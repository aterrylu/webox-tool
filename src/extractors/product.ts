import type { Page } from 'playwright';
import type { ProductDetail } from '../types.js';

/**
 * Extract detailed product info by clicking to open the product detail modal.
 *
 * WeBox renders product details inside `app-dialog-profile-detail` within a
 * full-screen nz-modal, NOT inside a drawer.
 */
export async function extractProductDetail(page: Page, productId: number): Promise<ProductDetail | null> {
  // Click the product card to open the detail modal
  const card = page.locator(`[id$="-${productId}"].product-menu-item-wrapper`);
  if (await card.count() === 0) return null;

  await card.scrollIntoViewIfNeeded();
  const photo = card.locator('.product-menu-top-wrapper');
  if (await photo.count() > 0) {
    await photo.click();
  } else {
    await card.click();
  }

  // Wait for the Angular detail component to render inside the modal
  const detailEl = await page.waitForSelector(
    'app-dialog-profile-detail',
    { timeout: 8000 }
  ).catch(function () { return null; });

  if (detailEl === null) return null;

  // Give Angular a moment to populate nested content
  await page.waitForTimeout(800);

  // Extract detail from the modal
  const detail = await page.evaluate(function (id) {
    var modal = document.querySelector('app-dialog-profile-detail');
    if (modal === null) return null;

    // Product name: inside .product-title, skip icon text
    var titleEl = modal.querySelector('.product-title');
    var name = '';
    if (titleEl) {
      // Get only direct text nodes (icons have their own text)
      var walker = document.createTreeWalker(titleEl, NodeFilter.SHOW_TEXT, null);
      var node;
      while (node = walker.nextNode()) {
        var parent = node.parentElement;
        if (parent && parent.tagName !== 'IMG' && !parent.classList.contains('allergy-icon')) {
          var t = (node.textContent || '').trim();
          if (t) name = t;
        }
      }
    }
    if (!name) name = titleEl ? (titleEl.textContent || '').trim() : 'Unknown';

    // Brand
    var brandEl = modal.querySelector('.brand-name');
    var brand = brandEl ? (brandEl.textContent || '').trim() : '';

    // Price from the Add to Cart button area
    var priceEl = modal.querySelector('.price');
    var rawPrice = priceEl ? (priceEl.textContent || '').trim() : '0';
    var priceNum = parseFloat(rawPrice.replace(/[^0-9.]/g, '') || '0');

    // Portions (radio buttons)
    var portionLabels = modal.querySelectorAll('.box-portion label');
    var portions: { id: number; name: string; price: number; isDefault: boolean }[] = [];
    portionLabels.forEach(function (label, idx) {
      var pName = (label.textContent || '').trim();
      var isChecked = label.classList.contains('ant-radio-wrapper-checked');
      if (pName) {
        portions.push({
          id: idx,
          name: pName,
          price: 0, // WeBox doesn't show per-portion price in the radio
          isDefault: isChecked,
        });
      }
    });

    // Variation options (protein choices, styles, etc.)
    var variations: { name: string; type: 'radio' | 'checkbox'; required: boolean; options: string[] }[] = [];
    var variationWrappers = modal.querySelectorAll('.variation-item-wrapper');
    variationWrappers.forEach(function (wrapper) {
      var list = wrapper.querySelector('.variation-list');
      if (!list) return;
      var isRadio = list.classList.contains('RADIO');
      var headingEl = wrapper.querySelector('.heading > span');
      var groupName = '';
      if (headingEl) {
        headingEl.childNodes.forEach(function(node) {
          if (node.nodeType === 3) {
            var t = (node.textContent || '').trim();
            if (t) groupName = t;
          }
        });
      }
      var requiredEl = wrapper.querySelector('.validation-tag, [class*="required"]');
      var isRequired = requiredEl !== null || isRadio;
      var optionNames: string[] = [];
      var items = list.querySelectorAll('app-product-item');
      items.forEach(function (item) {
        var nameEl = item.querySelector('.item-name, .product-name');
        var optName = nameEl ? (nameEl.textContent || '').trim() : (item.textContent || '').trim();
        if (optName) optionNames.push(optName);
      });
      if (optionNames.length > 0) {
        variations.push({
          name: groupName || 'Options',
          type: isRadio ? 'radio' : 'checkbox',
          required: isRequired,
          options: optionNames,
        });
      }
    });

    // Ingredients
    var ingredientsEl = modal.querySelector('.ingredients-and-allergens-wrap .item-wrap');
    var ingredients = ingredientsEl ? (ingredientsEl.textContent || '').trim() : '';

    // Allergens (text labels, not icons)
    var allergenItems = modal.querySelectorAll('.allergy-item');
    var allergens: string[] = [];
    allergenItems.forEach(function (item) {
      var t = (item.textContent || '').trim();
      if (t) allergens.push(t);
    });

    // Dietary badges from product title icons
    var badgeIcons = modal.querySelectorAll('.product-title .allergy-icon');
    var dietary: string[] = [];
    var seen: Record<string, boolean> = {};
    badgeIcons.forEach(function (el) {
      var src = el.getAttribute('src') || '';
      var match = src.match(/\/(\w+)\.svg$/);
      if (match && match[1] !== 'product-new' && !seen[match[1]]) {
        dietary.push(match[1]);
        seen[match[1]] = true;
      }
    });

    // Reviews
    var reviewCountEl = modal.querySelector('.review-count');
    var reviewText = reviewCountEl ? (reviewCountEl.textContent || '').trim() : '';
    var ratingMatch = reviewText.match(/([\d.]+)\s*\((\d+)\)/);
    var rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
    var reviewCount = ratingMatch ? parseInt(ratingMatch[2]) : 0;

    // Description (from .product-desc if present)
    var descEl = modal.querySelector('.product-desc');
    var description = descEl ? (descEl.textContent || '').trim() : '';

    return {
      id: id,
      name: name || 'Unknown',
      brand: brand,
      price: priceNum,
      rating: rating,
      reviewCount: reviewCount,
      salesCount: 0,
      mealAvailability: [] as ('lunch' | 'dinner')[],
      hasCustomization: portions.length > 1,
      portionCount: portions.length || 1,
      description: description,
      portions: portions,
      variations: variations,
      dietary: dietary,
      ingredients: ingredients,
      allergens: allergens,
    };
  }, productId);

  // Close the modal
  const closeBtn = page.locator('.ant-modal-close');
  if (await closeBtn.count() > 0) {
    await closeBtn.first().click();
  }
  await page.waitForTimeout(300);
  // Fallback: press Escape
  await page.keyboard.press('Escape').catch(function () {});
  await page.waitForTimeout(200);

  return detail;
}
