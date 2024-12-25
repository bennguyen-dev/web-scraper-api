import { Request, Response, NextFunction } from "express";
import { isValidUrl } from "../utils/url";

export function validateUrl(req: Request, res: Response, next: NextFunction) {
  const url = req.query?.url as string;

  if (!url) {
    return res.status(400).json({
      status: 400,
      message: "URL is required",
      data: null,
    });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({
      status: 400,
      message: "Invalid URL format",
      data: null,
    });
  }

  next();
}
