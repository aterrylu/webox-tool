import { chromium } from 'playwright';

async function main() {
  var browser = await chromium.connectOverCDP('http://localhost:56137');
  var pages = browser.contexts().flatMap(function(c) { return c.pages(); });
  var weboxPage = pages.find(function(p) { return p.url().includes('webox'); });
  if (weboxPage === undefined) { process.exit(1); }

  // Make sure we're on a menu page so cart sidebar is visible
  await weboxPage.goto('https://www.webox.com/?date=2026-03-11&shippingTime=Lunch', { waitUntil: 'domcontentloaded' });
  await weboxPage.waitForTimeout(3000);

  // Get cart items from localStorage
  var lsItems = await weboxPage.evaluate(function() {
    var raw = localStorage.getItem('CartService_cartItemArrMap');
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    var carts = parsed.value || [];
    var items: string[] = [];
    carts.forEach(function(cart: any) {
      var date = cart.dateShipping || '?';
      var meal = cart.shippingTimeSection?.timeShipping || '?';
      var cartItems = cart.cartItems || [];
      cartItems.forEach(function(item: any) {
        var name = item.productSpecial?.extProduct?.extName?.enUs || '?';
        items.push(date + ' ' + meal + ': ' + name);
      });
    });
    return items;
  });

  console.log('=== localStorage order ===');
  lsItems.forEach(function(item, i) { console.log('[' + i + '] ' + item); });

  // Get cart items from sidebar DOM
  var sidebarItems = await weboxPage.evaluate(function() {
    var sidebar = document.querySelector('app-b2b-cart-items');
    if (!sidebar) return ['no sidebar found'];
    var wrappers = sidebar.querySelectorAll('.input-number-wrapper');
    var items: string[] = [];
    wrappers.forEach(function(wrapper) {
      // Find the nearest item name
      var parent = wrapper.closest('.cart-item, [class*="cart-item"]');
      var nameEl = parent ? parent.querySelector('.item-name, .product-name, [class*="name"]') : null;
      var name = nameEl ? (nameEl.textContent || '').trim().slice(0, 60) : 'unknown';
      items.push(name);
    });
    return items;
  });

  console.log('\n=== sidebar DOM order (input-number-wrapper) ===');
  sidebarItems.forEach(function(item, i) { console.log('[' + i + '] ' + item); });

  // Get a broader view of the sidebar structure
  var sidebarStructure = await weboxPage.evaluate(function() {
    var sidebar = document.querySelector('app-b2b-cart-items');
    if (!sidebar) return 'no sidebar';
    var items: string[] = [];

    // Find all cart item containers
    var cartItemEls = sidebar.querySelectorAll('app-b2b-cart-item, [class*="cart-item"]');
    cartItemEls.forEach(function(el, i) {
      var text = (el.textContent || '').trim().slice(0, 100);
      items.push('[' + i + '] ' + el.tagName + '.' + el.className.split(' ').slice(0, 2).join('.') + ' => ' + text);
    });

    return items.join('\n');
  });

  console.log('\n=== sidebar cart item elements ===');
  console.log(sidebarStructure);

  process.exit(0);
}
main();
