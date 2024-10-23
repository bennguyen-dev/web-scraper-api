import rateLimit from "express-rate-limit";
import { config } from "../config/config";

export const limiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: {
    status: 429,
    message: "Too many requests, please try again later.",
    data: null,
  },
});
