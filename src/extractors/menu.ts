import type { Page } from 'playwright';
import type { MenuItem } from '../types.js';

/**
 * Extract menu items from the current WeBox page.
 *
 * WeBox uses virtual scroll — only items in the viewport are in the DOM.
 * We scroll one viewport at a time, extracting items at each position,
 * then deduplicate by product ID.
 */
export async function extractMenuItems(page: Page): Promise<MenuItem[]> {
  const itemMap = new Map<number, MenuItem>();

  // Scroll to top first
  await page.evaluate(function () { window.scrollTo(0, 0); });
  await page.waitForTimeout(500);

  // Scroll one viewport at a time, collecting items at each position
  for (let i = 0; i < 50; i++) {
    // Extract items currently in the DOM
    const batch = await page.evaluate(function () {
      var cards = document.querySelectorAll('.product-menu-item-wrapper');
      var items: any[] = [];

      cards.forEach(function (card) {
        var rawId = card.id || '';
        var idParts = rawId.split('-');
        var id = idParts.length > 1 ? parseInt(idParts[1]) : 0;

        var name = card.querySelector('.product-menu-title-text')?.textContent?.trim() || '';
        var brand = card.querySelector('.brand-name span')?.textContent?.trim() || '';
        var priceText = card.querySelector('.product-price')?.textContent?.replace(/[^0-9.]/g, '') || '0';

        var ratingText = card.querySelector('.product-menu-review-and-rating-count')?.textContent?.trim() || '';
        var ratingMatch = ratingText.match(/([\d.]+)\s*\((\d+)\)/);
        var rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
        var reviewCount = ratingMatch ? parseInt(ratingMatch[2]) : 0;

        var soldOutEl = card.querySelector('.product-menu-top-sold-out-wrapper') as HTMLElement | null;
        var soldOut = soldOutEl ? getComputedStyle(soldOutEl).display !== 'none' : false;

        var allergyIcons = Array.from(card.querySelectorAll('.product-menu-allergy-icon'));
        var dietary = allergyIcons.map(function (el) {
          var src = el.getAttribute('src') || '';
          var match = src.match(/\/(\w+)\.svg$/);
          return match ? match[1] : '';
        }).filter(Boolean);

        var hasCustomization = card.querySelector('.show-variation') !== null;

        if (name && id) {
          items.push({
            id: id,
            name: name,
            brand: brand,
            price: parseFloat(priceText),
            rating: rating,
            reviewCount: reviewCount,
            salesCount: 0,
            mealAvailability: [],
            hasCustomization: hasCustomization,
            portionCount: hasCustomization ? 2 : 1,
            soldOut: soldOut,
            dietary: dietary,
          });
        }
      });

      return items;
    });

    for (const item of batch) {
      if (!itemMap.has(item.id)) {
        itemMap.set(item.id, item);
      }
    }

    // Scroll down by one viewport height
    const scrolled = await page.evaluate(function () {
      var before = window.scrollY;
      window.scrollBy(0, window.innerHeight);
      return window.scrollY > before;
    });

    // If we couldn't scroll further, we've reached the bottom
    if (!scrolled) break;

    await page.waitForTimeout(400);
  }

  // Scroll back to top
  await page.evaluate(function () { window.scrollTo(0, 0); });

  return Array.from(itemMap.values());
}
