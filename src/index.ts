import express from "express";
import cors from "cors";
import { config } from "./config/config";
import { limiter } from "./middlewares/rateLimiter.middleware";
import { validateUrl } from "./middlewares/validator.middleware";
import { errorHandler } from "./middlewares/error.middleware";
import {
  scrapeInfo,
  scrapeInternalLinks,
} from "./controllers/scraper.controller";

const app = express();

app.use(express.json());
app.use(cors());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// API routes
app.get("/api/scrape-info", limiter, validateUrl, scrapeInfo);
app.get(
  "/api/scrape-internal-links",
  limiter,
  validateUrl,
  scrapeInternalLinks,
);

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});
