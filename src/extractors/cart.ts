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
    if (raw === null || raw === '') return { items: [], total: 0, budget: 0, remaining: 0, budgetKnown: false };

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

      // Extract budget from B2B budget schedules in UserService_user
      var budget = 0;
      var userRaw = localStorage.getItem('UserService_user');
      var schedules: any[] = [];
      if (userRaw) {
        try {
          var userData = JSON.parse(userRaw);
          var userVal = userData.value || userData;
          var company = userVal.extB2BCompany;
          var useTeam = company?.extOption?.budgetScheduleControlledByTeam;
          schedules = (useTeam ? userVal.extB2BTeam?.extBudgetSchedules : company?.extBudgetSchedules) || [];
        } catch { /* ignore */ }
      }

      var weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      carts.forEach(function (cart: any) {
        var dateStr = cart.dateShipping;
        var cartMeal = (cart.shippingTimeSection?.timeShipping || '').toLowerCase();
        if (dateStr && schedules.length > 0) {
          // Parse as local date to avoid UTC timezone shift
          var parts = dateStr.split('-');
          var localDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          var dayOfWeek = weekdays[localDate.getDay()];
          var schedule = schedules.find(function (s: any) { return s.weekday === dayOfWeek; });
          if (schedule) {
            var mealBudget = cartMeal === 'lunch' ? schedule.lunchBudget : schedule.dinnerBudget;
            budget += (mealBudget?.amount || 0);
          }
        }
      });

      return {
        items: items,
        total: total,
        budget: budget,
        remaining: budget > 0 ? budget - total : 0,
        budgetKnown: budget > 0,
      };
    } catch {
      return { items: [], total: 0, budget: 0, remaining: 0, budgetKnown: false };
    }
  });
}
