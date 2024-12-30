import {
  IGetInfo,
  IGetInfoResponse,
  IGetInternalLinks,
  IGetInternalLinksResponse,
  IResponse,
} from "../types";
import { checkErrorPage, getBlocker, initBrowser } from "../utils/browser";
import { getUrlWithProtocol, normalizePath } from "../utils/url";
import { config } from "../config/config";
import { Page } from "@playwright/test";
import { Response as PlaywrightResponse } from "playwright";

export async function getInfo({
  url,
}: IGetInfo): Promise<IResponse<IGetInfoResponse | null>> {
  const startTime = process.hrtime();
  const urlWithProtocol = getUrlWithProtocol(url);

  let page: Page | null = null;
  const controller = new AbortController();

  // Setup timeout
  const timeoutId = setTimeout(() => {
    controller.abort("Operation timed out after 45 seconds");
  }, config.functionTimeout);

  try {
    const context = await initBrowser();
    const blocker = await getBlocker();

    page = await context.newPage();

    if (!page) {
      throw new Error("Failed to create new page");
    }

    await blocker.enableBlockingInPage(page);

    const response = (await Promise.race([
      page.goto(urlWithProtocol, {
        waitUntil: "load",
        timeout: config.pageTimeout,
      }),
      new Promise((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error(controller.signal.reason)),
        );
      }),
    ])) as PlaywrightResponse | null;

    await page.waitForTimeout(2000);

    const checkErrorResult = await checkErrorPage(page, response);

    if (checkErrorResult.hasError) {
      return {
        status: 400,
        message: checkErrorResult.message,
        data: null,
      };
    }

    const { title, description, ogImage, logo } = await page.evaluate(() => {
      const getMeta = (name: string) =>
        document.querySelector(`meta[name="${name}"]`)?.getAttribute("content");
      const getOgMeta = (property: string) =>
        document
          .querySelector(`meta[property="${property}"]`)
          ?.getAttribute("content");

      // Find logo using common patterns
      const findLogo = () => {
        // Common logo selectors
        const logoSelectors = [
          'link[rel="icon"]',
          'link[rel="shortcut icon"]',
          'link[rel="apple-touch-icon"]',
          'meta[property="og:image"]',
          'img[src*="logo"]',
          ".logo img",
          "#logo img",
          "header img",
          '[class*="logo"] img',
          '[id*="logo"] img',
          'a[class*="logo"] img',
          'a[id*="logo"] img',
        ];

        // Try each selector
        for (const selector of logoSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            if (
              element.tagName.toLowerCase() === "link" ||
              element.tagName.toLowerCase() === "meta"
            ) {
              const href =
                element.getAttribute("href") || element.getAttribute("content");
              if (href) return href;
            } else if (element.tagName.toLowerCase() === "img") {
              const src = element.getAttribute("src");
              if (src) return src;
            }
          }
        }
        return undefined;
      };

      return {
        title: document.title,
        description: getMeta("description"),
        ogImage: getOgMeta("og:image"),
        logo: findLogo(),
      };
    });

    // Wait for visible images to load with a 3-second timeout
    await Promise.race([
      page.evaluate((browserViewport) => {
        return Promise.all(
          Array.from(document.images)
            .filter((img) => {
              // Check if image is in viewport
              const rect = img.getBoundingClientRect();
              const viewportHeight = browserViewport.height;
              const viewportWidth = browserViewport.width;

              return (
                !img.complete &&
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= viewportHeight &&
                rect.right <= viewportWidth
              );
            })
            .map(
              (img) =>
                new Promise((resolve) => {
                  img.onload = img.onerror = resolve;
                }),
            ),
        );
      }, config.browserViewport),
      new Promise((resolve) => setTimeout(resolve, 3000)), // 3-second timeout
    ]);

    const screenshot = await Promise.race([
      page.screenshot({
        fullPage: false,
        animations: "disabled",
        type: "png",
      }),
      new Promise((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error(controller.signal.reason)),
        );
      }),
    ]).catch((err) => {
      console.error(`Error taking screenshot for ${url}:`, err);
      return undefined;
    });

    const absoluteOgImage =
      ogImage && ogImage.startsWith("http")
        ? ogImage
        : ogImage
          ? new URL(ogImage, urlWithProtocol).href
          : undefined;

    const absoluteLogo =
      logo && logo.startsWith("http")
        ? logo
        : logo
          ? new URL(logo, urlWithProtocol).href
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
        screenshot: screenshot ? Buffer.from(screenshot as Buffer) : undefined,
        title,
        description: description || undefined,
        ogImage: absoluteOgImage,
        logo: absoluteLogo,
      },
    };
  } catch (error) {
    console.error(`Error getting info page ${url}:`, error);
    return {
      status:
        error instanceof Error && error.message.includes("timed out")
          ? 408
          : 500,
      message: error instanceof Error ? error.message : "Internal Server Error",
      data: null,
    };
  } finally {
    clearTimeout(timeoutId);
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

    const context = await initBrowser();

    page = await context.newPage();

    if (!page) {
      throw new Error("Failed to create new page");
    }

    // Block unnecessary resources
    await context.route("**/*", (route) => {
      const blockedTypes = ["image", "stylesheet", "font", "media"];
      const blockedUrls = [
        "google-analytics",
        "doubleclick.net",
        "facebook",
        "twitter",
      ];

      const request = route.request();
      if (
        blockedTypes.includes(request.resourceType()) ||
        blockedUrls.some((url) => request.url().includes(url))
      ) {
        route.abort();
      } else {
        route.continue();
      }
    });

    const response = await page.goto(origin, {
      waitUntil: "domcontentloaded",
      timeout: config.pageTimeout,
    });

    if (!response || response.status() === 404) {
      return {
        status: 404,
        message: "Page not found",
        data: null,
      };
    }

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
