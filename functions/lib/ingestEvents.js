"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestEvents = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const client_1 = require("@notionhq/client");
const puppeteer_1 = __importDefault(require("puppeteer"));
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
            '--disable-gpu'
        ],
    });
}
function getNotionDatabaseId(urlInput) {
    try {
        const urlObj = new URL(urlInput);
        const pathnameParts = urlObj.pathname.split('/').filter(Boolean);
        if (urlObj.hostname === 'www.notion.so' && pathnameParts.length >= 1) {
            const potentialDbId = pathnameParts[pathnameParts.length - 1].split('?')[0];
            if (potentialDbId && potentialDbId.length === 32 && /^[a-f0-9]+$/.test(potentialDbId)) {
                return potentialDbId;
            }
        }
    }
    catch (e) {
        console.warn('Could not parse Notion Database ID from URL:', urlInput, e);
    }
    return null;
}
function getNotionPropertyValue(page, propertyName, propertyType) {
    if (!page.properties || !page.properties[propertyName])
        return null;
    const prop = page.properties[propertyName];
    if (propertyType === 'title' && prop.type === 'title')
        return prop.title?.[0]?.plain_text || null;
    if (propertyType === 'rich_text' && prop.type === 'rich_text')
        return prop.rich_text?.[0]?.plain_text || null;
    if (propertyType === 'url' && prop.type === 'url')
        return prop.url || null;
    if (propertyType === 'date' && prop.type === 'date')
        return prop.date?.start || null;
    return null;
}
exports.ingestEvents = (0, https_1.onCall)({
    timeoutSeconds: 540,
    memory: '2GiB'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be logged in to ingest events.');
    }
    const { url } = request.data;
    if (!url) {
        throw new https_1.HttpsError('invalid-argument', 'URL is required');
    }
    console.log(`User ${request.auth.uid} requested ingestion for URL: ${url}`);
    let processedEvents = [];
    // For now, let's skip the Notion API integration since we're having issues with the API token
    // and focus on the HTML crawling approach which doesn't require external API keys
    const notionApiKey = undefined; // Skip Notion API for now
    console.log('Skipping Notion API integration and using HTML crawler instead');
    const notionDbId = getNotionDatabaseId(url);
    if (notionDbId && notionApiKey) {
        console.log(`Attempting to fetch events from Notion DB: ${notionDbId}`);
        const notion = new client_1.Client({ auth: notionApiKey });
        try {
            const queryParams = { database_id: notionDbId };
            const response = await notion.databases.query(queryParams);
            const mappedResults = response.results.map((pageResult) => {
                if (!('properties' in pageResult)) {
                    console.warn('Skipping partial page object from Notion results:', pageResult.id);
                    return null;
                }
                const page = pageResult;
                const title = getNotionPropertyValue(page, 'Name', 'title');
                const url = getNotionPropertyValue(page, 'URL', 'url');
                const date = getNotionPropertyValue(page, 'Date', 'date');
                if (!title || !url)
                    return null; // Ensure essential fields are present
                return {
                    title: title,
                    url: url,
                    date: date ? new Date(date).toISOString() : new Date().toISOString(),
                    source: 'Notion',
                };
            });
            processedEvents = mappedResults.filter((event) => event !== null);
            console.log(`User ${request.auth.uid} found ${processedEvents.length} events on page ${url}`);
        }
        catch (error) {
            console.error('Error fetching from Notion API:', error);
            if (error instanceof Error) {
                throw new https_1.HttpsError('internal', `Failed to fetch from Notion: ${error.message}`);
            }
            throw new https_1.HttpsError('internal', 'Failed to fetch page');
        }
    }
    else {
        console.log(`Not a Notion DB URL or API key/DB ID missing. Falling back to HTML crawler for URL: ${url}`);
        let browser = null;
        try {
            browser = await getBrowser();
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
            await new Promise(r => setTimeout(r, 3000));
            const eventLinks = await page.evaluate(() => {
                const eventsOutput = [];
                const eventSectionHeaders = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(el => el.textContent?.toLowerCase().includes('event') || el.textContent?.toLowerCase().includes('upcoming'));
                let searchContext = document.body;
                if (eventSectionHeaders.length > 0) {
                    const firstHeader = eventSectionHeaders[0];
                    let parent = firstHeader.parentElement;
                    for (let i = 0; i < 5 && parent; i++) {
                        if (parent.querySelectorAll('a[href^="http"]').length > 3) {
                            searchContext = parent;
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
                const links = Array.from(searchContext.querySelectorAll('a[href^="http"]'));
                links.forEach(linkEl => {
                    const linkText = linkEl.textContent?.trim();
                    if (linkEl.href && linkText && linkText.length > 5 && !linkEl.href.includes('#')) {
                        eventsOutput.push({ title: linkText, url: linkEl.href });
                    }
                });
                return eventsOutput;
            });
            processedEvents = eventLinks.map(link => ({
                ...link,
                date: new Date().toISOString(),
                source: 'HTMLCrawler'
            }));
            console.log(`Crawled ${processedEvents.length} potential events from HTML.`);
        }
        catch (error) {
            console.error('Error during Puppeteer crawling:', error);
            if (error instanceof Error) {
                throw new https_1.HttpsError('internal', `Failed to crawl: ${error.message}`);
            }
            throw new https_1.HttpsError('internal', 'Failed to crawl the HTML page for events.');
        }
        finally {
            if (browser)
                await browser.close();
        }
    }
    if (processedEvents.length === 0) {
        return { message: 'No events found from the provided URL.', eventIds: [] };
    }
    const db = (0, firestore_1.getFirestore)((0, app_1.getApp)());
    const batch = db.batch();
    const eventIds = [];
    try {
        for (const event of processedEvents) {
            // Generate a unique ID for the event
            const eventId = `evt_${db.collection('tmp').doc().id}`;
            const eventRef = db.doc(`users/${request.auth.uid}/events/${eventId}`);
            batch.set(eventRef, {
                ...event,
                originalIngestionUrl: url,
                status: 'pending_schema',
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                userId: request.auth.uid,
            });
            eventIds.push(eventId);
        }
        await batch.commit();
        console.log(`Successfully saved ${processedEvents.length} events for user ${request.auth.uid} from ${url}`);
        return {
            message: `Successfully ingested ${eventIds.length} events. Schema discovery will follow.`,
            eventIds
        };
    }
    catch (error) {
        console.error('Error saving events to Firestore:', error);
        if (error instanceof Error) {
            throw new https_1.HttpsError('internal', `DB save error: ${error.message}`);
        }
        throw new https_1.HttpsError('internal', 'Failed to save extracted events.');
    }
});
//# sourceMappingURL=ingestEvents.js.map