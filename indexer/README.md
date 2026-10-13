# ViralKit Envio indexer

This HyperIndex project indexes the `ReferralHub` events on Monad Testnet (10143). `PurchaseCompleted` is the canonical purchase record: merchant revenue and referrer rewards are fields on that event, so the handler stores one purchase and updates aggregates once.

## Configure and run

Use Node.js 22+, Docker Desktop with WSL 2 integration enabled for Ubuntu, and an Envio API token. Envio's CLI does not run natively on Windows. The local `.env` is configured with the token, deployed hub address, and deployment block; keep it private. Store the working copy under the WSL Linux home directory instead of `/mnt/c` to avoid slow Windows filesystem access.

```sh
pnpm install
pnpm codegen
pnpm typecheck
pnpm dev
```

Envio Cloud deployments use the same config and handler. Set `NEXT_PUBLIC_ENVIO_GRAPHQL_URL` in the frontend to the resulting GraphQL endpoint. The dashboard labels indexed activity separately from direct contract reads because indexing can lag.

Code generation and TypeScript checking pass under WSL 2. `envio dev` is running on this machine with Docker Desktop's local proxy. The GraphQL API is at `http://localhost:8080/v1/graphql`; indexing can lag behind chain activity. For a fresh setup, enable Docker Desktop WSL integration for Ubuntu, copy the indexer source and `.env` into a directory under `~/`, then run the commands above from there.
