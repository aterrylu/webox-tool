#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { WeboxClient } from './core/webox.js';
import {
  formatMenuItems,
  formatCart,
  formatBrands,
  formatProductDetail,
  formatOrders,
} from './formatters/text.js';

// One shared client for the life of the MCP server process
const client = new WeboxClient();

const server = new McpServer({
  name: 'webox',
  version: '0.1.0',
});

// --- webox_status ---
server.tool(
  'webox_status',
  'Check if the browser is connected and logged in to WeBox',
  {},
  async () => {
    const { loggedIn } = await client.getStatus();
    return {
      content: [{
        type: 'text',
        text: loggedIn
          ? 'Logged in to WeBox'
          : 'Not logged in — navigate to webox.com and log in first',
      }],
    };
  }
);

// --- webox_menu ---
server.tool(
  'webox_menu',
  'Browse the WeBox menu for a specific date and meal. Always use search to find items by name (virtual scroll means items not in viewport are invisible).',
  {
    date: z.string().describe('Date in YYYY-MM-DD format'),
    meal: z.enum(['lunch', 'dinner']).describe('Meal type'),
    search: z.string().optional().describe('Search query to filter by item name or brand'),
    limit: z.number().optional().default(30).describe('Max items to return'),
  },
  async ({ date, meal, search, limit }) => {
    const items = await client.getMenu(date, meal, { search, limit });
    return {
      content: [{ type: 'text', text: formatMenuItems(items, date, meal) }],
    };
  }
);

// --- webox_details ---
server.tool(
  'webox_details',
  'Get full details for a product including portions, variations/options, ingredients, and allergens',
  {
    id: z.number().describe('Product ID'),
    date: z.string().optional().describe('Date in YYYY-MM-DD format (navigates to that date first if provided)'),
  },
  async ({ id, date }) => {
    const detail = await client.getProductDetail(id, date);
    if (!detail) {
      return { content: [{ type: 'text', text: `Product ${id} not found` }] };
    }
    return { content: [{ type: 'text', text: formatProductDetail(detail) }] };
  }
);

// --- webox_brands ---
server.tool(
  'webox_brands',
  'List all available restaurant brands for a given date',
  {
    date: z.string().describe('Date in YYYY-MM-DD format'),
  },
  async ({ date }) => {
    const brands = await client.getBrands(date);
    return { content: [{ type: 'text', text: formatBrands(brands, date) }] };
  }
);

// --- webox_orders ---
server.tool(
  'webox_orders',
  'View past order history to understand preferences and ordering patterns',
  {
    days: z.number().optional().default(14).describe('How many days back to look'),
  },
  async ({ days }) => {
    const orders = await client.getOrders(days ?? 14);
    return { content: [{ type: 'text', text: formatOrders(orders, days ?? 14) }] };
  }
);

// --- webox_cart ---
server.tool(
  'webox_cart',
  'Read the current cart contents. Items are tagged as [AUTO] if auto-ordered (cancellable) or [MANUAL] if manually placed (cannot be cancelled by the agent without explicit user direction).',
  {},
  async () => {
    const cart = await client.getCart();
    const text = formatCartWithSource(cart);
    return { content: [{ type: 'text', text }] };
  }
);

// --- webox_add ---
server.tool(
  'webox_add',
  'Add an item to the cart. Always pass search with the exact product name so it becomes visible on the virtual-scroll page.',
  {
    id: z.number().describe('Product ID'),
    date: z.string().describe('Date in YYYY-MM-DD format'),
    meal: z.enum(['lunch', 'dinner']).describe('Meal type'),
    options: z.array(z.string()).optional().describe('Option names to select (e.g. ["Pollo Asado"]). Required for items with required variations.'),
    search: z.string().optional().describe('Product name to search for — makes the item visible on page. Strongly recommended.'),
  },
  async ({ id, date, meal, options, search }) => {
    const cart = await client.addToCart(id, date, meal, options, search);
    return {
      content: [{
        type: 'text',
        text: `Added product ${id} to cart\n\n${formatCart(cart)}`,
      }],
    };
  }
);

// --- webox_remove ---
server.tool(
  'webox_remove',
  'Remove an item from the cart by its index (from webox_cart output). Only removes items the user has authorized for removal.',
  {
    index: z.number().describe('Cart item index (from webox_cart output)'),
  },
  async ({ index }) => {
    const cart = await client.removeFromCart(index);
    return {
      content: [{
        type: 'text',
        text: `Removed item at index ${index}\n\n${formatCart(cart)}`,
      }],
    };
  }
);

/**
 * Format cart with auto/manual source tags.
 *
 * WeBox stores auto-ordered items in localStorage under CartService_cartItemArrMap.
 * The cart extractor reads that key. At time of writing, the exact field that
 * distinguishes auto-ordered from manually-placed items is unknown — we need to
 * inspect the actual data structure on a live account.
 *
 * Known indicators to look for: isAutoOrder, orderType, plannedOrder, isPlanned,
 * autoOrder, source on cart or cartItem objects.
 *
 * Until confirmed, this formatter notes [source unknown] so the user is aware.
 * The webox_cart tool description explains the semantic difference.
 */
function formatCartWithSource(cart: import('./types.js').Cart): string {
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
    // source field will be populated once we inspect the actual localStorage schema
    const source = (item as any).source === 'auto'
      ? ' [AUTO]'
      : (item as any).source === 'manual'
        ? ' [MANUAL]'
        : '';
    lines.push(`    [${item.index}]${source} ${item.name}${custom} x${item.quantity} — $${item.price.toFixed(2)}`);
  }

  lines.push('');
  if (cart.budgetKnown) {
    lines.push(`  💰 Total: $${cart.total.toFixed(2)} | Budget: $${cart.budget.toFixed(2)} | Remaining: $${cart.remaining.toFixed(2)}`);
  } else {
    lines.push(`  💰 Total: $${cart.total.toFixed(2)} | Budget: unknown`);
  }

  lines.push('');
  lines.push('  ℹ️  Note: [AUTO] = auto-ordered (cancellable), [MANUAL] = manually placed (do not cancel without explicit user direction). Source detection requires live localStorage inspection to confirm field name.');

  return lines.join('\n');
}

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
