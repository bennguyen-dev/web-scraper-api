import { Request, Response } from "express";
import { getInfo } from "../services/scraper.service";

export async function scrapeUrl(req: Request, res: Response) {
  const result = await getInfo({ url: req.body.url });
  res.status(result.status).json(result);
}
