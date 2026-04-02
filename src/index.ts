export interface ArbitrageOpportunity {
  id: string;
  timestamp: number;
  chain: string;
  pair: string;
  token0: string;
  token1: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  spread: number; // percentage
  spreadBps: number; // basis points
  liquidityBuy: number; // USD
  liquiditySell: number; // USD
  priceImpactBuy: number; // %
  priceImpactSell: number; // %
  loanAsset: string;
  loanAmount: number; // in token units
  loanAmountUSD: number;
  flashLoanProvider: string;
  flashLoanFee: number; // USD
  flashLoanFeePercent: number;
  gasFeeUSD: number;
  grossProfitToken: number;
  grossProfitUSD: number;
  netProfitToken: number;
  netProfitUSD: number;
  totalFeeUSD: number;
  isProfitable: boolean;
  confidence: 'high' | 'medium' | 'low';
  route: string[];
}

export interface TradeHistory {
  id: string;
  timestamp: number;
  chain: string;
  pair: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  loanAsset: string;
  loanAmount: number;
  loanAmountUSD: number;
  fee: number;
  feeUSD: number;
  grossProfitToken: number;
  grossProfitUSD: number;
  netProfitToken: number;
  netProfitUSD: number;
  txHash: string;
  status: 'success' | 'failed' | 'pending';
  blockNumber?: number;
  gasUsed?: number;
  executionTimeMs?: number;
  errorMessage?: string;
}

export interface ScannerConfig {
  minSpreadPercent: number;
  minProfitUSD: number;
  maxPriceImpact: number;
  minLiquidityUSD: number;
  selectedDexes: string[];
  selectedTokens: string[];
  selectedFlashProvider: string;
  scanIntervalMs: number;
  networkMode: 'mainnet' | 'testnet';
}

export interface ExecutionStep {
  step: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  txHash?: string;
  timestamp?: number;
  detail?: string;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: string | null;
  walletType: string | null;
  balance: string | null;
}

export interface TokenPrice {
  symbol: string;
  priceUSD: number;
  change24h: number;
  lastUpdated: number;
}
