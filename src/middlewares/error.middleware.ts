import { Request, Response, NextFunction } from "express";

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error("Error:", error);

  res.status(500).json({
    status: 500,
    message: error.message || "Internal Server Error",
    data: null,
  });
}
