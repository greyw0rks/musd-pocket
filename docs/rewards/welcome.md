# Pocket welcome reward

One welcome claim gives a synced Pocket account **200 testnet MEZO**, locked for **two weekly epochs** as a veMEZO NFT owned by its verified wallet. Pocket's relayer pays the claim gas. The faucet is a separate **0.06 BTC / 300 mUSD** claim in round `btc-0.06-v2`. Previous users can claim this new faucet allowance once; resetting faucet eligibility does not reset the one-time MEZO welcome reward.

The welcome campaign is deployed at `0x3469818359ce1bae2d137531dcd78c5cc4ec14ba`, funded with **200 MEZO (one claim)**, and configured in the live Pocket app. The first authenticated user claim remains pending. [Deployment, funding receipts and a successful real-token/escrow claim simulation](../evidence/welcome-rollout.json). With the campaign setting unset or its inventory depleted, the app reports that rewards are unavailable.

## Verified protocol configuration

| Item | Mezo testnet value |
| --- | --- |
| Chain | 31611 |
| MEZO token | `0x7B7c000000000000000000000000000000000001` |
| veMEZO escrow | `0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b` |
| Implementation observed at block 16,492,615 | `0x9665873019a05bEe102903C9df602da06555AE0A` |
| Claim amount | 200 MEZO, 18 decimals |
| Lock duration input | 1,209,600 seconds (two weeks) |

The supplied address is Mezo's **escrow**, not a faucet or reward distributor. Its verified ABI exposes `createLockFor(uint256,uint256,address)`. `locked(uint256)` returns `(int128 amount, uint256 end, bool isPermanent, uint256 boost)`.

Mezo computes `floor((block.timestamp + 2 weeks) / 1 week) * 1 week`. The actual wait is greater than seven days and at most fourteen days. On Saturday 31 October, this is roughly eleven days, with expiry on 12 November at 00:00 UTC. The app previews the exact boundary and shows the original expiry from the confirmed claim. It does not promise an eleven-day duration to future users. Existing positions can later be extended, transferred, split, merged or withdrawn in Mezo; the welcome receipt is historical evidence rather than a live position balance.

Sources: [user-supplied Mezo lock page](https://testnet.mezo.org/earn/lock/0x7B7c000000000000000000000000000000000001), [verified escrow proxy](https://api.explorer.test.mezo.org/api/v2/smart-contracts/0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b), [verified implementation](https://api.explorer.test.mezo.org/api/v2/smart-contracts/0x9665873019a05bEe102903C9df602da06555AE0A), [official locking guide](https://mezo.org/docs/users/mezo-earn/lock/vemezo/how-to-lock-mezo.md).

## Claim flow and authority

1. After the faucet is claimed, the Home gift icon opens **Welcome reward**.
2. The API verifies the Privy bearer identity and requires an existing synced user. It resolves the recipient from that identity. Request bodies cannot select an address, amount, account ID or lock duration.
3. The server derives a stable, namespaced hash of the Privy account ID and reads the campaign at a pinned block. It checks chain, MEZO token, veMEZO escrow, fixed terms, authorizer, pause status, inventory and gas availability.
4. The relayer signs a five-minute EIP-712 voucher bound to account hash, recipient, chain and campaign, simulates it, then relays the claim.
5. `PocketWelcomeReward` atomically records account and wallet replay guards and calls `createLockFor`. It verifies the resulting NFT owner, amount and weekly expiry. A failed lock rolls back the entire operation.
6. The on-chain claim record is authoritative after a crash or retry. A pending transaction remains pending until confirmed; a matching reverted transaction permits retry. Account and wallet guards prevent a second reward even if two servers send concurrently. A losing transaction can still consume gas.

Eligibility is one claim per authenticated account and wallet **per campaign deployment**. It does not establish that every account belongs to a different person. Redeploying a campaign creates a fresh on-chain eligibility set; preserve the existing deployment for a one-time welcome program.

Only unused campaign inventory is held by the campaign. Claimed tokens reside in Mezo's escrow, and the recipient owns the NFT. The campaign admin can pause new claims and recover unused inventory while paused; it cannot withdraw a user's position. The authorizer can approve claims against the funded budget. Keep the admin separate from the relayer for a larger rollout.

## Activation

Deploy `contracts/script/DeployPocketWelcomeReward.s.sol` on chain 31611 with:

- `WELCOME_REWARD_AUTHORIZER`: the public address corresponding to the app's existing `RELAYER_PRIVATE_KEY`.
- `WELCOME_REWARD_ADMIN`: the selected campaign admin.
- A BTC-funded deployer supplied through `--sender` for a dry run, and a privately configured CLI signer/keystore for an authorized broadcast.

The script deploys only; it does not transfer reward inventory. Run without `--broadcast` first to review the deployment. Real deployment and funding require operator authorization.

```bash
cd contracts
forge install foundry-rs/forge-std@v1.9.6 OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
forge script script/DeployPocketWelcomeReward.s.sol --sender YOUR_PUBLIC_DEPLOYER_ADDRESS --rpc-url mezo_testnet
```

Fund the verified deployed campaign with an explicit testnet MEZO budget. For `N` welcome claims, it needs `200 * N` MEZO; the relayer also needs BTC for gas. Public reads observed **200 MEZO** at the existing relayer `0xBA46d08B9E298E8E70096Fc238Da207139BCCAB7`, enough for one claim, and zero MEZO at the supplied embedded wallet. These are snapshots, not a guarantee of current balances. The rollout transferred that 200 MEZO into the deployed campaign; additional claims require additional funding.

Then set server variables `POCKET_WELCOME_REWARD_ADDRESS` to the deployed **campaign** address and `POCKET_WELCOME_REWARD_CHAIN_ID=31611`. Do not put the veMEZO escrow address in the campaign variable. Verify getters, funded inventory and a simulated claim before enabling the deployment.

## Validation

```bash
pnpm exec vitest run --config vitest.rewards.config.ts
cd contracts
forge test --no-match-contract PocketWelcomeRewardForkTest
MEZO_REWARD_FORK_RPC=https://rpc.test.mezo.org forge test --match-contract PocketWelcomeRewardForkTest -vv
```

Unit tests cover voucher binding, cross-chain and cross-campaign replay, account/wallet uniqueness, atomic rollback, ownership, epoch rounding, expiry and inventory recovery. API tests cover unavailable configuration/funding, trusted recipient binding, confirmation timeout, restart recovery and reverted claims. The optional fork test calls the real deployed veMEZO contract on a **local fork**, replacing the Cosmos MEZO precompile with a mintable EVM test token. It is not evidence of a live MEZO transfer or real-user adoption.
