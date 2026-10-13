# Testnet deployment runbook

This runbook deploys only to Monad Testnet (chain ID 10143). Do not use mainnet.

## Before deployment

1. The user has authorized a Monad Testnet deployment. Confirm the local deployer wallet address before submitting the transaction.
2. The encrypted deployer wallet has been generated locally in `packages/hardhat/.env`. Do not send a private key or recovery phrase in chat. The Hardhat config no longer falls back to the publicly known Hardhat test key for Monad.
3. Confirm the wallet has enough test MON for deployment gas.
4. Run `yarn hardhat:compile` and `yarn test`; do not deploy if either fails.
5. Agora's documented AUSD test token is `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC`. Its code, symbol, decimals, and chain ID were checked through Monad Testnet RPC on 2026-10-12. Read those values again before creating campaigns. Agora's faucet is documented at [Get test AUSD](https://docs.agora.finance/instant-settlement/guides/getting-testnet-tokens); any faucet transaction requires the user's wallet.

## Deploy ReferralHub

From this repository root, the starter's deploy wrapper supports:

```sh
yarn deploy --network monadTestnet
```

It deploys `ReferralHub` using the locally encrypted wallet and prompts for its decryption password. The key is decrypted into the Hardhat child process environment and is never written into source files or the frontend. Deployment is complete and verified as recorded below.

After the transaction, record the real deployer, address, transaction hash, block number, and receipt status. Query `nextCampaignId()` and `MAX_COMMISSION_BPS()` on chain, then verify source through the configured Monad Sourcify endpoint if supported.

### Deployment record

- Chain ID: `10143`
- Deployer: `0x5D92A004cB5a3D64597622883fC89520acA185db`
- ReferralHub: `0xf8B23407977e7d741dD4cc8ed8De871117eA307a`
- Transaction: `0x3487cc59e8bb8165474c87993375acc4ed132fd5bfb1338e2ab6f77eaa169518`
- Block: `70452352`; receipt status: successful; gas used: `1703446`
- Sourcify: [Monad Testnet verification](https://testnet.monadexplorer.com/contracts/full_match/10143/0xf8B23407977e7d741dD4cc8ed8De871117eA307a/)
- Read-back: `nextCampaignId() = 1`; `MAX_COMMISSION_BPS() = 2500`

## Create demo campaigns

Two campaigns have been created on the deployed hub: newsletter access (ID 1) and an event pass (ID 2). Both use Agora AUSD, cost 10 AUSD, and pay a 20% referral commission. The local frontend is configured with these campaign IDs.

Alice registered `ALICE`; Bob purchased both campaigns. The confirmed purchase transactions are [newsletter](https://testnet.monadexplorer.com/tx/0x70f34f5c1c69f72f3b59e29204929e8e3ef3158e2fcc8656763a7212b3e20bbc) and [event](https://testnet.monadexplorer.com/tx/0x6f3830ffed331204a233c75fd2e9d356cec8c410e7e3bec8279ced64abbc157e). Each paid 8 AUSD to the merchant and 2 AUSD to Alice, and Bob's onchain access flag is true for both. The purchase transactions were signed by the locally encrypted demo buyer wallet, not Dynamic.

## Envio

The [indexer project](indexer/README.md) uses the deployed hub address and start block in its ignored local `.env`. Code generation and TypeScript checking pass; local Envio is running with Docker/Postgres/Hasura. A GraphQL query returned both purchase rows and their actual payout amounts. Its endpoint is `http://localhost:8080/v1/graphql` and is not publicly hosted. Configure `NEXT_PUBLIC_ENVIO_GRAPHQL_URL` with a hosted Envio endpoint before presenting a public demo.
