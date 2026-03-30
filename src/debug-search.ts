import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('webox.com')) || context.pages()[0];

  await page.goto('https://www.webox.com/?date=2026-03-17&shippingTime=Lunch', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('app-new-menu .product-menu-item-wrapper', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const input = page.locator('[placeholder*="Search dishes" i]').first();
  await input.click();
  await input.fill('Chicken Sandwich');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  const debug = await page.evaluate(() => {
    const cards = document.querySelectorAll('.product-menu-item-wrapper');
    console.log('Total cards:', cards.length);
    return Array.from(cards).slice(0, 5).map((c: Element) => ({
      id: c.id,
      name: (c.querySelector('.product-menu-title-text') as HTMLElement)?.textContent?.trim(),
    }));
  });
  console.log('Cards after search:', JSON.stringify(debug, null, 2));
  console.log('Total cards found:', debug.length);

  await browser.close();
}
main().catch(console.error);
