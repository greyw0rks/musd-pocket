# PocketVault — MUSD Pocket on-chain leg

Minimal liquidity vault for MUSD Pocket. Holds MUSD and releases it only on the
authority of the off-chain settlement engine. One real deployment target: **Mezo
testnet (chain id 31611)**. Base/Ethereum vaults are modeled in the ledger, not
deployed.

## Contract

`src/PocketVault.sol`
- `deposit(amount, paymentId)` — pulls MUSD via `transferFrom` (needs prior approve); emits `Deposit`.
- `payout(to, amount, paymentId)` — **ENGINE_ROLE only**; releases liquidity to a Pocket recipient; emits `Payout`.
- `withdraw(to, amount, paymentId)` — **ENGINE_ROLE only**; cashes out to an external address; emits `Withdraw`.
- `liquidity()` — current MUSD balance.
- Idempotent per `paymentId` (shared replay guard across payout/withdraw), `ReentrancyGuard`, OpenZeppelin `AccessControl` + `SafeERC20`.

Trust model: the vault custodies funds; the ENGINE_ROLE key can *move* them but
never *holds* them. Admin can rotate the engine role.

## Develop

Dependencies are not vendored — restore them first:

```bash
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0
```

Then:

```bash
forge build
forge test -vvv
```

## Deployed

**PocketVault — Mezo testnet (31611): `0x251B3302c0CcB1cFBeb0cda3dE06C2D312a41735`**
(admin = engine = relayer `0xBA46d08B9E298E8E70096Fc238Da207139BCCAB7`; seeded with 50 mUSD).

## Deploy (real on-chain action — confirm first)

Copy `.env.example` → `.env`, fill in `MUSD_ADDRESS`, `VAULT_ADMIN`,
`VAULT_ENGINE`, `DEPLOYER_PRIVATE_KEY`, then:

```bash
# Dry run (no broadcast)
forge script script/DeployPocketVault.s.sol --rpc-url mezo_testnet

# Broadcast to Mezo testnet
forge script script/DeployPocketVault.s.sol --rpc-url mezo_testnet --broadcast
```
