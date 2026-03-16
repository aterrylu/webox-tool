import type { Page } from 'playwright';

/**
 * Dismiss any blocking overlays/dialogs that might intercept clicks.
 * WeBox shows "Planned Order Detected" dialogs, auto-order confirmations, etc.
 */
async function dismissOverlays(page: Page): Promise<void> {
  const overlays = page.locator('.ant-modal, .cdk-overlay-pane, nz-modal-container');
  for (const text of ['Cancel Planned', 'Got it', 'OK']) {
    const btn = overlays.locator('button', { hasText: text });
    if (await btn.count() > 0) {
      await btn.first().click();
    }
  }
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
export async function addToCart(page: Page, productId: number, options?: string[]): Promise<void> {
  const card = page.locator(`[id$="-${productId}"].product-menu-item-wrapper`);

  // Wait up to 5s for the card to appear (search results may take a moment to render)
  await card.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {
    throw new Error(`Product ${productId} not found on current page`);
  });

  // Check if item is sold out
  const soldOutWrapper = card.locator('.product-menu-top-sold-out-wrapper');
  if (await soldOutWrapper.count() > 0) {
    const soldOut = await soldOutWrapper.evaluate(function (el) {
      return getComputedStyle(el).display !== 'none';
    });
    if (soldOut) {
      throw new Error(`Product ${productId} is sold out`);
    }
  }

  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await dismissOverlays(page);

  // Click the + button (first match: main add btn, not the per-portion sub-buttons)
  const addBtn = card.locator('.product-add-wrapper, .btn.plus-add.small-plus-add').first();
  await addBtn.click();
  await page.waitForTimeout(1500);
  await dismissOverlays(page);

  // Check which UI appeared after clicking +
  const portionBox = page.locator('.portion-select-box.show');
  const modal = page.locator('app-dialog-profile-detail');

  if (await portionBox.count() > 0) {
    // Portion picker: select portion if specified, then click its + button
    if (options && options.length > 0) {
      for (const opt of options) {
        const portionBtn = portionBox.locator('.portion-option-btn', { hasText: new RegExp(opt, 'i') });
        if (await portionBtn.count() > 0) {
          await portionBtn.first().click();
          await page.waitForTimeout(300);
          break;
        }
      }
    }
    // Click the + button for the currently selected portion (first visible plus-add)
    await portionBox.locator('.portion-select-bottom .plus-add').first().click();
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
  } else if (await modal.count() > 0) {
    // Full variation modal: select required options, then click "Add to Cart"
    await page.waitForTimeout(800);

    const optionNames = options || [];
    const groups = modal.locator('.variation-list');
    const groupCount = await groups.count();

    for (let g = 0; g < groupCount; g++) {
      const group = groups.nth(g);
      const isRadio = await group.evaluate(function (el) {
        return el.classList.contains('RADIO');
      });
      const items = group.locator('app-product-item');

      // Try to match a provided option name
      let matched = false;
      for (const optName of optionNames) {
        const matchingItem = items.filter({ hasText: new RegExp(optName, 'i') });
        if (await matchingItem.count() > 0) {
          await matchingItem.first().locator('.select-mark').click();
          matched = true;
          break;
        }
      }

      // Required radio group with nothing selected = error
      if (!matched && isRadio) {
        const alreadySelected = group.locator('.select-mark.selected');
        if (await alreadySelected.count() === 0) {
          const itemCount = await items.count();
          const names: string[] = [];
          for (let i = 0; i < itemCount; i++) {
            const text = await items.nth(i).textContent();
            names.push((text || '').trim());
          }
          await page.keyboard.press('Escape').catch(function () {});
          throw new Error('Required option not provided. Use --options with one of: ' + names.join(', '));
        }
      }
    }

    await page.waitForTimeout(500);

    // Click "Add to Cart" button
    const addCartBtn = modal.locator('st-button.add-button');
    if (await addCartBtn.count() > 0) {
      await addCartBtn.click();
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
 * Remove an item from the cart by its index (from the `cart` command output).
 *
 * The cart extractor indexes items sequentially across all date/meal carts
 * from localStorage. To click the right UI element, we:
 * 1. Look up the item's name, date, and meal from localStorage.
 * 2. Navigate to that date/meal page so the sidebar shows the right items.
 * 3. Find the item by name in the sidebar and click its minus button.
 */
export async function removeFromCart(page: Page, index: number): Promise<void> {
  // Step 1: Look up item details from localStorage (same source as cart extractor)
  const itemInfo = await page.evaluate(function (idx) {
    var raw = localStorage.getItem('CartService_cartItemArrMap');
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    var carts = parsed.value || [];
    var flatIndex = 0;
    for (var c = 0; c < carts.length; c++) {
      var cart = carts[c];
      var cartItems = cart.cartItems || [];
      for (var i = 0; i < cartItems.length; i++) {
        if (flatIndex === idx) {
          return {
            name: cartItems[i].productSpecial?.extProduct?.extName?.enUs
              || cartItems[i].product?.extName?.enUs
              || cartItems[i].productName
              || null,
            date: cart.dateShipping || '',
            meal: (cart.shippingTimeSection?.timeShipping || '').toLowerCase(),
          };
        }
        flatIndex++;
      }
    }
    return null;
  }, index);

  if (itemInfo === null || itemInfo.name === null) {
    throw new Error(`Cart item index ${index} not found in cart data`);
  }

  // Step 2: Navigate to the item's date/meal so sidebar shows the right section
  if (itemInfo.date && itemInfo.meal) {
    const shippingTime = itemInfo.meal === 'lunch' ? 'Lunch' : 'Dinner';
    const url = `https://www.webox.com/?date=${itemInfo.date}&shippingTime=${shippingTime}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  await dismissOverlays(page);

  // Step 3: Find the item by name in the sidebar and click minus
  const sidebar = page.locator('app-b2b-cart-items');
  const cartItem = sidebar.locator('app-b2b-product-item').filter({ hasText: itemInfo.name });

  if (await cartItem.count() === 0) {
    throw new Error(`Could not find "${itemInfo.name}" in cart sidebar`);
  }

  const minusBtn = cartItem.first().locator('.btn.minus');
  if (await minusBtn.count() === 0) {
    throw new Error(`Minus button not found for "${itemInfo.name}"`);
  }
  await minusBtn.dispatchEvent('click');
  await page.waitForTimeout(500);

  // Handle "Are you sure to delete this item?" confirmation dialog
  const removeBtn = page.locator('.ant-modal button, .cdk-overlay-pane button, nz-modal-container button', { hasText: 'Remove' });
  if (await removeBtn.count() > 0) {
    await removeBtn.first().click();
  }

  await page.waitForTimeout(1000);
}
