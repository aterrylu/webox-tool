import type { Page } from 'playwright';
import type { MenuItem } from '../types.js';

/**
 * Extract menu items from the current WeBox page.
 * 
 * This runs inside page.evaluate() — all DOM access happens in-browser.
 * Returns compact structured data instead of full DOM snapshots.
 * 
 * TODO: The selectors below are placeholders. They need to be discovered
 * by inspecting the actual WeBox Angular components. Run `webox login`
 * and use browser DevTools to find the correct selectors.
 */
export async function extractMenuItems(page: Page): Promise<MenuItem[]> {
  return page.evaluate(() => {
    const items: any[] = [];
    
    // TODO: Replace these selectors with actual WeBox DOM selectors.
    // The site is an Angular SPA — inspect with DevTools to find:
    // 1. Product card container selector
    // 2. Product name element
    // 3. Price element  
    // 4. Rating element
    // 5. Brand/restaurant name
    // 6. Product ID (likely in a data attribute or link href)
    
    // Strategy: WeBox likely renders product cards in a grid/list.
    // Look for repeating elements with product info.
    // Angular often uses custom elements like <app-product-card>
    
    const cards = document.querySelectorAll(
      // Try multiple possible selectors
      '[class*="product-card"], [class*="menu-item"], [class*="food-item"], app-product-card, .item-card'
    );

    cards.forEach((card) => {
      const nameEl = card.querySelector('[class*="name"], [class*="title"], h3, h4');
      const priceEl = card.querySelector('[class*="price"]');
      const ratingEl = card.querySelector('[class*="rating"], [class*="star"]');
      const brandEl = card.querySelector('[class*="brand"], [class*="restaurant"]');
      
      // Try to extract product ID from data attributes or links
      const link = card.querySelector('a[href*="product"]');
      const idMatch = link?.getAttribute('href')?.match(/(\d+)/) 
        || card.getAttribute('data-id')
        || card.getAttribute('data-product-id');

      const id = idMatch ? (typeof idMatch === 'string' ? parseInt(idMatch) : parseInt(idMatch[1])) : 0;
      const name = nameEl?.textContent?.trim() || '';
      const priceText = priceEl?.textContent?.replace(/[^0-9.]/g, '') || '0';
      const ratingText = ratingEl?.textContent?.replace(/[^0-9.]/g, '') || '0';

      if (name) {
        items.push({
          id,
          name,
          brand: brandEl?.textContent?.trim() || '?',
          price: parseFloat(priceText),
          rating: parseFloat(ratingText) / 2, // Convert 10-scale to 5-scale
          reviewCount: 0,  // TODO: extract
          salesCount: 0,   // TODO: extract
          mealAvailability: [], // TODO: determine from page context
          hasCustomization: false, // TODO: check for customization indicator
          portionCount: 1,
        });
      }
    });

    return items;
  });
}

/**
 * Search for items by typing in the search box.
 */
export async function searchMenu(page: Page, query: string): Promise<void> {
  // TODO: Find the search input selector
  const searchInput = await page.$('[class*="search"] input, input[placeholder*="search" i], input[type="search"]');
  
  if (searchInput) {
    await searchInput.fill('');
    await searchInput.fill(query);
    // Wait for results to update (Angular debounce)
    await page.waitForTimeout(1000);
  }
}
