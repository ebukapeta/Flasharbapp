import { motion } from 'framer-motion';
import { TrendingUp, Zap, AlertTriangle, CheckCircle, ArrowRight, Droplets } from 'lucide-react';
import { ArbitrageOpportunity } from '../types';
import { useStore } from '../store/useStore';
import { CHAINS } from '../data/chains';

interface Props {
  opp: ArbitrageOpportunity;
  index: number;
}

function fmtUSD(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number, dec = 4): string {
  if (Math.abs(n) < 0.001) return n.toExponential(3);
  return n.toFixed(dec);
}

function confidenceStyle(c: string) {
  if (c === 'high') return { bg: 'bg-green-500/15', border: 'border-green-500/40', text: 'text-green-400', dot: 'bg-green-400' };
  if (c === 'medium') return { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400', dot: 'bg-amber-400' };
  return { bg: 'bg-gray-500/15', border: 'border-gray-500/40', text: 'text-gray-400', dot: 'bg-gray-400' };
}

export default function OpportunityCard({ opp, index }: Props) {
  const { setSelectedOpportunity, setShowExecutionModal, selectedChain } = useStore();
  const chain = CHAINS[selectedChain];
  const conf = confidenceStyle(opp.confidence);
  const buyDex = chain.dexes.find((d) => d.name === opp.buyDex);
  const sellDex = chain.dexes.find((d) => d.name === opp.sellDex);

  const handleExecute = () => {
    setSelectedOpportunity(opp);
    setShowExecutionModal(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ delay: index * 0.03 }}
      className={`relative rounded-2xl border ${conf.border} ${conf.bg} overflow-hidden backdrop-blur-sm`}
    >
      {/* Glow accent */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${opp.confidence === 'high' ? '#22c55e' : opp.confidence === 'medium' ? '#f59e0b' : '#6b7280'}40, transparent)` }} />

      <div className="p-4 space-y-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`w-2 h-2 rounded-full ${conf.dot} shrink-0 animate-pulse`} />
            <span className="font-bold text-white text-base truncate">{opp.pair}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${conf.bg} ${conf.text} border ${conf.border} shrink-0`}>
              {opp.confidence.toUpperCase()}
            </span>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-green-400">+{opp.spread.toFixed(2)}%</div>
            <div className="text-xs text-gray-500">{opp.spreadBps.toFixed(0)} bps</div>
          </div>
        </div>

        {/* DEX Route */}
        <div className="flex items-center gap-2 bg-gray-900/60 rounded-xl p-2.5">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 mb-0.5">BUY on</div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{buyDex?.logo || '🔄'}</span>
              <span className="text-sm font-semibold truncate" style={{ color: buyDex?.color || '#fff' }}>
                {opp.buyDex}
              </span>
            </div>
            <div className="font-mono text-xs text-gray-300 mt-0.5">${fmtNum(opp.buyPrice, opp.buyPrice < 1 ? 6 : 4)}</div>
          </div>
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <ArrowRight size={14} className="text-gray-600" />
            <span className="text-xs text-green-500 font-bold">
              +{opp.spread.toFixed(2)}%
            </span>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className="text-xs text-gray-500 mb-0.5">SELL on</div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-sm font-semibold truncate" style={{ color: sellDex?.color || '#fff' }}>
                {opp.sellDex}
              </span>
              <span className="text-sm">{sellDex?.logo || '🔄'}</span>
            </div>
            <div className="font-mono text-xs text-gray-300 mt-0.5">${fmtNum(opp.sellPrice, opp.sellPrice < 1 ? 6 : 4)}</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Loan Asset */}
          <div className="bg-gray-900/50 rounded-xl p-2.5 border border-gray-800">
            <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
              <Zap size={9} /> Loan Asset
            </div>
            <div className="text-sm font-bold text-blue-400">{fmtNum(opp.loanAmount, 2)} {opp.loanAsset}</div>
            <div className="text-xs text-gray-400">{fmtUSD(opp.loanAmountUSD)}</div>
          </div>

          {/* Price Impact */}
          <div className="bg-gray-900/50 rounded-xl p-2.5 border border-gray-800">
            <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
              <AlertTriangle size={9} /> Price Impact
            </div>
            <div className={`text-sm font-bold ${(opp.priceImpactBuy + opp.priceImpactSell) > 2 ? 'text-amber-400' : 'text-gray-200'}`}>
              {(opp.priceImpactBuy + opp.priceImpactSell).toFixed(2)}%
            </div>
            <div className="text-xs text-gray-500">
              B:{opp.priceImpactBuy.toFixed(2)}% S:{opp.priceImpactSell.toFixed(2)}%
            </div>
          </div>

          {/* Liquidity */}
          <div className="bg-gray-900/50 rounded-xl p-2.5 border border-gray-800">
            <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
              <Droplets size={9} /> Liquidity
            </div>
            <div className="text-xs space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Buy</span>
                <span className="text-gray-200 font-medium">{fmtUSD(opp.liquidityBuy)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sell</span>
                <span className="text-gray-200 font-medium">{fmtUSD(opp.liquiditySell)}</span>
              </div>
            </div>
          </div>

          {/* Fee */}
          <div className="bg-gray-900/50 rounded-xl p-2.5 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Total Fees</div>
            <div className="text-sm font-bold text-red-400">{fmtUSD(opp.totalFeeUSD)}</div>
            <div className="text-xs text-gray-500">
              Gas: {fmtUSD(opp.gasFeeUSD)}
            </div>
          </div>
        </div>

        {/* Profit Row */}
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 rounded-xl p-3 border border-green-500/20">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Gross Profit</div>
              <div className="text-sm font-bold text-gray-200">
                {fmtNum(opp.grossProfitToken, 4)} {opp.loanAsset}
              </div>
              <div className="text-xs text-gray-400">{fmtUSD(opp.grossProfitUSD)}</div>
            </div>
            <ArrowRight size={14} className="text-gray-600" />
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-0.5">Net Profit</div>
              <div className="text-base font-extrabold text-green-400">
                {fmtNum(opp.netProfitToken, 4)} {opp.loanAsset}
              </div>
              <div className="text-sm font-bold text-green-500">{fmtUSD(opp.netProfitUSD)}</div>
            </div>
          </div>
        </div>

        {/* Execute Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExecute}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            boxShadow: '0 4px 20px rgba(34,197,94,0.3)',
          }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }} />
          <CheckCircle size={16} className="relative z-10" />
          <span className="relative z-10 text-white">Execute Flash Loan</span>
          <TrendingUp size={14} className="relative z-10 text-green-200" />
        </motion.button>
      </div>
    </motion.div>
  );
}
