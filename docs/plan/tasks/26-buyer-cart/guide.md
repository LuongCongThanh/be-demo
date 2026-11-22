---
status: done
---

# Guide 26: Giỏ hàng Buyer

- Guest: dùng header `X-Cart-Session`, nhận `sessionId` lần tạo.
- Customer: dùng route `/api/v1/cart/me/*` với access token.
- Merge: `POST /api/v1/cart/merge` với header guest và access token.
- Giỏ không reserve hoặc decrement inventory.
