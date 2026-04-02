import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, TrendingUp, AlertTriangle, Shield, ChevronRight, Droplets } from 'lucide-react';
import { useStore } from '../store/useStore';
import { CHAINS } from '../data/chains';
import ExecutionModal from './ExecutionModal';

function fmtUSD(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(3)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(2)}K`;
  return `$${n.toFixed(4)}`;
}
function fmtToken(n: number, sym: string): string {
  if (Math.abs(n) < 0.0001) return `${n.toExponential(4)} ${sym}`;
  return `${n.toFixed(6)} ${sym}`;
}

export default function ConfirmExecutionModal() {
  const { showExecutionModal, setShowExecutionModal, selectedOpportunity, selectedChain, wallet } = useStore();
  const [showLive, setShowLive] = useState(false);
  const opp = selectedOpportunity;
  const chain = CHAINS[selectedChain];

  if (!opp) return null;

  const buyDex = chain.dexes.find((d) => d.name === opp.buyDex);
  const sellDex = chain.dexes.find((d) => d.name === opp.sellDex);
  const provider = chain.flashLoanProviders.find((p) => p.name === opp.flashLoanProvider) || chain.flashLoanProviders[0];

  const handleConfirm = () => {
    if (!wallet.connected) {
      alert('Please connect your wallet first!');
      return;
    }
    setShowLive(true);
  };

  return (
    <>
      <AnimatePresence>
        {showExecutionModal && !showLive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }}
            onClick={(e) => e.target === e.currentTarget && setShowExecutionModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl custom-scrollbar"
            >
              {/* Header */}
              <div className="sticky top-0 bg-gray-950 z-10 flex items-center justify-between p-5 border-b border-gray-800"
                style={{ background: 'linear-gradient(135deg, #22c55e10, rgba(15,15,20,0.98))' }}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-green-500/15 border border-green-500/30">
                    <Zap size={18} className="text-green-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-lg">Confirm Flash Loan</h2>
                    <p className="text-xs text-gray-400">{opp.pair} • {chain.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowExecutionModal(false)}
                  className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Profitability Banner */}
                <div className="rounded-xl p-4 border border-green-500/30 bg-green-500/8">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Gross Profit</div>
                      <div className="font-bold text-gray-100">{fmtToken(opp.grossProfitToken, opp.loanAsset)}</div>
                      <div className="text-xs text-green-400">{fmtUSD(opp.grossProfitUSD)}</div>
                    </div>
                    <div className="border-x border-gray-700">
                      <div className="text-xs text-gray-400 mb-1">Total Fees</div>
                      <div className="font-bold text-red-400">{fmtUSD(opp.totalFeeUSD)}</div>
                      <div className="text-xs text-gray-500">incl. gas</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Net Profit</div>
                      <div className="font-bold text-green-400 text-lg">{fmtToken(opp.netProfitToken, opp.loanAsset)}</div>
                      <div className="text-sm font-bold text-green-500">{fmtUSD(opp.netProfitUSD)}</div>
                    </div>
                  </div>
                </div>

                {/* Trade Route */}
                <Section title="Trade Route" icon={<TrendingUp size={14} />}>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex-1 bg-gray-900 rounded-xl p-3 border border-gray-800">
                      <div className="text-xs text-gray-500 mb-1">Step 1 – BUY</div>
                      <div className="flex items-center gap-2">
                        <span>{buyDex?.logo}</span>
                        <div>
                          <div className="font-semibold text-white">{opp.buyDex}</div>
                          <div className="text-xs text-gray-400">Price: <span className="font-mono text-green-400">${opp.buyPrice.toFixed(6)}</span></div>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-600 shrink-0" />
                    <div className="flex-1 bg-gray-900 rounded-xl p-3 border border-gray-800">
                      <div className="text-xs text-gray-500 mb-1">Step 2 – SELL</div>
                      <div className="flex items-center gap-2">
                        <span>{sellDex?.logo}</span>
                        <div>
                          <div className="font-semibold text-white">{opp.sellDex}</div>
                          <div className="text-xs text-gray-400">Price: <span className="font-mono text-blue-400">${opp.sellPrice.toFixed(6)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-500">
                    <span>{opp.route[0]}</span>
                    <ChevronRight size={10} />
                    <span>{opp.route[1]}</span>
                    <ChevronRight size={10} />
                    <span>{opp.route[2]}</span>
                  </div>
                </Section>

                {/* Flash Loan Details */}
                <Section title="Flash Loan" icon={<Zap size={14} />}>
                  <DetailRow label="Provider" value={opp.flashLoanProvider} valueColor={provider?.color} />
                  <DetailRow label="Loan Asset" value={opp.loanAsset} />
                  <DetailRow label="Borrow Amount" value={fmtToken(opp.loanAmount, opp.loanAsset)} />
                  <DetailRow label="Borrow Amount (USD)" value={fmtUSD(opp.loanAmountUSD)} />
                  <DetailRow label="Flash Loan Fee" value={`${opp.flashLoanFeePercent.toFixed(3)}% = ${fmtUSD(opp.flashLoanFee)}`} valueColor="#f87171" />
                  <DetailRow label="Repay Amount" value={fmtToken(opp.loanAmount + opp.flashLoanFee / (opp.loanAmountUSD / opp.loanAmount), opp.loanAsset)} />
                </Section>

                {/* Price & Spread */}
                <Section title="Price Analysis" icon={<TrendingUp size={14} />}>
                  <DetailRow label="Spread" value={`${opp.spread.toFixed(4)}% (${opp.spreadBps.toFixed(1)} bps)`} valueColor="#22c55e" />
                  <DetailRow label="Buy Price" value={`$${opp.buyPrice.toFixed(6)}`} />
                  <DetailRow label="Sell Price" value={`$${opp.sellPrice.toFixed(6)}`} />
                  <DetailRow label="Price Diff" value={`$${Math.abs(opp.sellPrice - opp.buyPrice).toFixed(6)}`} valueColor="#22c55e" />
                </Section>

                {/* Price Impact */}
                <Section title="Price Impact" icon={<AlertTriangle size={14} />}>
                  <DetailRow label="Buy Impact" value={`${opp.priceImpactBuy.toFixed(3)}%`}
                    valueColor={opp.priceImpactBuy > 1.5 ? '#f87171' : '#a3a3a3'} />
                  <DetailRow label="Sell Impact" value={`${opp.priceImpactSell.toFixed(3)}%`}
                    valueColor={opp.priceImpactSell > 1.5 ? '#f87171' : '#a3a3a3'} />
                  <DetailRow label="Total Impact" value={`${(opp.priceImpactBuy + opp.priceImpactSell).toFixed(3)}%`}
                    valueColor={(opp.priceImpactBuy + opp.priceImpactSell) > 3 ? '#f87171' : '#22c55e'} />
                </Section>

                {/* Liquidity */}
                <Section title="Pool Liquidity" icon={<Droplets size={14} />}>
                  <DetailRow label="Buy Pool TVL" value={fmtUSD(opp.liquidityBuy)} />
                  <DetailRow label="Sell Pool TVL" value={fmtUSD(opp.liquiditySell)} />
                  <DetailRow label="Trade/Liquidity Ratio" value={`${((opp.loanAmountUSD / Math.min(opp.liquidityBuy, opp.liquiditySell)) * 100).toFixed(2)}%`} />
                </Section>

                {/* Fee Breakdown */}
                <Section title="Fee Breakdown" icon={<Shield size={14} />}>
                  <DetailRow label="Flash Loan Fee" value={fmtUSD(opp.flashLoanFee)} valueColor="#f87171" />
                  <DetailRow label="Buy DEX Fee" value={fmtUSD(opp.loanAmountUSD * (buyDex?.fee || 30) / 10000)} valueColor="#f87171" />
                  <DetailRow label="Sell DEX Fee" value={fmtUSD(opp.loanAmountUSD * (sellDex?.fee || 30) / 10000)} valueColor="#f87171" />
                  <DetailRow label="Estimated Gas" value={fmtUSD(opp.gasFeeUSD)} valueColor="#f87171" />
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <DetailRow label="TOTAL FEES" value={fmtUSD(opp.totalFeeUSD)} valueColor="#f87171" bold />
                  </div>
                </Section>

                {/* Wallet Check */}
                {!wallet.connected && (
                  <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-sm text-amber-400">
                    <AlertTriangle size={14} />
                    Connect your wallet to execute this trade
                  </div>
                )}

                {/* Confirm Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirm}
                  disabled={!wallet.connected}
                  className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: wallet.connected
                      ? 'linear-gradient(135deg, #22c55e, #15803d)'
                      : '#374151',
                    boxShadow: wallet.connected ? '0 8px 30px rgba(34,197,94,0.35)' : 'none',
                  }}
                >
                  <Zap size={18} />
                  <span className="text-white">Confirm Trade — Execute Flash Loan</span>
                </motion.button>

                <p className="text-center text-xs text-gray-600">
                  This will execute atomically in a single transaction. If any step fails, the entire transaction reverts.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showLive && (
        <ExecutionModal
          opp={opp}
          onClose={() => {
            setShowLive(false);
            setShowExecutionModal(false);
          }}
        />
      )}
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/60">
        <span className="text-gray-500">{icon}</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, valueColor, bold }: {
  label: string; value: string; valueColor?: string; bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono ${bold ? 'font-bold' : 'font-medium'}`} style={{ color: valueColor || '#e5e7eb' }}>
        {value}
      </span>
    </div>
  );
}
