import type { Page } from 'playwright';
import type { Cart } from '../types.js';

/**
 * Extract cart contents.
 *
 * WeBox stores cart data in localStorage (key: CartService_cartItemArrMap).
 * This is more reliable than scraping the cart DOM.
 */
export async function extractCart(page: Page): Promise<Cart> {
  return page.evaluate(function () {
    var raw = localStorage.getItem('CartService_cartItemArrMap');
    if (raw === null || raw === '') return { items: [], total: 0, budget: 0, remaining: 0 };

    try {
      var parsed = JSON.parse(raw);
      var carts = parsed.value || [];
      var items: any[] = [];
      var total = 0;

      carts.forEach(function (cart: any) {
        var date = cart.dateShipping || '?';
        var meal = cart.shippingTimeSection?.timeShipping?.toLowerCase() || '?';
        var cartItems = cart.cartItems || [];

        cartItems.forEach(function (item: any) {
          var price = item.productSpecial?.price || item.price || 0;
          var qty = item.count || item.quantity || 1;
          total += price * qty;

          var name = item.productSpecial?.extProduct?.extName?.enUs
            || item.product?.extName?.enUs
            || item.productName
            || '?';

          var portion = item.productPortion?.extName?.enUs
            || item.portionName
            || null;

          items.push({
            index: items.length,
            name: name,
            price: price,
            quantity: qty,
            date: date,
            meal: meal,
            customization: portion,
          });
        });
      });

      return {
        items: items,
        total: total,
        budget: 20 * carts.length,
        remaining: (20 * carts.length) - total,
      };
    } catch {
      return { items: [], total: 0, budget: 0, remaining: 0 };
    }
  });
}
