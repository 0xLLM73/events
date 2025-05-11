const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Test Proxy Rule
  app.use(
    '/test-proxy',
    createProxyMiddleware({
      target: 'http://jsonplaceholder.typicode.com', // Public test API
      changeOrigin: true,
      pathRewrite: { '^\/test-proxy': '' }, // remove /test-proxy prefix
      logLevel: 'debug',
      onError: function(err, req, res) {
        console.error('[Proxy Error - TestProxy]:', err);
        if (res && res.writeHead && !res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        if (res && res.end) {
            res.end('Proxy Error occurred for TestProxy: ' + err.message);
        }
      }
    })
  );

  // Proxy Firestore Emulator requests
  app.use(
    '/google.firestore.v1.Firestore',
    createProxyMiddleware({
      target: 'http://127.0.0.1:8080',
      changeOrigin: true,
      ws: true,
      logLevel: 'debug',
      onError: function(err, req, res) {
        console.error('[Proxy Error - Firestore]:', err);
        if (res && res.writeHead && !res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        if (res && res.end) {
            res.end('Proxy Error occurred for Firestore: ' + err.message);
        }
      }
    })
  );

  // Proxy Functions Emulator requests
  app.use(
    '/functions-api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:5001',
      changeOrigin: true,
      pathRewrite: { '^\/functions-api': '/' },
      logLevel: 'debug',
      onError: function(err, req, res) {
        console.error('[Proxy Error - Functions]:', err);
        if (res && res.writeHead && !res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        if (res && res.end) {
            res.end('Proxy Error occurred for Functions: ' + err.message);
        }
      }
    })
  );
  console.log('Development proxy server configured with /test-proxy, Firestore, and Functions emulators.');
};
