const serverless = require('serverless-http');
const app = require('../../server'); // Import the Express app from the project root

// Export the serverless handler
module.exports.handler = serverless(app);
