import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import puppeteer, { Page } from 'puppeteer-core';
import { UserProfile, EventData, EventSchema, FieldMappings } from './types'; // Assuming a types.ts file

// Helper function to get a browser instance (can be shared)
async function getBrowser() {
  return puppeteer.launch({
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ],
  });
}

interface SignupTaskPayload {
  userId: string;
  eventId: string;
}

export const processSignupTask = functions.runWith({ 
  timeoutSeconds: 540, 
  memory: '2GB'
}).tasks
  .taskQueue({
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
    },
    rateLimits: {
      maxConcurrentDispatches: 5,
    },
  })
  .onDispatch(async (data) => {
    const { userId, eventId } = data as SignupTaskPayload;

    if (!userId || !eventId) {
      console.error('Invalid payload: userId or eventId missing.', data);
      return;
    }

    console.log(`Processing signup task for user ${userId}, event ${eventId}`);
    const eventRef = admin.firestore().doc(`users/${userId}/events/${eventId}`);

    let browser = null;
    try {
      await eventRef.update({ status: 'processing', statusReason: 'Task picked up, starting automation' });

      const userProfileSnap = await admin.firestore().doc(`users/${userId}`).get();
      const eventSnap = await eventRef.get();
      const schemaSnap = await eventRef.collection('schema').doc('formSchema').get();
      const mappingSnap = await admin.firestore().doc(`users/${userId}/mappings/${eventId}`).get();

      if (!userProfileSnap.exists) throw new Error('User profile not found.');
      if (!eventSnap.exists) throw new Error('Event data not found.');
      if (!schemaSnap.exists) throw new Error('Event schema not found.');
      if (!mappingSnap.exists) throw new Error('Field mapping not found.');

      const userProfile = userProfileSnap.data() as UserProfile;
      const eventData = eventSnap.data() as EventData;
      const eventSchema = schemaSnap.data() as EventSchema;
      const mappingData = mappingSnap.data();
      const fieldMappings = mappingData?.fieldMappings as FieldMappings | undefined;

      if (!eventData.url) throw new Error('Event URL missing in event data.');
      if (!eventSchema?.forms || eventSchema.forms.length === 0) throw new Error('No forms found in event schema.');
      if (!fieldMappings) throw new Error('No field mappings available.');

      browser = await getBrowser();
      const page: Page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });

      console.log(`Navigating to event URL: ${eventData.url}`);
      await page.goto(eventData.url, { waitUntil: 'networkidle2', timeout: 120000 });
      await new Promise(r => setTimeout(r, 3000)); // Replaced waitForTimeout

      const formToFill = eventSchema.forms[0];

      for (const schemaField of formToFill.fields) {
        const schemaFieldKey = schemaField.name || schemaField.label.replace(/\s+/g, '');
        const mappedValueInstruction = fieldMappings[schemaFieldKey];
        let valueToFill: string | boolean | undefined = undefined; // boolean for checkbox/radio

        if (mappedValueInstruction && mappedValueInstruction !== '__LEAVE_UNMAPPED__') {
          if (userProfile && mappedValueInstruction in userProfile) {
            valueToFill = userProfile[mappedValueInstruction as keyof UserProfile];
          } else if (mappedValueInstruction === '__CUSTOM_VALUE__') {
            console.warn(`Field ${schemaField.label} mapped to __CUSTOM_VALUE__ but not implemented. Skipping.`);
            continue;
          } else {
            valueToFill = mappedValueInstruction; // Assumed to be a custom literal value
          }
        }
        
        if (valueToFill === undefined && mappedValueInstruction !== '__LEAVE_UNMAPPED__') {
            console.warn(`No value found or resolved for schema field: ${schemaField.label} (key: ${schemaFieldKey}). Skipping.`);
            continue;
        }
        if (mappedValueInstruction === '__LEAVE_UNMAPPED__') {
            console.log(`Skipping field ${schemaField.label} as it was marked to be left unmapped.`);
            continue;
        }
        if(valueToFill === undefined) continue; // Should be caught by above, but as a safeguard

        console.log(`Attempting to fill field: ${schemaField.label || schemaField.name} with selector: ${schemaField.selector} with value: ${String(valueToFill).substring(0,30)}`);
        
        try {
            if (!schemaField.selector) {
                console.warn(`No selector for field ${schemaField.label}. Skipping.`);
                continue;
            }
            await page.waitForSelector(schemaField.selector, { timeout: 10000 });
            const fieldElement = await page.$(schemaField.selector);
            if (!fieldElement) {
                console.warn(`Could not find element with selector ${schemaField.selector} for field ${schemaField.label}`);
                continue;
            }

            if (schemaField.type === 'select') {
              await page.select(schemaField.selector, String(valueToFill));
            } else if (schemaField.type === 'checkbox' || schemaField.type === 'radio') {
              const targetValue = String(valueToFill).toLowerCase();
              if (targetValue === 'true' || targetValue === 'checked' || targetValue === 'on') {
                 await fieldElement.click();
              }
            } else {
              await fieldElement.click({ clickCount: 3 });
              await fieldElement.press('Backspace'); 
              await page.type(schemaField.selector, String(valueToFill), { delay: 50 });
            }
            await new Promise(r => setTimeout(r, 100));
        } catch (fieldError) {
            let fieldErrorMessage = 'Unknown error filling field.';
            if (fieldError instanceof Error) fieldErrorMessage = fieldError.message;
            console.warn(`Could not fill field ${schemaField.label} (selector: ${schemaField.selector}):`, fieldErrorMessage);
        }
      }
      
      console.log('All mapped fields processed. Attempting submit.');
      await new Promise(r => setTimeout(r, 2000));

      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '[role="button"][class*="submit"]' ,
        'button[id*="submit"]'
      ];
      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          const submitButton = await page.$(selector);
          if (submitButton && await submitButton.isIntersectingViewport()) {
            console.log(`Found submit button: ${selector}. Clicking.`);
            await submitButton.click();
            submitted = true;
            break;
          }
        } catch (e) { /* Try next selector */ }
      }

      if (!submitted) {
        console.warn('Could not find common submit button. Attempting direct form submission.');
        const formElementHandle = formToFill.id ? await page.$(`#${formToFill.id}`) : 
                                  formToFill.action ? await page.$(`form[action="${formToFill.action}"]`) : null;
        if (formElementHandle) {
            await page.evaluate(form => (form as HTMLFormElement).submit(), formElementHandle);
            submitted = true; 
            console.log('Direct form submission attempted.');
        } else {
            throw new Error('Form submission failed: No submit button or identifiable form found.');
        }
      }

      console.log('Form submission attempted. Waiting for navigation/confirmation...');
      try {
        await page.waitForNavigation({ timeout: 20000, waitUntil: 'networkidle0' });
        console.log('Navigation occurred after submission.');
      } catch (navError) {
        console.log('No navigation or timed out. Checking current page.');
      }
      
      await new Promise(r => setTimeout(r, 3000));

      const pageContent = await page.content();
      const hasRecaptcha = /recaptcha|g-recaptcha|turnstile|hcaptcha/i.test(pageContent);

      if (hasRecaptcha) {
        console.warn('CAPTCHA detected.');
        await eventRef.update({ status: 'needs_captcha', statusReason: 'CAPTCHA detected', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        const successKeywords = ['thank you', 'success', 'confirmation', 'registered', 'signed up', 'check your email'];
        const hasSuccessMessage = successKeywords.some(keyword => pageContent.toLowerCase().includes(keyword));
        if (hasSuccessMessage) {
            console.log('Success message detected.');
            await eventRef.update({ status: 'success', statusReason: 'Form submitted, success message detected.', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else {
            console.warn('Outcome unclear (no CAPTCHA or known success message).');
            // TODO: Implement screenshot logic here
            await eventRef.update({ status: 'failed', statusReason: 'Outcome unclear', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
      }
    } catch (error) {
      console.error(`Error processing signup for event ${eventId} (user: ${userId}):`, error);
      let errorMessage = 'Unknown error during signup processing.';
      if (error instanceof Error) errorMessage = error.message;
      try {
        await eventRef.update({ status: 'failed', statusReason: errorMessage.substring(0, 500), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      } catch (dbError) {
        console.error(`Failed to update error status for event ${eventId}:`, dbError);
      }
      throw error;
    } finally {
      if (browser) {
        console.log('Closing browser.');
        await browser.close();
      }
    }
  });

// It's good practice to define shared types in a separate file, e.g., functions/src/types.ts
// For now, I'll add them here for completeness if no types.ts was created.
// If you have a types.ts, these should be moved there and imported.
/*
export interface UserProfile {
  name?: string;
  email: string; // Usually from auth, non-optional
  phone?: string;
  organization?: string;
  dietaryRestrictions?: string;
  otherInfo?: string;
  [key: string]: any; // To allow other dynamic profile fields
}

export interface EventData {
  url: string;
  title?: string;
  date?: string;
  status?: string;
  // ... other event fields
}

export interface FormFieldSchema {
  name: string;
  id?: string;
  type: string;
  label: string;
  placeholder?: string;
  selector: string;
  options?: { value: string; text: string }[];
}

export interface EventFormSchema {
  id: string;
  action?: string;
  method?: string;
  fields: FormFieldSchema[];
}

export interface EventSchema {
  forms: EventFormSchema[];
  discoveredAt?: any; // Firestore Timestamp or Date
  sourceUrl?: string;
}

export interface FieldMappings {
  [schemaFieldKey: string]: string; // Maps schema field key to profile field key or custom value
}
*/
