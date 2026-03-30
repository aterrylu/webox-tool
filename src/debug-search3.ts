import { BrowserSession } from './core/browser.js';
import { searchOnPage } from './actions/search.js';

async function main() {
  const session = new BrowserSession();
  const page = await session.navigate('2026-03-17', 'lunch');
  
  const before = await page.evaluate(() => document.querySelectorAll('.product-menu-item-wrapper').length);
  console.log('Items BEFORE search:', before);
  
  await searchOnPage(page, 'Chicken Sandwich');
  
  const after = await page.evaluate(() => document.querySelectorAll('.product-menu-item-wrapper').length);
  console.log('Items AFTER search (2500ms):', after);
  
  // Wait longer
  await page.waitForTimeout(3000);
  const after2 = await page.evaluate(() => document.querySelectorAll('.product-menu-item-wrapper').length);
  console.log('Items AFTER search (5500ms total):', after2);
  
  // Check what the search input looks like
  const inputVal = await page.evaluate(() => {
    const inp = document.querySelector('[placeholder*="Search dishes" i]') as HTMLInputElement;
    return inp ? inp.value : 'NOT FOUND';
  });
  console.log('Search input value:', inputVal);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
