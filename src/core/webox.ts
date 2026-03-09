import type { Page } from 'playwright';
import { BrowserSession } from './browser.js';
import { extractMenuItems } from '../extractors/menu.js';
import { extractCart } from '../extractors/cart.js';
import { extractBrands } from '../extractors/brands.js';
import { extractProductDetail } from '../extractors/product.js';
import { addToCart, removeFromCart } from '../actions/cart.js';
import { extractOrders, parseWeboxDate } from '../extractors/orders.js';
import type { OrderPackage } from '../extractors/orders.js';
import type { MenuItem, Cart, Brand, ProductDetail, ConnectionConfig } from '../types.js';

export interface MenuOptions {
  search?: string;
  limit?: number;
}

export class WeboxClient {
  private session: BrowserSession;

  constructor(config?: ConnectionConfig) {
    this.session = new BrowserSession(config);
  }

  // --- Read operations ---

  async getMenu(date: string, meal: 'lunch' | 'dinner', opts?: MenuOptions): Promise<MenuItem[]> {
    const page = await this.session.navigate(date, meal);

    let items = await extractMenuItems(page);

    // Client-side search filter (WeBox search is dropdown-based, not grid-filter)
    if (opts?.search) {
      const q = opts.search.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q)
      );
    }

    return opts?.limit ? items.slice(0, opts.limit) : items;
  }

  async getCart(): Promise<Cart> {
    const page = await this.session.getPage();
    return extractCart(page);
  }

  async getBrands(date: string): Promise<Brand[]> {
    const page = await this.session.navigate(date, 'lunch');
    return extractBrands(page);
  }

  async getProductDetail(id: number, date?: string): Promise<ProductDetail | null> {
    const page: Page = date
      ? await this.session.navigate(date, 'lunch')
      : await this.session.getPage();
    try {
      return await extractProductDetail(page, id);
    } catch (err) {
      // Close any modal left open on error
      await page.keyboard.press('Escape').catch(function () {});
      throw err;
    }
  }

  async getOrders(days: number): Promise<OrderPackage[]> {
    const page = await this.session.getPage();
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoffISO = cutoff.toISOString().split('T')[0];
    const year = now.getFullYear();

    const packages = await extractOrders(page, cutoffISO);

    // Fill in ISO dates and filter by cutoff
    return packages
      .map(pkg => {
        pkg.dateISO = parseWeboxDate(pkg.date, year);
        return pkg;
      })
      .filter(pkg => pkg.dateISO >= cutoffISO);
  }

  async getStatus(): Promise<{ loggedIn: boolean }> {
    const loggedIn = await this.session.isLoggedIn();
    return { loggedIn };
  }

  // --- Write operations (cart only — never checkout) ---

  async addToCart(id: number, date: string, meal: 'lunch' | 'dinner', options?: string[]): Promise<Cart> {
    const page = await this.session.navigate(date, meal);
    // Virtual scroll: scroll until the target product card is in the DOM
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.waitForTimeout(500);
    for (let i = 0; i < 50; i++) {
      const found = await page.evaluate(function (pid) {
        return document.querySelector('[id$="-' + pid + '"].product-menu-item-wrapper') !== null;
      }, id);
      if (found) break;
      const scrolled = await page.evaluate(function () {
        var before = window.scrollY;
        window.scrollBy(0, window.innerHeight);
        return window.scrollY > before;
      });
      if (!scrolled) break;
      await page.waitForTimeout(400);
    }
    try {
      await addToCart(page, id, options);
    } catch (err) {
      // Close any modal/portion picker left open on error
      await page.keyboard.press('Escape').catch(function () {});
      throw err;
    }
    return extractCart(page);
  }

  async removeFromCart(index: number): Promise<Cart> {
    const page = await this.session.getPage();
    await removeFromCart(page, index);
    return extractCart(page);
  }
}
