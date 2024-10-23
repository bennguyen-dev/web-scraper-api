import { Page } from "puppeteer";
import { IGetInfo, IGetInfoResponse, IResponse } from "../types";
import { getBlocker, initBrowser } from "../utils/browser";
import { getUrlWithProtocol } from "../utils/url";
import { config } from "../config/config";

export async function getInfo({
  url,
}: IGetInfo): Promise<IResponse<IGetInfoResponse | null>> {
  const startTime = process.hrtime();
  const urlWithProtocol = getUrlWithProtocol(url);
  const host = new URL(urlWithProtocol).host;

  let page: Page | null = null;

  try {
    const browser = await initBrowser();
    const blocker = await getBlocker();

    page = await browser.newPage();

    if (!page) {
      throw new Error("Failed to create new page");
    }

    await page.setCacheEnabled(false);
    await page.setRequestInterception(true);

    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (
        req.url().includes("google-analytics") ||
        req.url().includes("doubleclick.net")
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.3",
    );

    await blocker.enableBlockingInPage(page);

    const response = await page.goto(urlWithProtocol, {
      waitUntil: "networkidle0",
      timeout: config.pageTimeout,
    });

    if (!response || !response.ok()) {
      throw new Error("Failed to load page");
    }

    const [title, description, ogImage, bodyContentExist] = await Promise.all([
      page.title().catch(() => undefined),
      page
        .$eval('meta[name="description"]', (el) => el.getAttribute("content"))
        .catch(() => undefined),
      page
        .$eval('meta[property="og:image"]', (el) => el.getAttribute("content"))
        .catch(() => undefined),
      page
        .evaluate(
          () => document.body && document.body.innerHTML.trim().length > 0,
        )
        .catch(() => undefined),
    ]);

    if (!bodyContentExist) {
      throw new Error(`No body content found on page: ${url}`);
    }

    const screenshot = await page
      .screenshot({
        optimizeForSpeed: true,
        fullPage: false,
        encoding: "binary",
        type: "png",
      })
      .catch((err) => {
        console.error("Error taking screenshot:", err);
        return undefined;
      });

    const absoluteOgImage =
      ogImage && ogImage.startsWith("http")
        ? ogImage
        : ogImage
          ? new URL(ogImage, urlWithProtocol).href
          : undefined;

    const endTime = process.hrtime(startTime);
    console.log(`Execution time: ${endTime[0]}s ${endTime[1] / 1000000}ms`);

    return {
      status: 200,
      message: "Info fetched successfully",
      data: {
        url: urlWithProtocol,
        screenshot: screenshot ? Buffer.from(screenshot) : undefined,
        title,
        description: description || undefined,
        ogImage: absoluteOgImage,
      },
    };
  } catch (error) {
    console.error("Error generating page info:", error);
    return {
      status: 500,
      message: error instanceof Error ? error.message : "Internal Server Error",
      data: null,
    };
  } finally {
    if (page && !page.isClosed()) {
      await page.close().catch(console.error);
    }
  }
}
