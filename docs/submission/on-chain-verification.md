# Repay and claimYield evidence

The supplied embedded wallet is `0xe66d1c48792a320c16d7abd90c835b25a0ac37db`. The latest recorded snapshot shows a closed Trove, 2,000 sMUSD principal and approximately 187.37 mUSD claimable yield. [Recorded state and successful claim simulation](../evidence/mezo-wallet-state.json) are read-only checks; no repayment or yield claim receipt has been collected.

## Claim yield

Sign in with that wallet, open Savings and select Claim. Review and authorize the wallet transaction. Save its hash, successful explorer receipt, before/after mUSD wallet balance, sMUSD principal and claimable yield. The principal should remain unchanged and the vault should send the claimed mUSD to the wallet. The corrected display includes uncheckpointed interest; a stored mapping of zero did not mean zero accrued yield.

## Repay

Use a wallet with an active Trove, or explicitly open a new Trove in Pocket first. The supplied wallet currently has no debt to repay. Choose a small valid repayment that leaves at least the protocol’s minimum net debt. Review the amount and sign in the embedded wallet. Save the successful receipt and before/after debt and collateral; debt must decrease and collateral remain unchanged. Closing a Trove is a different operation and does not prove partial repay.

## Verify public receipts

Run the read-only verifier with the operation, actual transaction hash and public wallet:

```bash
node scripts/verify-wave1-tx.mjs claimYield 0xYOUR_TRANSACTION_HASH 0xYOUR_PUBLIC_WALLET
node scripts/verify-wave1-tx.mjs repay 0xYOUR_TRANSACTION_HASH 0xYOUR_PUBLIC_WALLET
```

It checks the network, sender, called contract, calldata and successful receipt, plus historical before/after state and transfer logs. If the RPC cannot serve historical state, keep the receipt but label the state evidence incomplete; collect snapshots around the next test. It never signs or broadcasts a transaction. Do not share private keys or session tokens.
