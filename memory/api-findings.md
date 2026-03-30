---
name: WeBox API Findings
description: Reverse-engineered WeBox HTTP API endpoints and auth mechanism
type: project
---

# WeBox HTTP API Findings (2026-03-17)

## Auth
- **Cookie**: `X-Auth-Token` (JWT, not httpOnly, readable via `document.cookie`)
- Extract: `document.cookie.match(/X-Auth-Token=([^;]+)/)?.[1]`
- Tied to browser session — no standalone login discovered yet
- User address ID (e.g. 240143): get from `GET /api/users/my`

## Menu API
- `POST https://www.webox.com/api/product/menu/v1/dashboard?client=web`
- Body: `{ addressId: 240143, dateShipping: "2026-03-18", timeShipping: "Lunch" }`
- Response: `{ code: 1, data: { totalCount: 1951, categorySpecials: [...], brands: [...] } }`
- Products are in `data.categorySpecials[*].specials` (37 categories, 569 unique products)
- totalCount is 1951 — remaining items loaded via virtual scroll (no paginated endpoint found)
- Product schema: `{ id, productId, price, kitchenId, status, stockStatus, hasVariation, extProduct: { extName: { enUs }, extPortions } }`
- `id` field = the item ID used in cart operations (matches what webox_add uses)

## Budget API
- `POST /api/allowance/getCurrentUserRemainingAllowance?client=web`
- Body: `{ dateShipping: "2026-03-18", timeShipping: "Lunch" }`

## Orders API
- `GET /api/orders/range?client=web&dateFrom=2026-03-17&dateTo=2026-03-24&status=Paid,PartialRefunded,Planned,Unpaid`

## User Profile
- `GET /api/users/my?client=web` → includes `defaultShippingAddressId`

## Cart: localStorage Only
- No HTTP cart API found (all guessed endpoints → 500 errors)
- Cart lives in `localStorage.CartService_cartItemArrMap`
- Structure: `{ value: [{ dateShipping, shippingTimeSection, cartItems: [...] }] }`
- Potential: replace DOM clicks with direct localStorage injection

## Other Discovered Endpoints
- `GET /api/user/nav/categoryCuisines?addressId=...&dateShipping=...&timeShipping=...&client=web`
- `POST /api/localPartners/{addressId}/replaceLastMinuteTimeCutOff` (kitchen IDs list)
- `GET /api/adsBanners/my/v2?...` (promo banners)
- `GET /api/orders/myFlags?client=web`
