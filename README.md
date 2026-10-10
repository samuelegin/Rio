# Rio

A standalone community governance app on Monad Testnet. It talks only to the deployed `RioGovernance` contract: create proposals, vote For / Against / Abstain, watch the tally update. It knows nothing about Rhizome. That is the point: votes made here become the relationship evidence Rhizome reads.

```bash
npm install
npm run dev
```

Wallet connect and disconnect use RainbowKit. Browser wallets (MetaMask, Rabby) work out of the box. For WalletConnect and mobile wallets, copy `.env.example` to `.env` and set `VITE_WALLETCONNECT_PROJECT_ID` (free at cloud.reown.com). You need Monad Testnet MON. The contract address is in `src/chain.js`. Deploy to Vercel as a normal Vite app.

## Demo flow with Rhizome

1. With an anchor wallet, create a proposal (30 days) in Rio. Vote with every anchor wallet.
2. Judge connects their wallet in Rio and votes on that proposal.
3. After the registrar runs, open the Rhizome app and the judge's wallet shows as a member.
