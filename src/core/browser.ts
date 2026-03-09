import { chromium, type Browser, type Page } from 'playwright';
import { execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import type { ConnectionConfig } from '../types.js';

const WEBOX_URL_PATTERN = /webox\.com/;
const DEFAULT_CDP_PORT = 9222;
const CHROME_PROFILE_DIR = resolve(homedir(), '.webox-tool', 'chrome-profile');

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
   * 5. Auto-launch Chrome with CDP
   */
  private async getCdpEndpoint(): Promise<string> {
    if (this.config.cdpEndpoint) return this.config.cdpEndpoint;
    if (this.config.cdpPort) return `http://localhost:${this.config.cdpPort}`;

    const envPort = process.env.WEBOX_CDP_PORT;
    if (envPort) return `http://localhost:${envPort}`;

    // Auto-detect: find Chrome with --remote-debugging-port
    const detected = this.detectCdpPort();
    if (detected) return `http://localhost:${detected}`;

    // No browser found — launch one
    const port = this.launchChrome();
    await this.waitForCdpReady(port);
    return `http://localhost:${port}`;
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
    const endpoint = await this.getCdpEndpoint();
    this.browser = await chromium.connectOverCDP(endpoint);

    const weboxPage = this.findWeboxPage();
    const fallbackPage = this.browser.contexts().flatMap(c => c.pages())[0];
    this.page = weboxPage ?? fallbackPage ?? null;

    if (this.page) return this.page;

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

    return this.browser.contexts()
      .flatMap(c => c.pages())
      .find(p => WEBOX_URL_PATTERN.test(p.url())) ?? null;
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

  /**
   * Launch Chrome as a detached process with CDP enabled.
   * The browser persists after the CLI process exits.
   */
  private launchChrome(): number {
    const chromePath = this.findChromeBinary();
    mkdirSync(CHROME_PROFILE_DIR, { recursive: true });

    const child = spawn(chromePath, [
      `--remote-debugging-port=${DEFAULT_CDP_PORT}`,
      `--user-data-dir=${CHROME_PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
    ], {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    console.error(
      `Launched Chrome with CDP on port ${DEFAULT_CDP_PORT}.\n` +
      'If this is your first run, log in to webox.com in the browser window.'
    );

    return DEFAULT_CDP_PORT;
  }

  private findChromeBinary(): string {
    if (process.platform === 'darwin') {
      const path = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      if (existsSync(path)) return path;
      throw new Error('Chrome not found. Install Google Chrome or pass --cdp <port> to connect to an existing browser.');
    }

    // Linux: try common binary names
    for (const bin of ['google-chrome', 'chromium-browser', 'chromium']) {
      try {
        execFileSync('which', [bin], { encoding: 'utf-8', timeout: 2000 });
        return bin;
      } catch { /* try next */ }
    }

    throw new Error('Chrome/Chromium not found. Install Chrome or pass --cdp <port> to connect to an existing browser.');
  }

  private async waitForCdpReady(port: number, timeoutMs = 8000): Promise<void> {
    const start = Date.now();
    const url = `http://localhost:${port}/json/version`;

    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(url);
        if (res.ok) return;
      } catch { /* not ready yet */ }
      await new Promise(function (r) { setTimeout(r, 300); });
    }

    throw new Error(`Chrome did not become ready on port ${port} within ${timeoutMs / 1000}s.`);
  }

  async disconnect(): Promise<void> {
    // Never close the browser — it belongs to the agent.
    this.browser = null;
    this.page = null;
  }
}
