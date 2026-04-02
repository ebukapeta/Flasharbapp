import { motion } from 'framer-motion';
import { Settings, Filter, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { CHAINS } from '../data/chains';

export default function ScannerConfigPanel() {
  const { selectedChain, scannerConfig, setScannerConfig } = useStore();
  const chain = CHAINS[selectedChain];

  const allTokens = chain.tokens;
  const allDexes = chain.dexes;
  const allProviders = chain.flashLoanProviders;

  const toggleToken = (symbol: string) => {
    const current = scannerConfig.selectedTokens;
    setScannerConfig({
      selectedTokens: current.includes(symbol)
        ? current.filter((t) => t !== symbol)
        : [...current, symbol],
    });
  };

  const toggleDex = (id: string) => {
    const current = scannerConfig.selectedDexes;
    setScannerConfig({
      selectedDexes: current.includes(id)
        ? current.filter((d) => d !== id)
        : [...current, id],
    });
  };

  return (
    <div className="space-y-4">
      {/* Thresholds */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-400 font-medium flex items-center gap-1">
            <Filter size={10} /> Min Spread %
          </label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            value={scannerConfig.minSpreadPercent}
            onChange={(e) => setScannerConfig({ minSpreadPercent: parseFloat(e.target.value) || 0.5 })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400 font-medium">Min Profit ($)</label>
          <input
            type="number"
            step="1"
            min="1"
            value={scannerConfig.minProfitUSD}
            onChange={(e) => setScannerConfig({ minProfitUSD: parseFloat(e.target.value) || 10 })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400 font-medium">Max Price Impact %</label>
          <input
            type="number"
            step="0.5"
            min="0.1"
            max="10"
            value={scannerConfig.maxPriceImpact}
            onChange={(e) => setScannerConfig({ maxPriceImpact: parseFloat(e.target.value) || 3 })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400 font-medium">Min Liquidity ($)</label>
          <input
            type="number"
            step="10000"
            min="1000"
            value={scannerConfig.minLiquidityUSD}
            onChange={(e) => setScannerConfig({ minLiquidityUSD: parseFloat(e.target.value) || 50000 })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Flash Loan Provider */}
      <div>
        <label className="text-xs text-gray-400 font-medium flex items-center gap-1 mb-2">
          <Zap size={10} /> Flash Loan Provider
        </label>
        <div className="flex flex-wrap gap-2">
          {allProviders.map((p) => {
            const active = scannerConfig.selectedFlashProvider === p.id ||
              (!scannerConfig.selectedFlashProvider && allProviders[0].id === p.id);
            return (
              <button
                key={p.id}
                onClick={() => setScannerConfig({ selectedFlashProvider: p.id })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  active
                    ? 'text-white border-transparent'
                    : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'
                }`}
                style={active ? {
                  background: `${p.color}25`,
                  borderColor: `${p.color}60`,
                  color: p.color,
                } : {}}
              >
                {p.name}
                <span className="ml-1.5 opacity-60">
                  {p.fee === 0 ? '0% fee' : `${(p.fee / 100).toFixed(2)}%`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Token Selection */}
      <div>
        <label className="text-xs text-gray-400 font-medium mb-2 flex items-center gap-1">
          <Settings size={10} /> Base Tokens (all = scan all)
        </label>
        <div className="flex flex-wrap gap-2">
          {allTokens.map((token) => {
            const active = scannerConfig.selectedTokens.length === 0 ||
              scannerConfig.selectedTokens.includes(token.symbol);
            return (
              <motion.button
                key={token.symbol}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleToken(token.symbol)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                  active
                    ? 'text-white'
                    : 'bg-gray-900 text-gray-500 border-gray-800'
                }`}
                style={active ? {
                  background: `${token.logoColor}20`,
                  borderColor: `${token.logoColor}50`,
                  color: token.logoColor,
                } : {}}
              >
                {token.symbol}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* DEX Selection */}
      <div>
        <label className="text-xs text-gray-400 font-medium mb-2 block">DEX Selection (all = scan all)</label>
        <div className="flex flex-wrap gap-2">
          {allDexes.map((dex) => {
            const active = scannerConfig.selectedDexes.length === 0 ||
              scannerConfig.selectedDexes.includes(dex.id);
            return (
              <button
                key={dex.id}
                onClick={() => toggleDex(dex.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  active
                    ? 'text-white'
                    : 'bg-gray-900 text-gray-500 border-gray-800'
                }`}
                style={active ? {
                  background: `${dex.color}18`,
                  borderColor: `${dex.color}50`,
                  color: dex.color,
                } : {}}
              >
                <span>{dex.logo}</span>
                {dex.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scan Interval */}
      <div>
        <label className="text-xs text-gray-400 font-medium mb-2 block">
          Scan Interval: {(scannerConfig.scanIntervalMs / 1000).toFixed(1)}s
        </label>
        <input
          type="range"
          min="1000"
          max="10000"
          step="500"
          value={scannerConfig.scanIntervalMs}
          onChange={(e) => setScannerConfig({ scanIntervalMs: parseInt(e.target.value) })}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>1s (Fast)</span>
          <span>10s (Slow)</span>
        </div>
      </div>
    </div>
  );
}
