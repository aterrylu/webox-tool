import type { Page } from 'playwright';
import type { Brand } from '../types.js';

/**
 * Extract available brands/restaurants from the menu page.
 *
 * Instead of opening the brand filter dropdown, we aggregate brands
 * directly from the product cards on the page. This gives us accurate
 * counts of how many items each brand has.
 */
export async function extractBrands(page: Page): Promise<Brand[]> {
  return page.evaluate(function () {
    var cards = document.querySelectorAll('.product-menu-item-wrapper');
    var brandMap: Record<string, number> = {};

    cards.forEach(function (card) {
      var brand = card.querySelector('.brand-name span')?.textContent?.trim() || '';
      if (brand) {
        brandMap[brand] = (brandMap[brand] || 0) + 1;
      }
    });

    return Object.entries(brandMap)
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (entry, idx) {
        return {
          id: idx + 1,
          name: entry[0],
          itemCount: entry[1],
        };
      });
  });
}
