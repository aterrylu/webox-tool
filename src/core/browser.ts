import { chromium, type Browser, type Page } from 'playwright';
import { execFileSync } from 'child_process';
import type { ConnectionConfig } from '../types.js';

const WEBOX_URL_PATTERN = /webox\.com/;

/**
 * Connects to an already-running browser via CDP.
 *
 * The agent (Claude Code, OpenClaw, etc.) is responsible for:
 * 1. Opening the browser
 * 2. Navigating to webox.com
 * 3. Logging in
 *
 * This class attaches to that browser and finds the webox tab.
 */
export class BrowserSession {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: ConnectionConfig;

  constructor(config?: ConnectionConfig) {
    this.config = config ?? {};
  }

  /**
   * Resolve the CDP endpoint. Priority:
   * 1. Explicit endpoint URL from config
   * 2. Explicit port from config
   * 3. WEBOX_CDP_PORT env var
   * 4. Auto-detect from running Chrome processes
   */
  private getCdpEndpoint(): string {
    if (this.config.cdpEndpoint) return this.config.cdpEndpoint;
    if (this.config.cdpPort) return `http://localhost:${this.config.cdpPort}`;

    const envPort = process.env.WEBOX_CDP_PORT;
    if (envPort) return `http://localhost:${envPort}`;

    // Auto-detect: find Chrome with --remote-debugging-port
    const detected = this.detectCdpPort();
    if (detected) return `http://localhost:${detected}`;

    throw new Error(
      'No CDP endpoint found. Either:\n' +
      '  1. Pass --cdp <port> to the CLI\n' +
      '  2. Set WEBOX_CDP_PORT env var\n' +
      '  3. Make sure the agent has a Chrome browser running with CDP enabled'
    );
  }

  /**
   * Auto-detect CDP port from running Chrome processes.
   * Uses ps + grep to find --remote-debugging-port in process args.
   */
  private detectCdpPort(): number | null {
    try {
      const output = execFileSync('ps', ['aux'], { encoding: 'utf-8', timeout: 3000 });
      const lines = output.split('\n');
      for (const line of lines) {
        const match = line.match(/--remote-debugging-port=(\d+)/);
        if (match) {
          return parseInt(match[1]);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async connect(): Promise<Page> {
    const endpoint = this.getCdpEndpoint();
    this.browser = await chromium.connectOverCDP(endpoint);

    const page = this.findWeboxPage();
    if (page) {
      this.page = page;
      return this.page;
    }

    // No webox tab yet — find any open tab so the agent can navigate
    for (const context of this.browser.contexts()) {
      const pages = context.pages();
      if (pages.length > 0) {
        this.page = pages[0];
        return this.page;
      }
    }

    throw new Error(
      `Connected to browser at ${endpoint} but no tabs found.\n` +
      'The agent should open a tab and navigate to webox.com.'
    );
  }

  /**
   * Find an existing webox.com tab across all contexts.
   */
  private findWeboxPage(): Page | null {
    if (this.browser === null) return null;

    for (const context of this.browser.contexts()) {
      for (const page of context.pages()) {
        if (WEBOX_URL_PATTERN.test(page.url())) {
          return page;
        }
      }
    }
    return null;
  }

  async getPage(): Promise<Page> {
    if (this.page) {
      try {
        this.page.url(); // Check page is still alive
        return this.page;
      } catch {
        this.page = null;
      }
    }
    return this.connect();
  }

  async navigate(date: string, meal: 'lunch' | 'dinner'): Promise<Page> {
    const page = await this.getPage();
    const shippingTime = meal === 'lunch' ? 'Lunch' : 'Dinner';
    const url = `https://www.webox.com/?date=${date}&shippingTime=${shippingTime}`;

    // Only navigate if we're not already on the right page
    const currentUrl = page.url();
    if (currentUrl.includes(`date=${date}`) && currentUrl.includes(`shippingTime=${shippingTime}`)) {
      return page;
    }

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for Angular to render the menu
    await page.waitForSelector('app-new-menu .product-menu-item-wrapper', {
      timeout: 15000,
    }).catch(function () {});

    return page;
  }

  async isLoggedIn(): Promise<boolean> {
    const page = await this.getPage();

    return page.evaluate(function () {
      var hasAvatar = document.querySelector('app-user-avatar') !== null;
      var hasAddress = document.querySelector('app-menu-date-address-v3') !== null;
      var hasMenu = document.querySelector('app-new-menu, app-menu') !== null;
      return hasAvatar || hasAddress || hasMenu;
    });
  }

  async disconnect(): Promise<void> {
    // Never close the browser — it belongs to the agent.
    this.browser = null;
    this.page = null;
  }
}
