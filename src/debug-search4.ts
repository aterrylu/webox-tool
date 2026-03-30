import { BrowserSession } from './core/browser.js';

async function main() {
  const session = new BrowserSession();
  const page = await session.navigate('2026-03-17', 'lunch');
  
  const input = page.locator('[placeholder*="Search dishes" i]').first();
  await input.click();
  await input.fill('');
  
  console.log('URL before:', page.url());
  
  // Type slowly
  await page.keyboard.type('Chicken Sandwich', { delay: 80 });
  
  // Check at 500ms intervals
  for (const ms of [500, 1000, 1500, 2000, 2500]) {
    await page.waitForTimeout(500);
    const count = await page.evaluate(() => document.querySelectorAll('.product-menu-item-wrapper').length);
    const url = page.url();
    console.log(`${ms}ms: ${count} items, url=${url.split('?')[1] || url}`);
  }
  
  // Check what the input value is
  const val = await input.inputValue();
  console.log('Input value:', val);
  
  // Try pressing Enter now and check after
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  const count2 = await page.evaluate(() => document.querySelectorAll('.product-menu-item-wrapper').length);
  const url2 = page.url();
  console.log(`After Enter: ${count2} items, url=${url2.split('?')[1] || url2}`);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
