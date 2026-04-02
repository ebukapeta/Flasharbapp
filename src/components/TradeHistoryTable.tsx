import { motion } from 'framer-motion';
import { ExternalLink, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { CHAINS } from '../data/chains';

function fmtUSD(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(2)}K`;
  return `$${n.toFixed(4)}`;
}
function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}
function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

const STATUS_ICON = {
  success: <CheckCircle size={14} className="text-green-400" />,
  failed: <XCircle size={14} className="text-red-400" />,
  pending: <Clock size={14} className="text-amber-400 animate-pulse" />,
};

export default function TradeHistoryTable() {
  const { tradeHistory, clearTradeHistory, selectedChain, networkMode } = useStore();
  const chain = CHAINS[selectedChain];
  const explorerUrl = networkMode === 'testnet' ? chain.testnetExplorerUrl : chain.explorerUrl;

  if (tradeHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">📋</div>
        <div className="text-gray-400 font-semibold">No trade history yet</div>
        <div className="text-sm text-gray-600 mt-1">Execute flash loan trades to see history here</div>
      </div>
    );
  }

  const totals = tradeHistory.reduce(
    (acc, t) => ({
      gross: acc.gross + t.grossProfitUSD,
      net: acc.net + t.netProfitUSD,
      fees: acc.fees + t.feeUSD,
      success: acc.success + (t.status === 'success' ? 1 : 0),
    }),
    { gross: 0, net: 0, fees: 0, success: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Trades" value={tradeHistory.length.toString()} color="#3b82f6" />
        <StatCard label="Success Rate"
          value={`${tradeHistory.length > 0 ? ((totals.success / tradeHistory.length) * 100).toFixed(0) : 0}%`}
          color="#22c55e" />
        <StatCard label="Gross Profit" value={fmtUSD(totals.gross)} color="#a78bfa" />
        <StatCard label="Net Profit" value={fmtUSD(totals.net)} color={totals.net >= 0 ? '#22c55e' : '#f87171'} />
      </div>

      {/* Clear Button */}
      <div className="flex justify-end">
        <button
          onClick={clearTradeHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all"
        >
          <Trash2 size={12} />
          Clear History
        </button>
      </div>

      {/* Mobile Cards */}
      <div className="block sm:hidden space-y-3">
        {tradeHistory.map((trade, i) => (
          <motion.div
            key={trade.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className={`rounded-xl border p-4 space-y-2 ${
              trade.status === 'success' ? 'border-green-500/20 bg-green-500/5' :
              trade.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
              'border-gray-700 bg-gray-900/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {STATUS_ICON[trade.status]}
                <span className="font-bold text-white text-sm">{trade.pair}</span>
              </div>
              <span className="text-xs text-gray-500">{fmtTime(trade.timestamp)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <MobileRow label="Buy DEX" value={trade.buyDex} />
              <MobileRow label="Sell DEX" value={trade.sellDex} />
              <MobileRow label="Buy Price" value={`$${trade.buyPrice.toFixed(6)}`} />
              <MobileRow label="Sell Price" value={`$${trade.sellPrice.toFixed(6)}`} />
              <MobileRow label="Loan" value={`${trade.loanAmount.toFixed(2)} ${trade.loanAsset}`} />
              <MobileRow label="Total Fee" value={fmtUSD(trade.feeUSD)} valueColor="#f87171" />
              <MobileRow label="Gross Profit" value={fmtUSD(trade.grossProfitUSD)} valueColor="#a3a3a3" />
              <MobileRow label="Net Profit" value={fmtUSD(trade.netProfitUSD)}
                valueColor={trade.netProfitUSD >= 0 ? '#22c55e' : '#f87171'} />
            </div>
            {trade.txHash && (
              <a
                href={`${explorerUrl}/tx/${trade.txHash}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span className="font-mono">{shortHash(trade.txHash)}</span>
                <ExternalLink size={10} />
              </a>
            )}
            {trade.errorMessage && (
              <div className="text-xs text-red-400">{trade.errorMessage}</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-900 border-b border-gray-800">
            <tr>
              {['Status','Time','Pair','Buy DEX','Sell DEX','Buy $','Sell $','Loan','Fee','Gross','Net','Tx Hash'].map((h) => (
                <th key={h} className="px-3 py-3 text-gray-400 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {tradeHistory.map((trade, i) => (
              <motion.tr
                key={trade.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="hover:bg-gray-900/40 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {STATUS_ICON[trade.status]}
                    <span className={`font-semibold capitalize ${
                      trade.status === 'success' ? 'text-green-400' :
                      trade.status === 'failed' ? 'text-red-400' : 'text-amber-400'
                    }`}>{trade.status}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{fmtTime(trade.timestamp)}</td>
                <td className="px-3 py-2.5 font-bold text-white whitespace-nowrap">{trade.pair}</td>
                <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{trade.buyDex}</td>
                <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{trade.sellDex}</td>
                <td className="px-3 py-2.5 font-mono text-gray-200">${trade.buyPrice.toFixed(5)}</td>
                <td className="px-3 py-2.5 font-mono text-gray-200">${trade.sellPrice.toFixed(5)}</td>
                <td className="px-3 py-2.5 text-blue-300 whitespace-nowrap">{trade.loanAmount.toFixed(2)} {trade.loanAsset}</td>
                <td className="px-3 py-2.5 text-red-400 whitespace-nowrap">{fmtUSD(trade.feeUSD)}</td>
                <td className="px-3 py-2.5 text-gray-200">{fmtUSD(trade.grossProfitUSD)}</td>
                <td className={`px-3 py-2.5 font-bold ${trade.netProfitUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtUSD(trade.netProfitUSD)}
                </td>
                <td className="px-3 py-2.5">
                  {trade.txHash ? (
                    <a
                      href={`${explorerUrl}/tx/${trade.txHash}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono transition-colors"
                    >
                      {shortHash(trade.txHash)}
                      <ExternalLink size={9} />
                    </a>
                  ) : <span className="text-gray-600">—</span>}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function MobileRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-gray-600">{label}</div>
      <div className="font-semibold" style={{ color: valueColor || '#e5e7eb' }}>{value}</div>
    </div>
  );
}
