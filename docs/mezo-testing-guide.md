# Pocket pilot guide

Use the [Mezo testnet app](https://mpocket.tech/home) or [Android 0.2.5](https://mpocket.tech/downloads/mpocket-0.2.5.apk). For local testing open `http://localhost:3000/home`. Each tester uses their own account and wallet. Record observations below; a passed local test is not an independent user result.

## Merchant and customer

1. Merchant: Profile → Payment profile → Business. Save a recognizable business name, reload, and verify it remains.
2. Create a 1 mUSD payment link. Verify the business name is prefilled. Share the link or QR with the customer yourself.
3. Customer: open the link while signed out, sign in, and confirm it returns to that invoice. Check name, amount, network and receiving wallet.
4. Make the intended payment once. If confirmation is slow, use Check confirmation. Record its explorer URL.
5. Both: verify the paid invoice, wallet balances and Activity entry. Reload and reopen the invoice; it should not offer another payment.
6. Merchant: rename the business, create another link and verify the new name. The old invoice should keep its original name. Also test an expired/cancelled link without paying it.

## Navigation, Swap, Wealth and Savings

1. Verify the dock reads **Home · Swap · Wealth**. Open Wealth, visit Vault, Lock and Pools, then return using Back. Payment history is still under Home → View All.
2. Compare Savings principal and claimable interest with chain reads. An unavailable read should show unknown, not zero. Claim only if there is positive yield and you intend the transaction.
3. After a claim, record its receipt and actual mUSD received. If an error appears after wallet confirmation, use Check claim confirmation. A lost response can be recovered using its saved hash or nonce. Review claim again, when offered, preserves the original nonce. Reload during pending confirmation and check the existing claim.
4. In Lock, compare veBTC IDs, ownership, amounts and expiry with the explorer. With BTC for both principal and gas, enter a small intended amount, review the exact weekly unlock date, approve the BTC ERC-20 precompile, then separately confirm Create lock. Record the NFT, amount and owner. Use Manage to add BTC or extend; verify the resulting amount/date. The testnet maximum is 30 days, rounded down to a weekly boundary. Withdraw only after the unlock date. A permanent BTC lock's Start unlock sets a date up to 30 days away. The Existing MEZO tab preserves previous positions; those permanent locks retain the protocol's 208-week countdown.
5. In Pools, choose a funded pair and enter both deposit amounts. Review estimates, minimum amounts, slippage and the receiving wallet. Approve each asset separately, then separately confirm Add liquidity. Check the LP balance, remove a chosen percentage, and compare both returned tokens with the receipt. Claim fees when the displayed claimable amount is positive. An empty pool should explain that its first deposit sets the price; stable first deposits must contain equal normalized amounts.
6. Open Swap from the dock. Choose a liquid pair and direction. Enter a small intended amount, review the estimated and minimum received amounts, pool fee, slippage and recipient. Complete any approval, then separately confirm the swap. Verify input spent and output received. Switch direction and verify the input asset and amount field change correctly. An empty pair must explain why it cannot quote.
7. For any pending swap/pool/lock transaction, close and reopen the screen (or reload) and use Check confirmation. This must not prompt another signature. Rejecting a wallet request must not show success. If the wallet provides no hash, check its history; clear the saved request only when it was never sent. Each tester uses their own wallet; no server operator should sign on their behalf.

## Faucet and weekly tasks

1. Use the testnet faucet for starting BTC and mUSD. The welcome reward has ended.
2. Open Home → Weekly tasks. The checklist is available immediately and includes Lock BTC.
3. Complete an intended payment or protocol action and verify its task progress follows the confirmed receipt. Different-friend sends must use five distinct wallets; referrals require qualifying new accounts.
4. Tasks reset each Monday at 00:00 UTC. The checklist does not promise a weekly token payout.

## Borrow repayment (requires an active loan)

Review the collateral, debt, borrowing fee and minimum remaining debt before any new borrowing. Pick an exact partial repayment that leaves net debt above the current minimum. Confirm once, then compare receipt calldata, mUSD spent, debt reduction and unchanged collateral. Record the before/after blocks. Closing a loan is not a partial repayment test.

## Feedback record

- Tester alias / role:
- Date, device, browser and build URL:
- Scenario:
- Completed without help? If not, where did help become necessary?
- Expected / actual result:
- Transaction or invoice link (omit private session tokens):
- Most confusing wording or control:
- Screenshot or recording reference, if the tester chooses to share one:
- Follow-up issue and retest outcome:

Leave results blank until a tester actually completes the scenario.
