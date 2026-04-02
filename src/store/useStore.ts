import { create } from 'zustand';
import { ChainId, NetworkMode } from '../data/chains';
import { ArbitrageOpportunity, TradeHistory, ScannerConfig, WalletState, TokenPrice } from '../types';

interface AppState {
  // Chain & Network
  selectedChain: ChainId;
  networkMode: NetworkMode;
  setSelectedChain: (chain: ChainId) => void;
  setNetworkMode: (mode: NetworkMode) => void;

  // Wallet
  wallet: WalletState;
  setWallet: (w: Partial<WalletState>) => void;
  disconnectWallet: () => void;

  // Scanner
  isScanning: boolean;
  scannerConfig: ScannerConfig;
  opportunities: ArbitrageOpportunity[];
  setIsScanning: (v: boolean) => void;
  setScannerConfig: (cfg: Partial<ScannerConfig>) => void;
  addOpportunity: (opp: ArbitrageOpportunity) => void;
  setOpportunities: (opps: ArbitrageOpportunity[]) => void;
  clearOpportunities: () => void;

  // Trade History
  tradeHistory: TradeHistory[];
  addTradeHistory: (t: TradeHistory) => void;
  clearTradeHistory: () => void;

  // Token Prices
  tokenPrices: Record<string, TokenPrice>;
  setTokenPrice: (symbol: string, price: TokenPrice) => void;
  setTokenPrices: (prices: Record<string, TokenPrice>) => void;

  // UI State
  activeTab: 'scanner' | 'history' | 'guide';
  setActiveTab: (tab: 'scanner' | 'history' | 'guide') => void;
  showWalletModal: boolean;
  setShowWalletModal: (v: boolean) => void;
  selectedOpportunity: ArbitrageOpportunity | null;
  setSelectedOpportunity: (opp: ArbitrageOpportunity | null) => void;
  showExecutionModal: boolean;
  setShowExecutionModal: (v: boolean) => void;

  // Stats
  totalScanned: number;
  totalOpportunities: number;
  incrementScanned: () => void;
}

export const useStore = create<AppState>((set) => ({
  selectedChain: 'bsc',
  networkMode: 'testnet',
  setSelectedChain: (chain) => set({ selectedChain: chain, opportunities: [] }),
  setNetworkMode: (mode) => set({ networkMode: mode }),

  wallet: {
    connected: false,
    address: null,
    chainId: null,
    walletType: null,
    balance: null,
  },
  setWallet: (w) => set((s) => ({ wallet: { ...s.wallet, ...w } })),
  disconnectWallet: () =>
    set({
      wallet: {
        connected: false,
        address: null,
        chainId: null,
        walletType: null,
        balance: null,
      },
    }),

  isScanning: false,
  scannerConfig: {
    minSpreadPercent: 0.5,
    minProfitUSD: 10,
    maxPriceImpact: 3.0,
    minLiquidityUSD: 50000,
    selectedDexes: [],
    selectedTokens: [],
    selectedFlashProvider: '',
    scanIntervalMs: 3000,
    networkMode: 'testnet',
  },
  opportunities: [],
  setIsScanning: (v) => set({ isScanning: v }),
  setScannerConfig: (cfg) =>
    set((s) => ({ scannerConfig: { ...s.scannerConfig, ...cfg } })),
  addOpportunity: (opp) =>
    set((s) => ({
      opportunities: [opp, ...s.opportunities].slice(0, 50),
      totalOpportunities: s.totalOpportunities + 1,
    })),
  setOpportunities: (opps) => set({ opportunities: opps }),
  clearOpportunities: () => set({ opportunities: [] }),

  tradeHistory: [],
  addTradeHistory: (t) =>
    set((s) => ({ tradeHistory: [t, ...s.tradeHistory].slice(0, 200) })),
  clearTradeHistory: () => set({ tradeHistory: [] }),

  tokenPrices: {},
  setTokenPrice: (symbol, price) =>
    set((s) => ({ tokenPrices: { ...s.tokenPrices, [symbol]: price } })),
  setTokenPrices: (prices) => set({ tokenPrices: prices }),

  activeTab: 'scanner',
  setActiveTab: (tab) => set({ activeTab: tab }),
  showWalletModal: false,
  setShowWalletModal: (v) => set({ showWalletModal: v }),
  selectedOpportunity: null,
  setSelectedOpportunity: (opp) => set({ selectedOpportunity: opp }),
  showExecutionModal: false,
  setShowExecutionModal: (v) => set({ showExecutionModal: v }),

  totalScanned: 0,
  totalOpportunities: 0,
  incrementScanned: () => set((s) => ({ totalScanned: s.totalScanned + 1 })),
}));
