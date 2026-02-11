const serverless = require('serverless-http');

let handler;

try {
  const app = require('../backend/src/server');
  handler = serverless(app);
} catch (err) {
  console.error('Failed to initialise Express app:', err);
  handler = async (req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server init failed', detail: String(err) }));
  };
}

module.exports = handler;
