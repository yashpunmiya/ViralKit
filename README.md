# ViralKit

**One referral identity. Every Monad app. Instant rewards.**

ViralKit is reusable referral and payment-splitting infrastructure for Monad applications. A wallet registers one code, merchants create separate campaigns, and a confirmed purchase pays the merchant and referrer atomically. It is infrastructure with two small sample apps, not a marketplace.

## Project status

The Next.js app builds, the contract suite passes, and the full two-campaign purchase flow has been executed on Monad Testnet. Each purchase sent 8 AUSD to the merchant and 2 AUSD to Alice; Envio indexed both purchase events. Dynamic is configured with the user's environment ID, but browser sign-in and Dynamic-signed transactions have not yet been verified. The Envio service is local only. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for evidence and remaining submission work.

## What is included

- `packages/hardhat/contracts/ReferralHub.sol`: permanent referral-code registry, merchant campaigns, and atomic ERC-20 payouts.
- `packages/nextjs/lib/viralkit/`: isolated viem SDK used by both demo routes.
- `/demo/newsletter` and `/demo/event`: separate campaign checkouts with approval, receipt confirmation, and contract-verified access unlock.
- `/dashboard`: onchain referral identity and earnings plus separately labelled Envio activity.
- `/developer` and `/docs`: merchant campaign form and integration guide.
- `indexer/`: Envio HyperIndex config, entities, and event handlers.

## Local development

Requirements: Node 20.18.3+, Yarn 3.2.3. Then:

```sh
yarn install
yarn hardhat:compile
yarn test
yarn next:check-types
yarn next:build
yarn start
```

For Dynamic, copy `packages/nextjs/.env.example` to `packages/nextjs/.env.local` and enter the environment ID from your Dynamic dashboard. For local contract interaction, deploy to Hardhat using `yarn chain` and `yarn deploy`; demo checkouts still need an ERC-20 contract and campaign IDs on that local chain.

## Monad Testnet configuration

The app targets chain ID `10143`, RPC `https://testnet-rpc.monad.xyz/`, and explorer `https://testnet.monadexplorer.com`. Agora documents testnet AUSD at `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC`; the app reads its symbol and decimals from the token contract instead of assuming decimals. See [DEPLOYMENT.md](DEPLOYMENT.md) for the gated deployment sequence and [Agora's test token guide](https://docs.agora.finance/instant-settlement/guides/getting-testnet-tokens).

Never place an unencrypted private key or recovery phrase in chat, source control, or a `NEXT_PUBLIC_` variable. The scaffold's encrypted local Hardhat wallet flow keeps deployment signing local.

### Verified testnet demo

- Chain: Monad Testnet (`10143`)
- ReferralHub: [`0xf8B23407977e7d741dD4cc8ed8De871117eA307a`](https://testnet.monadexplorer.com/address/0xf8B23407977e7d741dD4cc8ed8De871117eA307a)
- AUSD: `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` (6 decimals)
- Campaign 1: newsletter access; campaign 2: event pass. Each costs 10 AUSD with a 20% commission.
- Alice registered `ALICE`; Bob purchased once in each campaign. His paid access is confirmed onchain for both.
- Newsletter purchase: [transaction](https://testnet.monadexplorer.com/tx/0x70f34f5c1c69f72f3b59e29204929e8e3ef3158e2fcc8656763a7212b3e20bbc)
- Event purchase: [transaction](https://testnet.monadexplorer.com/tx/0x6f3830ffed331204a233c75fd2e9d356cec8c410e7e3bec8279ced64abbc157e)
- Each 10 AUSD purchase paid 8 AUSD to the merchant and 2 AUSD to Alice. Alice's lifetime referral earnings are 4 AUSD.
- Both purchase rows are present in the local Envio GraphQL API at `http://localhost:8080/v1/graphql`. This endpoint is not public.

## SDK example

```ts
// Local source module; ViralKit does not publish an npm package yet.
import { createViralKitClient } from "~~/lib/viralkit";

const viralKit = createViralKitClient({ publicClient, walletClient });
const referrer = await viralKit.resolveReferralCode("ALICE");
const campaign = await viralKit.getCampaign(campaignId);
const purchaseHash = await viralKit.purchaseWithReferral(campaignId, "ALICE");
const receipt = await publicClient.waitForTransactionReceipt({ hash: purchaseHash });
if (receipt.status !== "success") throw new Error("Purchase failed");
const hasAccess = await viralKit.hasPurchased(campaignId, buyerAddress);
```

`purchaseWithReferral` checks the campaign, token balance, and allowance, requests an exact approval when needed, and then submits the purchase. Apps must wait for a successful receipt and verify `hasPurchased` before unlocking access. Campaign IDs and contract addresses are environment configuration, not embedded in the SDK.

## Payout behavior and limitations

For a campaign with a 10 AUSD price and 2,000 basis point commission, a referred buyer pays 10 AUSD, the merchant receives 8 AUSD, and the registered referrer receives 2 AUSD in the same transaction. A purchase without a referral pays the full price to the merchant. Each campaign represents one-time access: a buyer cannot purchase the same campaign twice.

The contract supports ordinary ERC-20 tokens with exact transfer behavior. It rejects fee-on-transfer behavior, uses OpenZeppelin `SafeERC20` and `ReentrancyGuard`, keeps no purchase funds under ordinary tokens, has no admin or upgrade key, and has a 25% commission cap. It is an unaudited hackathon MVP, not an audited production protocol.

## Architecture and attribution

The repository was created from [Monad Developers' scaffold-monad-hardhat](https://github.com/monad-developers/scaffold-monad-hardhat), which builds on Scaffold-ETH 2. Existing MIT notices remain in the repository. The independent `ReferralHub` uses OpenZeppelin contracts already present in the starter.

[Base's Flywheel](https://github.com/base/flywheel) is MIT licensed and documents reusable referral identities and ERC-20 rewards. Its modular campaign-hook and treasury architecture is broader than this demo needs. ViralKit therefore implements a small independent contract rather than copying Flywheel source. The contract is new hackathon work; the frontend, build tooling, and dependencies retain their respective upstream licenses and notices.

## Submission material

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the walkthrough and transaction evidence and [HACKATHON_SUBMISSION.md](HACKATHON_SUBMISSION.md) for a draft that labels missing public submission assets.
