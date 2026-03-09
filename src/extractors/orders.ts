import type { Page } from 'playwright';

export interface OrderItem {
  name: string;
  brand: string;
  portion: string;
  price: number;
}

export interface OrderPackage {
  orderId: string;
  date: string;       // "Mon 03/02", "Fri 03/06", etc.
  dateISO: string;     // "2026-03-02" for filtering
  meal: string;        // "lunch" | "dinner" | ""
  status: string;      // "Delivered", "Cancelled", etc.
  total: number;
  items: OrderItem[];
}

/**
 * Extract order history from the /order page.
 *
 * Scrolls down to load orders until we've gone past the cutoff date,
 * then extracts delivered orders from the DOM.
 */
export async function extractOrders(page: Page, cutoffDate: string): Promise<OrderPackage[]> {
  // Navigate to orders page
  await page.goto('https://www.webox.com/order/list/normal', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Scroll to load orders until we pass the cutoff date or hit a limit
  var maxScrolls = 15;
  for (var i = 0; i < maxScrolls; i++) {
    var oldestDate = await page.evaluate(function () {
      var items = document.querySelectorAll('.order-package .shipping-time');
      if (items.length === 0) return '';
      return (items[items.length - 1].textContent || '').trim();
    });

    // If we can determine the oldest visible date is before cutoff, stop
    if (oldestDate && isDateBeforeCutoff(oldestDate, cutoffDate)) break;

    await page.evaluate(function () { window.scrollTo(0, document.body.scrollHeight); });
    await page.waitForTimeout(1500);

    // Check if we've reached the end (no new content)
    var newCount = await page.evaluate(function () {
      return document.querySelectorAll('.order-item').length;
    });
    if (i > 0) {
      var prevCount = await page.evaluate(function () {
        return document.querySelectorAll('.order-item').length;
      });
      // If count didn't change, we've hit the end
      if (newCount === prevCount) break;
    }
  }

  // Extract all delivered orders
  return page.evaluate(function (cutoff) {
    var orderItems = document.querySelectorAll('.order-item');
    var results: any[] = [];

    orderItems.forEach(function (orderItem) {
      var statusEl = orderItem.querySelector('.order-status');
      var status = statusEl ? (statusEl.textContent || '').trim() : '';
      if (status !== 'Paid') return;

      var orderIdEl = orderItem.querySelector('.order-id');
      var orderId = orderIdEl ? (orderIdEl.textContent || '').replace('No.', '').trim() : '';

      var packages = orderItem.querySelectorAll('.order-package');
      packages.forEach(function (pkg) {
        var pkgStatusEl = pkg.querySelector('.package-status');
        var pkgStatus = pkgStatusEl ? (pkgStatusEl.textContent || '').trim() : '';
        if (pkgStatus !== 'Delivered') return;

        var dateEl = pkg.querySelector('.shipping-time');
        var dateStr = dateEl ? (dateEl.textContent || '').trim() : '';

        // Parse meal type from .package-time text
        var meal = '';
        var timeEl = pkg.querySelector('.package-time');
        if (timeEl) {
          var timeText = (timeEl.textContent || '').trim();
          if (timeText.includes('Lunch')) meal = 'lunch';
          else if (timeText.includes('Dinner')) meal = 'dinner';
        }

        // Parse total
        var totalEl = pkg.querySelector('.package-fee-amount');
        var totalText = totalEl ? (totalEl.textContent || '').replace(/[^0-9.]/g, '') : '0';

        // Extract product items
        var productEls = pkg.querySelectorAll('.product-item');
        var items: any[] = [];

        productEls.forEach(function (pi) {
          var nameEl = pi.querySelector('.item-name');
          var name = '';
          if (nameEl) {
            // Get text content excluding icon elements
            nameEl.childNodes.forEach(function (node) {
              if (node.nodeType === 3) { // Text node
                var t = (node.textContent || '').trim();
                if (t) name += t;
              }
            });
            if (!name) name = (nameEl.textContent || '').trim();
          }

          var brandEls = pi.querySelectorAll('.item-brand');
          var brand = '';
          brandEls.forEach(function (b) {
            var t = (b.textContent || '').replace(/^Cold\s*·\s*/, '').replace(/^·\s*/, '').trim();
            if (t && !t.startsWith('Cold')) brand = t;
          });

          var portionEl = pi.querySelector('.item-portion');
          var portion = portionEl ? (portionEl.textContent || '').replace(/^,\s*/, '').trim() : '';

          var priceEl = pi.querySelector('.item-price div');
          var priceText = priceEl ? (priceEl.textContent || '').replace(/[^0-9.]/g, '') : '0';

          items.push({
            name: name,
            brand: brand,
            portion: portion,
            price: parseFloat(priceText) || 0,
          });
        });

        if (items.length > 0) {
          results.push({
            orderId: orderId,
            date: dateStr,
            dateISO: '',  // Will be filled in post-processing
            meal: meal,
            status: pkgStatus,
            total: parseFloat(totalText) || 0,
            items: items,
          });
        }
      });
    });

    return results;
  }, cutoffDate);
}

/**
 * Parse WeBox date format "Mon 03/02" to ISO "YYYY-MM-DD" using current year context.
 */
export function parseWeboxDate(dateStr: string, referenceYear: number): string {
  var match = dateStr.match(/(\d{2})\/(\d{2})/);
  if (!match) return '';
  var month = match[1];
  var day = match[2];
  return referenceYear + '-' + month + '-' + day;
}

function isDateBeforeCutoff(dateStr: string, cutoffISO: string): boolean {
  var year = new Date().getFullYear();
  var iso = parseWeboxDate(dateStr, year);
  if (!iso) return false;
  return iso < cutoffISO;
}
