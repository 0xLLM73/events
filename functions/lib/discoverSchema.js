"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverSchema = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const puppeteer_1 = __importDefault(require("puppeteer")); // Import Page type
async function getBrowser() {
    return puppeteer_1.default.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
    });
}
exports.discoverSchema = (0, firestore_1.onDocumentCreated)({
    document: 'users/{userId}/events/{eventId}',
    timeoutSeconds: 540,
    memory: '2GiB'
}, async (event) => {
    const db = (0, firestore_2.getFirestore)((0, app_1.getApp)());
    const eventData = event.data?.data();
    const { userId, eventId } = event.params;
    if (!eventData || !eventData.url) {
        console.log(`Event ${eventId} for user ${userId} has no URL, skipping schema discovery.`);
        const eventRef = db.doc(`users/${userId}/events/${eventId}`); // Changed from uid to userId
        await eventRef.update({ status: 'schema_failed', statusReason: 'Missing URL' });
        return null;
    }
    const eventUrl = eventData.url;
    console.log(`No schema found for event ${eventId} (user: ${userId}) at URL: ${eventUrl}`); // Changed from uid to userId
    const eventRef = db.doc(`users/${userId}/events/${eventId}`); // Changed from uid to userId
    await eventRef.update({ status: 'processing_schema', statusReason: 'Starting schema discovery' });
    let browser = null;
    try {
        browser = await getBrowser();
        const page = await browser.newPage(); // Explicitly type page
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36');
        await page.setDefaultNavigationTimeout(90000);
        await page.setRequestInterception(true);
        // Handle SSL and CORS issues
        page.on('request', request => {
            const headers = request.headers();
            headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
            headers['Accept-Language'] = 'en-US,en;q=0.5';
            headers['Accept-Encoding'] = 'gzip, deflate, br';
            request.continue({ headers });
        });
        console.log(`Navigating to ${eventUrl}...`);
        const response = await page.goto(eventUrl, {
            waitUntil: 'networkidle2',
            timeout: 90000
        });
        if (!response) {
            throw new Error('Failed to get response from page');
        }
        const status = response.status();
        console.log(`Page response status: ${status}`);
        if (status >= 400) {
            throw new Error(`Page returned error status: ${status}`);
        }
        // Try to find and click any "Apply" buttons or links
        console.log('Looking for apply buttons and links...');
        await page.evaluate(() => {
            function clickElement(el) {
                try {
                    el.click();
                    console.log('Clicked element:', el.tagName, el.getAttribute('class') || '');
                }
                catch (e) {
                    console.error('Error clicking element:', e);
                }
            }
            // Find and click request/join/apply buttons
            const applyElements = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'))
                .filter(el => {
                const text = (el.textContent || '').toLowerCase();
                const value = (el instanceof HTMLInputElement ? el.value : '').toLowerCase();
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                const href = (el instanceof HTMLAnchorElement ? el.href : '').toLowerCase();
                const dataAttrs = Array.from(el.attributes)
                    .filter(attr => attr.name.startsWith('data-'))
                    .map(attr => attr.value.toLowerCase());
                return text.includes('request') ||
                    text.includes('join') ||
                    text.includes('apply') ||
                    text.includes('submit') ||
                    text.includes('register') ||
                    value.includes('request') ||
                    value.includes('join') ||
                    value.includes('apply') ||
                    value.includes('submit') ||
                    value.includes('register') ||
                    ariaLabel.includes('request') ||
                    ariaLabel.includes('join') ||
                    ariaLabel.includes('apply') ||
                    ariaLabel.includes('submit') ||
                    ariaLabel.includes('register') ||
                    href.includes('request') ||
                    href.includes('join') ||
                    href.includes('apply') ||
                    href.includes('submit') ||
                    href.includes('register') ||
                    dataAttrs.some(attr => attr.includes('request') ||
                        attr.includes('join') ||
                        attr.includes('apply') ||
                        attr.includes('register'));
            });
            console.log(`Found ${applyElements.length} potential apply elements`);
            applyElements.forEach(clickElement);
            // Find and click job cards
            const jobCards = Array.from(document.querySelectorAll('div, article, section, a'))
                .filter(el => {
                const text = (el.textContent || '').toLowerCase();
                const classes = el.className.toLowerCase();
                const id = (el.id || '').toLowerCase();
                const href = (el instanceof HTMLAnchorElement ? el.href : '').toLowerCase();
                return (classes.includes('job') ||
                    classes.includes('position') ||
                    classes.includes('listing') ||
                    id.includes('job') ||
                    id.includes('position') ||
                    id.includes('listing') ||
                    href.includes('job') ||
                    href.includes('position') ||
                    href.includes('listing')) &&
                    text.length > 0;
            });
            console.log(`Found ${jobCards.length} potential job cards`);
            jobCards.forEach(clickElement);
        });
        // Wait for any dynamic content to load after clicking
        await new Promise(r => setTimeout(r, 5000));
        // Wait for any dynamic content to load
        await new Promise(r => setTimeout(r, 5000));
        // Look for Luma-specific elements
        console.log('Looking for Luma-specific elements...');
        await page.evaluate(() => {
            // Look for request access form or modal
            const requestElements = Array.from(document.querySelectorAll('[class*="request"], [id*="request"], [class*="join"], [id*="join"]'));
            console.log(`Found ${requestElements.length} potential request/join elements`);
            requestElements.forEach(el => {
                try {
                    // Try to find any clickable elements within the request container
                    const clickables = el.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]');
                    if (clickables.length > 0) {
                        clickables.forEach(button => {
                            try {
                                button.click();
                                console.log('Clicked Luma request button:', button.tagName, button.getAttribute('class') || '');
                            }
                            catch (e) {
                                console.error('Error clicking Luma request button:', e);
                            }
                        });
                    }
                    else {
                        // If no clickable elements found, try clicking the container itself
                        el.click();
                        console.log('Clicked Luma request container:', el.tagName, el.getAttribute('class') || '');
                    }
                }
                catch (e) {
                    console.error('Error interacting with Luma request element:', e);
                }
            });
        });
        // Wait for any Luma-specific forms to load
        await new Promise(r => setTimeout(r, 5000));
        // Try to find iframes and switch to them if present
        const iframeHandles = await page.$$('iframe');
        let extractedForms = [];
        // First try the main page
        extractedForms = await page.evaluate(() => {
            const formsToReturn = [];
            document.querySelectorAll('form').forEach((formEl, formIndex) => {
                const currentFormSchema = {
                    id: formEl.id || `form-${formIndex}`,
                    action: formEl.action || undefined,
                    method: formEl.method || 'GET',
                    fields: [],
                };
                formEl.querySelectorAll('input, select, textarea').forEach((el, fieldIndex) => {
                    const fieldEl = el;
                    let fieldPlaceholder = undefined;
                    if (fieldEl instanceof HTMLInputElement || fieldEl instanceof HTMLTextAreaElement) {
                        fieldPlaceholder = fieldEl.placeholder || undefined;
                    }
                    const field = {
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
                        const selectElement = fieldEl;
                        field.options = Array.from(selectElement.options).map(opt => ({
                            value: opt.value,
                            text: opt.text,
                        }));
                    }
                    if (fieldEl.id) {
                        field.selector = `#${fieldEl.id.trim().replace(/\s+/g, '-')}`;
                    }
                    else if (fieldEl.name) {
                        field.selector = `[name="${fieldEl.name.trim().replace(/\s+/g, '-')}"]`;
                    }
                    else {
                        field.selector = `${fieldEl.tagName.toLowerCase()}:nth-of-type(${fieldIndex + 1})`;
                    }
                    currentFormSchema.fields.push(field);
                });
                formsToReturn.push(currentFormSchema);
            });
            return formsToReturn;
        });
        // If no forms found in main page, try each iframe
        // If no forms found, try looking for application-like elements
        if (extractedForms.length === 0) {
            console.log('No traditional forms found, looking for application-like elements...');
            const applicationForm = await page.evaluate(() => {
                // Look for elements that look like a form but aren't <form> elements
                const formLikeContainers = Array.from(document.querySelectorAll('div, section'))
                    .filter(el => {
                    const inputs = el.querySelectorAll('input, select, textarea').length > 0;
                    const classes = el.className.toLowerCase();
                    const id = (el.id || '').toLowerCase();
                    return inputs && (classes.includes('form') ||
                        classes.includes('apply') ||
                        classes.includes('application') ||
                        id.includes('form') ||
                        id.includes('apply') ||
                        id.includes('application'));
                });
                if (formLikeContainers.length > 0) {
                    const container = formLikeContainers[0];
                    const formSchema = {
                        id: container.id || 'application-form',
                        method: 'POST',
                        fields: [],
                    };
                    container.querySelectorAll('input, select, textarea').forEach((el, index) => {
                        const fieldEl = el;
                        let fieldPlaceholder = undefined;
                        if ('placeholder' in fieldEl) {
                            fieldPlaceholder = fieldEl.placeholder || undefined;
                        }
                        const field = {
                            name: fieldEl.name || fieldEl.id || `field-${index}`,
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
                        if (!labelText && fieldPlaceholder) {
                            labelText = fieldPlaceholder.trim();
                        }
                        if (!labelText) {
                            labelText = field.name;
                        }
                        field.label = labelText;
                        if (fieldEl.tagName === 'SELECT') {
                            const selectEl = fieldEl;
                            field.options = Array.from(selectEl.options).map(opt => ({
                                value: opt.value,
                                text: opt.text,
                            }));
                        }
                        if (fieldEl.id) {
                            field.selector = `#${fieldEl.id.trim().replace(/\s+/g, '-')}`;
                        }
                        else if (fieldEl.name) {
                            field.selector = `[name="${fieldEl.name.trim().replace(/\s+/g, '-')}"]`;
                        }
                        else {
                            field.selector = `${fieldEl.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
                        }
                        formSchema.fields.push(field);
                    });
                    return [formSchema];
                }
                return [];
            });
            if (applicationForm.length > 0) {
                console.log('Found application-like form structure');
                extractedForms = extractedForms.concat(applicationForm);
            }
        }
        // If still no forms found, try iframes
        if (extractedForms.length === 0 && iframeHandles.length > 0) {
            console.log(`No forms found in main page, checking ${iframeHandles.length} iframes...`);
            for (const frame of iframeHandles) {
                try {
                    const contentFrame = await frame.contentFrame();
                    if (!contentFrame)
                        continue;
                    console.log('Checking iframe for forms...');
                    const iframeForms = await contentFrame.evaluate(() => {
                        const formsToReturn = [];
                        document.querySelectorAll('form').forEach((formEl, formIndex) => {
                            const currentFormSchema = {
                                id: formEl.id || `form-${formIndex}`,
                                action: formEl.action || undefined,
                                method: formEl.method || 'GET',
                                fields: [],
                            };
                            formEl.querySelectorAll('input, select, textarea').forEach((el, fieldIndex) => {
                                const fieldEl = el;
                                let fieldPlaceholder = undefined;
                                if ('placeholder' in fieldEl) {
                                    fieldPlaceholder = fieldEl.placeholder || undefined;
                                }
                                const field = {
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
                                if (!labelText && fieldPlaceholder) {
                                    labelText = fieldPlaceholder.trim();
                                }
                                if (!labelText) {
                                    labelText = field.name;
                                }
                                field.label = labelText;
                                if (fieldEl.tagName === 'SELECT') {
                                    const selectEl = fieldEl;
                                    field.options = Array.from(selectEl.options).map(opt => ({
                                        value: opt.value,
                                        text: opt.text,
                                    }));
                                }
                                if (fieldEl.id) {
                                    field.selector = `#${fieldEl.id.trim().replace(/\s+/g, '-')}`;
                                }
                                else if (fieldEl.name) {
                                    field.selector = `[name="${fieldEl.name.trim().replace(/\s+/g, '-')}"]`;
                                }
                                else {
                                    field.selector = `${fieldEl.tagName.toLowerCase()}:nth-of-type(${fieldIndex + 1})`;
                                }
                                currentFormSchema.fields.push(field);
                            });
                            formsToReturn.push(currentFormSchema);
                        });
                        return formsToReturn;
                    });
                    if (iframeForms.length > 0) {
                        console.log(`Found ${iframeForms.length} forms in iframe`);
                        extractedForms = extractedForms.concat(iframeForms);
                    }
                }
                catch (error) {
                    console.error('Error checking iframe:', error);
                }
            }
        }
        // Clean up iframe handles
        await Promise.all(iframeHandles.map(handle => handle.dispose()));
        if (extractedForms.length === 0) {
            console.log(`No forms found on page ${eventUrl} for event ${eventId} (checked main page and ${iframeHandles.length} iframes)`);
            await event.data?.ref.update({ status: 'schema_failed', statusReason: 'No forms found on page' });
            return null;
        }
        const schemaToSave = {
            forms: extractedForms,
            discoveredAt: firestore_2.FieldValue.serverTimestamp(),
            sourceUrl: eventUrl,
        };
        const eventRef = db.doc(`users/${userId}/events/${eventId}`);
        await eventRef.collection('schema').doc('formSchema').set(schemaToSave);
        await eventRef.update({ status: 'pending_mapping', statusReason: 'Schema discovered, ready for mapping' });
        console.log(`Schema discovered and saved for event ${eventId}`);
        return null;
    }
    catch (error) {
        console.error(`Error discovering schema for event ${eventId} at ${eventUrl}:`, error);
        let errorMessage = 'Failed to discover schema.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        const eventRef = db.doc(`users/${userId}/events/${eventId}`);
        await eventRef.update({ status: 'schema_failed', statusReason: errorMessage.substring(0, 200) });
        return null;
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
});
//# sourceMappingURL=discoverSchema.js.map