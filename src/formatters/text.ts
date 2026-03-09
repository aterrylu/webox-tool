import type { MenuItem, Cart, Brand, ProductDetail } from '../types.js';
import type { OrderPackage } from '../extractors/orders.js';

export function formatMenuItems(items: MenuItem[], date: string, meal: string): string {
  const lines: string[] = [];

  lines.push(`📋 Menu for ${date} ${meal} | ${items.length} items`);
  lines.push('');

  for (const item of items) {
    const meals = item.mealAvailability.map(m => m[0].toUpperCase()).join('+');
    const mealTag = meals ? ` [${meals}]` : '';
    const sales = item.salesCount >= 50 ? ` ${item.salesCount}+` : '';
    const custom = item.hasCustomization ? ' [options]' : '';
    const portions = item.portionCount > 1 ? ` (${item.portionCount} options)` : '';
    const soldOut = item.soldOut ? ' SOLD_OUT' : '';
    const dietary = item.dietary?.length ? ` (${item.dietary.join(', ')})` : '';
    const rating = item.rating > 0 ? ` | ★${item.rating.toFixed(1)} (${item.reviewCount}r)` : '';

    lines.push(
      `[${item.id}] ${item.name} — ${item.brand} | $${item.price.toFixed(2)}${rating}${sales}${mealTag}${custom}${portions}${dietary}${soldOut}`
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

  const ratingStr = product.rating > 0
    ? `★${product.rating.toFixed(1)} (${product.reviewCount} reviews)`
    : 'No ratings yet';
  lines.push(`   Brand: ${product.brand} | ${ratingStr} | $${product.price.toFixed(2)}`);

  if (product.description) lines.push(`   ${product.description.slice(0, 200)}`);

  if (product.portions.length > 0) {
    lines.push(`\n   📦 Portions (${product.portions.length}):`);
    for (const p of product.portions) {
      const def = p.isDefault ? ' ← default' : '';
      lines.push(`     [${p.id}] ${p.name}${def}`);
    }
  }

  if (product.dietary.length > 0) {
    lines.push(`   🥗 Dietary: ${product.dietary.join(', ')}`);
  }

  if (product.ingredients) {
    lines.push(`   🧾 Ingredients: ${product.ingredients}`);
  }

  if (product.allergens && product.allergens.length > 0) {
    lines.push(`   ⚠️  Allergens: ${product.allergens.join(', ')}`);
  }

  return lines.join('\n');
}

export function formatOrders(packages: OrderPackage[], days: number): string {
  if (packages.length === 0) return `📦 No delivered orders in the last ${days} days`;

  const itemCount = packages.reduce((sum, p) => sum + p.items.length, 0);
  const lines: string[] = [`📦 Order History — last ${days} days (${packages.length} meals, ${itemCount} items)`, ''];

  for (const pkg of packages) {
    const meal = pkg.meal ? ` ${pkg.meal}` : '';
    lines.push(`  📅 ${pkg.date}${meal}`);
    for (const item of pkg.items) {
      const brand = item.brand ? ` — ${item.brand}` : '';
      const portion = item.portion && item.portion !== 'Regular' ? ` (${item.portion})` : '';
      const price = item.price > 0 ? ` | $${item.price.toFixed(2)}` : '';
      lines.push(`    ${item.name}${brand}${price}${portion}`);
    }
  }

  return lines.join('\n');
}
