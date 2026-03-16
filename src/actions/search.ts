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
  // WeBox header search: placeholder is "Search dishes, ingredients or flavors..."
  // Fall through selectors from most to least specific.
  const input = page.locator(
    '[placeholder*="Search dishes" i], [placeholder*="earch" i], [type="search"], input[placeholder]'
  ).first();

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
