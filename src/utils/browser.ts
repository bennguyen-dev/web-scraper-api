import puppeteer, { Browser } from "puppeteer";
import { config } from "../config/config";
import { PuppeteerBlocker } from "@ghostery/adblocker-puppeteer";

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
        deviceScaleFactor: 5 / 3,
      },
    });
  }
  return browserInstance;
}

export async function getBlocker(): Promise<PuppeteerBlocker> {
  if (!blocker) {
    blocker = await PuppeteerBlocker.fromLists(fetch, [
      "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
      "https://easylist.to/easylist/easylist.txt",
      "https://easylist.to/easylist/fanboy-social.txt",
      "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
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
