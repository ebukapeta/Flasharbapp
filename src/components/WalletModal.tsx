import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Shield, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { CHAINS } from '../data/chains';

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  chains: string[];
  color: string;
  popular?: boolean;
}

const WALLET_OPTIONS: WalletOption[] = [
  { id: 'metamask', name: 'MetaMask', icon: '🦊', chains: ['bsc', 'base', 'arbitrum'], color: '#F6851B', popular: true },
  { id: 'phantom', name: 'Phantom', icon: '👻', chains: ['solana'], color: '#AB9FF2', popular: true },
  { id: 'trustwallet', name: 'Trust Wallet', icon: '🛡️', chains: ['bsc', 'base', 'arbitrum'], color: '#3375BB' },
  { id: 'walletconnect', name: 'WalletConnect', icon: '🔗', chains: ['bsc', 'base', 'arbitrum'], color: '#3B99FC' },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: '🔵', chains: ['bsc', 'base', 'arbitrum'], color: '#0052FF' },
  { id: 'solflare', name: 'Solflare', icon: '🌞', chains: ['solana'], color: '#FFA500' },
  { id: 'backpack', name: 'Backpack', icon: '🎒', chains: ['solana'], color: '#E33E3F' },
  { id: 'okx', name: 'OKX Wallet', icon: '⭕', chains: ['bsc', 'base', 'arbitrum', 'solana'], color: '#1C1C1E' },
];

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function generateMockAddress(chain: string, walletType: string): string {
  const hash = walletType + chain;
  let h = 0;
  for (let i = 0; i < hash.length; i++) {
    h = (Math.imul(31, h) + hash.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(h).toString(16).padStart(8, '0');
  if (chain === 'solana') {
    return `${hex.toUpperCase()}...${Math.abs(h * 31).toString(16).slice(0, 8).toUpperCase()}`;
  }
  return `0x${hex}${'a1b2c3d4'.slice(0, 32)}`;
}

export default function WalletModal() {
  const { showWalletModal, setShowWalletModal, selectedChain, setWallet, wallet, disconnectWallet } = useStore();
  const chain = CHAINS[selectedChain];

  const compatible = WALLET_OPTIONS.filter((w) => w.chains.includes(selectedChain));

  const handleConnect = (walletOpt: WalletOption) => {
    const mockAddress = generateMockAddress(selectedChain, walletOpt.id);
    setWallet({
      connected: true,
      address: mockAddress,
      chainId: chain.chainIdHex,
      walletType: walletOpt.name,
      balance: (Math.random() * 5 + 0.1).toFixed(4),
    });
    setShowWalletModal(false);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setShowWalletModal(false);
  };

  return (
    <AnimatePresence>
      {showWalletModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowWalletModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-md bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-800"
              style={{ background: `linear-gradient(135deg, ${chain.color}15, transparent)` }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: `${chain.color}20` }}>
                  <Wallet size={20} style={{ color: chain.color }} />
                </div>
                <div>
                  <h2 className="font-bold text-white text-lg">Connect Wallet</h2>
                  <p className="text-xs text-gray-400">{chain.name} compatible wallets</p>
                </div>
              </div>
              <button onClick={() => setShowWalletModal(false)}
                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Connected State */}
            {wallet.connected && (
              <div className="p-4 mx-5 mt-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-green-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">Connected via {wallet.walletType}</p>
                    <p className="text-sm font-mono text-green-400 truncate">{truncateAddress(wallet.address || '')}</p>
                  </div>
                  <button onClick={handleDisconnect}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 border border-red-500/30 transition-all">
                    Disconnect
                  </button>
                </div>
              </div>
            )}

            {/* Wallet List */}
            <div className="p-5 grid grid-cols-2 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
              {compatible.map((w) => (
                <motion.button
                  key={w.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleConnect(w)}
                  className="relative flex flex-col items-center gap-2.5 p-4 rounded-xl border border-gray-700 bg-gray-900 hover:border-gray-500 transition-all group"
                  style={{ '--hover-color': w.color } as React.CSSProperties}
                >
                  {w.popular && (
                    <span className="absolute top-2 right-2 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium border border-amber-500/30">
                      Popular
                    </span>
                  )}
                  <span className="text-3xl">{w.icon}</span>
                  <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors text-center leading-tight">
                    {w.name}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
              <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
                <Shield size={12} />
                <span>Non-custodial • Your keys, your assets</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
