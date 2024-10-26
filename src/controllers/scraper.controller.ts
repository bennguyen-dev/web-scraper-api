import { Request, Response } from "express";
import { getInfo, getInternalLinks } from "../services/scraper.service";

export async function scrapeInfo(req: Request, res: Response) {
  const result = await getInfo({ url: req.body.url });
  res.status(result.status).json(result);
}

export async function scrapeInternalLinks(req: Request, res: Response) {
  const result = await getInternalLinks({
    url: req.body.url,
    limit: req.body.limit,
  });
  res.status(result.status).json(result);
}
