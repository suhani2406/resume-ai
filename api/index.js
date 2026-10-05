// Vercel serverless entry point. Reuses the exact same route logic as
// server/local.js via createApp() — no more duplicated server code.
const { createApp } = require("../server/app");

module.exports = createApp({ serveClient: false });
