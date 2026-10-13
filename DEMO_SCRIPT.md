# ViralKit demo script

## Verified 90-second story

1. Open the landing page and introduce ViralKit as a shared referral identity and onchain rewards layer for Monad apps.
2. Show `/dashboard` and the `ALICE` identity. Alice registered on Monad Testnet in [this transaction](https://testnet.monadexplorer.com/tx/0x2ab1269ceece02529c7d037df19e03ecac6a80261b402cc4ed30a5b372488977).
3. Show the newsletter purchase: [Bob's transaction](https://testnet.monadexplorer.com/tx/0x70f34f5c1c69f72f3b59e29204929e8e3ef3158e2fcc8656763a7212b3e20bbc). It cost 10 AUSD, paid 8 AUSD to the merchant and 2 AUSD to Alice, and unlocked Bob's campaign access.
4. Show the event pass as a separate campaign using the same code: [Bob's second transaction](https://testnet.monadexplorer.com/tx/0x6f3830ffed331204a233c75fd2e9d356cec8c410e7e3bec8279ced64abbc157e). It produced the same 8/2 AUSD split.
5. Return to `/dashboard`. The chain reports 4 AUSD in referral earnings, and local Envio returns both actual purchase rows. The endpoint is `http://localhost:8080/v1/graphql`.
6. Show `/developer` and `/docs` for the campaign and SDK integration surfaces.

## Local setup

From the repository root, run `yarn next:build` followed by `yarn next:serve`, then open `http://localhost:3000`. Keep the local Envio service running for indexed history. The frontend environment needs the Monad contract/token addresses, campaign IDs `1` and `2`, the Dynamic environment ID, and `NEXT_PUBLIC_ENVIO_GRAPHQL_URL=http://localhost:8080/v1/graphql`.

The onchain proof above used the locally encrypted demo wallets. Dynamic browser sign-in and a Dynamic-signed transaction still need to be verified before presenting Dynamic as a tested integration. Never display a private key or recovery phrase during recording.
