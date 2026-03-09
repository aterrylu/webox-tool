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
npx tsx src/cli.ts add --id PRODUCT_ID --date YYYY-MM-DD [--meal lunch|dinner] [--search "product name"] [--options "option1,option2"]
npx tsx src/cli.ts remove --index N
```

## Output Format

Menu items: `[product_id] Name — Brand | $Price | ★Rating (reviews) [options] (dietary)`
Cart items: `[index] Name (portion) xQty — $Price`

## Workflow

1. `status` — check browser connection and login
2. `orders --days 14` — learn user preferences from past orders
3. `menu --date --meal --search "keyword"` — **always use `--search`** to find items by name or brand
4. `details --id` — check portions/ingredients/allergens if needed
5. `add --id --date --meal --search "product name"` — add to cart. **Always pass `--search` with the exact product name** so the tool can find it on the page.
6. `cart` — verify cart and remaining budget
7. Repeat 3-6 until user is satisfied

**IMPORTANT — always use `--search`:** The menu uses virtual scroll, so items not in the viewport don't exist in the DOM. Always search by name to make items visible. Example:
```bash
menu --date 2026-03-10 --meal lunch --search "Chicken Katsu"
# sees: [12345] Chicken Katsu — SomeRestaurant | $12.00
add --id 12345 --date 2026-03-10 --meal lunch --search "Chicken Katsu"
```

## Domain Knowledge

- Budget: varies per company/user (check `cart` command for actual budget and remaining)
- Meals: lunch, dinner (each has different menu items)
- Dates: must be a future weekday
- Rating: 0-5 scale (★4.0+ is good)
- Items may have portions (e.g., 5PCS / 10 PCS) — add command picks the default
- Items marked `[options]` have required choices (e.g., protein). Use `details --id` to see options, then `add --options "Pollo Asado"` to select. The add command will fail if required options are not provided.
- Never auto-checkout — always confirm cart with user first
