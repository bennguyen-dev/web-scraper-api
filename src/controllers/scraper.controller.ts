import { Request, Response } from "express";
import { getInfo, getInternalLinks } from "../services/scraper.service";

export async function scrapeInfo(req: Request, res: Response) {
  const url = req.query.url as string;

  const result = await getInfo({ url });
  res.status(result.status).json(result);
}

export async function scrapeInternalLinks(req: Request, res: Response) {
  const url = req.query.url as string;
  const limit =
    typeof req.query.limit === "string"
      ? parseInt(req.query.limit, 10)
      : undefined;

  const result = await getInternalLinks({ url, limit });
  res.status(result.status).json(result);
}
