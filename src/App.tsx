import { AnimatePresence, motion } from "framer-motion";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import { useEffect, useMemo, useRef, useState } from "react";
import mainnetDeployments from "../smart-contracts/deployments/mainnet.json";
import testnetDeployments from "../smart-contracts/deployments/testnet.json";

type NetworkKey = "bsc" | "solana" | "base" | "arbitrum";
type ChainType = "evm" | "solana";
type EnvMode = "testnet" | "mainnet";
type ExecutionStatus = "running" | "success" | "failed";

interface NetworkConfig {
  key: NetworkKey;
  name: string;
  chainType: ChainType;
  dexes: string[];
  flashLoanProviders: string[];
  mainTokens: string[];
  tokenPairDepth: Record<string, number>;
  contractAddresses: { testnet: string; mainnet: string };
}

interface RuntimeChainConfig {
  chainIdHex?: string;
  dexScreenerChain: string;
  tokenAddresses: Record<string, string>;
  tokenDecimals: Record<string, number>;
  dexRouters: Record<string, string>;
  flashProviderAddresses: Record<string, string>;
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  priceUsd: string;
  liquidity?: { usd?: number };
  baseToken: { symbol: string };
  quoteToken: { symbol: string };
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
  error?: string;
}

interface DeploymentEntry {
  network: string;
  executorAddress?: string;
  programId?: string;
}

interface SolanaLikeProvider {
  isPhantom?: boolean;
  isBackpack?: boolean;
  publicKey?: { toString: () => string };
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
    };
    solana?: SolanaLikeProvider;
    backpack?: { solana?: SolanaLikeProvider };
    solflare?: SolanaLikeProvider;
  }
}

const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  bsc: {
    key: "bsc",
    name: "BNB Smart Chain",
    chainType: "evm",
    dexes: ["PancakeSwap V3", "THENA", "Biswap", "ApeSwap"],
    flashLoanProviders: ["Pancake V3 Flash", "Venus", "Aave V3 (BSC)"],
    mainTokens: ["USDT", "WBNB", "BTCB", "USDC", "WETH", "WBTC"],
    tokenPairDepth: { USDT: 226, WBNB: 204, BTCB: 138, USDC: 187, WETH: 141, WBTC: 119 },
    contractAddresses: {
      testnet: "0xB5Ff4E4025Ae9E9A2F8a16bE7A9dB2e9B2E8C0a1",
      mainnet: "0x3eE90A5D11C8d53f20952EA19A65A9f0A1F12b8C",
    },
  },
  solana: {
    key: "solana",
    name: "Solana",
    chainType: "solana",
    dexes: ["Orca", "Raydium CLMM", "Meteora", "Phoenix"],
    flashLoanProviders: ["Solend", "Marginfi", "Kamino"],
    mainTokens: ["USDC", "USDT", "WSOL", "MSOL", "JUP", "BONK"],
    tokenPairDepth: { USDC: 311, USDT: 219, WSOL: 283, MSOL: 127, JUP: 145, BONK: 174 },
    contractAddresses: {
      testnet: "ArbFlash1nDk4hT6wVtestnet8s2Qj5C3iN9qF2k",
      mainnet: "ArbFlashMain8Jx3tP2V7nQ5fY9rL1kD4uE6wZ3c",
    },
  },
  base: {
    key: "base",
    name: "Base",
    chainType: "evm",
    dexes: ["Aerodrome", "Uniswap V3", "Sushi", "BaseSwap"],
    flashLoanProviders: ["Aave V3", "Balancer", "Uniswap V3 Flash"],
    mainTokens: ["USDC", "WETH", "cbBTC", "DAI", "USDT", "AERO"],
    tokenPairDepth: { USDC: 302, WETH: 248, cbBTC: 117, DAI: 135, USDT: 141, AERO: 167 },
    contractAddresses: {
      testnet: "0x0A8E03Da1249351C4f6D16a0d33b9d81F6f8A8B3",
      mainnet: "0x112C6F54A5eAA651fC4fEe42cE7606Dc31dAc7d7",
    },
  },
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum",
    chainType: "evm",
    dexes: ["Uniswap V3", "Camelot", "Sushi", "Trader Joe"],
    flashLoanProviders: ["Aave V3", "Balancer", "Radiant"],
    mainTokens: ["USDC", "USDT", "WETH", "WBTC", "DAI", "ARB"],
    tokenPairDepth: { USDC: 354, USDT: 231, WETH: 278, WBTC: 148, DAI: 159, ARB: 206 },
    contractAddresses: {
      testnet: "0x2c2e511Ec1A43f2787fD6B40f1C5C9CcAFA7F7B2",
      mainnet: "0x7bfC4c8f0Df0B53b112D4d51d06Bf763A3d6782D",
    },
  },
};

const RUNTIME: Record<NetworkKey, RuntimeChainConfig> = {
  bsc: {
    chainIdHex: "0x38",
    dexScreenerChain: "bsc",
    tokenAddresses: {
      USDT: "0x55d398326f99059fF775485246999027B3197955",
      WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      BTCB: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      USDC: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      WETH: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      WBTC: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
    },
    tokenDecimals: { USDT: 18, WBNB: 18, BTCB: 18, USDC: 18, WETH: 18, WBTC: 18 },
    dexRouters: {
      "PancakeSwap V3": "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
      THENA: "0x20a8d7CC0d6A7f8f638b68A8C05A6f54f9c35fCb",
      Biswap: "0x3a6d8cA21D1Cf76F653A67577FA0D27453350d6D",
      ApeSwap: "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607",
    },
    flashProviderAddresses: {
      "Pancake V3 Flash": "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
      Venus: "0xfD36E2c2a6789Db23113685031d7F16329158384",
      "Aave V3 (BSC)": "0x6807dc923806fE8Fd134338EABCA509979a7e0cB",
    },
  },
  solana: {
    dexScreenerChain: "solana",
    tokenAddresses: {
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      USDT: "Es9vMFrzaCERmJfrF4H2UvepL9en5ZaY1f3T5X3f4fK",
      WSOL: "So11111111111111111111111111111111111111112",
      MSOL: "mSoLzYCxHdYgdzUQJ8DhfCsGfG8Q7gW5v5fQ5Q4Wv7w",
      JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    },
    tokenDecimals: { USDC: 6, USDT: 6, WSOL: 9, MSOL: 9, JUP: 6, BONK: 5 },
    dexRouters: {},
    flashProviderAddresses: {},
  },
  base: {
    chainIdHex: "0x2105",
    dexScreenerChain: "base",
    tokenAddresses: {
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      WETH: "0x4200000000000000000000000000000000000006",
      cbBTC: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
      DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      AERO: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    },
    tokenDecimals: { USDC: 6, WETH: 18, cbBTC: 8, DAI: 18, USDT: 6, AERO: 18 },
    dexRouters: {
      Aerodrome: "0xcF77a3Ba9A5CA399B7c97c74d54e5b82f6f2F97e",
      "Uniswap V3": "0x2626664c2603336E57B271c5C0b26F421741e481",
      Sushi: "0x6BDED42c6DA8FBF0d2bA55B2fa120C5e0c8D7891",
      BaseSwap: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86",
    },
    flashProviderAddresses: {
      "Aave V3": "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
      Balancer: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "Uniswap V3 Flash": "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    },
  },
  arbitrum: {
    chainIdHex: "0xa4b1",
    dexScreenerChain: "arbitrum",
    tokenAddresses: {
      USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      USDT: "0xFd086bC7CD5C481DCC9C85ebe478A1C0b69FCbb9",
      WETH: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
      WBTC: "0x2f2a2543b76a4166549f7aaab2e75b2fD5D8Ccf7",
      DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    },
    tokenDecimals: { USDC: 6, USDT: 6, WETH: 18, WBTC: 8, DAI: 18, ARB: 18 },
    dexRouters: {
      "Uniswap V3": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      Camelot: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
      Sushi: "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
      "Trader Joe": "0xb4315e873dbcf96ffd0acd8ea43f689d8c20fb30",
    },
    flashProviderAddresses: {
      "Aave V3": "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      Balancer: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      Radiant: "0x48B08F3f61d8D4F89cA55Db1Bf2f2D6D9A5c4A3d",
    },
  },
};

const FLASH_EXECUTOR_ABI = [
  "function executeArbitrage(address provider, tuple(address loanAsset,uint256 loanAmount,uint256 minProfit,address buyDexRouter,address sellDexRouter,bytes buyCalldata,bytes sellCalldata) params) external",
];

const walletOptions: Record<ChainType, string[]> = {
  evm: ["MetaMask", "Rabby", "Trust Wallet"],
  solana: ["Phantom", "Solflare", "Backpack"],
};

const executionSteps = [
  "Validate spread, slippage, and liquidity",
  "Build flash loan call parameters",
  "Request wallet signature",
  "Broadcast transaction to chain",
  "Wait for confirmation and settlement",
];

const deploymentMap: Record<EnvMode, Record<NetworkKey, DeploymentEntry>> = {
  testnet: testnetDeployments as Record<NetworkKey, DeploymentEntry>,
  mainnet: mainnetDeployments as Record<NetworkKey, DeploymentEntry>,
};

const formatUsd = (value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatAsset = (value: number, symbol: string) => `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
const formatPct = (value: number) => `${value.toFixed(3)}%`;
const shortAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
const resolveDeploymentAddress = (entry: DeploymentEntry) => entry.executorAddress ?? entry.programId ?? "Not set";
const envRefresh = Number(import.meta.env.VITE_SCANNER_REFRESH_MS ?? "15000");
const defaultEnv = (import.meta.env.VITE_DEFAULT_ENV ?? "testnet") as EnvMode;

const getSolanaProvider = (walletName: string): SolanaLikeProvider | undefined => {
  if (walletName === "Backpack") {
    return window.backpack?.solana;
  }
  if (walletName === "Solflare") {
    return window.solflare;
  }
  return window.solana;
};

async function fetchTokenPairs(chain: string, tokenAddress: string): Promise<DexScreenerPair[]> {
  const url = `https://api.dexscreener.com/token-pairs/v1/${chain}/${tokenAddress}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`DexScreener request failed with ${response.status}`);
  }
  const data = (await response.json()) as DexScreenerPair[];
  return Array.isArray(data) ? data : [];
}

function deriveOpportunities(networkKey: NetworkKey, pairs: DexScreenerPair[]) {
  const opportunities: Opportunity[] = [];
  const pairBuckets = new Map<string, DexScreenerPair[]>();
  let poolCount = 0;

  pairs.forEach((pair) => {
    const price = Number(pair.priceUsd);
    const liquidity = Number(pair.liquidity?.usd ?? 0);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(liquidity) || liquidity < 120000) {
      return;
    }
    const key = `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`;
    const bucket = pairBuckets.get(key) ?? [];
    bucket.push(pair);
    pairBuckets.set(key, bucket);
    poolCount += 1;
  });

  const providerPool = NETWORKS[networkKey].flashLoanProviders;
  let batchCounter = 1;

  pairBuckets.forEach((bucket, pairKey) => {
    if (bucket.length < 2) {
      return;
    }

    const sorted = [...bucket].sort((a, b) => Number(a.priceUsd) - Number(b.priceUsd));
    const buy = sorted[0];
    const sell = sorted[sorted.length - 1];
    if (buy.dexId === sell.dexId) {
      return;
    }

    const buyPrice = Number(buy.priceUsd);
    const sellPrice = Number(sell.priceUsd);
    const spreadPct = ((sellPrice - buyPrice) / buyPrice) * 100;
    if (spreadPct < 0.4) {
      return;
    }

    const pairLiquidityUsd = Math.min(Number(buy.liquidity?.usd ?? 0), Number(sell.liquidity?.usd ?? 0));
    const loanAsset = buy.baseToken.symbol.toUpperCase();
    const runtime = RUNTIME[networkKey];
    const tokenDecimals = runtime.tokenDecimals[loanAsset] ?? 18;
    const liquidityCapRatio = 0.008;
    const loanAmountUsd = Math.max(200, pairLiquidityUsd * liquidityCapRatio);
    const loanAmount = loanAmountUsd / buyPrice;
    const priceImpactPct = Math.min(1.4, (loanAmountUsd / pairLiquidityUsd) * 100 * 0.95);
    const flashFeePct = 0.09;
    const dexFeePct = 0.24;
    const grossProfitUsd = loanAmountUsd * (spreadPct / 100);
    const totalFeeUsd = loanAmountUsd * ((flashFeePct + dexFeePct + priceImpactPct) / 100);
    const netProfitUsd = grossProfitUsd - totalFeeUsd;
    if (netProfitUsd <= 5) {
      return;
    }

    opportunities.push({
      id: `${networkKey}-${pairKey}-${buy.pairAddress}-${sell.pairAddress}`,
      pair: pairKey,
      buyDex: buy.dexId,
      sellDex: sell.dexId,
      buyPrice,
      sellPrice,
      spreadPct,
      pairLiquidityUsd,
      priceImpactPct,
      flashFeePct,
      dexFeePct,
      totalFeeAsset: totalFeeUsd / buyPrice,
      totalFeeUsd,
      grossProfitAsset: grossProfitUsd / buyPrice,
      grossProfitUsd,
      netProfitAsset: netProfitUsd / buyPrice,
      netProfitUsd,
      loanAsset,
      loanAmount,
      loanAmountUsd,
      provider: providerPool[batchCounter % providerPool.length],
      poolAddress: buy.pairAddress,
      multicallBatch: batchCounter,
    });

    if (tokenDecimals === 0) {
      batchCounter += 1;
    }
    batchCounter += 1;
  });

  return {
    opportunities: opportunities.sort((a, b) => b.netProfitUsd - a.netProfitUsd).slice(0, 20),
    allPoolCount: poolCount,
  };
}

export default function App() {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey>("bsc");
  const [environment, setEnvironment] = useState<EnvMode>(defaultEnv);
  const [walletsByNetwork, setWalletsByNetwork] = useState<Partial<Record<NetworkKey, ConnectedWallet>>>({});
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [lastScanAt, setLastScanAt] = useState<string>("Not scanned yet");
  const [scanError, setScanError] = useState<string>("");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [confirmOpportunity, setConfirmOpportunity] = useState<Opportunity | null>(null);
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [scanMeta, setScanMeta] = useState({ allPoolCount: 0, totalBatches: 0, multicallBatchSize: 24 });
  const [routeCalldata, setRouteCalldata] = useState({ buyCalldata: "", sellCalldata: "" });

  const scanIntervalRef = useRef<number | null>(null);
  const progressTimeoutRef = useRef<number | null>(null);

  const activeNetwork = useMemo(() => NETWORKS[selectedNetwork], [selectedNetwork]);
  const activeRuntime = useMemo(() => RUNTIME[selectedNetwork], [selectedNetwork]);
  const activeWallet = walletsByNetwork[selectedNetwork];
  const activeTestnetDeploymentAddress = resolveDeploymentAddress(deploymentMap.testnet[selectedNetwork]);
  const activeMainnetDeploymentAddress = resolveDeploymentAddress(deploymentMap.mainnet[selectedNetwork]);
  const activeTestnetLinked = activeTestnetDeploymentAddress === activeNetwork.contractAddresses.testnet;
  const activeMainnetLinked = activeMainnetDeploymentAddress === activeNetwork.contractAddresses.mainnet;

  const clearScanTimer = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (progressTimeoutRef.current) {
      window.clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
  };

  const runScanCycle = async () => {
    setScanError("");
    setScanProgress(12);
    const tokens = Object.values(activeRuntime.tokenAddresses);
    const batchSize = 24;

    try {
      const pairsByToken = await Promise.all(tokens.map((address) => fetchTokenPairs(activeRuntime.dexScreenerChain, address)));
      setScanProgress(70);
      const mergedPairs = pairsByToken.flat();
      const result = deriveOpportunities(selectedNetwork, mergedPairs);

      setOpportunities(result.opportunities);
      setScanMeta({
        allPoolCount: result.allPoolCount,
        totalBatches: Math.ceil(tokens.length / batchSize),
        multicallBatchSize: batchSize,
      });
      setScanProgress(100);
      setLastScanAt(new Date().toLocaleTimeString());
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scanner request failed.");
      setOpportunities([]);
      setScanProgress(0);
    }

    progressTimeoutRef.current = window.setTimeout(() => setScanProgress(0), 1200);
  };

  const startScanner = () => {
    setScannerRunning(true);
    runScanCycle();
    clearScanTimer();
    scanIntervalRef.current = window.setInterval(() => {
      runScanCycle();
    }, envRefresh);
  };

  const stopScanner = () => {
    setScannerRunning(false);
    clearScanTimer();
    setScanProgress(0);
  };

  const connectEvmWallet = async (walletName: string) => {
    if (!window.ethereum) {
      throw new Error("No EVM wallet detected in browser.");
    }
    if (activeRuntime.chainIdHex) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: activeRuntime.chainIdHex }],
        });
      } catch {
        // Keep flow going; wallet might not support programmatic network switch.
      }
    }
    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
    if (!accounts || accounts.length === 0) {
      throw new Error("Wallet did not return an account.");
    }
    setWalletsByNetwork((current) => ({
      ...current,
      [selectedNetwork]: { walletName, address: accounts[0] },
    }));
  };

  const connectSolanaWallet = async (walletName: string) => {
    const provider = getSolanaProvider(walletName);
    if (!provider) {
      throw new Error(`${walletName} provider not found in browser.`);
    }
    const connection = await provider.connect();
    setWalletsByNetwork((current) => ({
      ...current,
      [selectedNetwork]: { walletName, address: connection.publicKey.toString() },
    }));
  };

  const connectWallet = async (walletName: string) => {
    try {
      if (activeNetwork.chainType === "evm") {
        await connectEvmWallet(walletName);
      } else {
        await connectSolanaWallet(walletName);
      }
      setWalletModalOpen(false);
      setScanError("");
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Wallet connection failed.");
    }
  };

  const disconnectWallet = async () => {
    if (activeNetwork.chainType === "solana") {
      const provider = getSolanaProvider(activeWallet?.walletName ?? "Phantom");
      if (provider?.disconnect) {
        await provider.disconnect();
      }
    }
    setWalletsByNetwork((current) => {
      const next = { ...current };
      delete next[selectedNetwork];
      return next;
    });
  };

  const beginExecution = async (opportunity: Opportunity) => {
    setConfirmOpportunity(null);
    setExecutionState({ opportunity, status: "running", stepIndex: 0 });

    try {
      if (activeNetwork.chainType !== "evm") {
        throw new Error("Solana execution requires program-specific accounts and CPI route instructions. Use EVM networks in this release.");
      }
      if (!activeWallet?.address) {
        throw new Error("Connect wallet before execution.");
      }
      if (!routeCalldata.buyCalldata.startsWith("0x") || !routeCalldata.sellCalldata.startsWith("0x")) {
        throw new Error("Buy and sell calldata must be hex values starting with 0x.");
      }

      setExecutionState((current) => (current ? { ...current, stepIndex: 1 } : current));

      const providerAddress = activeRuntime.flashProviderAddresses[opportunity.provider];
      const loanAssetAddress = activeRuntime.tokenAddresses[opportunity.loanAsset];
      const buyDexRouter = activeRuntime.dexRouters[opportunity.buyDex] ?? activeRuntime.dexRouters[activeNetwork.dexes[0]];
      const sellDexRouter = activeRuntime.dexRouters[opportunity.sellDex] ?? activeRuntime.dexRouters[activeNetwork.dexes[1]];
      if (!providerAddress || !loanAssetAddress || !buyDexRouter || !sellDexRouter) {
        throw new Error("Provider/router/token mapping missing for this opportunity.");
      }

      const tokenDecimals = activeRuntime.tokenDecimals[opportunity.loanAsset] ?? 18;
      const contractAddress = activeNetwork.contractAddresses[environment];
      const loanAmount = parseUnits(opportunity.loanAmount.toFixed(Math.min(tokenDecimals, 6)), tokenDecimals);
      const minProfit = parseUnits((opportunity.netProfitAsset * 0.5).toFixed(Math.min(tokenDecimals, 6)), tokenDecimals);

      setExecutionState((current) => (current ? { ...current, stepIndex: 2 } : current));
      const signerProvider = new BrowserProvider(window.ethereum!);
      const signer = await signerProvider.getSigner();
      const contract = new Contract(contractAddress, FLASH_EXECUTOR_ABI, signer);

      setExecutionState((current) => (current ? { ...current, stepIndex: 3 } : current));
      const tx = await contract.executeArbitrage(providerAddress, {
        loanAsset: loanAssetAddress,
        loanAmount,
        minProfit,
        buyDexRouter,
        sellDexRouter,
        buyCalldata: routeCalldata.buyCalldata,
        sellCalldata: routeCalldata.sellCalldata,
      });

      setExecutionState((current) => (current ? { ...current, stepIndex: 4, txHash: tx.hash } : current));
      await tx.wait();

      setExecutionState((current) => (current ? { ...current, status: "success", txHash: tx.hash } : current));
      setTradeHistory((history) => [
        {
          id: `${Date.now()}`,
          pair: opportunity.pair,
          buyDex: opportunity.buyDex,
          sellDex: opportunity.sellDex,
          buyPrice: opportunity.buyPrice,
          sellPrice: opportunity.sellPrice,
          totalFeeAsset: opportunity.totalFeeAsset,
          totalFeeUsd: opportunity.totalFeeUsd,
          grossProfitAsset: opportunity.grossProfitAsset,
          grossProfitUsd: opportunity.grossProfitUsd,
          netProfitAsset: opportunity.netProfitAsset,
          netProfitUsd: opportunity.netProfitUsd,
          txHash: tx.hash,
          status: "successful",
          loanAsset: opportunity.loanAsset,
          executedAt: new Date().toLocaleString(),
        },
        ...history,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed";
      setExecutionState((current) => (current ? { ...current, status: "failed", error: message } : current));
    }
  };

  useEffect(() => {
    if (!scannerRunning) {
      return;
    }
    runScanCycle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNetwork]);

  useEffect(() => {
    return () => clearScanTimer();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <motion.div
        animate={{ opacity: [0.32, 0.62, 0.32] }}
        transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.32),transparent_54%)]"
      />

      <main className="relative mx-auto flex w-full max-w-[1300px] flex-col gap-6 px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <section className="border border-slate-800/90 bg-slate-900/70 p-4 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">ArbiStack Pro</p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Live DEX Scanner and Flash Loan Executor</h1>
              <p className="mt-1 text-sm text-slate-300">Scanner pulls live pools from DexScreener APIs and executes on-chain through your wallet and deployed contract.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.values(NETWORKS).map((network) => (
                <button
                  key={network.key}
                  onClick={() => setSelectedNetwork(network.key)}
                  className={`px-3 py-2 text-sm font-medium transition ${selectedNetwork === network.key ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
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
                <button onClick={() => setEnvironment("testnet")} className={`px-3 py-2 text-sm ${environment === "testnet" ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-200"}`}>
                  Testnet
                </button>
                <button onClick={() => setEnvironment("mainnet")} className={`px-3 py-2 text-sm ${environment === "mainnet" ? "bg-amber-300 text-slate-950" : "bg-slate-800 text-slate-200"}`}>
                  Mainnet
                </button>
              </div>
            </div>

            <motion.div layout className="h-2 overflow-hidden bg-slate-800">
              <motion.div className="h-full bg-cyan-400" animate={{ width: `${scanProgress}%` }} transition={{ duration: 0.45, ease: "easeOut" }} />
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
              {scanError && <p className="text-rose-300">{scanError}</p>}
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
                  <td className={`py-2 font-semibold ${activeTestnetLinked ? "text-emerald-300" : "text-rose-300"}`}>{activeTestnetLinked ? "Linked" : "Mismatch"}</td>
                </tr>
                <tr className="border-t border-slate-800 align-top">
                  <td className="py-2 pr-2 font-medium text-slate-100">Mainnet</td>
                  <td className="py-2 pr-2 text-cyan-300">{activeMainnetDeploymentAddress}</td>
                  <td className="py-2 pr-2 text-cyan-300">{activeNetwork.contractAddresses.mainnet}</td>
                  <td className={`py-2 font-semibold ${activeMainnetLinked ? "text-emerald-300" : "text-rose-300"}`}>{activeMainnetLinked ? "Linked" : "Mismatch"}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
                  </tr>
                </thead>
                <tbody>
                  {activeNetwork.mainTokens.map((token) => (
                    <tr key={token} className="border-t border-slate-800">
                      <td className="py-2 pr-2 font-medium text-slate-200">{token}</td>
                      <td className="py-2 pr-2">{activeNetwork.tokenPairDepth[token]}</td>
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
                          onClick={() => {
                            setRouteCalldata({ buyCalldata: "", sellCalldata: "" });
                            setConfirmOpportunity(opportunity);
                          }}
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/70 p-3 sm:items-center sm:p-4">
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="max-h-[88vh] w-full max-w-2xl overflow-y-auto border border-slate-700 bg-slate-900 p-4 sm:p-5">
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

              <div className="mt-3 space-y-2 text-sm">
                <label className="block text-slate-300">Buy swap calldata (0x...)</label>
                <textarea
                  value={routeCalldata.buyCalldata}
                  onChange={(event) => setRouteCalldata((current) => ({ ...current, buyCalldata: event.target.value.trim() }))}
                  className="h-20 w-full border border-slate-700 bg-slate-950 p-2 text-xs"
                  placeholder="Paste router calldata"
                />
                <label className="block text-slate-300">Sell swap calldata (0x...)</label>
                <textarea
                  value={routeCalldata.sellCalldata}
                  onChange={(event) => setRouteCalldata((current) => ({ ...current, sellCalldata: event.target.value.trim() }))}
                  className="h-20 w-full border border-slate-700 bg-slate-950 p-2 text-xs"
                  placeholder="Paste router calldata"
                />
                <p className="text-xs text-amber-300">Calldata must match your deployed contract balance flow. Wrong payload can fail and still spend gas.</p>
              </div>

              <div className="sticky bottom-0 mt-5 flex justify-end gap-2 border-t border-slate-800 bg-slate-900 pt-3">
                <button onClick={() => setConfirmOpportunity(null)} className="bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600">Cancel</button>
                <button onClick={() => beginExecution(confirmOpportunity)} className="bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                  Confirm Trade
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {executionState && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="w-full max-w-2xl border border-slate-700 bg-slate-900 p-5">
              <h3 className="text-lg font-semibold">Execution window</h3>
              <p className="mt-1 text-sm text-slate-300">{executionState.opportunity.pair} via {executionState.opportunity.provider}</p>
              <div className="mt-4 space-y-2">
                {executionSteps.map((step, index) => {
                  const isDone = index < executionState.stepIndex;
                  const isActive = index === executionState.stepIndex && executionState.status === "running";
                  return (
                    <div key={step} className="flex items-center gap-3 text-sm">
                      <div className={`h-2.5 w-2.5 ${isDone ? "bg-emerald-300" : isActive ? "bg-cyan-300" : "bg-slate-600"}`} />
                      <span className={isDone || isActive ? "text-slate-100" : "text-slate-400"}>{step}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border border-slate-800 p-3 text-sm">
                <p>Status: {executionState.status}</p>
                {executionState.txHash && <p>Transaction hash: {executionState.txHash}</p>}
                {executionState.error && <p className="text-rose-300">Error: {executionState.error}</p>}
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
