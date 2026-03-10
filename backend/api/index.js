// Vercel Serverless Function Entry Point
let app;
try {
  app = require('../server.js');
} catch (err) {
  // If the app fails to load, expose the error for debugging
  app = (req, res) => {
    res.status(500).json({
      error: 'App failed to load',
      message: err.message,
      stack: err.stack
    });
  };
}
module.exports = app;
