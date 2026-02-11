const serverless = require('serverless-http');
const app = require('../backend/src/server');

module.exports = serverless(app);
