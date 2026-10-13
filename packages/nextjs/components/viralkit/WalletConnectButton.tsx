"use client";

import { DynamicWidget } from "@dynamic-labs/sdk-react-core";

export function WalletConnectButton() {
  if (!process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID) {
    return (
      <span className="wallet-not-configured" role="status">
        Wallet connection unavailable
      </span>
    );
  }

  return <DynamicWidget />;
}
