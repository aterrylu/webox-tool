import type { Page } from 'playwright';
import type { Brand } from '../types.js';

/**
 * Extract available brands/restaurants from the menu page.
 * 
 * TODO: Discover the brand filter/sidebar selectors on webox.com
 */
export async function extractBrands(page: Page): Promise<Brand[]> {
  return page.evaluate(() => {
    const brands: any[] = [];

    // TODO: Find brand filter elements
    // WeBox likely has a sidebar or filter bar with restaurant logos/names
    const brandEls = document.querySelectorAll(
      '[class*="brand"], [class*="restaurant-filter"], [class*="vendor"]'
    );

    brandEls.forEach((el) => {
      const name = el.textContent?.trim() || '';
      const countMatch = el.querySelector('[class*="count"]')?.textContent?.match(/\d+/);

      if (name) {
        brands.push({
          id: 0, // TODO: extract
          name,
          itemCount: countMatch ? parseInt(countMatch[0]) : 0,
        });
      }
    });

    return brands;
  });
}
