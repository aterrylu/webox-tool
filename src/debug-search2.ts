import { BrowserSession } from './core/browser.js';
import { searchOnPage } from './actions/search.js';

async function main() {
  const session = new BrowserSession();
  const page = await session.navigate('2026-03-17', 'lunch');
  
  await searchOnPage(page, 'Chicken Sandwich');
  
  // What does extractVisibleItems see?
  const result = await page.evaluate(() => {
    const cards = document.querySelectorAll('.product-menu-item-wrapper');
    return {
      count: cards.length,
      samples: Array.from(cards).slice(0, 3).map((c: Element) => ({
        id: c.id,
        name: (c.querySelector('.product-menu-title-text') as HTMLElement)?.textContent?.trim(),
      }))
    };
  });
  console.log('After searchOnPage:', JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
