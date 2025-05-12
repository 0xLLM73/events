// Test file for eventParser.ts
// We will add test cases here.

import { parseEventsFromHtml, fetchHtml, ParsedEvent } from '../eventParser';

describe('eventParser', () => {
  // Basic test to ensure the file is set up
  it('should exist', () => {
    expect(parseEventsFromHtml).toBeDefined();
    expect(fetchHtml).toBeDefined();
  });

  describe('fetchHtml', () => {
    // Mock global fetch
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    beforeEach(() => {
      // Reset mock before each test
      mockFetch.mockClear();
    });

    it('should fetch HTML successfully', async () => {
      const mockUrl = 'http://example.com';
      const mockHtmlContent = '<html><head><title>Test</title></head><body>Hello</body></html>';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'Content-Type': 'text/html' }),
        text: jest.fn().mockResolvedValueOnce(mockHtmlContent),
      });

      const result = await fetchHtml(mockUrl);

      expect(result).toBe(mockHtmlContent);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(mockUrl))); // Check if proxy URL is used
    });

    it('should throw an error if fetch fails', async () => {
      const mockUrl = 'http://example.com/fail';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(fetchHtml(mockUrl)).rejects.toThrow('Failed to fetch URL: 404 Not Found');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw an error on network issues', async () => {
      const mockUrl = 'http://example.com/network-error';
      const networkError = new Error('Network request failed');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(fetchHtml(mockUrl)).rejects.toThrow(`Could not fetch content from URL: ${networkError.message}`);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return content even if content-type is not HTML, but log a warning', async () => {
      const mockUrl = 'http://example.com/not-html';
      const mockTextContent = 'This is plain text.';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'Content-Type': 'text/plain' }),
        text: jest.fn().mockResolvedValueOnce(mockTextContent),
      });

      // Spy on console.warn
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await fetchHtml(mockUrl);

      expect(result).toBe(mockTextContent);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Expected HTML but got text/plain'));

      // Restore console.warn
      consoleWarnSpy.mockRestore();
    });
  });

  describe('parseEventsFromHtml', () => {
    it('should parse basic event data from HTML', () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test Event Title</title>
            <meta name="description" content="This is a test event description.">
          </head>
          <body>
            <p>Event Date: 2025-12-25</p>
            <span class="event-date">2025-12-25</span>
            <time datetime="2025-12-25T10:00:00">December 25th, 2025</time>
            <div id="event-details">Date is 2025-12-25</div>
          </body>
        </html>
      `;

      const mockUrl = 'http://example.com/event';

      const results: ParsedEvent[] = parseEventsFromHtml(mockHtml, mockUrl);

      // Expecting one event based on current logic
      expect(results).toHaveLength(1);

      const event = results[0];
      expect(event.title).toBe('Test Event Title');
      expect(event.url).toBe(mockUrl);
      expect(event.source).toBe('example.com');
      expect(event.status).toBe('pending_schema');
      // It should find the first date-like string
      expect(event.date).toBe('2025-12-25');
    });

    it('should return event with undefined date if no date is found', () => {
      const mockHtml = `
        <html>
          <head><title>Event Without Date</title></head>
          <body>Just some text</body>
        </html>
      `;
      const mockUrl = 'http://example.com/no-date';

      const results = parseEventsFromHtml(mockHtml, mockUrl);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Event Without Date');
      expect(results[0].date).toBeUndefined();
    });

    it('should use a default title if title tag is missing', () => {
      const mockHtml = `
        <html>
          <head></head>
          <body>Event Date: 2025-01-01</body>
        </html>
      `;
      const mockUrl = 'http://example.com/no-title';

      const results = parseEventsFromHtml(mockHtml, mockUrl);
      expect(results).toHaveLength(1);
      // The current implementation uses 'Unknown Event' as default
      expect(results[0].title).toBe('Unknown Event');
      expect(results[0].date).toBe('2025-01-01');
    });

    // TODO: Add more tests for different HTML structures and edge cases
    // TODO: Add tests for missing data scenarios
  });
});
