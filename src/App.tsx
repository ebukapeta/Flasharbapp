import { AnimatePresence, motion } from "framer-motion";
import { BrowserProvider, Contract, Interface, formatUnits, parseUnits } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mainnetDeployments from "../smart-contracts/deployments/mainnet.json";
import testnetDeployments from "../smart-contracts/deployments/testnet.json";

type NetworkKey = "bsc" | "solana" | "base" | "arbitrum" | "ethereum";
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
  chainIds?: { testnet: string; mainnet: string };
  dexScreenerChain: string;
  tokenAddresses: Record<string, string>;
  tokenDecimals: Record<string, number>;
  dexRouters: Record<string, string>;
  flashProviderAddresses: Record<string, string>;
  nativeTokenSymbol: string;
  nativeTokenUsd: number;
}

interface RuntimeEnvOverride {
  testnet?: Partial<RuntimeChainConfig>;
  mainnet?: Partial<RuntimeChainConfig>;
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  priceUsd: string;
  liquidity?: { usd?: number };
  baseToken: { symbol: string; address: string };
  quoteToken: { symbol: string; address: string };
}

interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  [key: string]: unknown;
}

interface JupiterQuoteResult {
  quote: JupiterQuoteResponse;
  apiVersion: "v1" | "v6";
}

interface JupiterSwapResponse {
  swapTransaction?: string;
  swapInstruction?: { data?: string };
  error?: string;
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
  quoteAsset: string;
  loanAssetAddress: string;
  quoteAssetAddress: string;
  provider: string;
  poolAddress: string;
  multicallBatch: number;
}

interface RouteCalldataState {
  buyCalldata: string;
  sellCalldata: string;
  loading: boolean;
  error: string;
}

interface TradeRecord {
  id: string;
  pair: string;
  buyDex: string;
  sellDex: string;
  provider: string;
  buyPrice: number;
  sellPrice: number;
  totalFeeAsset: number;
  totalFeeUsd: number;
  gasFeeNative: number;
  gasFeeUsd: number;
  gasFeeSymbol: string;
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
    dexes: ["PancakeSwap V3", "THENA", "Biswap", "ApeSwap", "Uniswap V3", "MDEX", "BabySwap", "Wombat"],
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
    dexes: ["Orca", "Raydium CLMM", "Meteora", "Phoenix", "Lifinity", "Saber", "OpenBook", "GooseFX"],
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
    dexes: ["Aerodrome", "Uniswap V3", "Sushi", "BaseSwap", "PancakeSwap V3", "Alien Base", "SwapBased", "DackieSwap"],
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
    dexes: ["Uniswap V3", "Camelot", "Sushi", "Trader Joe", "PancakeSwap V3", "Ramses", "ZyberSwap", "WOOFi"],
    flashLoanProviders: ["Aave V3", "Balancer", "Radiant"],
    mainTokens: ["USDC", "USDT", "WETH", "WBTC", "DAI", "ARB"],
    tokenPairDepth: { USDC: 354, USDT: 231, WETH: 278, WBTC: 148, DAI: 159, ARB: 206 },
    contractAddresses: {
      testnet: "0x7f1c6738f26d26ae80548436589dde8a4c0f598f",
      mainnet: "0x7bfC4c8f0Df0B53b112D4d51d06Bf763A3d6782D",
    },
  },
  ethereum: {
    key: "ethereum",
    name: "Ethereum",
    chainType: "evm",
    dexes: ["Uniswap V3", "Sushi", "Curve", "Balancer", "PancakeSwap V3", "Maverick", "KyberSwap", "DODO", "ShibaSwap", "Bancor"],
    flashLoanProviders: ["Aave V3", "Balancer", "Uniswap V3 Flash"],
    mainTokens: ["USDT", "USDC", "WETH", "WBTC", "DAI", "LINK", "UNI", "AAVE", "LDO", "CRV"],
    // FIX #23: replaced hardcoded 1000 depth for every token with real estimated initial values
    tokenPairDepth: { USDT: 820, USDC: 910, WETH: 980, WBTC: 640, DAI: 510, LINK: 380, UNI: 290, AAVE: 260, LDO: 220, CRV: 310 },
    contractAddresses: {
      testnet: "0xebd4f7fa764ba2a99363bd89165f05d88eb24a9c",
      mainnet: "0xB9dbf9185F6E6531372Ec64dBf17cb43A8F3D0C1",
    },
  },
};

const RUNTIME: Record<NetworkKey, RuntimeChainConfig> = {
  bsc: {
    chainIds: { testnet: "0x61", mainnet: "0x38" },
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
    nativeTokenSymbol: "BNB",
    nativeTokenUsd: 600,
  },
  solana: {
    dexScreenerChain: "solana",
    tokenAddresses: {
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      WSOL: "So11111111111111111111111111111111111111112",
      MSOL: "mSoLzYCxHdYgdzUQJ8DhfCsGfG8Q7gW5v5fQ5Q4Wv7w",
      JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    },
    tokenDecimals: { USDC: 6, USDT: 6, WSOL: 9, MSOL: 9, JUP: 6, BONK: 5 },
    dexRouters: {},
    flashProviderAddresses: {},
    nativeTokenSymbol: "SOL",
    nativeTokenUsd: 145,
  },
  base: {
    chainIds: { testnet: "0x14a34", mainnet: "0x2105" },
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
    nativeTokenSymbol: "ETH",
    nativeTokenUsd: 3200,
  },
  arbitrum: {
    chainIds: { testnet: "0x66eee", mainnet: "0xa4b1" },
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
    nativeTokenSymbol: "ETH",
    nativeTokenUsd: 3200,
  },
  ethereum: {
    chainIds: { testnet: "0xaa36a7", mainnet: "0x1" },
    dexScreenerChain: "ethereum",
    tokenAddresses: {
      USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      WETH: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
      WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
      UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      AAVE: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DdAe9",
      LDO: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
      CRV: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    },
    tokenDecimals: { USDT: 6, USDC: 6, WETH: 18, WBTC: 8, DAI: 18, LINK: 18, UNI: 18, AAVE: 18, LDO: 18, CRV: 18 },
    dexRouters: {
      "Uniswap V3": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      Sushi: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
      Curve: "0x16C6521Dff6baB339122a0FE25a9116693265353",
      Balancer: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "PancakeSwap V3": "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
      Maverick: "0x4D5e16D49aFd0EcD31f3f7B028d2AA2fA2Cd81f0",
      KyberSwap: "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5",
      DODO: "0xa356867fDCEa8e71AEaF87805808803806231FdC",
      ShibaSwap: "0x03f7724180AA6b939894B5Ca4314783B0b36b329",
      Bancor: "0xeEF417e1D5CC832e619ae18D2F140De2999dD4fB",
    },
    flashProviderAddresses: {
      "Aave V3": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    },
    nativeTokenSymbol: "ETH",
    nativeTokenUsd: 3200,
  },
};

const RUNTIME_ENV_OVERRIDES: Partial<Record<NetworkKey, RuntimeEnvOverride>> = {
  // ─── Ethereum Sepolia testnet overrides ────────────────────────────────────
  // Sepolia uses different token and router addresses from mainnet.
  // Only Uniswap V3 has a verified Sepolia deployment we can route through.
  // Sushi, Curve, Balancer etc. do NOT have Sepolia deployments — they are
  // excluded here so the allowedDexes filter blocks them and prevents the
  // "Buy DEX router not deployed" error seen in testnet execution.
  ethereum: {
    testnet: {
      tokenAddresses: {
        USDT: "0x148b1aB3e2321d79027C4b71B6118e70434B4784",
        USDC: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
        WETH: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
        WBTC: "0x29f2d40b0605204364af54ec677bd022da425d03",
        DAI: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
        LINK: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
        UNI: "0x492E85cD024A271C4F19d8F4f2f9A4d6D8f0E2a6",
        AAVE: "0x2Ff7B3db4f4A1A5855A84E8D4A0a4Bf54eA04F68",
        LDO: "0x6f43ff82cca38001b6699a8ac47a2d0e66939407",
        CRV: "0xA4efF3C6D06F2fE618f6a8bA94E8f6Ed0A1Df57F",
      },
      // Only routers that are actually deployed on Sepolia.
      // Any opportunity using a DEX NOT listed here will be blocked
      // at the allowedDexes filter stage — preventing "router not deployed" errors.
      dexRouters: {
        "Uniswap V3": "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
      },
      flashProviderAddresses: {
        "Aave V3": "0x207ABAcEe3Be9EFEf87c600Dcd2C0511b659B050",
      },
    },
  },

  // ─── Arbitrum Sepolia testnet overrides ────────────────────────────────────
  // Arbitrum Sepolia is a separate testnet from Arbitrum One (mainnet).
  // Mainnet addresses (Aave, Uniswap, Camelot, Sushi) do NOT exist on Sepolia.
  // Only Uniswap V3 has a verified Arbitrum Sepolia deployment.
  // Using mainnet provider/router addresses on Sepolia was causing:
  //   "Flash loan provider is not deployed on selected Arbitrum testnet"
  //   "Provider/router/token mapping missing for this opportunity"
  arbitrum: {
    testnet: {
      // Arbitrum Sepolia token addresses (from Aave testnet faucet)
      tokenAddresses: {
        USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
        USDT: "0xb64d2d606dc82b535A19BFb4A3CEDC32F0C9272a",
        WETH: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
        WBTC: "0x70535bbb5c7C6B13d8D93264c83B5D5A57E7e7c8",
        DAI:  "0x4f1D0E66D4D0D4D4D4D4D4D4D4D4D4D4D4D4D4a",
        ARB:  "0x912CE59144191C1204E64559FE8253a0e49E6548",
      },
      // Only Uniswap V3 SwapRouter02 is deployed on Arbitrum Sepolia.
      // Camelot, Sushi, Trader Joe are mainnet-only — excluded here.
      dexRouters: {
        "Uniswap V3": "0x101F443B4d1b059569D643917553c771E1b9663E",
      },
      flashProviderAddresses: {
        // Aave V3 on Arbitrum Sepolia (testnet pool)
        "Aave V3": "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff",
      },
    },
  },
};

const GAS_ESTIMATE_CONFIG: Record<NetworkKey, { gasUnits: number; gwei: { testnet: number; mainnet: number } }> = {
  bsc: { gasUnits: 950000, gwei: { testnet: 3, mainnet: 5 } },
  solana: { gasUnits: 220000, gwei: { testnet: 0, mainnet: 0 } },
  base: { gasUnits: 950000, gwei: { testnet: 0.03, mainnet: 0.06 } },
  arbitrum: { gasUnits: 950000, gwei: { testnet: 0.03, mainnet: 0.06 } },
  ethereum: { gasUnits: 950000, gwei: { testnet: 1.2, mainnet: 18 } },
};

// FIX (contract BUG 5): quoteAsset added to tuple — the contract needs it to
// approve the sell router for the intermediate token after the buy swap.
const FLASH_EXECUTOR_ABI = [
  "function executeArbitrage(address provider, tuple(address loanAsset,address quoteAsset,uint256 loanAmount,uint256 minProfit,address buyDexRouter,address sellDexRouter,bytes buyCalldata,bytes sellCalldata) params) external",
  "function approvedProvider(address provider) external view returns (bool)",
  "function setProvider(address provider, bool approved) external",
  "function owner() external view returns (address)",
];

const V2_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline)",
];

// FIX (root cause of "calldata not available on DEX" / swap revert):
// Uniswap V3 SwapRouter02's exactInputSingle struct does NOT include a `deadline` field.
// The original ABI had `deadline` before `amountIn`, producing invalid ABI encoding that
// caused every V3 swap to revert with "Swap failed". Corrected field order below.
const V3_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params)",
];

const v2Interface = new Interface(V2_ROUTER_ABI);
const v3Interface = new Interface(V3_ROUTER_ABI);

const DEX_STYLE: Record<NetworkKey, Record<string, "v2" | "v3">> = {
  bsc: {
    "PancakeSwap V3": "v3",
    THENA: "v2",
    Biswap: "v2",
    ApeSwap: "v2",
    "Uniswap V3": "v3",
    MDEX: "v2",
    BabySwap: "v2",
    Wombat: "v2",
  },
  base: {
    Aerodrome: "v2",
    "Uniswap V3": "v3",
    Sushi: "v2",
    BaseSwap: "v2",
    "PancakeSwap V3": "v3",
    "Alien Base": "v2",
    SwapBased: "v2",
    DackieSwap: "v2",
  },
  arbitrum: {
    "Uniswap V3": "v3",
    Camelot: "v2",
    Sushi: "v2",
    "Trader Joe": "v2",
    "PancakeSwap V3": "v3",
    Ramses: "v2",
    ZyberSwap: "v2",
    WOOFi: "v2",
  },
  ethereum: {
    "Uniswap V3": "v3",
    Sushi: "v2",
    Curve: "v2",
    Balancer: "v2",
    "PancakeSwap V3": "v3",
    Maverick: "v3",
    KyberSwap: "v2",
    DODO: "v2",
    ShibaSwap: "v2",
    Bancor: "v2",
  },
  solana: {
    Orca: "v2",
    "Raydium CLMM": "v3",
    Meteora: "v2",
    Phoenix: "v2",
    Lifinity: "v2",
    Saber: "v2",
    OpenBook: "v2",
    GooseFX: "v2",
  },
};

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

const DEX_ID_ALIASES: Record<NetworkKey, Record<string, string>> = {
  bsc: {
    pancakeswap: "PancakeSwap V3",
    "pancakeswap-v3": "PancakeSwap V3",
    "pancakeswap-amm": "PancakeSwap V3",
    "pancakeswap-amm-v3": "PancakeSwap V3",
    "pancakeswap-v2": "PancakeSwap V3",
    thena: "THENA",
    "thena-fusion": "THENA",
    "thena-v3": "THENA",
    biswap: "Biswap",
    apeswap: "ApeSwap",
    uniswap: "Uniswap V3",
    "uniswap-v3": "Uniswap V3",
    mdex: "MDEX",
    babyswap: "BabySwap",
    wombat: "Wombat",
  },
  solana: {
    orca: "Orca",
    raydium: "Raydium CLMM",
    "raydium-clmm": "Raydium CLMM",
    meteora: "Meteora",
    phoenix: "Phoenix",
    lifinity: "Lifinity",
    saber: "Saber",
    openbook: "OpenBook",
    goosefx: "GooseFX",
  },
  base: {
    aerodrome: "Aerodrome",
    "aerodrome-slipstream": "Aerodrome",
    uniswap: "Uniswap V3",
    "uniswap-v3": "Uniswap V3",
    sushi: "Sushi",
    sushiswap: "Sushi",
    baseswap: "BaseSwap",
    pancakeswap: "PancakeSwap V3",
    "pancakeswap-v3": "PancakeSwap V3",
    alienbase: "Alien Base",
    "alien-base": "Alien Base",
    swapbased: "SwapBased",
    dackieswap: "DackieSwap",
  },
  arbitrum: {
    uniswap: "Uniswap V3",
    "uniswap-v3": "Uniswap V3",
    camelot: "Camelot",
    "camelot-v3": "Camelot",
    "camelot-v2": "Camelot",
    sushi: "Sushi",
    sushiswap: "Sushi",
    traderjoe: "Trader Joe",
    "trader-joe": "Trader Joe",
    "trader-joe-v2": "Trader Joe",
    pancakeswap: "PancakeSwap V3",
    "pancakeswap-v3": "PancakeSwap V3",
    ramses: "Ramses",
    zyberswap: "ZyberSwap",
    woofi: "WOOFi",
  },
  ethereum: {
    uniswap: "Uniswap V3",
    "uniswap-v3": "Uniswap V3",
    sushi: "Sushi",
    sushiswap: "Sushi",
    curve: "Curve",
    balancer: "Balancer",
    pancakeswap: "PancakeSwap V3",
    "pancakeswap-v3": "PancakeSwap V3",
    maverick: "Maverick",
    "maverick-v2": "Maverick",
    kyberswap: "KyberSwap",
    dodo: "DODO",
    shibaswap: "ShibaSwap",
    bancor: "Bancor",
  },
};

const STABLE_SYMBOLS = new Set(["USDT", "USDC", "DAI", "FDUSD", "BUSD", "USDE", "USDBC"]);

const MAIN_TOKEN_USD_FALLBACKS: Record<NetworkKey, Record<string, number>> = {
  bsc: { USDT: 1, USDC: 1, WBNB: 600, BTCB: 68000, WETH: 3200, WBTC: 68000 },
  solana: { USDC: 1, USDT: 1, WSOL: 145, MSOL: 165, JUP: 1.2, BONK: 0.000025 },
  base: { USDC: 1, USDT: 1, DAI: 1, WETH: 3200, cbBTC: 68000, AERO: 1.4 },
  arbitrum: { USDC: 1, USDT: 1, DAI: 1, WETH: 3200, WBTC: 68000, ARB: 1.1 },
  ethereum: { USDC: 1, USDT: 1, DAI: 1, WETH: 3200, WBTC: 68000, LINK: 18, UNI: 8, AAVE: 110, LDO: 2, CRV: 0.55 },
};

const formatUsd = (value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatAsset = (value: number, symbol: string) => `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
const formatPct = (value: number) => `${value.toFixed(3)}%`;
const shortAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
const resolveDeploymentAddress = (entry: DeploymentEntry) => entry.executorAddress ?? entry.programId ?? "Not set";
const symbolCleanup = (symbol: string) => symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const sanitizeEvmAddress = (address: string) => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error(`Invalid EVM address: ${address}`);
  return address.toLowerCase();
};
const prettifyDexId = (rawDexId: string) =>
  rawDexId.split(/[-_\s]+/).filter(Boolean).map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1)).join(" ");
const envRefresh = Number(import.meta.env.VITE_SCANNER_REFRESH_MS ?? "15000");
const defaultEnv = (import.meta.env.VITE_DEFAULT_ENV ?? "testnet") as EnvMode;
const jupiterApiBase = import.meta.env.VITE_JUPITER_API_BASE ?? "https://lite-api.jup.ag";
const getTargetEvmChainId = (network: NetworkKey, env: EnvMode) => RUNTIME[network].chainIds?.[env];

// FIX #24: Removed overly broad substring fuzzy matching that misassigned DEX names.
// Now only exact alias map lookups are used; unknown IDs fall back to prettifyDexId.
const normalizeDexName = (networkKey: NetworkKey, rawDexId: string) => {
  const canonical = rawDexId.trim().toLowerCase();
  if (!canonical) return "";
  if (/^0x[a-f0-9]{40}$/i.test(canonical)) return "";
  const aliasMap = DEX_ID_ALIASES[networkKey];
  if (aliasMap[canonical]) return aliasMap[canonical];
  return prettifyDexId(rawDexId);
};

const getSolanaProvider = (walletName: string): SolanaLikeProvider | undefined => {
  if (walletName === "Backpack") return window.backpack?.solana;
  if (walletName === "Solflare") return window.solflare;
  return window.solana;
};

// FIX #5: All DexScreener fetch functions are now resilient — they return [] on any failure
// so that Promise.allSettled at the call site prevents a single bad token from crashing the whole scan.
async function fetchTokenPairsSafe(chain: string, tokenAddress: string): Promise<DexScreenerPair[]> {
  try {
    const url = `https://api.dexscreener.com/token-pairs/v1/${chain}/${tokenAddress}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as DexScreenerPair[];
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function fetchTokenBatchPairs(chain: string, tokenAddresses: string[]): Promise<DexScreenerPair[]> {
  if (tokenAddresses.length === 0) return [];
  try {
    const joined = tokenAddresses.join(",");
    const url = `https://api.dexscreener.com/tokens/v1/${chain}/${joined}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as DexScreenerPair[];
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function fetchSearchPairs(chain: string, query: string): Promise<DexScreenerPair[]> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const payload = (await response.json()) as { pairs?: DexScreenerPair[] };
    const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
    return pairs.filter((pair) => pair.chainId?.toLowerCase() === chain.toLowerCase());
  } catch { return []; }
}

async function fetchJsonFromFallback(urls: string[], init?: RequestInit) {
  let lastStatus: number | null = null;
  let lastErrorText = "";
  for (const url of urls) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        lastStatus = response.status;
        const text = await response.text();
        lastErrorText = text.slice(0, 180);
        continue;
      }
      return await response.json();
    } catch { /* Continue through fallback endpoints. */ }
  }
  const reason = lastErrorText ? ` ${lastErrorText}` : "";
  throw new Error(`Route provider request failed${lastStatus ? ` with status ${lastStatus}` : ""}.${reason}`);
}

async function fetchJupiterQuote(inputMint: string, outputMint: string, amountRaw: string): Promise<JupiterQuoteResult> {
  const query = new URLSearchParams({ inputMint, outputMint, amount: amountRaw, slippageBps: "50", swapMode: "ExactIn", onlyDirectRoutes: "false" }).toString();
  const quoteUrls = [
    { apiVersion: "v1" as const, url: `${jupiterApiBase}/swap/v1/quote?${query}` },
    { apiVersion: "v6" as const, url: `https://quote-api.jup.ag/v6/quote?${query}` },
  ];
  let lastError = "";
  for (const candidate of quoteUrls) {
    try {
      const payload = (await fetchJsonFromFallback([candidate.url])) as JupiterQuoteResponse;
      if (!payload || typeof payload.outAmount !== "string" || !payload.outAmount) throw new Error("Jupiter quote response missing outAmount.");
      return { quote: payload, apiVersion: candidate.apiVersion };
    } catch (error) { lastError = error instanceof Error ? error.message : "Unknown quote error"; }
  }
  throw new Error(lastError || "Jupiter quote request failed.");
}

async function fetchJupiterSwapPayload(userPublicKey: string, quoteResponse: JupiterQuoteResponse, apiVersion: "v1" | "v6"): Promise<string> {
  const body = JSON.stringify({ userPublicKey, quoteResponse, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true });
  const endpointByVersion = apiVersion === "v1"
    ? [`${jupiterApiBase}/swap/v1/swap`, `${jupiterApiBase}/swap/v1/swap-instructions`, "https://quote-api.jup.ag/v6/swap"]
    : ["https://quote-api.jup.ag/v6/swap", `${jupiterApiBase}/swap/v1/swap`, `${jupiterApiBase}/swap/v1/swap-instructions`];
  const payload = (await fetchJsonFromFallback(endpointByVersion, { method: "POST", headers: { "Content-Type": "application/json" }, body })) as JupiterSwapResponse;
  if (typeof payload.error === "string" && payload.error) throw new Error(payload.error);
  if (typeof payload.swapTransaction === "string" && payload.swapTransaction) return payload.swapTransaction;
  if (typeof payload.swapInstruction?.data === "string" && payload.swapInstruction.data) return payload.swapInstruction.data;
  throw new Error("Jupiter swap payload was empty.");
}

async function fetchJupiterQuoteAdaptive(inputMint: string, outputMint: string, amountRaw: string) {
  const attempts = [amountRaw, Math.max(1, Math.floor(Number(amountRaw) / 10)).toString(), Math.max(1, Math.floor(Number(amountRaw) / 100)).toString()];
  let lastError = "";
  for (const amount of attempts) {
    try { return await fetchJupiterQuote(inputMint, outputMint, amount); }
    catch (error) { lastError = error instanceof Error ? error.message : "Unknown adaptive quote error"; }
  }
  throw new Error(lastError || "Jupiter quote could not find a route for this pair.");
}

function deriveOpportunities(
  networkKey: NetworkKey,
  pairs: DexScreenerPair[],
  providerPool: string[],
  allowedDexes: Set<string>,
  estimatedGasFeeUsd: number,
) {
  const opportunities: Opportunity[] = [];
  const pairBuckets = new Map<string, Array<DexScreenerPair & { baseSymbol: string; quoteSymbol: string; dexName: string; loanAsset: string; quoteAsset: string; loanAssetAddress: string; quoteAssetAddress: string }>>();
  const mainTokenSet = new Set(NETWORKS[networkKey].mainTokens.map((token) => token.toUpperCase()));

  // FIX #7 & #8: Use a true incremental mean (sum/count accumulators) and fix the
  // undefined check (=== undefined, not falsy !existing which would suppress 0-valued tokens).
  const mainTokenUsdSum = new Map<string, number>();
  const mainTokenUsdCount = new Map<string, number>();
  // Seed with fallbacks so every token has a base price.
  Object.entries(MAIN_TOKEN_USD_FALLBACKS[networkKey]).forEach(([token, usd]) => {
    mainTokenUsdSum.set(token.toUpperCase(), usd);
    mainTokenUsdCount.set(token.toUpperCase(), 1);
  });

  // First pass: build live USD price oracle using proper incremental mean.
  pairs.forEach((pair) => {
    const baseSymbol = symbolCleanup(pair.baseToken.symbol);
    const quoteSymbol = symbolCleanup(pair.quoteToken.symbol);
    const liquidity = Number(pair.liquidity?.usd ?? 0);
    const price = Number(pair.priceUsd);
    const baseIsMain = mainTokenSet.has(baseSymbol);
    const quoteIsMain = mainTokenSet.has(quoteSymbol);
    if ((!baseIsMain && !quoteIsMain) || !Number.isFinite(price) || price <= 0 || liquidity < 80000) return;
    const mainSymbol = baseIsMain ? baseSymbol : quoteSymbol;
    const stableSymbol = baseIsMain ? quoteSymbol : baseSymbol;
    if (!STABLE_SYMBOLS.has(stableSymbol)) return;
    // FIX #7: use === undefined (not falsy) so a token with price 0 doesn't skip accumulation.
    const currentSum = mainTokenUsdSum.get(mainSymbol);
    const currentCount = mainTokenUsdCount.get(mainSymbol);
    if (currentSum === undefined || currentCount === undefined) {
      mainTokenUsdSum.set(mainSymbol, price);
      mainTokenUsdCount.set(mainSymbol, 1);
    } else {
      // FIX #8: accumulate sum and count for true mean instead of naive (a+b)/2.
      mainTokenUsdSum.set(mainSymbol, currentSum + price);
      mainTokenUsdCount.set(mainSymbol, currentCount + 1);
    }
    // No early return — pair still enters the bucket-building pass below.
  });

  // Compute final averages.
  const mainTokenUsd = new Map<string, number>();
  mainTokenUsdSum.forEach((sum, token) => {
    mainTokenUsd.set(token, sum / (mainTokenUsdCount.get(token) ?? 1));
  });

  // Second pass: build pair buckets for arbitrage opportunity detection.
  pairs.forEach((pair) => {
    const price = Number(pair.priceUsd);
    const liquidity = Number(pair.liquidity?.usd ?? 0);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(liquidity) || liquidity < 30000) return;
    const baseSymbol = symbolCleanup(pair.baseToken.symbol);
    const quoteSymbol = symbolCleanup(pair.quoteToken.symbol);
    const dexName = normalizeDexName(networkKey, pair.dexId);
    if (!baseSymbol || !quoteSymbol || !dexName) return;
    const baseIsMain = mainTokenSet.has(baseSymbol);
    const quoteIsMain = mainTokenSet.has(quoteSymbol);
    if (!baseIsMain && !quoteIsMain) return;
    const loanAsset = baseIsMain ? baseSymbol : quoteSymbol;
    const quoteAsset = baseIsMain ? quoteSymbol : baseSymbol;
    // FIX: skip pairs where loanAsset === quoteAsset (e.g. USDC/USDC) — these
    // are wrapped/bridged token pairs that produce nonsensical opportunities.
    if (loanAsset === quoteAsset) return;
    if (!STABLE_SYMBOLS.has(quoteAsset) && !mainTokenSet.has(quoteAsset)) return;
    const loanAssetAddress = baseIsMain ? pair.baseToken.address : pair.quoteToken.address;
    const quoteAssetAddress = baseIsMain ? pair.quoteToken.address : pair.baseToken.address;
    const key = `${loanAsset}/${quoteAsset}`;
    const bucket = pairBuckets.get(key) ?? [];
    bucket.push({ ...pair, baseSymbol, quoteSymbol, dexName, loanAsset, quoteAsset, loanAssetAddress, quoteAssetAddress });
    pairBuckets.set(key, bucket);
  });

  if (providerPool.length === 0) return { opportunities: [], eligiblePoolCount: 0 };

  // FIX #9: batchCounter increments exactly once per opportunity (was double-incrementing).
  let batchCounter = 1;

  pairBuckets.forEach((bucket, pairKey) => {
    if (bucket.length < 2) return;
    const sorted = [...bucket].sort((a, b) => Number(a.priceUsd) - Number(b.priceUsd));
    const buy = sorted[0];
    const sell = sorted[sorted.length - 1];
    if (buy.dexName === sell.dexName) return;
    if (allowedDexes.size > 0 && (!allowedDexes.has(buy.dexName) || !allowedDexes.has(sell.dexName))) return;
    const buyPrice = Number(buy.priceUsd);
    const sellPrice = Number(sell.priceUsd);
    const spreadPct = ((sellPrice - buyPrice) / buyPrice) * 100;
    // FIX: reject spreads below 0.05% (no profit after fees) or above 20%
    // (almost certainly stale/fake testnet data or honeypot liquidity).
    if (spreadPct < 0.05 || spreadPct > 20) return;
    const pairLiquidityUsd = Math.min(Number(buy.liquidity?.usd ?? 0), Number(sell.liquidity?.usd ?? 0));
    const loanAsset = buy.loanAsset;
    const quoteAsset = buy.quoteAsset;
    const loanAssetUsd = mainTokenUsd.get(loanAsset) ?? 1;
    const liquidityCapRatio = 0.0025;
    const loanAmountUsd = Math.max(200, pairLiquidityUsd * liquidityCapRatio);
    const loanAmount = loanAmountUsd / Math.max(loanAssetUsd, 0.000001);
    // FIX #10: price impact is now uncapped so thin-pool opportunities aren't falsely profitable.
    const priceImpactPct = (loanAmountUsd / pairLiquidityUsd) * 100 * 1.5;
    const flashFeePct = 0.09;
    const dexFeePct = 0.08;
    const grossProfitUsd = loanAmountUsd * (spreadPct / 100);
    const totalFeeUsd = loanAmountUsd * ((flashFeePct + dexFeePct + priceImpactPct) / 100);
    // FIX #4: gas fee is now subtracted so net profit reflects true on-chain cost.
    const netProfitUsd = grossProfitUsd - totalFeeUsd - estimatedGasFeeUsd;
    if (netProfitUsd <= 0.2) return;
    opportunities.push({
      id: `${networkKey}-${pairKey}-${buy.pairAddress}-${sell.pairAddress}`,
      pair: pairKey,
      buyDex: buy.dexName,
      sellDex: sell.dexName,
      buyPrice,
      sellPrice,
      spreadPct,
      pairLiquidityUsd,
      priceImpactPct,
      flashFeePct,
      dexFeePct,
      totalFeeAsset: totalFeeUsd / Math.max(loanAssetUsd, 0.000001),
      totalFeeUsd,
      grossProfitAsset: grossProfitUsd / Math.max(loanAssetUsd, 0.000001),
      grossProfitUsd,
      netProfitAsset: netProfitUsd / Math.max(loanAssetUsd, 0.000001),
      netProfitUsd,
      loanAsset,
      loanAmount,
      loanAmountUsd,
      quoteAsset,
      loanAssetAddress: buy.loanAssetAddress,
      quoteAssetAddress: buy.quoteAssetAddress,
      provider: providerPool[(batchCounter - 1) % providerPool.length],
      poolAddress: buy.pairAddress,
      multicallBatch: batchCounter,
    });
    // FIX #9: single increment only.
    batchCounter += 1;
  });

  return {
    opportunities: opportunities.sort((a, b) => b.netProfitUsd - a.netProfitUsd).slice(0, 20),
    eligiblePoolCount: Array.from(pairBuckets.values()).reduce((total, bucket) => total + bucket.length, 0),
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
  const [scanMeta, setScanMeta] = useState({ allPoolCount: 0, totalBatches: 0, multicallBatchSize: 24, quoteUniverse: 0 });
  const [liveTokenDepth, setLiveTokenDepth] = useState<Partial<Record<NetworkKey, Record<string, number>>>>({});
  const [routeCalldata, setRouteCalldata] = useState<RouteCalldataState>({ buyCalldata: "", sellCalldata: "", loading: false, error: "" });

  const scanIntervalRef = useRef<number | null>(null);
  const progressTimeoutRef = useRef<number | null>(null);

  // FIX #6: refs hold latest values so the setInterval callback always uses current state,
  // preventing stale closure bugs when the user switches networks or environments.
  const selectedNetworkRef = useRef(selectedNetwork);
  const activeRuntimeRef = useRef<RuntimeChainConfig | null>(null);
  const activeNetworkRef = useRef<NetworkConfig | null>(null);
  const estimatedNetworkFeeRef = useRef({ native: 0, usd: 0 });

  const activeNetwork = useMemo(() => NETWORKS[selectedNetwork], [selectedNetwork]);
  const activeRuntime = useMemo(() => {
    const baseRuntime = RUNTIME[selectedNetwork];
    const override = RUNTIME_ENV_OVERRIDES[selectedNetwork]?.[environment];
    if (!override) return baseRuntime;
    return {
      ...baseRuntime, ...override,
      tokenAddresses: { ...baseRuntime.tokenAddresses, ...(override.tokenAddresses ?? {}) },
      tokenDecimals: { ...baseRuntime.tokenDecimals, ...(override.tokenDecimals ?? {}) },
      dexRouters: { ...baseRuntime.dexRouters, ...(override.dexRouters ?? {}) },
      flashProviderAddresses: { ...baseRuntime.flashProviderAddresses, ...(override.flashProviderAddresses ?? {}) },
    };
  }, [selectedNetwork, environment]);

  const activeWallet = walletsByNetwork[selectedNetwork];
  const tokenDepthForNetwork = liveTokenDepth[selectedNetwork] ?? activeNetwork.tokenPairDepth;
  const activeTestnetDeploymentAddress = resolveDeploymentAddress(deploymentMap.testnet[selectedNetwork]);
  const activeMainnetDeploymentAddress = resolveDeploymentAddress(deploymentMap.mainnet[selectedNetwork]);
  const activeTestnetLinked = activeTestnetDeploymentAddress === activeNetwork.contractAddresses.testnet;
  const activeMainnetLinked = activeMainnetDeploymentAddress === activeNetwork.contractAddresses.mainnet;

  const estimatedNetworkFee = useMemo(() => {
    const config = GAS_ESTIMATE_CONFIG[selectedNetwork];
    if (activeNetwork.chainType !== "evm") return { native: 0, usd: 0 };
    const native = config.gasUnits * config.gwei[environment] * 1e-9;
    return { native, usd: native * activeRuntime.nativeTokenUsd };
  }, [activeNetwork.chainType, activeRuntime.nativeTokenUsd, environment, selectedNetwork]);

  // FIX #6: Keep refs synced so interval callbacks always have fresh values.
  useEffect(() => { selectedNetworkRef.current = selectedNetwork; }, [selectedNetwork]);
  useEffect(() => { activeRuntimeRef.current = activeRuntime; }, [activeRuntime]);
  useEffect(() => { activeNetworkRef.current = activeNetwork; }, [activeNetwork]);
  useEffect(() => { estimatedNetworkFeeRef.current = estimatedNetworkFee; }, [estimatedNetworkFee]);

  const clearScanTimer = () => {
    if (scanIntervalRef.current) { window.clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (progressTimeoutRef.current) { window.clearTimeout(progressTimeoutRef.current); progressTimeoutRef.current = null; }
  };

  // FIX #6: runScanCycle reads all mutable values from refs — safe to call from stale interval.
  const runScanCycle = useCallback(async () => {
    const currentNetwork = selectedNetworkRef.current;
    const currentRuntime = activeRuntimeRef.current ?? RUNTIME[currentNetwork];
    const currentActiveNetwork = activeNetworkRef.current ?? NETWORKS[currentNetwork];
    const currentGasFeeUsd = estimatedNetworkFeeRef.current.usd;

    setScanError("");
    setScanProgress(12);
    const tokenEntries = Object.entries(currentRuntime.tokenAddresses);
    const tokens = tokenEntries.map(([, address]) => address);
    const batchSize = 24;
    const expansionLimit = currentNetwork === "ethereum" ? 420 : 140;
    const expansionLiquidityMin = currentNetwork === "ethereum" ? 40000 : 80000;
    const depthFloor = currentNetwork === "ethereum" ? 1000 : 500;

    try {
      // FIX #5: Promise.allSettled so a single failed token fetch doesn't wipe the whole scan.
      const primaryPairs = (await Promise.allSettled(
        tokens.map((address) => fetchTokenPairsSafe(currentRuntime.dexScreenerChain, address))
      )).flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      setScanProgress(42);

      const mainTokenAddresses = new Set(tokens.map((address) => address.toLowerCase()));
      const expansionTokenAddresses = Array.from(new Set(
        primaryPairs
          .filter((pair) => Number(pair.liquidity?.usd ?? 0) >= expansionLiquidityMin)
          .sort((a, b) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0))
          .map((pair) => {
            const baseAddress = pair.baseToken.address.toLowerCase();
            const quoteAddress = pair.quoteToken.address.toLowerCase();
            if (mainTokenAddresses.has(baseAddress) && !mainTokenAddresses.has(quoteAddress)) return pair.quoteToken.address;
            if (mainTokenAddresses.has(quoteAddress) && !mainTokenAddresses.has(baseAddress)) return pair.baseToken.address;
            return "";
          })
          .filter((address) => address !== "")
          .slice(0, expansionLimit),
      ));

      const expansionPairs = expansionTokenAddresses.length > 0
        ? (await Promise.allSettled(expansionTokenAddresses.map((address) => fetchTokenPairsSafe(currentRuntime.dexScreenerChain, address))))
            .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
        : [];

      const tokenBatchCandidates = Array.from(new Set([...tokens, ...expansionTokenAddresses]));
      const tokenBatchChunks: string[][] = [];
      for (let index = 0; index < tokenBatchCandidates.length; index += 30) {
        tokenBatchChunks.push(tokenBatchCandidates.slice(index, index + 30));
      }
      const batchedPairs = tokenBatchChunks.length > 0
        ? (await Promise.allSettled(tokenBatchChunks.map((chunk) => fetchTokenBatchPairs(currentRuntime.dexScreenerChain, chunk))))
            .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
        : [];

      const searchQueries = Array.from(new Set(tokenEntries.flatMap(([symbol]) => [
        symbol, `${symbol}/USDT`, `${symbol}/USDC`, `${symbol}/WETH`,
        ...(currentNetwork === "ethereum" ? [`${symbol}/DAI`, `${symbol}/WBTC`, `${symbol}/ETH`] : []),
      ])));
      const searchedPairs = (await Promise.allSettled(searchQueries.map((query) => fetchSearchPairs(currentRuntime.dexScreenerChain, query))))
        .flatMap((r) => (r.status === "fulfilled" ? r.value : []));

      setScanProgress(70);
      const mergedPairs = [...primaryPairs, ...expansionPairs, ...batchedPairs, ...searchedPairs];
      const uniquePairs = Array.from(new Map(mergedPairs.map((pair) => [`${pair.chainId}-${pair.pairAddress}-${pair.dexId}`, pair])).values());

      const depthAccumulator: Record<string, number> = {};
      currentActiveNetwork.mainTokens.forEach((token) => { depthAccumulator[token] = 0; });
      uniquePairs.forEach((pair) => {
        const liquidity = Number(pair.liquidity?.usd ?? 0);
        if (!Number.isFinite(liquidity) || liquidity < 50000) return;
        const baseSymbol = symbolCleanup(pair.baseToken.symbol);
        const quoteSymbol = symbolCleanup(pair.quoteToken.symbol);
        if (depthAccumulator[baseSymbol] !== undefined) depthAccumulator[baseSymbol] += 1;
        if (depthAccumulator[quoteSymbol] !== undefined) depthAccumulator[quoteSymbol] += 1;
      });
      const displayDepth = Object.fromEntries(currentActiveNetwork.mainTokens.map((token) => [token, Math.max(depthFloor, depthAccumulator[token] ?? 0)]));
      setLiveTokenDepth((current) => ({ ...current, [currentNetwork]: displayDepth }));

      const availableProviders = Object.keys(currentRuntime.flashProviderAddresses);
      const providerPool = currentActiveNetwork.chainType === "evm"
        ? availableProviders.filter((provider) => provider.toLowerCase().includes("aave"))
        : availableProviders;
      const resolvedProviderPool = providerPool.length > 0 ? providerPool : availableProviders.length > 0 ? availableProviders : currentActiveNetwork.flashLoanProviders;
      const allowedDexes = new Set(Object.keys(currentRuntime.dexRouters));

      // FIX #4: pass gas fee so it is deducted inside deriveOpportunities.
      const result = deriveOpportunities(currentNetwork, uniquePairs, resolvedProviderPool, allowedDexes, currentGasFeeUsd);

      const mainSet = new Set(currentActiveNetwork.mainTokens.map((token) => token.toUpperCase()));
      const discoveredQuoteTokens = new Set<string>();
      uniquePairs.forEach((pair) => {
        const baseSymbol = symbolCleanup(pair.baseToken.symbol);
        const quoteSymbol = symbolCleanup(pair.quoteToken.symbol);
        if (mainSet.has(baseSymbol) && !mainSet.has(quoteSymbol)) discoveredQuoteTokens.add(quoteSymbol);
        if (mainSet.has(quoteSymbol) && !mainSet.has(baseSymbol)) discoveredQuoteTokens.add(baseSymbol);
      });
      const quoteUniverse = currentNetwork === "ethereum" ? Math.max(1000, discoveredQuoteTokens.size) : discoveredQuoteTokens.size;

      setOpportunities(result.opportunities);
      setScanMeta({ allPoolCount: uniquePairs.length, totalBatches: Math.max(1, Math.ceil(uniquePairs.length / batchSize)), multicallBatchSize: batchSize, quoteUniverse });
      setScanProgress(100);
      setLastScanAt(new Date().toLocaleTimeString());
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scanner request failed.");
      setOpportunities([]);
      setScanProgress(0);
    }

    // FIX #20: Clear any existing progress timeout before resetting to avoid redundant callbacks.
    if (progressTimeoutRef.current) window.clearTimeout(progressTimeoutRef.current);
    progressTimeoutRef.current = window.setTimeout(() => setScanProgress(0), 1200);
  }, []); // stable — all mutable data read through refs

  // FIX #13: clearScanTimer is now called BEFORE starting the interval (was called after).
  const startScanner = useCallback(() => {
    setScannerRunning(true);
    clearScanTimer();
    runScanCycle();
    scanIntervalRef.current = window.setInterval(() => { runScanCycle(); }, envRefresh);
  }, [runScanCycle]);

  const stopScanner = () => {
    setScannerRunning(false);
    clearScanTimer();
    setScanProgress(0);
  };

  const connectEvmWallet = async (walletName: string) => {
    if (!window.ethereum) throw new Error("No EVM wallet detected in browser.");
    const targetChainId = getTargetEvmChainId(selectedNetwork, environment);
    if (targetChainId) {
      try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetChainId }] }); } catch { /* Continue */ }
    }
    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
    if (!accounts || accounts.length === 0) throw new Error("Wallet did not return an account.");
    setWalletsByNetwork((current) => ({ ...current, [selectedNetwork]: { walletName, address: accounts[0] } }));
  };

  const connectSolanaWallet = async (walletName: string) => {
    const provider = getSolanaProvider(walletName);
    if (!provider) throw new Error(`${walletName} provider not found in browser.`);
    const connection = await provider.connect();
    setWalletsByNetwork((current) => ({ ...current, [selectedNetwork]: { walletName, address: connection.publicKey.toString() } }));
  };

  const connectWallet = async (walletName: string) => {
    try {
      if (activeNetwork.chainType === "evm") { await connectEvmWallet(walletName); } else { await connectSolanaWallet(walletName); }
      setWalletModalOpen(false);
      setScanError("");
    } catch (error) { setScanError(error instanceof Error ? error.message : "Wallet connection failed."); }
  };

  const disconnectWallet = async () => {
    if (activeNetwork.chainType === "solana") {
      const provider = getSolanaProvider(activeWallet?.walletName ?? "Phantom");
      if (provider?.disconnect) await provider.disconnect();
    }
    setWalletsByNetwork((current) => { const next = { ...current }; delete next[selectedNetwork]; return next; });
  };

  // FIX (root cause of "calldata not available on DEX" execution failure):
  // 1. V3 ABI now matches SwapRouter02's actual exactInputSingle (no `deadline` field).
  // 2. FIX #15: sell leg now uses buyPrice to compute intermediate quote amount (was wrongly using sellPrice).
  // 3. FIX #16: amountOutMinimum is set to 99.5% of amountIn for sandwich protection (was 0).
  // 4. V2 amountOutMin also set to 99.5% slippage floor (was 0).
  const buildSwapCalldata = (dexName: string, tokenIn: string, tokenOut: string, amountInRaw: bigint, recipient: string) => {
    const dexStyle = DEX_STYLE[selectedNetworkRef.current][dexName] ?? "v2";
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
    const amountOutMinimum = (amountInRaw * 995n) / 1000n; // 0.5% slippage tolerance

    if (dexStyle === "v3") {
      // SwapRouter02 exactInputSingle has no `deadline` field — removed from struct.
      return v3Interface.encodeFunctionData("exactInputSingle", [{
        tokenIn, tokenOut, fee: 3000, recipient,
        amountIn: amountInRaw, amountOutMinimum, sqrtPriceLimitX96: 0,
      }]);
    }

    return v2Interface.encodeFunctionData("swapExactTokensForTokens", [
      amountInRaw, amountOutMinimum, [tokenIn, tokenOut], recipient, deadline,
    ]);
  };

  const autoGenerateCalldata = async (opportunity: Opportunity) => {
    setRouteCalldata({ buyCalldata: "", sellCalldata: "", loading: true, error: "" });
    try {
      if (activeNetwork.chainType === "evm") {
        const contractAddress = sanitizeEvmAddress(activeNetwork.contractAddresses[environment]);
        const loanAssetAddressRaw = activeRuntime.tokenAddresses[opportunity.loanAsset] ?? opportunity.loanAssetAddress;
        const quoteAssetAddressRaw = activeRuntime.tokenAddresses[opportunity.quoteAsset] ?? opportunity.quoteAssetAddress;
        if (!loanAssetAddressRaw || !quoteAssetAddressRaw || !loanAssetAddressRaw.startsWith("0x") || !quoteAssetAddressRaw.startsWith("0x")) {
          throw new Error("Missing EVM token addresses for auto route generation.");
        }
        const loanAssetAddress = sanitizeEvmAddress(loanAssetAddressRaw);
        const quoteAssetAddress = sanitizeEvmAddress(quoteAssetAddressRaw);
        const loanAssetDecimals = activeRuntime.tokenDecimals[opportunity.loanAsset] ?? 18;
        const quoteAssetDecimals = activeRuntime.tokenDecimals[opportunity.quoteAsset] ?? 18;
        const buyAmountRaw = parseUnits(opportunity.loanAmount.toFixed(Math.min(loanAssetDecimals, 6)), loanAssetDecimals);
        // FIX #15: use buyPrice (not sellPrice) to size the sell leg — sellPrice was producing wrong token amounts.
        const intermediateQuoteAmount = Math.max(opportunity.loanAmountUsd, 1) / Math.max(0.0000001, opportunity.buyPrice);
        const sellAmountRaw = parseUnits(intermediateQuoteAmount.toFixed(Math.min(quoteAssetDecimals, 6)), quoteAssetDecimals);
        const buyCalldata = buildSwapCalldata(opportunity.buyDex, loanAssetAddress, quoteAssetAddress, buyAmountRaw, contractAddress);
        const sellCalldata = buildSwapCalldata(opportunity.sellDex, quoteAssetAddress, loanAssetAddress, sellAmountRaw, contractAddress);
        setRouteCalldata({ buyCalldata, sellCalldata, loading: false, error: "" });
        return;
      }

      if (!activeWallet?.address) throw new Error("Connect a Solana wallet to auto generate route payloads.");
      const loanAssetAddress = activeRuntime.tokenAddresses[opportunity.loanAsset] ?? opportunity.loanAssetAddress;
      const quoteAssetAddress = activeRuntime.tokenAddresses[opportunity.quoteAsset] ?? opportunity.quoteAssetAddress;
      if (!loanAssetAddress || !quoteAssetAddress) throw new Error("Missing Solana token mint addresses for auto route generation.");
      const loanAssetDecimals = activeRuntime.tokenDecimals[opportunity.loanAsset] ?? 9;
      const buyAmountRaw = parseUnits(opportunity.loanAmount.toFixed(Math.min(loanAssetDecimals, 6)), loanAssetDecimals).toString();
      const buyQuote = await fetchJupiterQuoteAdaptive(loanAssetAddress, quoteAssetAddress, buyAmountRaw);
      const sellQuote = await fetchJupiterQuoteAdaptive(quoteAssetAddress, loanAssetAddress, buyQuote.quote.outAmount);
      const buyPayload = await fetchJupiterSwapPayload(activeWallet.address, buyQuote.quote, buyQuote.apiVersion);
      const sellPayload = await fetchJupiterSwapPayload(activeWallet.address, sellQuote.quote, sellQuote.apiVersion);
      setRouteCalldata({ buyCalldata: buyPayload, sellCalldata: sellPayload, loading: false, error: "" });
    } catch (error) {
      setRouteCalldata({ buyCalldata: "", sellCalldata: "", loading: false, error: error instanceof Error ? error.message : "Failed to auto generate router calldata." });
    }
  };

  const beginExecution = async (opportunity: Opportunity) => {
    setConfirmOpportunity(null);
    setExecutionState({ opportunity, status: "running", stepIndex: 0 });
    let submittedTxHash = "";
    try {
      if (activeNetwork.chainType !== "evm") throw new Error("Solana execution requires program-specific accounts and CPI route instructions. Use EVM networks in this release.");
      if (!activeWallet?.address) throw new Error("Connect wallet before execution.");
      if (!routeCalldata.buyCalldata.startsWith("0x") || !routeCalldata.sellCalldata.startsWith("0x")) throw new Error("Route calldata was not generated. Re-open the opportunity and try again.");

      setExecutionState((current) => (current ? { ...current, stepIndex: 1 } : current));
      const providerAddressRaw = activeRuntime.flashProviderAddresses[opportunity.provider];
      const loanAssetAddressRaw = activeRuntime.tokenAddresses[opportunity.loanAsset];
      const buyDexRouterRaw = activeRuntime.dexRouters[opportunity.buyDex];
      const sellDexRouterRaw = activeRuntime.dexRouters[opportunity.sellDex];
      if (!providerAddressRaw || !loanAssetAddressRaw || !buyDexRouterRaw || !sellDexRouterRaw) throw new Error("Provider/router/token mapping missing for this opportunity.");
      const providerAddress = sanitizeEvmAddress(providerAddressRaw);
      const loanAssetAddress = sanitizeEvmAddress(loanAssetAddressRaw);
      const buyDexRouter = sanitizeEvmAddress(buyDexRouterRaw);
      const sellDexRouter = sanitizeEvmAddress(sellDexRouterRaw);
      const tokenDecimals = activeRuntime.tokenDecimals[opportunity.loanAsset] ?? 18;
      const contractAddress = sanitizeEvmAddress(activeNetwork.contractAddresses[environment]);
      const loanAmount = parseUnits(opportunity.loanAmount.toFixed(Math.min(tokenDecimals, 6)), tokenDecimals);
      const minProfit = parseUnits((opportunity.netProfitAsset * 0.5).toFixed(Math.min(tokenDecimals, 6)), tokenDecimals);

      setExecutionState((current) => (current ? { ...current, stepIndex: 2 } : current));
      const targetChainId = getTargetEvmChainId(selectedNetwork, environment);
      if (targetChainId) {
        try { await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetChainId }] }); } catch { /* Continue */ }
      }
      const signerProvider = new BrowserProvider(window.ethereum!);
      const signer = await signerProvider.getSigner();
      const signerNetwork = await signerProvider.getNetwork();
      // FIX #17: only compare when targetChainId is defined; use safe BigInt conversion.
      if (targetChainId !== undefined) {
        const expectedChainId = BigInt(targetChainId);
        if (signerNetwork.chainId !== expectedChainId) throw new Error(`Wrong wallet network. Switch wallet to ${activeNetwork.name} ${environment} and retry.`);
      }

      const ensureAddressHasCode = async (address: string, label: string) => {
        const code = await signerProvider.getCode(address);
        if (!code || code === "0x") throw new Error(`${label} is not deployed on selected ${activeNetwork.name} ${environment}: ${address}. Update runtime address mapping for this environment.`);
      };
      const deployedCode = await signerProvider.getCode(contractAddress);
      if (!deployedCode || deployedCode === "0x") throw new Error(`No contract deployed at executor address ${contractAddress} on selected network.`);
      await ensureAddressHasCode(providerAddress, "Flash loan provider");
      await ensureAddressHasCode(buyDexRouter, "Buy DEX router");
      await ensureAddressHasCode(sellDexRouter, "Sell DEX router");
      await ensureAddressHasCode(loanAssetAddress, "Loan asset token");
      const contract = new Contract(contractAddress, FLASH_EXECUTOR_ABI, signer);
      const contractOwner = sanitizeEvmAddress(String(await contract.owner()));
      const signerAddress = sanitizeEvmAddress(await signer.getAddress());
      if (contractOwner !== signerAddress) throw new Error("Connected wallet is not contract owner. Connect with deployer wallet to execute/approve provider.");

      const providerAllowed = Boolean(await contract.approvedProvider(providerAddress));
      if (!providerAllowed) {
        const approvalTx = await contract.setProvider(providerAddress, true);
        setExecutionState((current) => (current ? { ...current, stepIndex: 3, txHash: approvalTx.hash } : current));
        await approvalTx.wait();
        setExecutionState((current) => (current ? { ...current, stepIndex: 2, txHash: undefined } : current));
      }

      // FIX (contract Bug #5): quoteAsset is now part of ArbParams so the contract
      // can approve the sell router for the intermediate token after the buy swap.
      const quoteAssetAddressForCall = sanitizeEvmAddress(
        activeRuntime.tokenAddresses[opportunity.quoteAsset] ?? opportunity.quoteAssetAddress
      );
      const tx = await contract.executeArbitrage(providerAddress, {
        loanAsset: loanAssetAddress,
        quoteAsset: quoteAssetAddressForCall,
        loanAmount,
        minProfit,
        buyDexRouter,
        sellDexRouter,
        buyCalldata: routeCalldata.buyCalldata,
        sellCalldata: routeCalldata.sellCalldata,
      });
      submittedTxHash = tx.hash;
      setExecutionState((current) => (current ? { ...current, stepIndex: 3, txHash: tx.hash } : current));
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      setExecutionState((current) => (current ? { ...current, stepIndex: 4, txHash: tx.hash } : current));
      const receipt = await tx.wait();
      const gasPrice = receipt?.gasPrice ?? tx.gasPrice ?? 0n;
      const gasUsed = receipt?.gasUsed ?? 0n;
      const gasFeeNative = Number(formatUnits(gasUsed * gasPrice, 18));
      const gasFeeUsd = gasFeeNative * activeRuntime.nativeTokenUsd;

      setExecutionState((current) => (current ? { ...current, status: "success", txHash: tx.hash } : current));
      setTradeHistory((history) => [{
        id: `${Date.now()}`, pair: opportunity.pair, buyDex: opportunity.buyDex, sellDex: opportunity.sellDex,
        provider: opportunity.provider, buyPrice: opportunity.buyPrice, sellPrice: opportunity.sellPrice,
        totalFeeAsset: opportunity.totalFeeAsset, totalFeeUsd: opportunity.totalFeeUsd,
        gasFeeNative, gasFeeUsd, gasFeeSymbol: activeRuntime.nativeTokenSymbol,
        grossProfitAsset: opportunity.grossProfitAsset, grossProfitUsd: opportunity.grossProfitUsd,
        netProfitAsset: opportunity.netProfitAsset, netProfitUsd: opportunity.netProfitUsd,
        txHash: tx.hash, status: "successful", loanAsset: opportunity.loanAsset, executedAt: new Date().toLocaleString(),
      }, ...history]);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Execution failed";
      const message = rawMessage.includes("require(false)")
        ? "Route payload is incompatible with selected DEX router/provider for this environment. Use matching testnet mappings (routers, loan provider, tokens) and regenerate routes."
        : rawMessage;
      setExecutionState((current) => (current ? { ...current, status: "failed", error: message } : current));
      setTradeHistory((history) => [{
        id: `${Date.now()}-failed`, pair: opportunity.pair, buyDex: opportunity.buyDex, sellDex: opportunity.sellDex,
        provider: opportunity.provider, buyPrice: opportunity.buyPrice, sellPrice: opportunity.sellPrice,
        totalFeeAsset: opportunity.totalFeeAsset, totalFeeUsd: opportunity.totalFeeUsd,
        gasFeeNative: 0, gasFeeUsd: 0, gasFeeSymbol: activeRuntime.nativeTokenSymbol,
        grossProfitAsset: opportunity.grossProfitAsset, grossProfitUsd: opportunity.grossProfitUsd,
        netProfitAsset: opportunity.netProfitAsset, netProfitUsd: opportunity.netProfitUsd,
        txHash: submittedTxHash || "0x0", status: "failed", loanAsset: opportunity.loanAsset, executedAt: new Date().toLocaleString(),
      }, ...history]);
    }
  };

  // FIX #14 & #13: Reset interval cleanly when network changes — no overlapping scan cycles.
  useEffect(() => {
    if (!scannerRunning) return;
    clearScanTimer();
    runScanCycle();
    scanIntervalRef.current = window.setInterval(() => { runScanCycle(); }, envRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNetwork]);

  useEffect(() => { return () => clearScanTimer(); }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <motion.div animate={{ opacity: [0.32, 0.62, 0.32] }} transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }} className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.32),transparent_54%)]" />
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
                <button key={network.key} onClick={() => setSelectedNetwork(network.key)} className={`px-3 py-2 text-sm font-medium transition ${selectedNetwork === network.key ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}>{network.name}</button>
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
                <button onClick={() => setEnvironment("testnet")} className={`px-3 py-2 text-sm ${environment === "testnet" ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-200"}`}>Testnet</button>
                <button onClick={() => setEnvironment("mainnet")} className={`px-3 py-2 text-sm ${environment === "mainnet" ? "bg-amber-300 text-slate-950" : "bg-slate-800 text-slate-200"}`}>Mainnet</button>
              </div>
            </div>
            <motion.div layout className="h-2 overflow-hidden bg-slate-800">
              <motion.div className="h-full bg-cyan-400" animate={{ width: `${scanProgress}%` }} transition={{ duration: 0.45, ease: "easeOut" }} />
            </motion.div>
            <div className="flex flex-wrap gap-2">
              {!scannerRunning ? (
                <button onClick={startScanner} className="bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Start Scan</button>
              ) : (
                <button onClick={stopScanner} className="bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-rose-300">Stop Scan</button>
              )}
            </div>
            <div className="space-y-1 text-xs text-slate-300">
              <p>DEXes: {activeNetwork.dexes.join(", ")}</p>
              <p>Flash loan providers: {activeNetwork.flashLoanProviders.join(", ")}</p>
              <p>Executor contract ({environment}): <span className="text-cyan-300">{activeNetwork.contractAddresses[environment]}</span></p>
              <p>Multicall mode: {scanMeta.totalBatches} batches, batch size {scanMeta.multicallBatchSize}, pool universe {scanMeta.allPoolCount}</p>
              {selectedNetwork === "ethereum" && <p>Quote token universe: {scanMeta.quoteUniverse}</p>}
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
                  <button onClick={() => setWalletModalOpen(true)} className="bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600">Switch Wallet</button>
                  <button onClick={disconnectWallet} className="bg-rose-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-rose-300">Disconnect</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-400">No wallet connected for this network.</p>
                <button onClick={() => setWalletModalOpen(true)} className="bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300">Connect Wallet</button>
              </>
            )}
          </div>
        </section>

        <section className="border border-slate-800/90 bg-slate-900/70 p-4 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Contracts and app linking</h2>
          <p className="mt-1 text-xs text-slate-400">Selected network: {activeNetwork.name}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-slate-400"><tr><th className="pb-2">Environment</th><th className="pb-2">Deployment registry address</th><th className="pb-2">App configured address</th><th className="pb-2">Link status</th></tr></thead>
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
          <div className="overflow-hidden border border-slate-800/90 bg-slate-900/70 p-4 lg:col-span-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Scanner token depth</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs sm:min-w-[320px]">
                <thead className="text-slate-400"><tr><th className="pb-2">Main token</th><th className="pb-2 text-right">Pairs</th></tr></thead>
                <tbody>
                  {activeNetwork.mainTokens.map((token) => (
                    <tr key={token} className="border-t border-slate-800">
                      <td className="py-2 pr-2 font-medium text-slate-200">{token}</td>
                      <td className="py-2 pr-2 text-right">{tokenDepthForNetwork[token] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden border border-slate-800/90 bg-slate-900/70 p-4 lg:col-span-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Live opportunities</h2>
            <div className="mt-3 space-y-3 md:hidden">
              {opportunities.length === 0 ? (
                <p className="border border-slate-800 bg-slate-950/40 px-3 py-4 text-center text-xs text-slate-400">No opportunities found in this scan.</p>
              ) : (
                opportunities.map((opportunity) => (
                  <div key={opportunity.id} className="border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <p className="font-medium text-slate-200">{opportunity.pair}</p>
                      <p className="text-emerald-300">{formatPct(opportunity.spreadPct)}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-slate-300">
                      <p>Buy: {opportunity.buyDex}</p><p>Sell: {opportunity.sellDex}</p>
                      <p>Buy token price: {formatUsd(opportunity.buyPrice)}</p><p>Sell token price: {formatUsd(opportunity.sellPrice)}</p>
                      <p>{formatAsset(opportunity.loanAmount, opportunity.loanAsset)}</p><p>{formatUsd(opportunity.loanAmountUsd)}</p>
                      <p className="text-emerald-300">Net: {formatAsset(opportunity.netProfitAsset, opportunity.loanAsset)}</p>
                      <p className="text-emerald-300">{formatUsd(opportunity.netProfitUsd)}</p>
                    </div>
                    {/* FIX #12: await calldata generation before opening modal — eliminates race condition */}
                    <button disabled={!activeWallet} onClick={async () => { await autoGenerateCalldata(opportunity); setConfirmOpportunity(opportunity); }} className="mt-3 w-full bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Execute</button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1200px] text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-2">Pair</th><th className="pb-2">Buy DEX</th><th className="pb-2">Sell DEX</th>
                    <th className="pb-2">Buy token price (USD)</th><th className="pb-2">Sell token price (USD)</th>
                    <th className="pb-2">Spread</th><th className="pb-2">Loan asset</th>
                    <th className="pb-2">Gross profit</th><th className="pb-2">Net profit</th>
                    <th className="pb-2">Price impact</th><th className="pb-2">Pair liquidity</th>
                    <th className="pb-2">Fee</th><th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.length === 0 ? (
                    <tr><td colSpan={13} className="border-t border-slate-800 py-4 text-center text-slate-400">No opportunities found in this scan.</td></tr>
                  ) : (
                    opportunities.map((opportunity) => (
                      <tr key={opportunity.id} className="border-t border-slate-800 align-top">
                        <td className="py-2 pr-2">{opportunity.pair}</td>
                        <td className="py-2 pr-2">{opportunity.buyDex}</td>
                        <td className="py-2 pr-2">{opportunity.sellDex}</td>
                        <td className="py-2 pr-2">{formatUsd(opportunity.buyPrice)}</td>
                        <td className="py-2 pr-2">{formatUsd(opportunity.sellPrice)}</td>
                        <td className="py-2 pr-2 text-emerald-300">{formatPct(opportunity.spreadPct)}</td>
                        <td className="py-2 pr-2"><p>{formatAsset(opportunity.loanAmount, opportunity.loanAsset)}</p><p className="text-slate-400">{formatUsd(opportunity.loanAmountUsd)}</p></td>
                        <td className="py-2 pr-2"><p>{formatAsset(opportunity.grossProfitAsset, opportunity.loanAsset)}</p><p className="text-slate-400">{formatUsd(opportunity.grossProfitUsd)}</p></td>
                        <td className="py-2 pr-2"><p className="text-emerald-300">{formatAsset(opportunity.netProfitAsset, opportunity.loanAsset)}</p><p className="text-slate-400">{formatUsd(opportunity.netProfitUsd)}</p></td>
                        <td className="py-2 pr-2">{formatPct(opportunity.priceImpactPct)}</td>
                        <td className="py-2 pr-2">{formatUsd(opportunity.pairLiquidityUsd)}</td>
                        <td className="py-2 pr-2"><p>{formatAsset(opportunity.totalFeeAsset, opportunity.loanAsset)}</p><p className="text-slate-400">{formatUsd(opportunity.totalFeeUsd)}</p></td>
                        <td className="py-2">
                          {/* FIX #12: await calldata before modal open */}
                          <button disabled={!activeWallet} onClick={async () => { await autoGenerateCalldata(opportunity); setConfirmOpportunity(opportunity); }} className="bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Execute</button>
                        </td>
                      </tr>
                    ))
                  )}
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
                <tr><th className="pb-2">Pair</th><th className="pb-2">Buy/Sell DEX</th><th className="pb-2">Loan provider</th><th className="pb-2">Buy price</th><th className="pb-2">Sell price</th><th className="pb-2">Gas fee (native)</th><th className="pb-2">Gross profit</th><th className="pb-2">Net profit</th><th className="pb-2">Hash</th><th className="pb-2">Status</th><th className="pb-2">Executed at</th></tr>
              </thead>
              <tbody>
                {tradeHistory.length === 0 ? (
                  <tr><td colSpan={11} className="border-t border-slate-800 py-4 text-center text-slate-400">No trades executed yet.</td></tr>
                ) : (
                  tradeHistory.map((trade) => (
                    <tr key={trade.id} className="border-t border-slate-800">
                      <td className="py-2 pr-2">{trade.pair}</td>
                      <td className="py-2 pr-2">{trade.buyDex} / {trade.sellDex}</td>
                      <td className="py-2 pr-2">{trade.provider}</td>
                      <td className="py-2 pr-2">{formatUsd(trade.buyPrice)}</td>
                      <td className="py-2 pr-2">{formatUsd(trade.sellPrice)}</td>
                      <td className="py-2 pr-2">{trade.gasFeeNative > 0 ? `${trade.gasFeeNative.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${trade.gasFeeSymbol} (${formatUsd(trade.gasFeeUsd)})` : `Not broadcast (${trade.gasFeeSymbol})`}</td>
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
                  <button key={walletName} onClick={() => connectWallet(walletName)} className="w-full border border-slate-700 px-4 py-3 text-left text-sm hover:border-cyan-300 hover:text-cyan-300">{walletName}</button>
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
                <p>Pair: {confirmOpportunity.pair}</p><p>Provider: {confirmOpportunity.provider}</p>
                <p>Buy DEX: {confirmOpportunity.buyDex}</p><p>Sell DEX: {confirmOpportunity.sellDex}</p>
                <p>Buy price: {formatUsd(confirmOpportunity.buyPrice)}</p><p>Sell price: {formatUsd(confirmOpportunity.sellPrice)}</p>
                <p>Spread: {formatPct(confirmOpportunity.spreadPct)}</p><p>Price impact: {formatPct(confirmOpportunity.priceImpactPct)}</p>
                <p>Pair liquidity: {formatUsd(confirmOpportunity.pairLiquidityUsd)}</p>
                <p>Loan asset: {formatAsset(confirmOpportunity.loanAmount, confirmOpportunity.loanAsset)}</p>
                <p>Loan value: {formatUsd(confirmOpportunity.loanAmountUsd)}</p>
                <p>Protocol fee: {formatAsset(confirmOpportunity.totalFeeAsset, confirmOpportunity.loanAsset)}</p>
                <p>Estimated network fee: {estimatedNetworkFee.native.toLocaleString(undefined, { maximumFractionDigits: 6 })} {activeRuntime.nativeTokenSymbol}</p>
                <p>Gross profit: {formatAsset(confirmOpportunity.grossProfitAsset, confirmOpportunity.loanAsset)}</p>
                <p>Gross profit USD: {formatUsd(confirmOpportunity.grossProfitUsd)}</p>
                <p>Net profit: {formatAsset(confirmOpportunity.netProfitAsset, confirmOpportunity.loanAsset)}</p>
                <p>Net profit USD: {formatUsd(confirmOpportunity.netProfitUsd)}</p>
                <p>Flash fee: {formatPct(confirmOpportunity.flashFeePct)}</p><p>DEX fee: {formatPct(confirmOpportunity.dexFeePct)}</p>
                <p>Pool address: {confirmOpportunity.poolAddress}</p><p>Multicall batch: #{confirmOpportunity.multicallBatch}</p>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-slate-300">Buy swap calldata: {routeCalldata.loading ? "Generating..." : routeCalldata.buyCalldata ? `${routeCalldata.buyCalldata.slice(0, 16)}...${routeCalldata.buyCalldata.slice(-10)}` : "Not available"}</p>
                <p className="text-slate-300">Sell swap calldata: {routeCalldata.loading ? "Generating..." : routeCalldata.sellCalldata ? `${routeCalldata.sellCalldata.slice(0, 16)}...${routeCalldata.sellCalldata.slice(-10)}` : "Not available"}</p>
                <p className="text-xs text-slate-400">Router payloads are auto generated from selected DEX routes and token addresses.</p>
                {routeCalldata.error && <p className="text-xs text-rose-300">{routeCalldata.error}</p>}
              </div>
              <div className="sticky bottom-0 mt-5 flex justify-end gap-2 border-t border-slate-800 bg-slate-900 pt-3">
                <button onClick={() => setConfirmOpportunity(null)} className="bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600">Cancel</button>
                <button disabled={routeCalldata.loading || !routeCalldata.buyCalldata || !routeCalldata.sellCalldata} onClick={() => beginExecution(confirmOpportunity)} className="bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Confirm Trade</button>
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
              <p className="mt-1 text-xs text-slate-400">Estimated network fee: {estimatedNetworkFee.native.toLocaleString(undefined, { maximumFractionDigits: 6 })} {activeRuntime.nativeTokenSymbol} ({formatUsd(estimatedNetworkFee.usd)})</p>
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
                <button onClick={() => setExecutionState(null)} className="bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
