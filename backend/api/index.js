const serverless = require('serverless-http');

let handler;
try {
  const app = require('../src/server');
  handler = serverless(app);
} catch (err) {
  console.error('Serverless init error:', err);
  // Export a simple handler that returns 500 so Vercel logs this clearly
  handler = async (req, res) => {
    console.error('Invocation after failed init:', err);
    res.status(500).json({ error: 'Server initialization failed', detail: String(err) });
  };
}

module.exports = handler;