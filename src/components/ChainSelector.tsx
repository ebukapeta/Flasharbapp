import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { CHAIN_LIST, CHAINS, ChainId } from '../data/chains';

const CHAIN_ICONS: Record<ChainId, string> = {
  bsc: '⬡',
  solana: '◎',
  base: '🔵',
  arbitrum: '🔷',
};

export default function ChainSelector() {
  const { selectedChain, setSelectedChain, networkMode, setNetworkMode } = useStore();

  return (
    <div className="flex flex-col gap-3">
      {/* Chain Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CHAIN_LIST.map((chainId) => {
          const chain = CHAINS[chainId];
          const active = selectedChain === chainId;
          return (
            <motion.button
              key={chainId}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedChain(chainId)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 border
                ${active
                  ? 'text-white border-transparent shadow-lg'
                  : 'bg-gray-900/60 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200'
                }`}
              style={active ? {
                background: `linear-gradient(135deg, ${chain.color}30, ${chain.color}18)`,
                borderColor: chain.color,
                boxShadow: `0 0 20px ${chain.color}30`,
                color: chain.color,
              } : {}}
            >
              <span className="text-base">{CHAIN_ICONS[chainId]}</span>
              <span>{chain.shortName}</span>
              {active && (
                <motion.div
                  layoutId="chain-indicator"
                  className="absolute inset-0 rounded-xl"
                  style={{ border: `1px solid ${chain.color}60` }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Network Mode Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 font-medium">NETWORK:</span>
        <div className="flex bg-gray-900 rounded-lg border border-gray-700 p-0.5">
          {(['testnet', 'mainnet'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setNetworkMode(mode)}
              className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200
                ${networkMode === mode
                  ? mode === 'mainnet'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              {mode === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}
            </button>
          ))}
        </div>
        {networkMode === 'mainnet' && (
          <span className="text-xs text-amber-400 font-medium animate-pulse">
            ⚠️ Live Trading
          </span>
        )}
      </div>
    </div>
  );
}
