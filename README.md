# 🍱 webox-tool

AI-powered WeBox food ordering CLI — browser automation for AI agents.

Built for [OpenClaw](https://github.com/openclaw/openclaw) and any LLM agent that needs to browse menus, manage carts, and place food orders on [WeBox](https://webox.com).

## Why?

AI agents waste massive tokens when browsing food ordering sites via DOM snapshots (50k+ tokens per page). This tool uses **Playwright browser automation + targeted JS extractors** to return compact, structured data (~500 tokens per query). That's a **100x reduction**.

## Architecture

```
Agent (Claude/GPT/etc)
  ↓ CLI call
npx tsx src/cli.ts menu --date 2026-03-10 --meal lunch
  ↓ Playwright (CDP)
Agent's Chrome browser (already open, logged into WeBox)
  ↓ page.evaluate()
Targeted JS extractor (returns structured JSON)
  ↓
Compact text output (one line per item)
```

**Key design choices:**
- **CDP attachment** — connects to the agent's already-running Chrome browser (no login flow needed)
- **Targeted JS extraction** — `page.evaluate()` returns minimal structured JSON, not full DOM
- **dispatchEvent for Angular** — uses DOM `dispatchEvent()` instead of Playwright's `.click()` to trigger Angular Zone.js event handlers reliably over CDP
- **AI-agent-friendly output** — compact, parseable, low-token text
- **Safe** — never auto-checkouts. Cart operations only.

## Installation

```bash
git clone https://github.com/nox-0x/webox-tool.git
cd webox-tool
npm install
```

## Prerequisites

**First run:** The tool auto-launches Chrome with CDP when no browser is detected. Just run any command:

```bash
npx tsx src/cli.ts status
# → Launches Chrome, prints "log in to webox.com in the browser window"
```

Log in to WeBox in the browser that opens. Cookies are saved in `~/.webox-tool/chrome-profile/`, so you only log in once.

**Already have Chrome with CDP?** The tool auto-detects it, or you can specify:
```bash
npx tsx src/cli.ts --cdp 56137 status
```

## Commands

```bash
# Check connection and login
npx tsx src/cli.ts status

# Browse menu
npx tsx src/cli.ts menu --date 2026-03-10 --meal lunch [--limit 30]
npx tsx src/cli.ts menu --date 2026-03-10 --meal dinner --search "wings"

# Product details (portions, ingredients, allergens)
npx tsx src/cli.ts details --id 48020540 --date 2026-03-10

# Order history (preference learning)
npx tsx src/cli.ts orders --days 14

# Cart operations
npx tsx src/cli.ts cart
npx tsx src/cli.ts add --date 2026-03-10 --meal lunch --id 48020540
npx tsx src/cli.ts remove --index 0

# Restaurants
npx tsx src/cli.ts brands --date 2026-03-10
```

### CDP Connection

Auto-detects from running Chrome processes, or specify explicitly:
```bash
npx tsx src/cli.ts --cdp 56137 menu --date 2026-03-10 --meal lunch
WEBOX_CDP_PORT=56137 npx tsx src/cli.ts status
```

## Output Format

Designed for AI agents — compact, one line per item:

```
📋 Menu for 2026-03-10 lunch | 5 items

[48020540] Achari Wings — Curry Pizza House | $9.45 | ★5.0 (1r) (mild)
[48204736] Chicken Katsu Plate — Akita Sushi | $14.45 | ★4.4 (16r)
[49101562] La Colombe Vanilla Draft Latte — WeBox Beverage | $3.45 (vegetarian)
```

Format: `[product_id] Name — Brand | $Price | ★Rating (reviews) [options] (dietary)`

## How It Works

### Extractors (the key innovation)

Instead of capturing full page DOM/screenshots, each page type has a targeted JS extractor:

```typescript
// Runs inside page.evaluate() — returns only what we need
function extractMenuItems(): MenuItem[] {
  var cards = document.querySelectorAll('.product-menu-item-wrapper');
  return Array.from(cards).map(function (card) {
    return {
      id: /* from element ID */,
      name: /* from .product-name */,
      price: /* from .product-price */,
      rating: /* from .product-rate-star */,
      brand: /* from .brand-name */,
    };
  });
}
```

This means:
- **50k tokens** (full DOM snapshot) → **500 tokens** (structured extract)
- Agents can browse menus, compare items, and build carts efficiently
- Multiple queries per conversation without blowing context

### Add-to-Cart Flows

WeBox has three different flows when clicking the + button:

1. **Simple items** — adds directly to cart (no popup)
2. **Portion picker** — small inline popup (`.portion-select-box`) for choosing size, then + to confirm
3. **Full variation modal** — `app-dialog-profile-detail` for complex items with many options

The tool detects which flow appeared and handles it automatically.

## WeBox Site Details

- **URL:** https://www.webox.com
- **Framework:** Angular SPA (ng-zorro, CDK overlays)
- **Menu URL:** `/?date=YYYY-MM-DD&shippingTime=Lunch|Dinner`
- **Budget:** varies per company/user (extracted from cart data)
- **Cart storage:** localStorage key `CartService_cartItemArrMap`
- **Products have:** id, name (EN + ZH), price, rating (0-5), brand, portions/options, dietary info, ingredients, allergens

## Project Structure

```
webox-tool/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts              # CLI entry point (commander.js)
│   ├── core/
│   │   ├── browser.ts      # CDP browser session manager
│   │   └── webox.ts        # High-level client (orchestrates extractors + actions)
│   ├── extractors/
│   │   ├── menu.ts         # Menu page extractor
│   │   ├── cart.ts         # Cart extractor (localStorage)
│   │   ├── product.ts      # Product detail extractor (modal)
│   │   ├── brands.ts       # Brand list extractor
│   │   └── orders.ts       # Order history extractor
│   ├── actions/
│   │   └── cart.ts         # Add/remove cart items
│   ├── formatters/
│   │   └── text.ts         # Compact text output formatter
│   └── types.ts            # TypeScript interfaces
├── SKILL.md                # AI agent skill definition
└── README.md
```

## Contributing

This is an open-source project by [@nox-0x](https://github.com/nox-0x) and [@aterrylu](https://github.com/aterrylu).

PRs welcome!

## License

MIT
