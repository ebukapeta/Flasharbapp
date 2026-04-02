import { ChainId, CHAINS, DexConfig } from '../data/chains';
import { ArbitrageOpportunity, ScannerConfig } from '../types';
import { v4 as uuidv4 } from '../utils/uuid';

export interface TokenPrice {
  symbol: string;
  priceUSD: number;
  change24h: number;
  lastUpdated: number;
}

// ─────────────────────────────────────────────────────────
//  SIMULATED PRICE FEED ENGINE (multicall-aware simulation)
// ─────────────────────────────────────────────────────────

const BASE_PRICES: Record<string, number> = {
  WBNB: 620, BNB: 620,
  USDT: 1.0, USDC: 1.0, DAI: 1.0,
  BTCB: 97000, WBTC: 97000,
  WETH: 3500, ETH: 3500,
  WSOL: 185, SOL: 185,
  MSOL: 195,
  BONK: 0.000025,
  RAY: 2.8,
  ARB: 1.1,
  GMX: 28,
  cbETH: 3700,
};

export function getBasePrice(symbol: string): number {
  return BASE_PRICES[symbol] ?? 1.0;
}

// Simulate realistic pool price with noise per DEX
function simulatePoolPrice(
  basePrice: number,
  dexId: string,
  pairKey: string,
  timestamp: number
): number {
  // Deterministic-ish noise based on pair + dex
  const hash = simpleHash(`${dexId}${pairKey}${Math.floor(timestamp / 4000)}`);
  const noise = (hash % 1000) / 1000; // 0-1
  const spread = (noise - 0.5) * 0.012; // ±0.6% variation
  return basePrice * (1 + spread);
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Simulate liquidity based on pair and dex
function simulateLiquidity(token0: string, token1: string, dexId: string): number {
  const hash = simpleHash(`liq${dexId}${token0}${token1}`);
  const base = getPairBaseLiquidity(token0, token1);
  const multiplier = 0.5 + (hash % 100) / 100; // 0.5-1.5x
  return base * multiplier;
}

function getPairBaseLiquidity(t0: string, t1: string): number {
  const stable = ['USDT', 'USDC', 'DAI', 'BUSD'];
  const major = ['WETH', 'WBNB', 'WSOL', 'WBTC', 'BTCB'];

  if (stable.includes(t0) && stable.includes(t1)) return 8000000;
  if (major.includes(t0) && stable.includes(t1)) return 4000000;
  if (major.includes(t1) && stable.includes(t0)) return 4000000;
  if (major.includes(t0) && major.includes(t1)) return 2000000;
  return 500000;
}

// Calculate price impact using constant product AMM formula
function calcPriceImpact(tradeAmountUSD: number, liquidityUSD: number): number {
  if (liquidityUSD <= 0) return 100;
  // AMM impact approximation: deltaP/P ≈ tradeAmount / (2 * liquidity)
  const impact = (tradeAmountUSD / (2 * liquidityUSD)) * 100;
  return Math.min(impact, 99);
}

// Calculate optimal trade size given liquidity and max price impact
function calcOptimalTradeSize(
  liqBuy: number,
  liqSell: number,
  maxImpactPct: number,
  basePrice: number
): number {
  const maxImpact = maxImpactPct / 100;
  // Max trade before hitting impact limit on the thinner side
  const minLiq = Math.min(liqBuy, liqSell);
  const maxTradeUSD = minLiq * maxImpact * 2 * 0.7; // 70% of max to be conservative
  return maxTradeUSD / basePrice;
}

interface PairQuote {
  dexId: string;
  price: number;
  liquidityUSD: number;
}

function generatePairQuotes(
  token0: string,
  token1: string,
  chainId: ChainId,
  timestamp: number
): PairQuote[] {
  const chain = CHAINS[chainId];
  const quotes: PairQuote[] = [];

  const price0 = getBasePrice(token0);
  const price1 = getBasePrice(token1);
  const pairPrice = price0 / price1;
  const pairKey = `${token0}${token1}`;

  for (const dex of chain.dexes) {
    const dexPrice = simulatePoolPrice(pairPrice, dex.id, pairKey, timestamp);
    const liq = simulateLiquidity(token0, token1, dex.id);
    quotes.push({ dexId: dex.id, price: dexPrice, liquidityUSD: liq });
  }
  return quotes;
}

function getDexById(chainId: ChainId, dexId: string): DexConfig | undefined {
  return CHAINS[chainId].dexes.find((d) => d.id === dexId);
}

function getConfidence(spread: number, liqBuy: number, liqSell: number): 'high' | 'medium' | 'low' {
  const minLiq = Math.min(liqBuy, liqSell);
  if (spread >= 1.5 && minLiq >= 1000000) return 'high';
  if (spread >= 0.8 && minLiq >= 300000) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────
//  MAIN SCAN FUNCTION
// ─────────────────────────────────────────────────────────
export function scanForOpportunities(
  chainId: ChainId,
  config: ScannerConfig,
  _tokenPrices: Record<string, { priceUSD: number }>,
  onOpportunity: (opp: ArbitrageOpportunity) => void
): void {
  const chain = CHAINS[chainId];
  const timestamp = Date.now();

  // Get active tokens
  const activeTokens = config.selectedTokens.length > 0
    ? chain.tokens.filter((t) => config.selectedTokens.includes(t.symbol))
    : chain.tokens;

  // Generate all unique pairs from active tokens
  const pairs: [string, string][] = [];
  for (let i = 0; i < activeTokens.length; i++) {
    for (let j = i + 1; j < activeTokens.length; j++) {
      pairs.push([activeTokens[i].symbol, activeTokens[j].symbol]);
    }
  }

  // Get active DEXes
  const activeDexIds = config.selectedDexes.length > 0
    ? config.selectedDexes
    : chain.dexes.map((d) => d.id);

  // Get flash loan provider
  const provider = config.selectedFlashProvider
    ? chain.flashLoanProviders.find((p) => p.id === config.selectedFlashProvider)
    : chain.flashLoanProviders[0];

  if (!provider) return;

  // Scan each pair across DEXes (multicall simulation)
  for (const [t0, t1] of pairs) {
    const allQuotes = generatePairQuotes(t0, t1, chainId, timestamp)
      .filter((q) => activeDexIds.includes(q.dexId))
      .filter((q) => q.liquidityUSD >= config.minLiquidityUSD);

    if (allQuotes.length < 2) continue;

    // Find best buy (lowest price) and best sell (highest price)
    const sorted = [...allQuotes].sort((a, b) => a.price - b.price);
    const buyQuote = sorted[0];
    const sellQuote = sorted[sorted.length - 1];

    const rawSpread = ((sellQuote.price - buyQuote.price) / buyQuote.price) * 100;
    if (rawSpread < config.minSpreadPercent) continue;

    const buyDex = getDexById(chainId, buyQuote.dexId)!;
    const sellDex = getDexById(chainId, sellQuote.dexId)!;

    // Determine loan asset (token0, which we borrow to buy token1)
    // The flash loan borrows the quote token (stablecoin or native) to buy the base token
    const loanToken = isStable(t1) ? t1 : isStable(t0) ? t0 : t0;
    const loanTokenPrice = getBasePrice(loanToken);

    // Calculate optimal trade size
    const optimalTokens = calcOptimalTradeSize(
      buyQuote.liquidityUSD,
      sellQuote.liquidityUSD,
      config.maxPriceImpact,
      loanTokenPrice
    );
    const tradeSizeUSD = optimalTokens * loanTokenPrice;

    // Price impact
    const piB = calcPriceImpact(tradeSizeUSD, buyQuote.liquidityUSD);
    const piS = calcPriceImpact(tradeSizeUSD, sellQuote.liquidityUSD);
    const totalImpact = piB + piS;
    if (totalImpact > config.maxPriceImpact * 2) continue;

    // Effective spread after price impact
    const effectiveSpread = rawSpread - totalImpact;
    if (effectiveSpread < 0.1) continue;

    // Fee calculations
    const flashLoanFeeUSD = tradeSizeUSD * (provider.fee / 10000);
    const buyFeeUSD = tradeSizeUSD * (buyDex.fee / 10000);
    const sellFeeUSD = tradeSizeUSD * (sellDex.fee / 10000);

    // Gas cost
    const gasPrice = chain.gasPrice;
    const nativePrice = chainId === 'bsc' ? getBasePrice('WBNB') :
                        chainId === 'solana' ? getBasePrice('WSOL') :
                        getBasePrice('WETH');
    const gasUnits = chainId === 'solana' ? 0.001 : 300000;
    const gasFeeUSD = chainId === 'solana'
      ? gasPrice * gasUnits * nativePrice
      : (gasPrice / 1e9) * gasUnits * nativePrice;

    const totalFeeUSD = flashLoanFeeUSD + buyFeeUSD + sellFeeUSD + gasFeeUSD;

    // Gross profit
    const grossProfitUSD = tradeSizeUSD * (effectiveSpread / 100);
    const grossProfitToken = grossProfitUSD / loanTokenPrice;

    // Net profit
    const netProfitUSD = grossProfitUSD - totalFeeUSD;
    const netProfitToken = netProfitUSD / loanTokenPrice;

    if (netProfitUSD < config.minProfitUSD) continue;

    const opp: ArbitrageOpportunity = {
      id: uuidv4(),
      timestamp,
      chain: chainId,
      pair: `${t0}/${t1}`,
      token0: t0,
      token1: t1,
      buyDex: buyDex.name,
      sellDex: sellDex.name,
      buyPrice: buyQuote.price,
      sellPrice: sellQuote.price,
      spread: rawSpread,
      spreadBps: rawSpread * 100,
      liquidityBuy: buyQuote.liquidityUSD,
      liquiditySell: sellQuote.liquidityUSD,
      priceImpactBuy: piB,
      priceImpactSell: piS,
      loanAsset: loanToken,
      loanAmount: optimalTokens,
      loanAmountUSD: tradeSizeUSD,
      flashLoanProvider: provider.name,
      flashLoanFee: flashLoanFeeUSD,
      flashLoanFeePercent: provider.fee / 100,
      gasFeeUSD,
      grossProfitToken,
      grossProfitUSD,
      netProfitToken,
      netProfitUSD,
      totalFeeUSD,
      isProfitable: netProfitUSD > 0,
      confidence: getConfidence(rawSpread, buyQuote.liquidityUSD, sellQuote.liquidityUSD),
      route: [loanToken, t0 === loanToken ? t1 : t0, loanToken],
    };

    onOpportunity(opp);
  }
}

function isStable(symbol: string): boolean {
  return ['USDT', 'USDC', 'DAI', 'BUSD'].includes(symbol);
}

// Fetch live prices from CoinGecko (public API, no key needed)
export async function fetchTokenPrices(chainId: ChainId): Promise<Record<string, TokenPrice>> {
  const chain = CHAINS[chainId];
  const ids = chain.tokens.map((t) => t.coingeckoId).join(',');
  
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error('price fetch failed');
    const data = await res.json();
    const out: Record<string, TokenPrice> = {};
    for (const token of chain.tokens) {
      const d = data[token.coingeckoId];
      if (d) {
        out[token.symbol] = {
          symbol: token.symbol,
          priceUSD: d.usd ?? getBasePrice(token.symbol),
          change24h: d.usd_24h_change ?? 0,
          lastUpdated: Date.now(),
        };
      } else {
        out[token.symbol] = {
          symbol: token.symbol,
          priceUSD: getBasePrice(token.symbol),
          change24h: 0,
          lastUpdated: Date.now(),
        };
      }
    }
    return out;
  } catch {
    // Fallback to base prices
    const out: Record<string, TokenPrice> = {};
    for (const token of chain.tokens) {
      out[token.symbol] = {
        symbol: token.symbol,
        priceUSD: getBasePrice(token.symbol),
        change24h: 0,
        lastUpdated: Date.now(),
      };
    }
    return out;
  }
}

export interface TokenPrice {
  symbol: string;
  priceUSD: number;
  change24h: number;
  lastUpdated: number;
}
