# Build the WeBox MCP Server

## Goal
Convert the existing CLI tool (src/cli.ts) into an MCP server (src/mcp.ts) that Claude Code can use as a native tool server. Keep all existing code in src/extractors/, src/actions/, src/core/ unchanged.

## Tasks

### 1. Install dependencies
Run: npm install @modelcontextprotocol/sdk zod

### 2. Create src/mcp.ts
MCP server using StdioServerTransport. One shared WeboxClient instance across all tool calls.

Expose these tools using zod schemas:

**webox_status** — no params. Returns login status string.

**webox_menu** — params: date (string), meal (enum lunch|dinner), search (optional string), limit (optional number default 30). Returns formatted menu items.

**webox_details** — params: id (number), date (optional string). Returns product detail string.

**webox_brands** — params: date (string). Returns brands list string.

**webox_orders** — params: days (optional number default 14). Returns order history string.

**webox_cart** — no params. Returns cart contents. IMPORTANT: inspect CartService_cartItemArrMap in localStorage — look for fields like isAutoOrder, orderType, plannedOrder, isPlanned, autoOrder on cart items. If found, tag items as source:'auto' or source:'manual' in the output. If not found, note that in the output.

**webox_add** — params: id (number), date (string), meal (enum lunch|dinner), options (optional array of strings), search (optional string). Returns updated cart.

**webox_remove** — params: index (number). Returns updated cart.

Reuse src/formatters/text.ts formatters where possible for output.

### 3. Update package.json
Add script: "mcp": "npx tsx src/mcp.ts"

### 4. Create .mcp.json in project root
Content (use actual absolute path /Users/aterrylu/workspace/webox-tool):
```json
{
  "mcpServers": {
    "webox": {
      "command": "npx",
      "args": ["tsx", "/Users/aterrylu/workspace/webox-tool/src/mcp.ts"]
    }
  }
}
```

### 5. Create preferences.md in project root
```markdown
# WeBox Preferences

## Dietary
(fill in your restrictions)

## Favorites
(items or cuisines you enjoy)

## Avoid
(items or cuisines to skip)

## Budget
(target per meal, splurge rules, etc.)

## Ordering Mode
default: interactive
# auto        = Claude picks substitutes autonomously, no questions
# interactive = Claude pauses and asks on any problem
# batch       = Order all possible items, report all failures at end

## Notes
(anything else Claude should know)
```

### 6. Verify compilation
Run: npx tsc --noEmit
Fix any type errors found before declaring complete.

## Completion Criteria
Output the exact text below when ALL of the following are true:
- src/mcp.ts exists and npx tsc --noEmit passes with no errors
- .mcp.json exists with the correct absolute path
- preferences.md exists
- package.json includes @modelcontextprotocol/sdk and zod in dependencies

<promise>MCP SERVER COMPLETE</promise>
