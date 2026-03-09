#!/usr/bin/env node
import { Command } from 'commander';
import { BrowserSession } from './browser.js';
import { extractMenuItems, searchMenu } from './extractors/menu.js';
import { extractCart } from './extractors/cart.js';
import { extractBrands } from './extractors/brands.js';
import { extractProductDetail } from './extractors/product.js';
import { formatMenuItems, formatCart, formatBrands, formatProductDetail } from './formatters/text.js';

const program = new Command();

program
  .name('webox')
  .description('AI-powered WeBox food ordering CLI')
  .version('0.1.0');

// Login command — opens visible browser
program
  .command('login')
  .description('Open browser for manual login (saves session)')
  .action(async () => {
    const session = new BrowserSession({ headless: false });
    const page = await session.launch();
    await page.goto('https://www.webox.com/');
    console.log('🔐 Browser opened — please log in manually.');
    console.log('   Press Ctrl+C when done (session will be saved).');
    // Keep alive until user closes
    await new Promise(() => {});
  });

// Status command
program
  .command('status')
  .description('Check if session is valid')
  .action(async () => {
    const session = new BrowserSession();
    const loggedIn = await session.isLoggedIn();
    console.log(loggedIn ? '✅ Logged in' : '❌ Not logged in — run `webox login`');
    await session.close();
  });

// Menu command
program
  .command('menu')
  .description('Browse menu items')
  .requiredOption('--date <date>', 'Date (YYYY-MM-DD)')
  .requiredOption('--meal <meal>', 'Meal type', 'lunch')
  .option('--search <query>', 'Search filter')
  .option('--limit <n>', 'Max items', '30')
  .action(async (opts) => {
    const session = new BrowserSession();
    try {
      const page = await session.navigate(opts.date, opts.meal);
      
      if (opts.search) {
        await searchMenu(page, opts.search);
      }

      const items = await extractMenuItems(page);
      const limited = items.slice(0, parseInt(opts.limit));
      console.log(formatMenuItems(limited, opts.date, opts.meal, items.length));
    } finally {
      await session.close();
    }
  });

// Cart command
program
  .command('cart')
  .description('View current cart')
  .action(async () => {
    const session = new BrowserSession();
    try {
      const page = await session.launch();
      await page.goto('https://www.webox.com/', { waitUntil: 'networkidle' });
      const cart = await extractCart(page);
      console.log(formatCart(cart));
    } finally {
      await session.close();
    }
  });

// Brands command
program
  .command('brands')
  .description('List available restaurants')
  .requiredOption('--date <date>', 'Date (YYYY-MM-DD)')
  .action(async (opts) => {
    const session = new BrowserSession();
    try {
      const page = await session.navigate(opts.date, 'lunch');
      const brands = await extractBrands(page);
      console.log(formatBrands(brands, opts.date));
    } finally {
      await session.close();
    }
  });

// Details command
program
  .command('details')
  .description('Get product details')
  .requiredOption('--id <id>', 'Product ID')
  .option('--date <date>', 'Date (YYYY-MM-DD)')
  .action(async (opts) => {
    const session = new BrowserSession();
    try {
      const page = await session.navigate(opts.date || new Date().toISOString().split('T')[0], 'lunch');
      const detail = await extractProductDetail(page, parseInt(opts.id));
      if (detail) {
        console.log(formatProductDetail(detail));
      } else {
        console.log(`❌ Product ${opts.id} not found`);
      }
    } finally {
      await session.close();
    }
  });

// Add to cart
program
  .command('add')
  .description('Add item to cart')
  .requiredOption('--id <id>', 'Product ID')
  .requiredOption('--date <date>', 'Date (YYYY-MM-DD)')
  .option('--meal <meal>', 'Meal type', 'lunch')
  .action(async (opts) => {
    const session = new BrowserSession();
    try {
      const page = await session.navigate(opts.date, opts.meal);
      // TODO: Implement click-based add to cart
      // 1. Find product card with matching ID
      // 2. Click it to open detail/add dialog
      // 3. Click "Add to Cart" button
      // 4. Confirm success
      console.log(`⚠️ Add to cart not yet implemented — coming soon!`);
      console.log(`   Product: ${opts.id} | Date: ${opts.date} | Meal: ${opts.meal}`);
    } finally {
      await session.close();
    }
  });

// Remove from cart
program
  .command('remove')
  .description('Remove item from cart')
  .requiredOption('--index <n>', 'Cart item index')
  .action(async (opts) => {
    // TODO: Implement cart item removal
    console.log(`⚠️ Remove from cart not yet implemented — coming soon!`);
  });

program.parse();
