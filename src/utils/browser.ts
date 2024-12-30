import { Browser, BrowserContext, chromium, Page } from "@playwright/test";
import { config } from "../config/config";
import { fullLists, PlaywrightBlocker } from "@ghostery/adblocker-playwright";
import { Response as PlaywrightResponse } from "playwright";

let browserInstance: Browser | null = null;
let contextInstance: BrowserContext | null = null;
let blocker: PlaywrightBlocker | null = null;

export async function initBrowser(): Promise<BrowserContext> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: config.browserArgs,
    });
  }

  if (!contextInstance) {
    contextInstance = await browserInstance.newContext({
      viewport: {
        width: config.browserViewport.width,
        height: config.browserViewport.height,
      },
      deviceScaleFactor: 1,
      userAgent: config.userAgent,
    });
  }

  return contextInstance;
}

export async function getBlocker(): Promise<PlaywrightBlocker> {
  if (!blocker) {
    blocker = await PlaywrightBlocker.fromLists(fetch, fullLists, {
      enableCompression: true,
    });
  }
  return blocker;
}

export async function closeBrowser(): Promise<void> {
  if (contextInstance) {
    await contextInstance.close();
    contextInstance = null;
  }

  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});

export const checkErrorPage = async (
  page: Page,
  response: PlaywrightResponse | null,
) => {
  const startTime = process.hrtime();

  try {
    if (!response || !response.ok()) {
      const status = response?.status() || "N/A";
      const url = page.url();
      console.log(
        `[Error] Failed to load page. Status: ${status}, URL: ${url}`,
      );
      return {
        hasError: true,
        message: `Failed to load page (Status: ${status})`,
      };
    }

    const errorStatusCodes = [404, 403, 500, 502, 503, 504];
    if (response && errorStatusCodes.includes(response.status())) {
      const status = response.status();
      const url = page.url();
      console.log(`[Error] HTTP error ${status} detected. URL: ${url}`);
      return {
        hasError: true,
        message: `Server error occurred (HTTP ${status})`,
      };
    }

    const errorUrlKeywords = [
      "/404",
      "/not-found",
      "/error",
      "/invalid",
      "/failed",
      "/forbidden",
      "/unavailable",
      "/page-not-found",
      "/page-not-available",
      "/page-unavailable",
      "/does-not-exist",
      "/error-occurred",
      "/access-denied",
      "/unauthorized",
    ];
    const errorKeyword = errorUrlKeywords.find((keyword) =>
      page.url().toLowerCase().includes(keyword),
    );
    if (errorKeyword) {
      const url = page.url();
      console.log(
        `[Error] Error keyword "${errorKeyword}" found in URL: ${url}`,
      );
      return {
        hasError: true,
        message: `Error page detected (URL contains "${errorKeyword}")`,
      };
    }

    // Check page content
    const contentCheck = await page.evaluate(() => {
      const bodyText = document.body?.innerText?.toLowerCase() || "";
      const metaDescription =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content")
          ?.toLowerCase() || "";
      const hasContent = bodyText.length > 0;
      const hasImages = document.querySelectorAll("img").length > 0;
      const imageCount = document.querySelectorAll("img").length;

      const errorTerms = [
        "404",
        "403",
        "error",
        "not found",
        "unavailable",
        "invalid",
      ];
      const foundErrorTerm = errorTerms.find(
        (term) => bodyText.includes(term) || metaDescription.includes(term),
      );

      return {
        isEmpty: !hasContent && !hasImages,
        hasErrorTerms: !!foundErrorTerm,
        foundErrorTerm,
        imageCount,
        contentLength: bodyText.length,
      };
    });

    if (contentCheck.isEmpty) {
      const url = page.url();
      console.log(
        `[Error] Empty page detected. Content length: ${contentCheck.contentLength}, Images: ${contentCheck.imageCount}. URL: ${url}`,
      );
      return {
        hasError: true,
        message: "Page is empty (no text content or images found)",
      };
    }

    if (contentCheck.hasErrorTerms) {
      const url = page.url();
      console.log(
        `[Error] Error term "${contentCheck.foundErrorTerm}" found in content. URL: ${url}`,
      );
      return {
        hasError: true,
        message: `Error content detected (found "${contentCheck.foundErrorTerm}")`,
      };
    }

    console.log(
      `[Success] Page validated successfully. Content length: ${contentCheck.contentLength}, Images: ${contentCheck.imageCount}`,
    );
    return { hasError: false, message: "Page validated successfully" };
  } catch (error) {
    console.error(
      `[Error] Failed to validate page: ${error instanceof Error ? error.message : error}`,
    );
    return { hasError: true, message: "Failed to validate page" };
  } finally {
    const endTime = process.hrtime(startTime);
    console.log(
      `Execution time validate page ${page.url()}: ${endTime[0]}s ${
        endTime[1] / 1000000
      }ms`,
    );
  }
};
