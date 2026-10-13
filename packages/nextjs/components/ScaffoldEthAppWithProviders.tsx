"use client";

import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { SiteShell } from "~~/components/viralkit/SiteShell";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => <SiteShell>{children}</SiteShell>;

export const ScaffoldEthAppWithProviders = ({ children }: { children: React.ReactNode }) => {
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
  const app = (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ScaffoldEthApp>{children}</ScaffoldEthApp>
      </QueryClientProvider>
    </WagmiProvider>
  );

  if (!environmentId) return app;

  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [EthereumWalletConnectors],
        overrides: {
          evmNetworks: [
            {
              blockExplorerUrls: ["https://testnet.monadexplorer.com"],
              chainId: 10143,
              name: "Monad Testnet",
              iconUrls: ["https://app.dynamic.xyz/assets/networks/monad.svg"],
              nativeCurrency: { decimals: 18, name: "Monad", symbol: "MON" },
              networkId: 10143,
              rpcUrls: ["https://testnet-rpc.monad.xyz"],
              vanityName: "Monad Testnet",
            },
          ],
        },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            <ScaffoldEthApp>{children}</ScaffoldEthApp>
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
};
