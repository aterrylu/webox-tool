#!/usr/bin/env node
import { Command } from 'commander';
import { WeboxClient } from './core/webox.js';
import { formatMenuItems, formatCart, formatBrands, formatProductDetail, formatOrders } from './formatters/text.js';
import type { ConnectionConfig } from './types.js';

const program = new Command();

program
  .name('webox')
  .description('AI-powered WeBox food ordering CLI — operates on an agent-managed browser')
  .version('0.1.0')
  .option('--cdp <endpoint>', 'CDP endpoint (default: http://localhost:9222)');

function getConfig(): ConnectionConfig {
  const opts = program.opts();
  if (opts.cdp) {
    // Accept either a port number or a full URL
    const isPort = /^\d+$/.test(opts.cdp);
    return isPort ? { cdpPort: parseInt(opts.cdp) } : { cdpEndpoint: opts.cdp };
  }
  return {};
}

// --- Read commands ---

program
  .command('status')
  .description('Check if browser is connected and logged in')
  .action(async () => {
    const client = new WeboxClient(getConfig());
    const { loggedIn } = await client.getStatus();
    console.log(loggedIn ? 'Logged in' : 'Not logged in — navigate to webox.com and log in first');
  });

program
  .command('menu')
  .description('Browse menu items')
  .requiredOption('--date <date>', 'Date (YYYY-MM-DD)')
  .requiredOption('--meal <meal>', 'Meal type (lunch|dinner)', 'lunch')
  .option('--search <query>', 'Search filter')
  .option('--limit <n>', 'Max items to return', '30')
  .action(async (opts) => {
    const client = new WeboxClient(getConfig());
    const items = await client.getMenu(opts.date, opts.meal, {
      search: opts.search,
      limit: parseInt(opts.limit),
    });
    console.log(formatMenuItems(items, opts.date, opts.meal));
  });

program
  .command('brands')
  .description('List available restaurants')
  .requiredOption('--date <date>', 'Date (YYYY-MM-DD)')
  .action(async (opts) => {
    const client = new WeboxClient(getConfig());
    const brands = await client.getBrands(opts.date);
    console.log(formatBrands(brands, opts.date));
  });

program
  .command('details')
  .description('Get product details')
  .requiredOption('--id <id>', 'Product ID')
  .option('--date <date>', 'Date (YYYY-MM-DD)')
  .action(async (opts) => {
    const client = new WeboxClient(getConfig());
    const detail = await client.getProductDetail(parseInt(opts.id), opts.date);
    if (detail) {
      console.log(formatProductDetail(detail));
    } else {
      console.log(`Product ${opts.id} not found`);
    }
  });

program
  .command('orders')
  .description('View past order history')
  .option('--days <n>', 'How many days back to show', '14')
  .action(async (opts) => {
    const client = new WeboxClient(getConfig());
    const days = parseInt(opts.days);
    const orders = await client.getOrders(days);
    console.log(formatOrders(orders, days));
  });

program
  .command('cart')
  .description('View current cart')
  .action(async () => {
    const client = new WeboxClient(getConfig());
    const cart = await client.getCart();
    console.log(formatCart(cart));
  });

// --- Write commands (cart only) ---

program
  .command('add')
  .description('Add item to cart')
  .requiredOption('--id <id>', 'Product ID')
  .requiredOption('--date <date>', 'Date (YYYY-MM-DD)')
  .option('--meal <meal>', 'Meal type (lunch|dinner)', 'lunch')
  .action(async (opts) => {
    const client = new WeboxClient(getConfig());
    const cart = await client.addToCart(parseInt(opts.id), opts.date, opts.meal);
    console.log(`Added product ${opts.id} to cart`);
    console.log(formatCart(cart));
  });

program
  .command('remove')
  .description('Remove item from cart by index')
  .requiredOption('--index <n>', 'Cart item index')
  .action(async (opts) => {
    const client = new WeboxClient(getConfig());
    const cart = await client.removeFromCart(parseInt(opts.index));
    console.log(`Removed item at index ${opts.index}`);
    console.log(formatCart(cart));
  });

program.parseAsync().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
