import type { Page } from 'playwright';
import type { Cart } from '../types.js';

/**
 * Extract cart contents.
 * 
 * WeBox stores cart data in localStorage (key: CartService_cartItemArrMap).
 * This is more reliable than scraping DOM.
 */
export async function extractCart(page: Page): Promise<Cart> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('CartService_cartItemArrMap');
    if (!raw) return { items: [], total: 0, budget: 0, remaining: 0 };

    try {
      const parsed = JSON.parse(raw);
      const carts = parsed.value || [];
      const items: any[] = [];
      let total = 0;

      carts.forEach((cart: any, cartIdx: number) => {
        const date = cart.dateShipping || '?';
        const meal = cart.shippingTimeSection?.timeShipping?.toLowerCase() || '?';
        const cartItems = cart.cartItems || [];

        cartItems.forEach((item: any, itemIdx: number) => {
          const price = item.price || 0;
          const qty = item.quantity || 1;
          total += price * qty;

          items.push({
            index: items.length,
            name: item.product?.extName?.enUs || item.productName || '?',
            price,
            quantity: qty,
            date,
            meal,
            customization: item.portionName || null,
          });
        });
      });

      return {
        items,
        total,
        budget: 20 * carts.length, // $20 per meal
        remaining: (20 * carts.length) - total,
      };
    } catch {
      return { items: [], total: 0, budget: 0, remaining: 0 };
    }
  });
}
