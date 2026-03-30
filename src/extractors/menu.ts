import type { Page } from 'playwright';
import type { MenuItem } from '../types.js';

/**
 * Extract menu items from the current WeBox page.
 *
 * WeBox uses virtual scroll + horizontal carousels, so only items visible
 * in the viewport exist in the DOM. For best results, use the search bar
 * to filter before calling this (handled by WeboxClient.getMenu).
 *
 * When no search is active, scrolls viewport-by-viewport to collect items,
 * deduplicating by product ID.
 */
export async function extractMenuItems(page: Page, searched?: boolean): Promise<MenuItem[]> {
  const itemMap = new Map<number, MenuItem>();

  // Don't scroll to top when search is active — it resets the Angular search state
  if (!searched) {
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.waitForTimeout(500);
  }

  // Scroll one viewport at a time, collecting items at each position
  for (let i = 0; i < 50; i++) {
    const batch = await extractVisibleItems(page);
    for (const item of batch) {
      if (!itemMap.has(item.id)) {
        itemMap.set(item.id, item);
      }
    }

    const scrolled = await page.evaluate(function () {
      var before = window.scrollY;
      window.scrollBy(0, window.innerHeight);
      return window.scrollY > before;
    });
    if (!scrolled) break;
    await page.waitForTimeout(400);
  }

  if (!searched) {
    await page.evaluate(function () { window.scrollTo(0, 0); });
  }
  return Array.from(itemMap.values());
}

/** Extract items currently visible in the DOM. */
async function extractVisibleItems(page: Page): Promise<MenuItem[]> {
  return page.evaluate(function () {
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
}
