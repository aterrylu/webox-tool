import type { Page } from 'playwright';

/**
 * Dismiss any blocking overlays/dialogs that might intercept clicks.
 * WeBox shows "Planned Order Detected" dialogs, auto-order confirmations, etc.
 */
async function dismissOverlays(page: Page): Promise<void> {
  await page.evaluate(function () {
    // Only look inside modal/overlay containers to avoid clicking unrelated buttons
    var containers = document.querySelectorAll('.ant-modal, .cdk-overlay-pane, nz-modal-container');
    containers.forEach(function (container) {
      var buttons = container.querySelectorAll('button');
      buttons.forEach(function (btn) {
        var text = (btn.textContent || '').trim();
        if (text === 'Cancel Planned' || text === 'Got it' || text === 'OK') {
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      });
    });
  });
  await page.waitForTimeout(500);
}

/**
 * Add a product to the cart by clicking the + button on its card.
 *
 * Three possible flows after clicking +:
 * 1. Simple item — adds directly to cart (no popup/modal).
 * 2. Portion picker — a small inline `.portion-select-box` appears with
 *    portion options and a second + button to confirm.
 * 3. Full variation modal — `app-dialog-profile-detail` opens for complex
 *    items with many customization options.
 *
 * A "Planned Order Detected" dialog may appear if there's a conflicting
 * auto-order — we dismiss it automatically.
 */
export async function addToCart(page: Page, productId: number): Promise<void> {
  // Find card by product ID
  const card = await page.$(`[id$="-${productId}"].product-menu-item-wrapper`);

  if (card === null) {
    throw new Error(`Product ${productId} not found on current page`);
  }

  // Check if item is sold out
  const soldOut = await card.evaluate(function (el) {
    var wrapper = el.querySelector('.product-menu-top-sold-out-wrapper') as HTMLElement | null;
    return wrapper ? getComputedStyle(wrapper).display !== 'none' : false;
  });

  if (soldOut) {
    throw new Error(`Product ${productId} is sold out`);
  }

  // Scroll card into view
  await card.evaluate(function (el) {
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(300);

  // Dismiss any blocking overlays first
  await dismissOverlays(page);

  // Click the + button via dispatchEvent (Playwright's native click doesn't
  // trigger Angular's Zone.js-patched event listeners reliably over CDP)
  const clicked = await page.evaluate(function (id) {
    var card = document.querySelector('[id$="-' + id + '"].product-menu-item-wrapper');
    if (!card) return false;
    var btn = card.querySelector('.plus-add, .product-add-wrapper');
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, productId);

  if (!clicked) {
    throw new Error(`Add button not found for product ${productId}`);
  }

  await page.waitForTimeout(1500);

  // Check if a "Planned Order Detected" dialog appeared
  await dismissOverlays(page);

  // Check which UI appeared after clicking +
  const uiState = await page.evaluate(function () {
    var portionBox = document.querySelector('.portion-select-box.show');
    if (portionBox) return 'portion-picker';
    var modal = document.querySelector('app-dialog-profile-detail');
    if (modal) return 'full-modal';
    return 'direct-add';
  });

  if (uiState === 'portion-picker') {
    // Portion picker: default portion is pre-selected, click + in the picker
    await page.evaluate(function () {
      var box = document.querySelector('.portion-select-box.show');
      if (!box) return;
      var btn = box.querySelector('.portion-select-bottom .plus-add');
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
  } else if (uiState === 'full-modal') {
    // Full variation modal: select required options, then click "Add to Cart"
    await page.waitForTimeout(800);

    // Select the first option in each required radio group
    await page.evaluate(function () {
      var modal = document.querySelector('app-dialog-profile-detail');
      if (!modal) return;
      var radioGroups = modal.querySelectorAll('.RADIO.variation-list');
      radioGroups.forEach(function (group) {
        // Only select if nothing is already selected
        var alreadySelected = group.querySelector('.select-mark.selected');
        if (alreadySelected) return;
        var firstMark = group.querySelector('app-product-item .select-mark');
        if (firstMark) {
          firstMark.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      });
    });
    await page.waitForTimeout(500);

    // Click "Add to Cart" button
    const modalClicked = await page.evaluate(function () {
      var panes = document.querySelectorAll('.cdk-overlay-pane');
      for (var i = panes.length - 1; i >= 0; i--) {
        var pd = panes[i].querySelector('app-dialog-profile-detail');
        if (pd) {
          var btn = pd.querySelector('st-button.add-button');
          if (btn) {
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return true;
          }
        }
      }
      return false;
    });

    if (modalClicked) {
      await page.waitForTimeout(2000);
      await dismissOverlays(page);
    } else {
      await page.keyboard.press('Escape');
      throw new Error(`Could not find Add to Cart button for product ${productId}`);
    }

    // Close the modal if still open
    await page.keyboard.press('Escape').catch(function () {});
    await page.waitForTimeout(300);
  }

  // Wait for cart update
  await page.waitForTimeout(1000);
}

/**
 * Remove an item from the cart by its index.
 *
 * Clicks the minus button in the cart sidebar. If quantity is 1,
 * a confirmation dialog ("Are you sure to delete this item?") appears
 * which we auto-confirm.
 */
export async function removeFromCart(page: Page, index: number): Promise<void> {
  // Find the minus button for the cart item in the sidebar
  const removed = await page.evaluate(function (idx) {
    var sidebar = document.querySelector('app-b2b-cart-items');
    if (sidebar === null) return 'no sidebar';

    // Each cart item has an input-number-wrapper with minus/plus buttons
    var inputWrappers = sidebar.querySelectorAll('.input-number-wrapper');
    if (inputWrappers.length === 0) return 'no items';
    if (idx < 0 || idx >= inputWrappers.length) return 'out of range: ' + inputWrappers.length;

    var wrapper = inputWrappers[idx];
    var minusBtn = wrapper.querySelector('.btn.minus');
    if (minusBtn) {
      minusBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return 'clicked';
    }
    return 'no minus button';
  }, index);

  if (removed === 'no sidebar') {
    throw new Error('Cart sidebar not found');
  }
  if (removed === 'no items') {
    throw new Error('No items in cart');
  }
  if (removed.startsWith('out of range')) {
    throw new Error(`Cart item index ${index} out of range (${removed})`);
  }
  if (removed === 'no minus button') {
    throw new Error(`Minus button not found for cart item ${index}`);
  }

  await page.waitForTimeout(500);

  // Handle "Are you sure to delete this item?" confirmation dialog
  await page.evaluate(function () {
    var containers = document.querySelectorAll('.ant-modal, .cdk-overlay-pane, nz-modal-container');
    containers.forEach(function (container) {
      var buttons = container.querySelectorAll('button');
      buttons.forEach(function (btn) {
        var text = (btn.textContent || '').trim();
        if (text === 'Remove') {
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      });
    });
  });

  await page.waitForTimeout(1000);
}
