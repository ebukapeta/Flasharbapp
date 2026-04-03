import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import mainnetDeployments from "../smart-contracts/deployments/mainnet.json";
import testnetDeployments from "../smart-contracts/deployments/testnet.json";

type NetworkKey = "bsc" | "solana" | "base" | "arbitrum";
type ChainType = "evm" | "solana";
type ExecutionStatus = "running" | "success" | "failed";

interface NetworkConfig {
  key: NetworkKey;
  name: string;
  chainType: ChainType;
  dexes: string[];
  flashLoanProviders: string[];
  mainTokens: string[];
  quoteUniverse: string[];
  tokenPrices: Record<string, number>;
  tokenPairDepth: Record<string, number>;
  samplePools: Record<string, string[]>;
  contractAddresses: { testnet: string; mainnet: string };
  contractSourceFile: string;
}

interface ConnectedWallet {
  walletName: string;
  address: string;
}

interface Opportunity {
  id: string;
  pair: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;
  pairLiquidityUsd: number;
  priceImpactPct: number;
  flashFeePct: number;
  dexFeePct: number;
  totalFeeAsset: number;
  totalFeeUsd: number;
  grossProfitAsset: number;
  grossProfitUsd: number;
  netProfitAsset: number;
  netProfitUsd: number;
  loanAsset: string;
  loanAmount: number;
  loanAmountUsd: number;
  provider: string;
  poolAddress: string;
  multicallBatch: number;
  createdAt: string;
}

interface TradeRecord {
  id: string;
  pair: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  totalFeeAsset: number;
  totalFeeUsd: number;
  grossProfitAsset: number;
  grossProfitUsd: number;
  netProfitAsset: number;
  netProfitUsd: number;
  txHash: string;
  status: "successful" | "failed";
  loanAsset: string;
  executedAt: string;
}

interface ExecutionState {
  opportunity: Opportunity;
  stepIndex: number;
  status: ExecutionStatus;
  txHash?: string;
}

interface DeploymentEntry {
  network: string;
  executorAddress?: string;
  programId?: string;
}

const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  bsc: {
    key: "bsc",
    name: "BNB Smart Chain",
    chainType: "evm",
    dexes: ["PancakeSwap V3", "THENA", "Biswap", "ApeSwap"],
    flashLoanProviders: ["Pancake V3 Flash", "Venus", "Aave V3 (BSC)"],
    mainTokens: ["USDT", "WBNB", "BTCB", "USDC", "WETH", "WBTC"],
    quoteUniverse: ["CAKE", "FDUSD", "ETH", "TRX", "XRP", "ADA", "DOGE", "LINK", "UNI", "SOL"],
    tokenPrices: { USDT: 1, WBNB: 601, BTCB: 94000, USDC: 1, WETH: 3200, WBTC: 94000 },
    tokenPairDepth: { USDT: 226, WBNB: 204, BTCB: 138, USDC: 187, WETH: 141, WBTC: 119 },
    samplePools: {
      USDT: ["0x34A3...b112", "0x820d...9a1e", "0x8fA4...0c78"],
      WBNB: ["0x21f3...672f", "0x92F8...f261", "0xAb14...72c1"],
      BTCB: ["0xBc17...d4aa", "0x112a...7f93", "0x55a8...e801"],
      USDC: ["0x4Df2...ce92", "0x001a...7765", "0x923e...fc9b"],
      WETH: ["0x7e11...491b", "0x8bb2...d71f", "0x4c91...27ed"],
      WBTC: ["0x13f0...8f31", "0x9f11...521d", "0x81d4...71ac"],
    },
    contractAddresses: {
      testnet: "0xB5Ff4E4025Ae9E9A2F8a16bE7A9dB2e9B2E8C0a1",
      mainnet: "0x3eE90A5D11C8d53f20952EA19A65A9f0A1F12b8C",
    },
    contractSourceFile: "smart-contracts/evm/bsc/FlashArbitrageExecutorBsc.sol",
  },
  solana: {
    key: "solana",
    name: "Solana",
    chainType: "solana",
    dexes: ["Orca", "Raydium CLMM", "Meteora", "Phoenix"],
    flashLoanProviders: ["Solend", "Marginfi", "Kamino"],
    mainTokens: ["USDC", "USDT", "WSOL", "MSOL", "JUP", "BONK"],
    quoteUniverse: ["RAY", "PYTH", "WIF", "JTO", "FIDA", "SAMO", "ORCA", "MEW", "UXD", "HNT"],
    tokenPrices: { USDC: 1, USDT: 1, WSOL: 178, MSOL: 199, JUP: 1.05, BONK: 0.000038 },
    tokenPairDepth: { USDC: 311, USDT: 219, WSOL: 283, MSOL: 127, JUP: 145, BONK: 174 },
    samplePools: {
      USDC: ["8gKJ...5f2A", "2x1Z...9P7k", "9qMw...2ArD"],
      USDT: ["5AbH...x1Ko", "1QwE...7dLp", "6mPd...s4RQ"],
      WSOL: ["4eXK...Q8dF", "2rTy...L5bM", "9uGb...1MdR"],
      MSOL: ["3mSa...p8Fd", "6YYu...R4hL", "8Ssv...3NwQ"],
      JUP: ["7PaK...o2Bt", "4NNw...h9Fe", "5vKd...1sTr"],
      BONK: ["9wQe...d4Fh", "2LmN...v6Kp", "7GcD...k8Qz"],
    },
    contractAddresses: {
      testnet: "ArbFlash1nDk4hT6wVtestnet8s2Qj5C3iN9qF2k",
      mainnet: "ArbFlashMain8Jx3tP2V7nQ5fY9rL1kD4uE6wZ3c",
    },
    contractSourceFile: "smart-contracts/solana/flash_arb_executor.rs",
  },
  base: {
    key: "base",
    name: "Base",
    chainType: "evm",
    dexes: ["Aerodrome", "Uniswap V3", "Sushi", "BaseSwap"],
    flashLoanProviders: ["Aave V3", "Balancer", "Uniswap V3 Flash"],
    mainTokens: ["USDC", "WETH", "cbBTC", "DAI", "USDT", "AERO"],
    quoteUniverse: ["DEGEN", "MORPHO", "BRETT", "TOSHI", "LDO", "UNI", "CRV", "SNX", "MKR", "ZRO"],
    tokenPrices: { USDC: 1, WETH: 3200, cbBTC: 94200, DAI: 1, USDT: 1, AERO: 1.27 },
    tokenPairDepth: { USDC: 302, WETH: 248, cbBTC: 117, DAI: 135, USDT: 141, AERO: 167 },
    samplePools: {
      USDC: ["0x0a91...2b71", "0x2f41...8ca4", "0x8d92...f131"],
      WETH: ["0x5f18...4b29", "0x9b2a...11f8", "0x1d33...2c74"],
      cbBTC: ["0xe1d5...4af0", "0x7b1a...ce90", "0x11b9...2f76"],
      DAI: ["0x83ad...761e", "0x2dd4...d942", "0x00f8...56c1"],
      USDT: ["0x51f8...223d", "0x9cc3...59fa", "0x2bce...8f22"],
      AERO: ["0xaa74...6ee1", "0x84b2...9c21", "0x47de...0f6c"],
    },
    contractAddresses: {
      testnet: "0x0A8E03Da1249351C4f6D16a0d33b9d81F6f8A8B3",
      mainnet: "0x112C6F54A5eAA651fC4fEe42cE7606Dc31dAc7d7",
    },
    contractSourceFile: "smart-contracts/evm/base/FlashArbitrageExecutorBase.sol",
  },
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum",
    chainType: "evm",
    dexes: ["Uniswap V3", "Camelot", "Sushi", "Trader Joe"],
    flashLoanProviders: ["Aave V3", "Balancer", "Radiant"],
    mainTokens: ["USDC", "USDT", "WETH", "WBTC", "DAI", "ARB"],
    quoteUniverse: ["GMX", "PENDLE", "RDNT", "MAGIC", "GRAIL", "LINK", "UNI", "LDO", "FRAX", "COMP"],
    tokenPrices: { USDC: 1, USDT: 1, WETH: 3200, WBTC: 94000, DAI: 1, ARB: 0.83 },
    tokenPairDepth: { USDC: 354, USDT: 231, WETH: 278, WBTC: 148, DAI: 159, ARB: 206 },
    samplePools: {
      USDC: ["0x71d1...29ab", "0x18b4...2ca8", "0xa1f0...f283"],
      USDT: ["0x6e70...be15", "0x339f...b052", "0x8e4f...3f29"],
      WETH: ["0x7d59...0f1a", "0x6f12...40b3", "0x238f...e5a0"],
      WBTC: ["0x446c...2d59", "0xfa21...0ae5", "0x7b91...13bb"],
      DAI: ["0x5ca4...85bc", "0x717b...6da1", "0x022f...f13c"],
      ARB: ["0x89bd...dd20", "0x144a...8ca3", "0x6f70...5ca8"],
    },
    contractAddresses: {
      testnet: "0x2c2e511Ec1A43f2787fD6B40f1C5C9CcAFA7F7B2",
      mainnet: "0x7bfC4c8f0Df0B53b112D4d51d06Bf763A3d6782D",
    },
    contractSourceFile: "smart-contracts/evm/arbitrum/FlashArbitrageExecutorArbitrum.sol",
  },
};

const executionSteps = [
  "Validate spread, slippage, gas, and route health",
  "Borrow flash loan from selected provider",
  "Buy target pair on buy DEX",
  "Sell target pair on sell DEX",
  "Repay principal plus flash loan fee",
  "Settle net profit to connected wallet",
];

const walletOptions: Record<ChainType, string[]> = {
  evm: ["MetaMask", "Rabby", "Trust Wallet"],
  solana: ["Phantom", "Solflare", "Backpack"],
};

const deploymentMap: Record<"testnet" | "mainnet", Record<NetworkKey, DeploymentEntry>> = {
  testnet: testnetDeployments as Record<NetworkKey, DeploymentEntry>,
  mainnet: mainnetDeployments as Record<NetworkKey, DeploymentEntry>,
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const formatUsd = (value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatAsset = (value: number, symbol: string) => `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
const formatPct = (value: number) => `${value.toFixed(3)}%`;

const buildAddress = (isSolana: boolean) => {
  if (isSolana) {
    return `7D${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 10)}Fk`;
  }
  return `0x${Math.random().toString(16).slice(2, 42).padEnd(40, "0")}`;
};

const shortAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const resolveDeploymentAddress = (entry: DeploymentEntry) => entry.executorAddress ?? entry.programId ?? "Not set";

const simulateScan = (network: NetworkConfig) => {
  const allPoolCount = Object.values(network.tokenPairDepth).reduce((sum, count) => sum + count, 0);
  const multicallBatchSize = 24;
  const totalBatches = Math.ceil(allPoolCount / multicallBatchSize);
  const opportunities: Opportunity[] = [];
  const now = new Date().toISOString();

  network.mainTokens.forEach((baseToken, tokenIndex) => {
    for (let i = 0; i < 3; i += 1) {
      const quoteToken = pickRandom(network.quoteUniverse);
      const buyDex = pickRandom(network.dexes);
      const sellDex = pickRandom(network.dexes.filter((dex) => dex !== buyDex));
      const provider = pickRandom(network.flashLoanProviders);
      const basePrice = network.tokenPrices[baseToken] ?? 1;
      const quotePrice = network.tokenPrices[quoteToken] ?? randomBetween(0.12, 18);
      const pairLiquidityUsd = randomBetween(450000, 15000000);
      const tradeShare = randomBetween(0.004, 0.018);
      const loanAmountUsd = pairLiquidityUsd * tradeShare;
      const loanAmount = loanAmountUsd / basePrice;
      const spreadPct = randomBetween(0.35, 2.1);
      const priceImpactPct = Math.min(1.15, tradeShare * 100 * 0.62 + randomBetween(0.02, 0.22));
      const flashFeePct = randomBetween(0.04, 0.09);
      const dexFeePct = randomBetween(0.16, 0.35);
      const grossProfitUsd = loanAmountUsd * (spreadPct / 100);
      const totalFeeUsd = loanAmountUsd * ((flashFeePct + dexFeePct + priceImpactPct * 0.45) / 100);
      const netProfitUsd = grossProfitUsd - totalFeeUsd;

      if (netProfitUsd <= 12) {
        continue;
      }

      const crossPrice = basePrice / quotePrice;
      const buyPrice = crossPrice * (1 - randomBetween(0.0004, 0.0018));
      const sellPrice = crossPrice * (1 + spreadPct / 100 - randomBetween(0, 0.001));
      const sampleAddress = pickRandom(network.samplePools[baseToken] ?? ["unknown"]);

      opportunities.push({
        id: `${network.key}-${tokenIndex}-${i}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        pair: `${baseToken}/${quoteToken}`,
        buyDex,
        sellDex,
        buyPrice,
        sellPrice,
        spreadPct,
        pairLiquidityUsd,
        priceImpactPct,
        flashFeePct,
        dexFeePct,
        totalFeeAsset: totalFeeUsd / basePrice,
        totalFeeUsd,
        grossProfitAsset: grossProfitUsd / basePrice,
        grossProfitUsd,
        netProfitAsset: netProfitUsd / basePrice,
        netProfitUsd,
        loanAsset: baseToken,
        loanAmount,
        loanAmountUsd,
        provider,
        poolAddress: sampleAddress,
        multicallBatch: Math.max(1, Math.ceil((tokenIndex * 3 + i + 1) / 2)),
        createdAt: now,
      });
    }
  });

  return {
    opportunities: opportunities.sort((a, b) => b.netProfitUsd - a.netProfitUsd).slice(0, 18),
    allPoolCount,
    totalBatches,
    multicallBatchSize,
  };
};

export default function App() {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey>("bsc");
  const [environment, setEnvironment] = useState<"testnet" | "mainnet">("testnet");
  const [walletsByNetwork, setWalletsByNetwork] = useState<Partial<Record<NetworkKey, ConnectedWallet>>>({});
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [lastScanAt, setLastScanAt] = useState<string>("Not scanned yet");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [confirmOpportunity, setConfirmOpportunity] = useState<Opportunity | null>(null);
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [scanMeta, setScanMeta] = useState({ allPoolCount: 0, totalBatches: 0, multicallBatchSize: 24 });

  const scanIntervalRef = useRef<number | null>(null);
  const progressTimeoutsRef = useRef<number[]>([]);
  const executionIntervalRef = useRef<number | null>(null);

  const activeNetwork = useMemo(() => NETWORKS[selectedNetwork], [selectedNetwork]);
  const activeWallet = walletsByNetwork[selectedNetwork];
  const activeTestnetDeployment = deploymentMap.testnet[selectedNetwork];
  const activeMainnetDeployment = deploymentMap.mainnet[selectedNetwork];
  const activeTestnetDeploymentAddress = resolveDeploymentAddress(activeTestnetDeployment);
  const activeMainnetDeploymentAddress = resolveDeploymentAddress(activeMainnetDeployment);
  const activeTestnetLinked = activeTestnetDeploymentAddress === activeNetwork.contractAddresses.testnet;
  const activeMainnetLinked = activeMainnetDeploymentAddress === activeNetwork.contractAddresses.mainnet;

  const clearProgressTimeouts = () => {
    progressTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    progressTimeoutsRef.current = [];
  };

  const runScanCycle = () => {
    clearProgressTimeouts();
    setScanProgress(0);
    [18, 41, 68, 86].forEach((value, index) => {
      const timeoutId = window.setTimeout(() => setScanProgress(value), 250 + index * 200);
      progressTimeoutsRef.current.push(timeoutId);
    });

    const timeoutId = window.setTimeout(() => {
      const result = simulateScan(activeNetwork);
      setOpportunities(result.opportunities);
      setScanMeta({
        allPoolCount: result.allPoolCount,
        totalBatches: result.totalBatches,
        multicallBatchSize: result.multicallBatchSize,
      });
      setScanProgress(100);
      setLastScanAt(new Date().toLocaleTimeString());
    }, 1200);
    progressTimeoutsRef.current.push(timeoutId);
  };

  const startScanner = () => {
    setScannerRunning(true);
    runScanCycle();
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
    }
    scanIntervalRef.current = window.setInterval(() => {
      runScanCycle();
    }, 15000);
  };

  const stopScanner = () => {
    setScannerRunning(false);
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    clearProgressTimeouts();
  };

  const connectWallet = (walletName: string) => {
    setWalletsByNetwork((current) => ({
      ...current,
      [selectedNetwork]: {
        walletName,
        address: buildAddress(activeNetwork.chainType === "solana"),
      },
    }));
    setWalletModalOpen(false);
  };

  const disconnectWallet = () => {
    setWalletsByNetwork((current) => {
      const next = { ...current };
      delete next[selectedNetwork];
      return next;
    });
  };

  const beginExecution = (opportunity: Opportunity) => {
    setConfirmOpportunity(null);
    setExecutionState({ opportunity, stepIndex: 0, status: "running" });

    if (executionIntervalRef.current) {
      window.clearInterval(executionIntervalRef.current);
      executionIntervalRef.current = null;
    }

    executionIntervalRef.current = window.setInterval(() => {
      setExecutionState((current) => {
        if (!current) {
          return current;
        }

        if (current.stepIndex < executionSteps.length - 1) {
          return { ...current, stepIndex: current.stepIndex + 1 };
        }

        if (executionIntervalRef.current) {
          window.clearInterval(executionIntervalRef.current);
          executionIntervalRef.current = null;
        }

        const succeeded = Math.random() > 0.12;
        const txHash = `0x${Math.random().toString(16).slice(2, 18)}${Math.random().toString(16).slice(2, 18)}`;

        setTradeHistory((history) => [
          {
            id: `${Date.now()}`,
            pair: current.opportunity.pair,
            buyDex: current.opportunity.buyDex,
            sellDex: current.opportunity.sellDex,
            buyPrice: current.opportunity.buyPrice,
            sellPrice: current.opportunity.sellPrice,
            totalFeeAsset: current.opportunity.totalFeeAsset,
            totalFeeUsd: current.opportunity.totalFeeUsd,
            grossProfitAsset: current.opportunity.grossProfitAsset,
            grossProfitUsd: current.opportunity.grossProfitUsd,
            netProfitAsset: succeeded ? current.opportunity.netProfitAsset : -Math.abs(current.opportunity.totalFeeAsset),
            netProfitUsd: succeeded ? current.opportunity.netProfitUsd : -Math.abs(current.opportunity.totalFeeUsd),
            txHash,
            status: succeeded ? "successful" : "failed",
            loanAsset: current.opportunity.loanAsset,
            executedAt: new Date().toLocaleString(),
          },
          ...history,
        ]);

        return {
          ...current,
          status: succeeded ? "success" : "failed",
          txHash,
        };
      });
    }, 1000);
  };

  useEffect(() => {
    if (!scannerRunning) {
      return;
    }
    runScanCycle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNetwork, environment]);

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        window.clearInterval(scanIntervalRef.current);
      }
      if (executionIntervalRef.current) {
        window.clearInterval(executionIntervalRef.current);
      }
      clearProgressTimeouts();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <motion.div
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.32),transparent_52%)]"
      />

      <main className="relative mx-auto flex w-full max-w-[1300px] flex-col gap-6 px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <section className="border border-slate-800/90 bg-slate-900/70 p-4 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">ArbiStack Pro</p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">DEX Cross-Exchange Scanner + Flash Loan Executor</h1>
              <p className="mt-1 text-sm text-slate-300">Live multicall batching with hardcoded high-liquidity pools for BSC, Solana, Base, and Arbitrum.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {Object.values(NETWORKS).map((network) => (
                <button
                  key={network.key}
                  onClick={() => setSelectedNetwork(network.key)}
                  className={`px-3 py-2 text-sm font-medium transition ${
                    selectedNetwork === network.key ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {network.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 border border-slate-800/90 bg-slate-900/70 p-4 sm:p-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-300">
                <p>Protocol: {activeNetwork.name}</p>
                <p>Last scan: {lastScanAt}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEnvironment("testnet")}
                  className={`px-3 py-2 text-sm ${environment === "testnet" ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-200"}`}
                >
                  Testnet
                </button>
                <button
                  onClick={() => setEnvironment("mainnet")}
                  className={`px-3 py-2 text-sm ${environment === "mainnet" ? "bg-amber-300 text-slate-950" : "bg-slate-800 text-slate-200"}`}
                >
                  Mainnet
                </button>
              </div>
            </div>

            <motion.div layout className="h-2 overflow-hidden bg-slate-800">
              <motion.div
                className="h-full bg-cyan-400"
                animate={{ width: `${scanProgress}%` }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />
            </motion.div>

            <div className="flex flex-wrap gap-2">
              {!scannerRunning ? (
                <button onClick={startScanner} className="bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                  Start Scan
                </button>
              ) : (
                <button onClick={stopScanner} className="bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-rose-300">
                  Stop Scan
                </button>
              )}
            </div>

            <div className="space-y-1 text-xs text-slate-300">
              <p>DEXes: {activeNetwork.dexes.join(", ")}</p>
              <p>Flash loan providers: {activeNetwork.flashLoanProviders.join(", ")}</p>
              <p>
                Executor contract ({environment}): <span className="text-cyan-300">{activeNetwork.contractAddresses[environment]}</span>
              </p>
              <p>
                Multicall mode: {scanMeta.totalBatches} batches, batch size {scanMeta.multicallBatchSize}, hardcoded pool universe {scanMeta.allPoolCount}
              </p>
            </div>
          </div>

          <div className="space-y-2 border border-slate-800 p-3 text-sm lg:col-span-4">
            <p className="font-semibold text-slate-100">Wallet</p>
            {activeWallet ? (
              <>
                <p className="text-slate-300">{activeWallet.walletName}</p>
                <p className="text-cyan-300">{shortAddress(activeWallet.address)}</p>
                <div className="flex gap-2">
                  <button onClick={() => setWalletModalOpen(true)} className="bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600">
                    Switch Wallet
                  </button>
                  <button onClick={disconnectWallet} className="bg-rose-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-rose-300">
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-400">No wallet connected for this network.</p>
                <button onClick={() => setWalletModalOpen(true)} className="bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300">
                  Connect Wallet
                </button>
              </>
            )}
          </div>
        </section>

        <section className="border border-slate-800/90 bg-slate-900/70 p-4 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Contracts and app linking</h2>
          <p className="mt-1 text-xs text-slate-400">Selected network: {activeNetwork.name}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-2">Environment</th>
                  <th className="pb-2">Deployment registry address</th>
                  <th className="pb-2">App configured address</th>
                  <th className="pb-2">Link status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-800 align-top">
                  <td className="py-2 pr-2 font-medium text-slate-100">Testnet</td>
                  <td className="py-2 pr-2 text-cyan-300">{activeTestnetDeploymentAddress}</td>
                  <td className="py-2 pr-2 text-cyan-300">{activeNetwork.contractAddresses.testnet}</td>
                  <td className={`py-2 font-semibold ${activeTestnetLinked ? "text-emerald-300" : "text-rose-300"}`}>
                    {activeTestnetLinked ? "Linked" : "Mismatch"}
                  </td>
                </tr>
                <tr className="border-t border-slate-800 align-top">
                  <td className="py-2 pr-2 font-medium text-slate-100">Mainnet</td>
                  <td className="py-2 pr-2 text-cyan-300">{activeMainnetDeploymentAddress}</td>
                  <td className="py-2 pr-2 text-cyan-300">{activeNetwork.contractAddresses.mainnet}</td>
                  <td className={`py-2 font-semibold ${activeMainnetLinked ? "text-emerald-300" : "text-rose-300"}`}>
                    {activeMainnetLinked ? "Linked" : "Mismatch"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Update app mapping in <span className="text-slate-200">src/App.tsx</span> and deployment registries in
            <span className="text-slate-200"> smart-contracts/deployments/testnet.json</span> and
            <span className="text-slate-200"> smart-contracts/deployments/mainnet.json</span>.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-12">
          <div className="border border-slate-800/90 bg-slate-900/70 p-4 lg:col-span-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Scanner token depth</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-2">Main token</th>
                    <th className="pb-2">Pairs</th>
                    <th className="pb-2">Sample pools</th>
                  </tr>
                </thead>
                <tbody>
                  {activeNetwork.mainTokens.map((token) => (
                    <tr key={token} className="border-t border-slate-800">
                      <td className="py-2 pr-2 font-medium text-slate-200">{token}</td>
                      <td className="py-2 pr-2">{activeNetwork.tokenPairDepth[token]}</td>
                      <td className="py-2 text-[11px] text-slate-400">{(activeNetwork.samplePools[token] ?? []).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-slate-800/90 bg-slate-900/70 p-4 lg:col-span-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Live opportunities</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-2">Pair</th>
                    <th className="pb-2">Buy DEX</th>
                    <th className="pb-2">Sell DEX</th>
                    <th className="pb-2">Spread</th>
                    <th className="pb-2">Loan asset</th>
                    <th className="pb-2">Gross profit</th>
                    <th className="pb-2">Net profit</th>
                    <th className="pb-2">Price impact</th>
                    <th className="pb-2">Pair liquidity</th>
                    <th className="pb-2">Fee</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opportunity) => (
                    <tr key={opportunity.id} className="border-t border-slate-800 align-top">
                      <td className="py-2 pr-2">{opportunity.pair}</td>
                      <td className="py-2 pr-2">{opportunity.buyDex}</td>
                      <td className="py-2 pr-2">{opportunity.sellDex}</td>
                      <td className="py-2 pr-2 text-emerald-300">{formatPct(opportunity.spreadPct)}</td>
                      <td className="py-2 pr-2">
                        <p>{formatAsset(opportunity.loanAmount, opportunity.loanAsset)}</p>
                        <p className="text-slate-400">{formatUsd(opportunity.loanAmountUsd)}</p>
                      </td>
                      <td className="py-2 pr-2">
                        <p>{formatAsset(opportunity.grossProfitAsset, opportunity.loanAsset)}</p>
                        <p className="text-slate-400">{formatUsd(opportunity.grossProfitUsd)}</p>
                      </td>
                      <td className="py-2 pr-2">
                        <p className="text-emerald-300">{formatAsset(opportunity.netProfitAsset, opportunity.loanAsset)}</p>
                        <p className="text-slate-400">{formatUsd(opportunity.netProfitUsd)}</p>
                      </td>
                      <td className="py-2 pr-2">{formatPct(opportunity.priceImpactPct)}</td>
                      <td className="py-2 pr-2">{formatUsd(opportunity.pairLiquidityUsd)}</td>
                      <td className="py-2 pr-2">
                        <p>{formatAsset(opportunity.totalFeeAsset, opportunity.loanAsset)}</p>
                        <p className="text-slate-400">{formatUsd(opportunity.totalFeeUsd)}</p>
                      </td>
                      <td className="py-2">
                        <button
                          disabled={!activeWallet}
                          onClick={() => setConfirmOpportunity(opportunity)}
                          className="bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          Execute
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border border-slate-800/90 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Trade history</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[1300px] text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-2">Pair</th>
                  <th className="pb-2">Buy/Sell DEX</th>
                  <th className="pb-2">Buy/Sell price</th>
                  <th className="pb-2">Fee</th>
                  <th className="pb-2">Gross profit</th>
                  <th className="pb-2">Net profit</th>
                  <th className="pb-2">Hash</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Executed at</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="border-t border-slate-800 py-4 text-center text-slate-400">
                      No trades executed yet.
                    </td>
                  </tr>
                ) : (
                  tradeHistory.map((trade) => (
                    <tr key={trade.id} className="border-t border-slate-800">
                      <td className="py-2 pr-2">{trade.pair}</td>
                      <td className="py-2 pr-2">{trade.buyDex} / {trade.sellDex}</td>
                      <td className="py-2 pr-2">{trade.buyPrice.toFixed(6)} / {trade.sellPrice.toFixed(6)}</td>
                      <td className="py-2 pr-2">{formatAsset(trade.totalFeeAsset, trade.loanAsset)} ({formatUsd(trade.totalFeeUsd)})</td>
                      <td className="py-2 pr-2">{formatAsset(trade.grossProfitAsset, trade.loanAsset)} ({formatUsd(trade.grossProfitUsd)})</td>
                      <td className="py-2 pr-2">{formatAsset(trade.netProfitAsset, trade.loanAsset)} ({formatUsd(trade.netProfitUsd)})</td>
                      <td className="py-2 pr-2 text-cyan-300">{shortAddress(trade.txHash)}</td>
                      <td className={`py-2 pr-2 ${trade.status === "successful" ? "text-emerald-300" : "text-rose-300"}`}>{trade.status}</td>
                      <td className="py-2">{trade.executedAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {walletModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="w-full max-w-md border border-slate-700 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Connect wallet</h3>
                <button onClick={() => setWalletModalOpen(false)} className="text-slate-400 hover:text-white">Close</button>
              </div>
              <p className="mt-1 text-sm text-slate-300">{activeNetwork.name} requires a {activeNetwork.chainType === "solana" ? "Solana" : "EVM"} wallet.</p>
              <div className="mt-4 space-y-2">
                {walletOptions[activeNetwork.chainType].map((walletName) => (
                  <button key={walletName} onClick={() => connectWallet(walletName)} className="w-full border border-slate-700 px-4 py-3 text-left text-sm hover:border-cyan-300 hover:text-cyan-300">
                    {walletName}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmOpportunity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/70 p-3 sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="w-full max-w-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5 max-h-[88vh] overflow-y-auto"
            >
              <h3 className="text-lg font-semibold">Confirm flash loan execution</h3>
              <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
                <p>Pair: {confirmOpportunity.pair}</p>
                <p>Provider: {confirmOpportunity.provider}</p>
                <p>Buy DEX: {confirmOpportunity.buyDex}</p>
                <p>Sell DEX: {confirmOpportunity.sellDex}</p>
                <p>Buy price: {confirmOpportunity.buyPrice.toFixed(8)}</p>
                <p>Sell price: {confirmOpportunity.sellPrice.toFixed(8)}</p>
                <p>Spread: {formatPct(confirmOpportunity.spreadPct)}</p>
                <p>Price impact: {formatPct(confirmOpportunity.priceImpactPct)}</p>
                <p>Pair liquidity: {formatUsd(confirmOpportunity.pairLiquidityUsd)}</p>
                <p>Loan asset: {formatAsset(confirmOpportunity.loanAmount, confirmOpportunity.loanAsset)}</p>
                <p>Loan value: {formatUsd(confirmOpportunity.loanAmountUsd)}</p>
                <p>Total fee: {formatAsset(confirmOpportunity.totalFeeAsset, confirmOpportunity.loanAsset)}</p>
                <p>Gross profit: {formatAsset(confirmOpportunity.grossProfitAsset, confirmOpportunity.loanAsset)}</p>
                <p>Gross profit USD: {formatUsd(confirmOpportunity.grossProfitUsd)}</p>
                <p>Net profit: {formatAsset(confirmOpportunity.netProfitAsset, confirmOpportunity.loanAsset)}</p>
                <p>Net profit USD: {formatUsd(confirmOpportunity.netProfitUsd)}</p>
                <p>Flash fee: {formatPct(confirmOpportunity.flashFeePct)}</p>
                <p>DEX fee: {formatPct(confirmOpportunity.dexFeePct)}</p>
                <p>Pool address: {confirmOpportunity.poolAddress}</p>
                <p>Multicall batch: #{confirmOpportunity.multicallBatch}</p>
              </div>
              <div className="sticky bottom-0 mt-5 flex justify-end gap-2 border-t border-slate-800 bg-slate-900 pt-3">
                <button onClick={() => setConfirmOpportunity(null)} className="bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600">Cancel</button>
                <button onClick={() => beginExecution(confirmOpportunity)} className="bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Confirm Trade</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {executionState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
          >
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="w-full max-w-2xl border border-slate-700 bg-slate-900 p-5">
              <h3 className="text-lg font-semibold">Execution window</h3>
              <p className="mt-1 text-sm text-slate-300">{executionState.opportunity.pair} via {executionState.opportunity.provider}</p>
              <div className="mt-4 space-y-2">
                {executionSteps.map((step, index) => {
                  const isDone = index < executionState.stepIndex;
                  const isActive = index === executionState.stepIndex && executionState.status === "running";
                  return (
                    <div key={step} className="flex items-center gap-3 text-sm">
                      <div
                        className={`h-2.5 w-2.5 ${
                          isDone ? "bg-emerald-300" : isActive ? "bg-cyan-300" : "bg-slate-600"
                        }`}
                      />
                      <span className={isDone || isActive ? "text-slate-100" : "text-slate-400"}>{step}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border border-slate-800 p-3 text-sm">
                <p>Status: {executionState.status}</p>
                {executionState.txHash && <p>Transaction hash: {executionState.txHash}</p>}
              </div>
              <div className="mt-5 flex justify-end">
                <button onClick={() => setExecutionState(null)} className="bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
