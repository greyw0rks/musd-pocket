# mUSD Pocket

> One balance. Any chain. Spend your Bitcoin without selling it.

**Live:** https://mpocket.vercel.app

## The idea

Mezo gives Bitcoin holders a way to earn without selling. But the moment they want
to *spend* that money, it's stranded — on one chain, behind a bridge, behind a
second gas token, behind a seed phrase some people never write down.

Pocket collapses all of that into a single balance.

You sign in with X or Telegram and get a wallet that has no seed phrase. You send
money to a username, a link, or a plain address. You get paid the same way. At no
point does the chain, the bridge, or the gas token come up — because it shouldn't
have to.

## How it works

Your money lives in a vault on Mezo. When you deposit, it goes into that vault and
your balance goes up. When you send, the vault pays the other person directly.

In between, the app keeps a ledger — the same one you see as your balance — with
one detail worth caring about. When you send money, that amount is *committed*
rather than spent: it's held against the payment while the transfer is in flight,
and only really leaves when the chain confirms it. If something goes wrong, the
money goes back. Nobody's balance ever flickers.

The person receiving never needs to hold any cryptocurrency for gas. Pocket pays
that on their behalf. On Mezo, gas isn't paid in mUSD — it's paid in Bitcoin — and
the entire point of the design is that a user should never have to know that.

## What's real, and what's a demo

Pocket talks about three chains. Being honest about which ones are real matters
more than the number being three.

**Mezo is real.** It's the one chain the app actually transacts on, and every
deposit, payout, and withdrawal is a real on-chain transaction on Mezo testnet.

**Base and Ethereum are modeled.** Their token and bridge addresses are real
reference data, but no spendable mUSD exists on those testnets, so a free live
demo can't use them. Cross-chain sends there are simulated end to end — the app
records what *would* move, nets it against everything else in flight, and settles
the difference. It's a faithful sketch of a settlement system, and it is a sketch.

## Who can move your money

This is the part worth being straight about.

Your funds aren't held by a company's wallet. They sit in a smart contract, and
the only way out is through a key the app's server controls. That key can move
money in the vault — it can pay people and cash people out — but it can never
hold your money, and it can't take funds the vault doesn't have. It can also be
replaced without touching anyone's balance.

That's still a key someone has to be trusted with. A production version would
split that authority across many parties so no single one could move funds alone.
Calling that out is more useful than pretending it's not there.

## Where it stands

Pocket runs on Mezo testnet today with the real money path wired up: real
deposits, real payouts, real gasless receives, and a ledger that holds its
balance invariants under failure. Base and Ethereum routing is modeled, the
server key is a single point of trust, and shareable payment links exist in the
data model but aren't the main way people send yet.

The demo funds live in a vault on Mezo testnet —
[`0x251B…1735`](https://explorer.mezo.org/address/0x251B3302c0CcB1cFBeb0cda3dE06C2D312a41735).
