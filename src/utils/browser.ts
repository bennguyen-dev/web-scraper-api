import { Browser, BrowserContext, chromium } from "@playwright/test";
import { config } from "../config/config";
import { fullLists, PlaywrightBlocker } from "@ghostery/adblocker-playwright";

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
        width: 1440,
        height: 756,
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
