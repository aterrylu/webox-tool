# webox — WeBox Food Ordering Tool

Browser automation CLI for ordering food on WeBox. Connects to an agent-managed Chrome browser via CDP. Returns compact structured text optimized for AI agents (~500 tokens per query vs 50k+ for raw DOM).

## Setup

```bash
cd /path/to/webox-tool && npm install
npx tsx src/cli.ts status   # Auto-launches Chrome if needed
```

On first run, Chrome opens automatically. Log in to webox.com in the browser window — cookies are saved for future sessions.

**If you already have Chrome with CDP running:**
```bash
npx tsx src/cli.ts --cdp 56137 status       # by port
WEBOX_CDP_PORT=56137 npx tsx src/cli.ts status          # env var
```

## Commands

### Browse
```bash
npx tsx src/cli.ts menu --date YYYY-MM-DD --meal lunch|dinner [--search "query"] [--limit N]
npx tsx src/cli.ts brands --date YYYY-MM-DD
npx tsx src/cli.ts details --id PRODUCT_ID [--date YYYY-MM-DD]
```

### Order History
```bash
npx tsx src/cli.ts orders [--days N]          # default: last 14 days
```

### Cart (safe — no checkout)
```bash
npx tsx src/cli.ts cart
npx tsx src/cli.ts add --id PRODUCT_ID --date YYYY-MM-DD [--meal lunch|dinner]
npx tsx src/cli.ts remove --index N
```

## Output Format

Menu items: `[product_id] Name — Brand | $Price | ★Rating (reviews) [options] (dietary)`
Cart items: `[index] Name (portion) xQty — $Price`

## Workflow

1. `status` — check browser connection and login
2. `orders --days 14` — check past orders to learn user preferences
3. `menu --date --meal` — browse available items
4. `details --id` — check portions/ingredients/allergens if needed
5. `add --id --date --meal` — add to cart (handles portion picker automatically)
6. `cart` — verify cart and remaining budget
7. Repeat 3-6 until user is satisfied

## Domain Knowledge

- Budget: varies per company/user (check `cart` command for actual budget and remaining)
- Meals: lunch, dinner (each has different menu items)
- Dates: must be a future weekday
- Rating: 0-5 scale (★4.0+ is good)
- Items may have portions (e.g., 5PCS / 10 PCS) — add command picks the default
- Never auto-checkout — always confirm cart with user first
