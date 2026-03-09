import type { MenuItem, Cart, Brand, ProductDetail } from '../types.js';

export function formatMenuItems(items: MenuItem[], date: string, meal: string, total?: number): string {
  const lines: string[] = [];
  const shown = items.length;
  const totalStr = total ? ` (of ${total} total)` : '';
  
  lines.push(`📋 Menu for ${date} ${meal} | ${shown} items${totalStr}`);
  lines.push('');

  for (const item of items) {
    const meals = item.mealAvailability.map(m => m[0].toUpperCase()).join('+');
    const mealTag = meals ? ` [${meals}]` : '';
    const sales = item.salesCount >= 50 ? ` ${item.salesCount}+` : '';
    const custom = item.hasCustomization ? ' ⚙' : '';
    const portions = item.portionCount > 1 ? ` (${item.portionCount} options)` : '';

    lines.push(
      `[${item.id}] ${item.name} — ${item.brand} | $${item.price.toFixed(2)} | ★${item.rating.toFixed(1)} (${item.reviewCount}r)${sales}${mealTag}${custom}${portions}`
    );
  }

  return lines.join('\n');
}

export function formatCart(cart: Cart): string {
  if (cart.items.length === 0) return '🛒 Cart is empty';

  const lines: string[] = ['🛒 Your Cart:', ''];
  let currentDate = '';
  let currentMeal = '';

  for (const item of cart.items) {
    if (item.date !== currentDate || item.meal !== currentMeal) {
      currentDate = item.date;
      currentMeal = item.meal;
      lines.push(`  📅 ${item.date} — ${item.meal}`);
    }
    const custom = item.customization ? ` (${item.customization})` : '';
    lines.push(`    [${item.index}] ${item.name}${custom} x${item.quantity} — $${item.price.toFixed(2)}`);
  }

  lines.push('');
  lines.push(`  💰 Total: $${cart.total.toFixed(2)} | Budget: $${cart.budget.toFixed(2)} | Remaining: $${cart.remaining.toFixed(2)}`);

  return lines.join('\n');
}

export function formatBrands(brands: Brand[], date: string): string {
  const lines: string[] = [`🏪 Brands for ${date} (${brands.length} total):`, ''];

  for (const b of brands) {
    lines.push(`  [${b.id}] ${b.name} — ${b.itemCount} items`);
  }

  return lines.join('\n');
}

export function formatProductDetail(product: ProductDetail): string {
  const lines: string[] = [];
  
  lines.push(`🍱 ${product.name}`);
  if (product.nameZh) lines.push(`   ${product.nameZh}`);
  lines.push(`   Brand: ${product.brand} | ★${product.rating.toFixed(1)} (${product.reviewCount} reviews) | ${product.salesCount}+ sold`);
  if (product.description) lines.push(`   ${product.description.slice(0, 200)}`);

  if (product.portions.length > 0) {
    lines.push(`\n   📦 Portions (${product.portions.length}):`);
    for (const p of product.portions) {
      const def = p.isDefault ? ' ← default' : '';
      lines.push(`     [${p.id}] ${p.name} — $${p.price.toFixed(2)}${def}`);
    }
  }

  if (product.dietary.length > 0) {
    lines.push(`   🥗 Dietary: ${product.dietary.join(', ')}`);
  }

  return lines.join('\n');
}
