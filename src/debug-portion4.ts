import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => /webox\.com/.test(p.url()));
if (!page) throw new Error('No WeBox tab');

await page.goto('https://www.webox.com/?date=2026-03-17&shippingTime=Lunch', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('app-new-menu .product-menu-item-wrapper', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

const input = page.locator('[placeholder*="Search dishes" i]').first();
await input.click();
await input.fill('Lemon Pepper Wings');
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);

const card = page.locator('[id$="-48900972"].product-menu-item-wrapper');
await card.locator('.product-add-wrapper, .btn.plus-add.small-plus-add').first().click();
await page.waitForTimeout(1500);

const portionBox = page.locator('.portion-select-box.show');
console.log('portion box shown:', await portionBox.count());

// Click 10 PCS option
const tenPCS = portionBox.locator('.portion-option-btn', { hasText: '10 PCS' });
await tenPCS.first().click();
await page.waitForTimeout(500);

// Inspect bottom section
const bottomHTML = await portionBox.evaluate(el => {
  const bottom = el.querySelector('.portion-select-bottom');
  return bottom?.innerHTML?.substring(0, 2000) || 'not found';
});
console.log('Portion bottom HTML after 10PCS click:\n', bottomHTML);

// Check visible plus-add buttons
const plusBtns = await portionBox.locator('.btn.plus-add').all();
console.log('plus-add count:', plusBtns.length);
for (const btn of plusBtns) {
  const visible = await btn.isVisible();
  const box = await btn.boundingBox();
  console.log('  visible:', visible, 'box:', box);
}

await page.keyboard.press('Escape').catch(() => {});
await browser.close();
