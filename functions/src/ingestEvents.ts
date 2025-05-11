import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Client as NotionClient } from '@notionhq/client';
import {
  PageObjectResponse, 
  // PartialPageObjectResponse, // Unused import
  QueryDatabaseParameters,
  // GetPagePropertyResponse, // Unused import
} from '@notionhq/client/build/src/api-endpoints';
import puppeteer, { Page } from 'puppeteer-core';
import { ExtractedEvent } from './types'; // Assuming ExtractedEvent is defined in types.ts

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

function getNotionDatabaseId(urlInput: string): string | null {
  try {
    const urlObj = new URL(urlInput);
    const pathnameParts = urlObj.pathname.split('/').filter(Boolean);
    if (urlObj.hostname === 'www.notion.so' && pathnameParts.length >= 1) {
        const potentialDbId = pathnameParts[pathnameParts.length - 1].split('?')[0];
        if (potentialDbId && potentialDbId.length === 32 && /^[a-f0-9]+$/.test(potentialDbId)) {
            return potentialDbId;
        }
    }
  } catch (e) {
    console.warn('Could not parse Notion Database ID from URL:', urlInput, e);
  }
  return null;
}

function getNotionPropertyValue(page: PageObjectResponse, propertyName: string, propertyType: 'title' | 'rich_text' | 'url' | 'date'): string | null {
    if (!page.properties || !page.properties[propertyName]) return null;
    const prop = page.properties[propertyName];
    if (propertyType === 'title' && prop.type === 'title') return prop.title?.[0]?.plain_text || null;
    if (propertyType === 'rich_text' && prop.type === 'rich_text') return prop.rich_text?.[0]?.plain_text || null;
    if (propertyType === 'url' && prop.type === 'url') return prop.url || null;
    if (propertyType === 'date' && prop.type === 'date') return prop.date?.start || null;
    return null;
}

export const ingestEvents = functions.runWith({ 
  timeoutSeconds: 300,
  memory: '1GB'
}).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }
  const uid = context.auth.uid;
  const pageUrlInput = data.url as string | undefined;
  if (!pageUrlInput) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "url" argument.');
  }
  console.log(`User ${uid} requested ingestion for URL: ${pageUrlInput}`);
  
  let processedEvents: ExtractedEvent[] = [];

  const notionApiKey = functions.config().notion?.api_token as string | undefined;
  const notionDbId = getNotionDatabaseId(pageUrlInput);

  if (notionDbId && notionApiKey) {
    console.log(`Attempting to fetch events from Notion DB: ${notionDbId}`);
    const notion = new NotionClient({ auth: notionApiKey });
    try {
      const queryParams: QueryDatabaseParameters = { database_id: notionDbId };
      const response = await notion.databases.query(queryParams);
      
      const mappedResults: (ExtractedEvent | null)[] = response.results.map((pageResult) => {
        if (!('properties' in pageResult)) { 
            console.warn('Skipping partial page object from Notion results:', pageResult.id);
            return null; 
        }
        const page = pageResult as PageObjectResponse;
        const title = getNotionPropertyValue(page, 'Name', 'title');
        const url = getNotionPropertyValue(page, 'URL', 'url');
        const date = getNotionPropertyValue(page, 'Date', 'date');
        if (!title || !url) return null; // Ensure essential fields are present

        return {
          title: title,
          url: url,
          date: date ? new Date(date).toISOString() : new Date().toISOString(),
          source: 'Notion' as const,
        };
      });
      processedEvents = mappedResults.filter((event): event is ExtractedEvent => event !== null);
      console.log(`Fetched ${processedEvents.length} events from Notion.`);
    } catch (error) {
      console.error('Error fetching from Notion API:', error);
      if (error instanceof Error) {
        throw new functions.https.HttpsError('internal', `Failed to fetch from Notion: ${error.message}`);
      }
      throw new functions.https.HttpsError('internal', 'Failed to fetch data from Notion.');
    }
  } else {
    console.log(`Not a Notion DB URL or API key/DB ID missing. Falling back to HTML crawler for URL: ${pageUrlInput}`);
    let browser = null;
    try {
      browser = await getBrowser();
      const page: Page = await browser.newPage();
      await page.goto(pageUrlInput, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 3000));

      const eventLinks = await page.evaluate(() => {
        const eventsOutput: { title: string; url: string }[] = [];
        const eventSectionHeaders = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(
            el => el.textContent?.toLowerCase().includes('event') || el.textContent?.toLowerCase().includes('upcoming')
        );
        let searchContext: HTMLElement = document.body;
        if(eventSectionHeaders.length > 0) {
            const firstHeader = eventSectionHeaders[0] as HTMLElement;
            let parent = firstHeader.parentElement;
            for(let i=0; i<5 && parent; i++) {
                if(parent.querySelectorAll('a[href^="http"]').length > 3) {
                    searchContext = parent as HTMLElement;
                    break;
                }
                parent = parent.parentElement;
            }
        }
        const links = Array.from(searchContext.querySelectorAll('a[href^="http"]')) as HTMLAnchorElement[];
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
          source: 'HTMLCrawler' as const 
        }));
      console.log(`Crawled ${processedEvents.length} potential events from HTML.`);
    } catch (error) {
      console.error('Error during Puppeteer crawling:', error);
      if (error instanceof Error) {
        throw new functions.https.HttpsError('internal', `Failed to crawl: ${error.message}`);
      }
      throw new functions.https.HttpsError('internal', 'Failed to crawl the HTML page for events.');
    } finally {
      if (browser) await browser.close();
    }
  }

  if (processedEvents.length === 0) {
    return { message: 'No events found from the provided URL.', eventIds: [] };
  }

  const batch = admin.firestore().batch();
  const eventIds: string[] = [];
  try {
    for (const event of processedEvents) {
      const eventId = `evt_${admin.firestore().collection('tmp').doc().id}`;
      const eventRef = admin.firestore().doc(`users/${uid}/events/${eventId}`);
      batch.set(eventRef, {
        ...event,
        originalIngestionUrl: pageUrlInput,
        status: 'pending_schema',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userId: uid,
      });
      eventIds.push(eventId);
    }
    await batch.commit();
    console.log(`Successfully saved ${eventIds.length} events to Firestore for user ${uid}.`);
    return { 
        message: `Successfully ingested ${eventIds.length} events. Schema discovery will follow.`, 
        eventIds 
    };
  } catch (error) {
    console.error('Error saving events to Firestore:', error);
    if (error instanceof Error) {
        throw new functions.https.HttpsError('internal', `DB save error: ${error.message}`);
    }
    throw new functions.https.HttpsError('internal', 'Failed to save extracted events.');
  }
});
