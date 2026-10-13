# Implementation status (2026-10-12)

## Verified

- The supplied `build.md` and pre-existing `.dist` were left untouched; work lives in `viralkit/`.
- Solidity 0.8.20 contract compiles. Hardhat suite: **14 passing**; includes referral registration/ownership, campaign configuration, atomic payouts, exact token transfer behavior, repeat purchase rejection, reentrancy, and cross-campaign use.
- Hardhat TypeScript check and lint pass. Next.js TypeScript check passes. Next.js production build completes and prerenders the landing, dashboard, developer, docs, and block explorer routes; checkout routes render on demand. The production server is running at `http://localhost:3000`; landing, dashboard, developer, docs, newsletter, and event routes all returned HTTP 200.
- Testnet ReferralHub deployment: [contract](https://testnet.monadexplorer.com/address/0xf8B23407977e7d741dD4cc8ed8De871117eA307a), [deployment transaction](https://testnet.monadexplorer.com/tx/0x3487cc59e8bb8165474c87993375acc4ed132fd5bfb1338e2ab6f77eaa169518), block `70452352`, successful receipt. Sourcify verification is complete.
- Agora AUSD is `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC`, symbol `AUSD`, 6 decimals.
- Alice (`0x56b1066f9be6Ec2A053C7F6F17001cdDc45E4681`) registered `ALICE` in [this transaction](https://testnet.monadexplorer.com/tx/0x2ab1269ceece02529c7d037df19e03ecac6a80261b402cc4ed30a5b372488977).
- Merchant created campaign 1 (newsletter) in [this transaction](https://testnet.monadexplorer.com/tx/0x02521fa7e23addf07d1ef3c3320e4885e6f29fb7b07adf610c5e7d48f07a5417) and campaign 2 (event) in [this transaction](https://testnet.monadexplorer.com/tx/0xe4af5b393c770e0090816b089c1f29c7713973b3eb09471e45bcba8cb181e191). Each costs 10 AUSD with a 20% commission.
- Bob (`0x92AA16d24eabA77a57c080f9B81f961613977eef`) completed both purchases: [newsletter](https://testnet.monadexplorer.com/tx/0x70f34f5c1c69f72f3b59e29204929e8e3ef3158e2fcc8656763a7212b3e20bbc) and [event](https://testnet.monadexplorer.com/tx/0x6f3830ffed331204a233c75fd2e9d356cec8c410e7e3bec8279ced64abbc157e). Each paid 8 AUSD to the merchant and 2 AUSD to Alice. `hasPurchased` is true for both campaigns; Alice's lifetime earnings are 4 AUSD.
- Envio generated types and TypeScript check pass. Local Envio with Docker/Postgres/Hasura is running. A live GraphQL query returned both purchase rows and aggregates: one purchase and 8 AUSD merchant revenue per campaign; Alice has two referred purchases and 4 AUSD total earnings.
- `packages/nextjs/.env.local` contains a Dynamic environment ID, contract/token addresses, campaign IDs, and the local Envio endpoint. Secrets and encrypted demo wallets remain in ignored local files.

## Still outstanding

- Dynamic browser sign-in, embedded wallet provisioning, and a transaction signed through Dynamic have not been exercised. The purchases above were signed by the locally encrypted demo buyer wallet.
- Hosting, a public Envio endpoint, demo video/screenshots, source repository publication, and hackathon submission have not been completed. No team/member data was provided.
- The production build emits one non-fatal dependency warning from the starter block explorer's viem import path (`ox/tempo` dynamic dependency). Build completes successfully.
- No external Solidity audit has been performed; this remains an unaudited hackathon MVP.
- The hackathon landing page confirms dates of September 1 to October 13, 2026, but does not show a cutoff time or timezone. Track-specific eligibility requires checking the signed-in portal; no sponsor bounty eligibility is claimed here.

## Gate summary

| Area | Status | Evidence |
| --- | --- | --- |
| Contract and local checks | Passed | 14 tests; compile, lint, and type checks pass |
| Monad Testnet | Passed | Deployed and source-verified hub; two real campaign purchases and exact payouts |
| Envio | Passed locally | Both purchases queried from local GraphQL; endpoint is not public |
| Dynamic | Configured; live flow unverified | Environment ID is present; sign-in and transaction signing still need a browser session |
| Public demo/submission | Not complete | Hosting, video, team details, and submission remain outstanding |
