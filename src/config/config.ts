import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 100, // requests per window
  pageTimeout: 30000, // 30 seconds
  browserArgs: [
    "--hide-scrollbars",
    "--disable-web-security",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--single-process",
    '--proxy-server="direct://"',
    "--proxy-bypass-list=*",
  ],
};
