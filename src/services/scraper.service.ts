import { Page } from "puppeteer";
import {
  IGetInfo,
  IGetInfoResponse,
  IGetInternalLinks,
  IGetInternalLinksResponse,
  IResponse,
} from "../types";
import { getBlocker, initBrowser } from "../utils/browser";
import { getUrlWithProtocol, normalizePath } from "../utils/url";
import { config } from "../config/config";

export async function getInfo({
  url,
}: IGetInfo): Promise<IResponse<IGetInfoResponse | null>> {
  const startTime = process.hrtime();
  const urlWithProtocol = getUrlWithProtocol(url);

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
      waitUntil: "networkidle2",
      timeout: config.pageTimeout,
    });

    if (!response || !response.ok()) {
      throw new Error(`Failed to load page`);
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
      throw new Error(`No body content found on page`);
    }

    // wait 3 seconds for page to load content before taking screenshot
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const screenshot = await page
      .screenshot({
        optimizeForSpeed: true,
        fullPage: false,
        encoding: "binary",
        type: "png",
      })
      .catch((err) => {
        console.error(`Error taking screenshot for ${url}:`, err);
        return undefined;
      });

    const absoluteOgImage =
      ogImage && ogImage.startsWith("http")
        ? ogImage
        : ogImage
          ? new URL(ogImage, urlWithProtocol).href
          : undefined;

    const endTime = process.hrtime(startTime);
    console.log(
      `Execution time get info ${url}: ${endTime[0]}s ${endTime[1] / 1000000}ms`,
    );

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
    console.error(`Error getting info page ${url}:`, error);
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

export async function getInternalLinks({
  url,
  limit = 100,
}: IGetInternalLinks): Promise<IResponse<IGetInternalLinksResponse | null>> {
  const startTime = process.hrtime();
  const urlWithProtocol = getUrlWithProtocol(url);
  let page: Page | null = null;

  try {
    const baseUrl = new URL(urlWithProtocol);
    const hostname = baseUrl.hostname;
    const origin = baseUrl.origin;

    const browser = await initBrowser();

    page = await browser.newPage();

    if (!page) {
      throw new Error("Failed to create new page");
    }

    // Performance optimizations
    await Promise.all([
      page.setCacheEnabled(false),
      page.setRequestInterception(true),
      page.setJavaScriptEnabled(true),
    ]);

    // Block unnecessary resources
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      const blockedTypes = ["image", "stylesheet", "font", "media"];
      const blockedUrls = [
        "google-analytics",
        "doubleclick.net",
        "facebook",
        "twitter",
      ];

      if (
        blockedTypes.includes(resourceType) ||
        blockedUrls.some((url) => req.url().includes(url))
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.3",
    );

    const response = await page.goto(urlWithProtocol, {
      waitUntil: "domcontentloaded",
      timeout: config.pageTimeout,
    });

    if (!response || !response.ok()) {
      throw new Error(`Failed to load page`);
    }

    // Collect and filter links in the browser context
    const paths = await page.evaluate(
      (data: { hostname: string; origin: string }) => {
        const uniquePaths = new Set<string>();
        const links = Array.from(document.querySelectorAll("a[href]"));

        const excludedExtensions = new Set([
          ".pdf",
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
          ".svg",
          ".css",
          ".js",
          ".json",
          ".xml",
          ".txt",
          ".doc",
          ".docx",
          ".zip",
          ".rar",
          ".mp3",
          ".mp4",
          ".wav",
          ".avi",
          ".mov",
        ]);

        const excludedPaths = new Set([
          "/wp-admin",
          "/wp-content",
          "/wp-includes",
          "/admin",
          "/login",
          "/logout",
          "/signin",
          "/signout",
          "/cart",
          "/checkout",
          "/account",
          "/dashboard",
          "/assets",
          "/static",
          "/media",
          "/uploads",
        ]);

        for (const link of links) {
          const href = link.getAttribute("href");
          if (!href) continue;

          try {
            // Handle relative and absolute URLs
            const urlObj = href.startsWith("http")
              ? new URL(href)
              : new URL(href, data.origin);

            // Skip if not same domain
            if (urlObj.hostname !== data.hostname) continue;

            // Skip if has query params or hash
            if (urlObj.hash || urlObj.search) continue;

            const pathname = urlObj.pathname.toLowerCase();

            // Skip excluded extensions
            if ([...excludedExtensions].some((ext) => pathname.endsWith(ext)))
              continue;

            // Skip excluded paths
            if ([...excludedPaths].some((path) => pathname.startsWith(path)))
              continue;

            // Add pathname
            uniquePaths.add(pathname || "/");
          } catch (e) {
            continue;
          }
        }

        return Array.from(uniquePaths);
      },
      { hostname, origin },
    );

    // Normalize paths and remove duplicates
    const normalizedUrls = paths
      .map((path) => normalizePath(origin, path))
      .filter(Boolean);

    const normalizeInputUrl = normalizePath(
      origin,
      new URL(urlWithProtocol).pathname,
    );

    const results = [...new Set([normalizeInputUrl, ...normalizedUrls])]
      .slice(0, limit)
      // Sort URLs
      .sort((a, b) => {
        // Input URL always comes first
        if (a === normalizeInputUrl) return -1;
        if (b === normalizeInputUrl) return 1;

        // Homepage (origin) comes second if it's not the input URL
        if (a === origin && a !== normalizeInputUrl) return -1;
        if (b === origin && b !== normalizeInputUrl) return 1;

        return a.length === b.length ? a.localeCompare(b) : a.length - b.length;
      });

    const endTime = process.hrtime(startTime);
    console.log(
      `Execution time get internal links ${url}: ${endTime[0]}s ${endTime[1] / 1000000}ms`,
    );

    return {
      status: 200,
      message: "Internal links fetched successfully",
      data: {
        links: results,
      },
    };
  } catch (error) {
    console.error(`Error getting internal links for ${url}:`, error);
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
