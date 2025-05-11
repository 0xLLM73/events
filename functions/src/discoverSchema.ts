import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import puppeteer, { Page } from 'puppeteer-core'; // Import Page type

// Define interfaces for schema clarity
interface FormField {
  name: string;
  id?: string;
  type: string;
  label: string;
  placeholder?: string;
  options?: { value: string; text: string }[];
  selector: string;
}

interface FormSchema {
  id: string;
  action?: string;
  method?: string;
  fields: FormField[];
}

interface EventSchemaToSave {
  forms: FormSchema[];
  discoveredAt: admin.firestore.FieldValue;
  sourceUrl: string;
}

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

export const discoverSchema = functions.runWith({ 
  timeoutSeconds: 300,
  memory: '1GB'
}).firestore
  .document('/users/{uid}/events/{eventId}')
  .onCreate(async (snap, context) => {
    const eventData = snap.data();
    const { uid, eventId } = context.params;

    if (!eventData || !eventData.url) {
      console.log(`Event ${eventId} for user ${uid} has no URL, skipping schema discovery.`);
      await snap.ref.update({ status: 'schema_failed', statusReason: 'Missing URL' });
      return null;
    }

    const eventUrl = eventData.url as string;
    console.log(`Discovering schema for event ${eventId} (user: ${uid}) at URL: ${eventUrl}`);
    await snap.ref.update({ status: 'processing_schema', statusReason: 'Starting schema discovery' });

    let browser = null;
    try {
      browser = await getBrowser();
      const page: Page = await browser.newPage(); // Explicitly type page
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36');
      await page.goto(eventUrl, { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise(r => setTimeout(r, 5000));

      const extractedForms: FormSchema[] = await page.evaluate(() => {
        const formsToReturn: FormSchema[] = [];
        document.querySelectorAll('form').forEach((formEl, formIndex) => {
          const currentFormSchema: FormSchema = {
            id: formEl.id || `form-${formIndex}`,
            action: formEl.action || undefined,
            method: formEl.method || 'GET',
            fields: [],
          };

          formEl.querySelectorAll('input, select, textarea').forEach((el, fieldIndex) => {
            const fieldEl = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            
            let fieldPlaceholder: string | undefined = undefined;
            if (fieldEl instanceof HTMLInputElement || fieldEl instanceof HTMLTextAreaElement) {
                fieldPlaceholder = fieldEl.placeholder || undefined;
            }

            const field: FormField = {
              name: fieldEl.name || fieldEl.id || `field-${formIndex}-${fieldIndex}`,
              id: fieldEl.id || undefined,
              type: fieldEl.type ? fieldEl.type.toLowerCase() : fieldEl.tagName.toLowerCase(),
              label: '',
              placeholder: fieldPlaceholder,
              options: [],
              selector: '' 
            };

            let labelText = '';
            if (fieldEl.labels && fieldEl.labels.length > 0) {
              labelText = fieldEl.labels[0].textContent?.trim() || '';
            }
            if (!labelText && fieldEl.id) {
              const labelForEl = document.querySelector(`label[for="${fieldEl.id}"]`);
              if (labelForEl) {
                labelText = labelForEl.textContent?.trim() || '';
              }
            }
            if (!labelText) {
                labelText = fieldEl.getAttribute('aria-label')?.trim() || '';
            }
            if (!labelText) {
                labelText = fieldEl.title?.trim() || '';
            }
            // Use fieldPlaceholder (which is safely accessed) for label fallback
            if (!labelText && fieldPlaceholder) { 
                labelText = fieldPlaceholder.trim();
            }
             if (!labelText) { 
                labelText = field.name;
            }
            field.label = labelText;

            if (fieldEl.tagName === 'SELECT') {
              const selectElement = fieldEl as HTMLSelectElement;
              field.options = Array.from(selectElement.options).map(opt => ({
                value: opt.value,
                text: opt.text,
              }));
            }
            
            if (fieldEl.id) {
                field.selector = `#${fieldEl.id.trim().replace(/\s+/g, '-')}`;
            } else if (fieldEl.name) {
                field.selector = `[name="${fieldEl.name.trim().replace(/\s+/g, '-')}"]`;
            } else { 
                field.selector = `${fieldEl.tagName.toLowerCase()}:nth-of-type(${fieldIndex + 1})`;
            }

            currentFormSchema.fields.push(field);
          });
          formsToReturn.push(currentFormSchema);
        });
        return formsToReturn;
      });

      if (extractedForms.length === 0) {
        console.log(`No forms found on page ${eventUrl} for event ${eventId}`);
        await snap.ref.update({ status: 'schema_failed', statusReason: 'No forms found on page' });
        return null;
      }

      const schemaToSave: EventSchemaToSave = {
        forms: extractedForms,
        discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
        sourceUrl: eventUrl,
      };

      await snap.ref.collection('schema').doc('formSchema').set(schemaToSave);
      await snap.ref.update({ status: 'pending_mapping', statusReason: 'Schema discovered, ready for mapping' });
      console.log(`Schema discovered and saved for event ${eventId}`);
      return null;

    } catch (error) {
      console.error(`Error discovering schema for event ${eventId} at ${eventUrl}:`, error);
      let errorMessage = 'Failed to discover schema.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      await snap.ref.update({ status: 'schema_failed', statusReason: errorMessage.substring(0, 200) });
      return null;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });
