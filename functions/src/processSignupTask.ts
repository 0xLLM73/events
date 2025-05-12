import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import * as admin from 'firebase-admin';
import puppeteer, { Page } from 'puppeteer';
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

export const processSignupTask = onTaskDispatched(
  {
    timeoutSeconds: 540,
    memory: '2GiB',

    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60
    }
  },
  async (task) => {
    const { userId, eventId } = task.data as SignupTaskPayload;

    if (!userId || !eventId) {
      console.error('Invalid payload: userId or eventId missing.', task.data);
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

      // Try to find and click the submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:not([type])',
        'input[type="button"]',
        'a.submit',
        'button.submit',
        '[role="button"][class*="submit"]',
        'button[id*="submit"]',
        // Common text-based selectors
        'button, input[type="button"], input[type="submit"], a'
      ];

      // First try exact matches
      const exactTextMatches = [
        'submit',
        'register',
        'sign up',
        'apply',
        'join',
        'request',
        'send',
        'continue',
      ];

      let submitButton = null;
      
      // Try exact text matches first
      for (const text of exactTextMatches) {
        if (submitButton) break;
        submitButton = await page.evaluate((text) => {
          const elements = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'));
          return elements.find(el => {
            const buttonText = (el.textContent || '').toLowerCase().trim();
            return buttonText === text;
          })?.outerHTML;
        }, text);
      }

      // If no exact match, try contains
      if (!submitButton) {
        submitButton = await page.evaluate((texts) => {
          const elements = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'));
          return elements.find(el => {
            const buttonText = (el.textContent || '').toLowerCase().trim();
            return texts.some(text => buttonText.includes(text));
          })?.outerHTML;
        }, exactTextMatches);
      }

      // If still no match, try CSS selectors
      if (!submitButton) {
        for (const selector of submitSelectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              submitButton = await page.evaluate(el => el.outerHTML, element);
              break;
            }
          } catch (e) {
            console.warn(`Error checking selector ${selector}:`, e);
          }
        }
      }

      if (!submitButton) {
        console.warn('No submit button found. Will try form.submit()');
        await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) (form as HTMLFormElement).submit();
        });
      } else {
        console.log('Found submit button:', submitButton);
        // Create a unique selector for the found button
        const buttonSelector = await page.evaluate((html) => {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          const button = tempDiv.firstElementChild;
          if (!button) return null;

          // Try to create a unique selector
          if (button.id) return `#${button.id}`;
          if (button.className) {
            const classes = button.className.split(' ').join('.');
            return `.${classes}`;
          }
          return button.tagName.toLowerCase();
        }, submitButton);

        if (buttonSelector) {
          try {
            await page.click(buttonSelector);
            console.log('Clicked submit button with selector:', buttonSelector);
          } catch (e) {
            console.warn('Error clicking submit button, trying evaluate:', e);
            await page.evaluate((html) => {
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = html;
              const button = tempDiv.firstElementChild;
              if (button) (button as HTMLElement).click();
            }, submitButton);
          }
        }
      }

      // Wait for navigation or check for success message
      try {
        await page.waitForNavigation({ timeout: 20000, waitUntil: 'networkidle0' });
        console.log('Navigation occurred after submission.');
      } catch (navError) {
        console.log('No navigation or timed out. Checking current page.');
      }

      // Check for success indicators
      const pageContent = await page.evaluate(() => document.body.textContent || '');
      const formStillExists = await page.evaluate(() => {
        const form = document.querySelector('form');
        return form !== null;
      });

      if (formStillExists) {
        const errorElements = await page.evaluate(() => {
          const errorSelectors = [
            '.error',
            '.alert-error',
            '.alert-danger',
            '[role="alert"]',
            '[aria-invalid="true"]'
          ];
          return errorSelectors.some(selector => document.querySelector(selector) !== null);
        });

        if (errorElements) {
          throw new Error('Form submission failed - error elements detected');
        }
      }

      const successKeywords = ['thank you', 'success', 'confirmation', 'registered', 'signed up', 'check your email'];
      const hasSuccessMessage = successKeywords.some((keyword: string) => pageContent.toLowerCase().includes(keyword));

      if (hasSuccessMessage) {
        console.log('Success message detected.');
        await eventRef.update({
          status: 'completed',
          statusReason: 'Successfully signed up for event',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        console.log('No explicit success message found, but no errors either. Marking as completed.');
        await eventRef.update({
          status: 'completed',
          statusReason: 'Form submitted without errors',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      console.error(`Error processing signup for event ${eventId} (user: ${userId}):`, error);
      let errorMessage = 'Unknown error during signup processing.';
      if (error instanceof Error) errorMessage = error.message;
      try {
        await eventRef.update({
          status: 'signup_failed',
          statusReason: errorMessage,
          error: error instanceof Error ? error.stack : String(error)
        });
      } catch (updateError) {
        console.error('Failed to update event status:', updateError);
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.warn('Error closing browser:', e);
        }
      }
    }
  });
