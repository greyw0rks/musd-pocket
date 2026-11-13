# Pocket merchant pilot record — 12 November 2026

**Status: builder payment verified; independent customer pilot pending.**

Merchant operator: [@musd_pocket](https://x.com/musd_pocket), confirmed by the builder. Business profile **Pocket** is configured for its existing wallet `0x0a5e59ca4f182561de80172c6da5db927091ea29`. The confirmed offer is **Pocket closed-mainnet waitlist**, priced at **100 testnet mUSD**. This is builder-operated; independent customers use their own accounts and wallets.

The first [pilot invoice](https://mpocket.tech/pay/89YAGVPYD8ZXYE6FJWZUK652) was paid with 100 testnet mUSD on November 3 at 22:39:35 UTC. The sender, `0xe66d1c48792a320c16d7abd90c835b25a0ac37db`, is the builder's Trove/Savings test wallet. The November 12 read-only check confirms the PAID invoice and matching Activity record. Use this link as a receipt; prepare a new invoice for an independent customer. The per-wallet waitlist flow reuses that wallet's own invoice. [Original setup](../evidence/wave-2-waitlist-pilot.json) · [Current snapshot](../evidence/wave-2-pilot-snapshot-2026-11-12.json).

1. Sign into Pocket with the intended X identity and confirm its wallet.
2. Profile → Payment profile → Business; save the public business name.
3. Create an invoice for the agreed item/service, exact mUSD price and description.
4. Share its link/QR yourself with the intended customer. Each invoice records one payment; create another for the next customer.
5. Customer signs in, checks the merchant, amount and wallet, and pays once. Use Check confirmation for a pending transaction.
6. Verify paid invoice, wallet balances and Activity after reload; record fulfillment and feedback.
7. Use Send from the business account for intended outgoing payments; retain the receipt.
8. Repeat with another independent customer and later a returning customer.

The X page distributes links; Pocket signs payments. Own-wallet transfers are not independent adoption. A testnet purchase validates the workflow, not real-money revenue.

| Field | Result |
| --- | --- |
| Date / app deployment | Paid November 3; verified November 12, 2026 / mpocket.tech |
| Merchant public name / X handle | Pocket / @musd_pocket |
| Merchant wallet | 0x0a5e59ca4f182561de80172c6da5db927091ea29 |
| Item/service / exact mUSD price | Closed-mainnet waitlist / 100 testnet mUSD |
| Customer public alias, with consent | Builder wallet; no independent customer alias supplied |
| Independent of builder's wallets? | No — same wallet used for the Trove/Savings checks |
| Invoice URL | https://mpocket.tech/pay/89YAGVPYD8ZXYE6FJWZUK652 |
| Transaction explorer URL | [100-mUSD receipt](https://explorer.test.mezo.org/tx/0x056b918e9620de6ef203312880f6dc6872e8db71ac2d7edf59c58f074a363195) |
| Paid status after reload | PAID invoice and Activity agree in the database; physical Android reload not verified |
| Item/service delivered? | Builder test; mainnet access is not activated by payment |
| Steps completed without help | No independent observation recorded |
| Confusing step / exact feedback | No independent customer feedback recorded |
| Will use again / why | Not measured with independent customers |
| Return transaction | Pending independent pilot |

## Independent pilot prepared for the next milestone

Planning target: one merchant and two independent customers, followed by a return payment. This is a project target, not a Buildathon minimum.

For each customer, record the public invoice and transaction links, confirmation after reload, item/service fulfillment, the steps completed without help, exact feedback and any return transaction. Confirm independence directly with the participant; a different wallet address alone does not prove it. Keep the original builder receipt and historical setup records intact.

| Observation | Current result |
| --- | --- |
| Independent customer invoice / receipt | Awaiting actual customer payment |
| Fulfilled item or service | Awaiting observation |
| Customer feedback | Awaiting observation |
| Return payment | Awaiting observation |

Suggested invitation text for the builder to share:

> I’m testing Pocket merchant checkout on Mezo Testnet. You can sign in, pay an invoice in testnet mUSD and check the receipt. I’d like feedback on the payment steps and whether you would use this for an actual purchase. We’ll record the invoice, fulfillment and any repeat use as a small pilot.

Keep private identity/contact details outside the public repo. Record missing and failed observations honestly. Separate customer demand from app tests.
