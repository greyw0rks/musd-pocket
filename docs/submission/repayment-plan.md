# Approved partial-repayment proof

Builder approved on 3 November 2026. You sign from the wallet owning the Trove:
`0xe66d1c48792a320c16d7abd90c835b25a0ac37db` on Mezo testnet (31611).

Completed by the user on November 3. [Open](https://explorer.test.mezo.org/tx/0xa6f7cdd5570fd32f2ead694375072f30bdd26a4623e5b31df29337a31876b752) → [repay 10 mUSD](https://explorer.test.mezo.org/tx/0x77596c3ad14f654f73952c2f5dfdcb05bbe8d30e93ff205bc5935ab6d70c31e7) → [close](https://explorer.test.mezo.org/tx/0xa5cc358a589f8966b76c20d6d2881e765e50d25eeec2da2723406d4ec8ed93f6). The repayment proof passes after accounting for accrued interest; collateral remained 0.05 BTC. [Verified repayment](../evidence/wave-2-repayment-proof.json). The steps below document the completed sequence; do not repeat them for evidence.

1. Home → Borrow → Open a Trove. Enter **0.05 BTC** collateral and **2,000 mUSD** draw. Check the live quote, then sign once.
2. After confirmation, return to Borrow and record the actual collateral/debt. The reviewed snapshot quoted a **2 mUSD fee**, **200 mUSD reserve** and **2,202 mUSD composite debt**, about **176.81% collateral ratio**. Fresh quotes can change; this is not a fixed rate.
3. Repay → Partial repayment: enter **10 mUSD**, review and sign. No mUSD allowance approval is required. Expected remaining net debt at that quoted fee is **1,992 mUSD**, above the **1,800 mUSD** protocol minimum.
4. Save the repay explorer URL before closing. Verify 10 mUSD burned, debt reduced by 10 after accrued interest and collateral unchanged. Mezo accrues interest between blocks; compare debt at the repayment timestamp using the verified protocol formula.
5. Close the Trove when the app's refreshed checks permit it. At the reviewed fee, this burns the remaining **1,992 mUSD** from your wallet and returns **0.05 BTC** collateral. Keep mUSD and BTC for gas available. Recovery mode can prevent closing; the app must recheck.

The reviewed open-call simulation passed. This sequence requires your embedded-wallet signatures; the server relayer cannot own or repay your Trove. If a transaction has a hash but confirmation is unavailable, inspect that hash before trying again.

[Unsigned quote](../evidence/wave-2-funding-preflight.json). Record open, repay and close explorer URLs and their before/after blocks in the submission evidence. Closing alone does not prove partial repayment.

After signing, verify the repayment without another transaction:

```sh
node --env-file=.env --import tsx scripts/check-repayment-proof.ts 0xYOUR_REPAY_TRANSACTION_HASH
```
