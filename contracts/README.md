# Pocket contracts

Current payments are direct wallet transfers; they do not call PocketVault.
The legacy vault below describes the earlier deployment. Mezo Troves, Savings,
router, pools and veMEZO are existing protocol contracts used by the app.

## PocketWelcomeReward — activation pending

`src/PocketWelcomeReward.sol` implements one 20-testnet-MEZO reward per identity
hash and wallet per campaign deployment. EIP-712 authorization binds the
recipient and deadline; the campaign creates a recipient-owned veMEZO NFT for
two weekly epochs (7–14 days after rounding). A persistent server reservation
prevents blind repeat broadcasts.

Deployment script: `script/DeployPocketWelcomeReward.s.sol`. Review the admin,
authorizer and inventory budget; deploy, verify and fund the campaign before
setting `POCKET_WELCOME_REWARD_ADDRESS`. Deployment does not fund it.
The database also needs `prisma/sql/2026-11-02-merchant-and-rewards.sql`.

[Configuration, safeguards and activation steps](../docs/mezo-wealth.md).
Unit tests cover signature replay, NFT ownership, expiry and rollback; fork
tests use mock tokens for Cosmos precompiles and do not prove live funding.

## PocketVault — legacy on-chain leg

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
