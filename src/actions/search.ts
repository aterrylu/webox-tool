import type { Page } from 'playwright';

/**
 * Use WeBox's search bar to filter the menu page.
 *
 * Types the query into the header search input and presses Enter.
 * The page filters to show only matching items — bypasses virtual scroll
 * and horizontal carousel issues.
 *
 * The search query must match the product name exactly as shown in the DOM.
 */
export async function searchOnPage(page: Page, query: string): Promise<void> {
  // Find the search input in the header
  const searchInput = page.locator('input').filter({ hasText: '' }).and(
    page.locator('[placeholder*="earch" i], [placeholder*="filter" i], [type="search"], .search-input input, .header input')
  );

  // Fallback: try any input in the top area of the page
  let input = searchInput.first();
  if (await searchInput.count() === 0) {
    // Try broader: any visible input that looks like a search
    input = page.locator('input[placeholder]').first();
  }

  if (await input.count() === 0) {
    throw new Error('Search input not found on page');
  }

  await input.click();
  await input.fill(query);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
}

/**
 * Clear the search bar to show the full menu again.
 */
export async function clearSearch(page: Page): Promise<void> {
  const searchInput = page.locator('[placeholder*="earch" i], [placeholder*="filter" i], [type="search"], .search-input input, .header input');
  if (await searchInput.count() > 0) {
    await searchInput.first().fill('');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }
}
