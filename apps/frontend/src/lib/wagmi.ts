import { http, createConfig, createStorage, noopStorage } from "wagmi";
import { defineChain } from "viem";
import { injected } from "@wagmi/core";

export const kiteTestnet = defineChain({
  id: 2368,
  name: "Kite AI Testnet",
  nativeCurrency: { name: "Kite", symbol: "KITE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-testnet.gokite.ai/"] },
  },
  blockExplorers: {
    default: { name: "KiteScan", url: "https://testnet.kitescan.ai" },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [kiteTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [kiteTestnet.id]: http(),
  },
  ssr: true,
  storage: createStorage({
    storage: noopStorage,
  }),
  multiInjectedProviderDiscovery: true,
});
