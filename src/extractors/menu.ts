import type { Page } from 'playwright';
import type { MenuItem } from '../types.js';

/**
 * Extract menu items from the current WeBox page.
 *
 * Runs inside page.evaluate() — all DOM access happens in-browser.
 * Returns compact structured data instead of full DOM snapshots.
 *
 * Selectors discovered from WeBox Angular app (March 2026).
 */
export async function extractMenuItems(page: Page): Promise<MenuItem[]> {
  // Scroll down to load all lazy-loaded menu items
  var prevCount = 0;
  for (var i = 0; i < 20; i++) {
    var currentCount = await page.evaluate(function () {
      return document.querySelectorAll('.product-menu-item-wrapper').length;
    });
    if (currentCount === prevCount && i > 0) break;
    prevCount = currentCount;
    await page.evaluate(function () { window.scrollTo(0, document.body.scrollHeight); });
    await page.waitForTimeout(800);
  }

  // Scroll back to top
  await page.evaluate(function () { window.scrollTo(0, 0); });

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

      if (name) {
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
