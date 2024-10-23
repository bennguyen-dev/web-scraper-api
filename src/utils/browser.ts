import puppeteer, { Browser } from "puppeteer";
import { PuppeteerBlocker } from "@cliqz/adblocker-puppeteer";
import { config } from "../config/config";

let browserInstance: Browser | null = null;
let blocker: PuppeteerBlocker | null = null;

export async function initBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: config.browserArgs,
      defaultViewport: {
        width: 1440,
        height: 756,
      },
    });
  }
  return browserInstance;
}

export async function getBlocker(): Promise<PuppeteerBlocker> {
  if (!blocker) {
    blocker = await PuppeteerBlocker.fromLists(fetch, [
      "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
    ]);
  }
  return blocker;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});
