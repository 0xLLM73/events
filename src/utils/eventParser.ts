/**
 * Utility functions for parsing event data from HTML
 */

import { v4 as uuidv4 } from 'uuid';

export interface ParsedEvent {
  id: string;
  title: string;
  url: string;
  date?: string;
  source: string;
  status: 'pending_schema';
  statusReason: string;
  createdAt: Date;
}

/**
 * Extract event data from HTML content
 */
export const parseEventsFromHtml = (html: string, sourceUrl: string): ParsedEvent[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Extract page title
  const pageTitle = doc.title || 'Unknown Event';
  
  // Look for event information in the page
  // This is a simplified version - in a real implementation, you'd have more sophisticated parsing
  const events: ParsedEvent[] = [];
  
  // Create a single event from the page
  const event: ParsedEvent = {
    id: uuidv4(),
    title: pageTitle,
    url: sourceUrl,
    source: new URL(sourceUrl).hostname,
    status: 'pending_schema',
    statusReason: 'Event ingested, waiting for schema discovery',
    createdAt: new Date()
  };
  
  // Try to find a date in the page
  const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]+ \d{1,2},? \d{4}/g;
  const dateMatches = html.match(dateRegex);
  if (dateMatches && dateMatches.length > 0) {
    event.date = dateMatches[0];
  }
  
  events.push(event);
  return events;
};

/**
 * Fetch HTML content from a URL using a CORS proxy
 */
export const fetchHtml = async (url: string): Promise<string> => {
  // Use a reliable CORS proxy
  const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  
  try {
    const response = await fetch(corsProxyUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
        console.warn(`Expected HTML but got ${contentType} from ${url}`);
        // Allow processing non-html content for now, but log a warning
    }

    return await response.text();
  } catch (error) {
    console.error(`Error fetching URL ${url} via CORS proxy:`, error);
    throw new Error(`Could not fetch content from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
