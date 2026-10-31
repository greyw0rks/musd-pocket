# Pocket external-user and merchant pilot

Track 2: Access and Distribution for MUSD/MEZO. Run the pilot on Mezo testnet; tokens and pricing tests have no real-money value.

## Recruit and record

Proposed targets: 10–20 independent users, 20 completed transfers, five paid requests, and two or three merchants. These are targets, not achieved traction or official judging thresholds. Ask participants to use their own Pocket account and wallet. Tag developer-controlled wallets separately. Obtain consent before publishing feedback, screenshots, addresses or identifying details.

Recruitment draft, for the project owner to send:

> I'm testing Pocket, a Mezo payment app with social sign-in, a wallet, borrowing and Savings. Would you try a testnet payment and tell me where it feels confusing? Merchants can create a payment link or QR and receive mUSD directly. Testing takes about 10 minutes; testnet assets have no monetary value.

No invitations have been sent by the coding agent.

## User session

1. Sign in, create the embedded wallet, and record a pseudonymous participant ID.
2. Claim the 0.06 BTC / 300 mUSD faucet allowance. Prior users can claim once in the new round. The separate MEZO welcome campaign has a finite budget; do not promise all participants a claim when it is empty.
3. Send a small mUSD transfer to another independent participant and confirm both wallets and the explorer receipt.
4. Create a Request from that participant. Check that payment goes to the requester. Open the incoming request, pay through checkout, and verify both sides show confirmation.
5. Return on another day for a second payment. Record return dates and feedback.

Ask: What was unclear? Did you understand who receives the payment and who pays gas? Would you use it again, and for what?

## Merchant session

1. Open Home → Accept mUSD. Save the business name and create a small invoice for a real pilot service or order.
2. Share its payment link or QR with an independent customer. The phone's camera can open the QR; Pocket also accepts pasted checkout links.
3. Customer reviews amount, recipient and BTC gas, then signs a direct mUSD transfer. Merchant checks the confirmed invoice and their wallet balance.
4. Close the customer's browser after a submitted pending hash and confirm merchant polling recovers the receipt. Retry receipt confirmation without sending twice.
5. Test an expired unpaid invoice. It must not offer a new payment. Collect feedback on a possible disclosed merchant fee and gas coverage. Pilot service fees are zero.

## Evidence

Use [pilot-evidence.csv](pilot-evidence.csv) for actual activity only. Keep original hashes and explorer links, plus consented screenshots and short feedback. A wallet alone is not a person; independently recruited users and returning sessions need separate evidence. Reverted transactions, faucet claims, welcome claims, simulations and owner-controlled transfers do not count as completed customer payments.

For the reviewer’s remaining money paths, use [on-chain verification](on-chain-verification.md). Finish those receipts and independent adoption before calling the remediation complete.
