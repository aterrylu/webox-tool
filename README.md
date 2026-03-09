# 🍱 webox-tool

AI-powered WeBox food ordering CLI — browser automation for AI agents.

Built for [OpenClaw](https://github.com/openclaw/openclaw) and any LLM agent that needs to browse menus, manage carts, and place food orders on [WeBox](https://webox.com).

## Why?

AI agents waste massive tokens when browsing food ordering sites via DOM snapshots (50k+ tokens per page). This tool uses **Playwright browser automation + targeted JS extractors** to return compact, structured data (~500 tokens per query). That's a **100x reduction**.

## Architecture

```
Agent (Claude/GPT/etc)
  ↓ CLI call
webox-tool menu --date 2026-03-10 --meal lunch
  ↓ Playwright
Browser (persistent session, saved cookies)
  ↓ page.evaluate()
Targeted JS extractor (returns structured JSON)
  ↓
Compact text output (one line per item)
```

**Key design choices:**
- **Playwright, not API scraping** — interact with the real site like a user. No reverse-engineering.
- **Targeted JS extraction** — `page.evaluate()` returns minimal structured JSON, not full DOM.
- **Persistent browser session** — cookies/auth survive between calls.
- **AI-agent-friendly output** — compact, parseable, low-token text.
- **Safe** — never auto-checkouts. Cart operations only.

## Installation

```bash
# Clone
git clone https://github.com/nox-0x/webox-tool.git
cd webox-tool

# Install
npm install

# First run — opens visible browser for manual login
npx webox login

# Subsequent runs use saved session (headless)
npx webox menu --date 2026-03-10 --meal lunch
```

## Commands

```bash
# Login / session management
webox login                    # Open browser for manual login
webox status                   # Check if session is valid

# Browse menu
webox menu --date 2026-03-10 --meal lunch [--limit 30]
webox menu --date 2026-03-10 --meal dinner --search "wings"
webox menu --date 2026-03-10 --category "dim sum"

# Product details
webox details --id 186386

# Cart operations
webox cart                     # View current cart
webox add --date 2026-03-10 --meal lunch --id 186386
webox remove --index 3         # Remove by position

# Restaurants
webox brands --date 2026-03-10
```

## Output Format

Designed for AI agents — compact, one line per item, machine-parseable:

```
📋 Menu for 2026-03-10 Lunch | 30 items
[186386] Three-BBQ Combo Rice — Superstar | $18.45 | ★4.5 (14r) | [L+D]
[117399] Black Mushroom Sumai — Green Garden | $7.45 | ★4.8 (23r) | [L]
[187529] 6pc Chicken Wings — Wings Circle | $11.45 | ★4.5 (1r) | [L+D]
```

Format: `[product_id] Name — Brand | $Price | ★Rating (reviews) | [Meal availability]`

## How It Works

### Extractors (the key innovation)

Instead of capturing full page DOM/screenshots, each page type has a targeted JS extractor:

```typescript
// Runs inside page.evaluate() — returns only what we need
function extractMenuItems(): MenuItem[] {
  const cards = document.querySelectorAll('[product-card-selector]');
  return Array.from(cards).map(card => ({
    id: /* extract product id */,
    name: /* extract name */,
    price: /* extract price */,
    rating: /* extract rating */,
    brand: /* extract brand */,
  }));
}
```

This means:
- **50k tokens** (full DOM snapshot) → **500 tokens** (structured extract)
- Agents can browse menus, compare items, and build carts efficiently
- Multiple queries per conversation without blowing context

### Session Management

```
~/.webox-tool/
├── browser-data/          # Playwright persistent context (cookies, localStorage)
├── config.json            # Address ID, preferences
└── cache/                 # Optional menu cache (TTL: 1 hour)
```

First run opens a visible browser — you log in manually. Cookies persist for subsequent headless runs. If session expires, the tool detects it and prompts for re-login.

## WeBox Site Details

- **URL:** https://www.webox.com
- **Framework:** Angular SPA
- **Auth:** Email/password login, JWT stored in `X-Auth-Token` cookie
- **Menu URL:** `/?date=YYYY-MM-DD&shippingTime=Lunch|Dinner`
- **Budget:** $20/meal (lunch and dinner are separate budgets)
- **Products have:** id, name (EN + ZH), price, rating (0-10 scale), brand, portions/options, dietary info

## OpenClaw Skill Integration

This tool is designed to work as an [OpenClaw skill](https://docs.openclaw.ai). Add to your workspace:

```bash
# In your OpenClaw workspace
cd ~/.openclaw/workspace/tools/
git clone https://github.com/nox-0x/webox-tool.git
cd webox-tool && npm install
```

Then your AI agent can call it directly:
```bash
npx webox menu --date 2026-03-10 --meal lunch --search "bento" --limit 10
```

## Project Structure

```
webox-tool/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts              # CLI entry point (commander.js)
│   ├── browser.ts          # Browser session manager
│   ├── extractors/
│   │   ├── menu.ts         # Menu page extractor
│   │   ├── cart.ts         # Cart extractor
│   │   ├── product.ts      # Product detail extractor
│   │   └── brands.ts       # Brand list extractor
│   ├── actions/
│   │   ├── navigate.ts     # URL-based navigation (date/meal switching)
│   │   ├── cart.ts         # Add/remove cart items
│   │   └── search.ts       # Search input handling
│   ├── formatters/
│   │   └── text.ts         # Compact text output formatter
│   └── types.ts            # TypeScript interfaces
├── bin/
│   └── webox               # Executable entry
├── SKILL.md                # OpenClaw skill definition
└── README.md
```

## Contributing

This is an open-source project by [@nox-0x](https://github.com/nox-0x) and [@aterrylu](https://github.com/aterrylu).

PRs welcome! The main areas that need work:
1. **Discovering exact DOM selectors** for WeBox's Angular components
2. **Cart interaction flow** (add/remove items with customization options)
3. **Menu caching** to reduce redundant browser launches
4. **Support for other meal delivery services** (generalize the extractor pattern)

## License

MIT
