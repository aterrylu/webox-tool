import { chromium, type BrowserContext, type Page } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { BrowserConfig } from './types.js';

const DEFAULT_DATA_DIR = join(homedir(), '.webox-tool', 'browser-data');

export class BrowserSession {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;

  constructor(config?: Partial<BrowserConfig>) {
    this.config = {
      dataDir: config?.dataDir || DEFAULT_DATA_DIR,
      headless: config?.headless ?? true,
      addressId: config?.addressId || '240143',
    };

    if (!existsSync(this.config.dataDir)) {
      mkdirSync(this.config.dataDir, { recursive: true });
    }
  }

  async launch(): Promise<Page> {
    this.context = await chromium.launchPersistentContext(this.config.dataDir, {
      headless: this.config.headless,
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    // Reuse existing page or create new one
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
    return this.page;
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      return this.launch();
    }
    return this.page;
  }

  async navigate(date: string, meal: 'lunch' | 'dinner'): Promise<Page> {
    const page = await this.getPage();
    const shippingTime = meal === 'lunch' ? 'Lunch' : 'Dinner';
    const url = `https://www.webox.com/?date=${date}&shippingTime=${shippingTime}`;
    
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Wait for Angular to render product cards
    await page.waitForSelector('[class*="product"], [class*="item-card"], .menu-item', { 
      timeout: 15000 
    }).catch(() => {
      // Selector might differ — fall through to extractor which handles this
    });

    return page;
  }

  async isLoggedIn(): Promise<boolean> {
    const page = await this.getPage();
    
    // Check for auth token cookie
    const cookies = await this.context!.cookies('https://www.webox.com');
    const authCookie = cookies.find(c => c.name === 'X-Auth-Token');
    
    if (!authCookie) return false;

    // Navigate to site and check if we get redirected to login
    await page.goto('https://www.webox.com/', { waitUntil: 'networkidle' });
    const url = page.url();
    
    return !url.includes('login') && !url.includes('signin');
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }
}
