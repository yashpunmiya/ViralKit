# ViralKit

**Referral infrastructure for apps on Monad.**

ViralKit gives apps a shared referral identity and onchain campaign checkout. A confirmed purchase can split an ERC-20 payment between a merchant and its referrer in one transaction. Merchants manage campaigns, referrers share campaign links, and developers can integrate the checkout with the ViralKit client SDK.

> **Network status:** The current deployment targets Monad Testnet (chain ID `10143`). MON and AUSD on this network are test assets and have no real-world value. The smart contract has not received an independent security audit.

## Product areas

- `/` — product overview and onboarding
- `/onboarding` — connect a wallet and choose a workflow
- `/creator` — create campaigns and review campaign activity
- `/creator/campaign/[campaignId]` — campaign details and indexed purchases
- `/dashboard` — referral code, links, onchain earnings, and Envio activity
- `/developer` and `/docs` — campaign setup and integration guidance
- `/examples` — working newsletter and event checkout examples
- `/settings` — connected account settings

Campaigns, balances, payments, and referral earnings are read from Monad Testnet. Purchase history is read from the configured Envio HyperIndex GraphQL endpoint; it may appear after the chain confirms the transaction and the indexer processes its event.

## Requirements

- Node.js `20.18.3` or newer
- Yarn `3.2.3`
- Docker, if you want to run the Envio indexer locally

## Run locally

Install dependencies and create the frontend environment file:

```sh
yarn install
cp packages/nextjs/.env.example packages/nextjs/.env.local
```

Set `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` and the deployed contract, token, and campaign values in `packages/nextjs/.env.local`. For local Envio indexing, configure `indexer/.env` from `indexer/.env.example`, start the Envio service with Docker using the [indexer guide](indexer/README.md), and set `NEXT_PUBLIC_ENVIO_GRAPHQL_URL` to its GraphQL endpoint. Do not commit `.env` files or wallet secrets.

Start the app in development mode:

```sh
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). Build and serve the production app with:

```sh
yarn next:build
yarn start
```

## Project commands

```sh
yarn hardhat:compile       # Compile contracts
yarn hardhat:test          # Run contract tests on the local Hardhat network
yarn hardhat:check-types   # Check contract tooling TypeScript
yarn next:check-types      # Check frontend TypeScript
yarn next:build            # Build the production frontend
```

## Configuration

The frontend template is [packages/nextjs/.env.example](packages/nextjs/.env.example). The indexer template is [indexer/.env.example](indexer/.env.example). The deployed Monad Testnet contract and AUSD addresses are recorded in the frontend example and [deployment runbook](DEPLOYMENT.md).

Dynamic uses a public environment identifier in the browser. Never put a private key, seed phrase, or other signing secret in a `NEXT_PUBLIC_` variable or in source control. Wallet actions are signed by the connected wallet.

## Architecture

- `packages/hardhat/contracts/ReferralHub.sol` — referral registration, campaign terms, and atomic ERC-20 settlement
- `packages/nextjs/lib/viralkit/` — viem client and integration helpers
- `packages/nextjs/app/` — product, account, checkout, and example routes
- `indexer/` — Envio HyperIndex event handlers, schema, and GraphQL configuration

The deployed contract is immutable and does not require a redeployment to run the existing app. Treat contract changes and any deployment as a separate reviewed release. Keep the existing deployed addresses when configuring an environment.

## SDK

The SDK is currently included as a source module in this repository; it is not published as an npm package. Example:

```ts
import { createViralKitClient } from "~~/lib/viralkit";

const viralKit = createViralKitClient({ publicClient, walletClient });
const referrer = await viralKit.resolveReferralCode("ALICE");
const campaign = await viralKit.getCampaign(campaignId);
const hash = await viralKit.purchaseWithReferral(campaignId, "ALICE");
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("Purchase failed");
const accessGranted = await viralKit.hasPurchased(campaignId, buyerAddress);
```

Wait for a successful receipt and verify access onchain before granting a product entitlement. See `/docs` for the integration flow and `/examples` for working checkout implementations.

## Licenses

See [LICENCE](LICENCE) and the third-party notices retained with bundled dependencies.
