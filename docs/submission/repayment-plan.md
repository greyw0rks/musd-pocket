# Approved partial-repayment proof

Builder approved on 3 November 2026. You sign from the wallet owning the Trove:
`0xe66d1c48792a320c16d7abd90c835b25a0ac37db` on Mezo testnet (31611).

1. Home → Borrow → Open a Trove. Enter **0.05 BTC** collateral and **2,000 mUSD** draw. Check the live quote, then sign once.
2. After confirmation, return to Borrow and record the actual collateral/debt. The reviewed snapshot quoted a **2 mUSD fee**, **200 mUSD reserve** and **2,202 mUSD composite debt**, about **176.81% collateral ratio**. Fresh quotes can change; this is not a fixed rate.
3. Repay → Partial repayment: enter **10 mUSD**, review and sign. No mUSD allowance approval is required. Expected remaining net debt at that quoted fee is **1,992 mUSD**, above the **1,800 mUSD** protocol minimum.
4. Save the repay explorer URL before closing. Verify 10 mUSD burned, debt reduced by 10 and collateral unchanged.
5. Close the Trove when the app's refreshed checks permit it. At the reviewed fee, this burns the remaining **1,992 mUSD** from your wallet and returns **0.05 BTC** collateral. Keep mUSD and BTC for gas available. Recovery mode can prevent closing; the app must recheck.

The reviewed open-call simulation passed. This sequence requires your embedded-wallet signatures; the server relayer cannot own or repay your Trove. If a transaction has a hash but confirmation is unavailable, inspect that hash before trying again.

[Unsigned quote](../evidence/wave-2-funding-preflight.json). Record open, repay and close explorer URLs and their before/after blocks in the submission evidence. Closing alone does not prove partial repayment.

After signing, verify the repayment without another transaction:

```sh
node --env-file=.env --import tsx scripts/check-repayment-proof.ts 0xYOUR_REPAY_TRANSACTION_HASH
```
