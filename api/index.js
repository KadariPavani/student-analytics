const serverless = require('serverless-http');

let handler;

try {
  const app = require('../backend/src/server');
  handler = serverless(app, {
    // Forward request body correctly for POST/PUT/PATCH
    request: (request, event, context) => {
      // Ensure basePath is stripped so Express routes match
      request.url = request.url || event.path;
    },
  });
} catch (err) {
  console.error('Failed to initialise Express app:', err);
  handler = async (req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Server init failed',
        detail: String(err),
        stack: err.stack,
      })
    );
  };
}

module.exports = handler;
