import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, CheckCircle, LogOut } from 'lucide-react';
import { useStore } from '../store/useStore';
import { CHAINS } from '../data/chains';

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  color: string;
  popular?: boolean;
  chains: string[];
}

const WALLETS: WalletOption[] = [
  { id: 'metamask', name: 'MetaMask', icon: '🦊', color: '#F6851B', popular: true, chains: ['bsc', 'base', 'arbitrum'] },
  { id: 'phantom', name: 'Phantom', icon: '👻', color: '#AB9FF2', popular: true, chains: ['solana'] },
  { id: 'walletconnect', name: 'WalletConnect', icon: '🔗', color: '#3B99FC', chains: ['bsc', 'base', 'arbitrum'] },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: '🔵', color: '#0052FF', chains: ['bsc', 'base', 'arbitrum'] },
  { id: 'trust', name: 'Trust Wallet', icon: '🛡️', color: '#3375BB', chains: ['bsc', 'base', 'arbitrum'] },
  { id: 'backpack', name: 'Backpack', icon: '🎒', color: '#E33E3F', chains: ['solana'] },
  { id: 'solflare', name: 'Solflare', icon: '☀️', color: '#FC8D4D', chains: ['solana'] },
  { id: 'rabby', name: 'Rabby Wallet', icon: '🐰', color: '#8697FF', chains: ['bsc', 'base', 'arbitrum'] },
];

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function generateAddress(_walletId: string, chainId: string): string {
  if (chainId === 'solana') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
    let addr = '';
    for (let i = 0; i < 44; i++) addr += chars[Math.floor(Math.random() * chars.length)];
    return addr;
  }
  return '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export default function WalletModal() {
  const {
    showWalletModal,
    setShowWalletModal,
    wallet,
    setWallet,
    disconnectWallet,
    selectedChain,
  } = useStore();

  const chain = CHAINS[selectedChain];
  const compatible = WALLETS.filter((w) => w.chains.includes(selectedChain));

  const handleConnect = (w: WalletOption) => {
    const address = generateAddress(w.id, selectedChain);
    const balance = (Math.random() * 10 + 0.5).toFixed(4);
    setWallet({
      connected: true,
      address,
      chainId: chain.chainIdHex,
      walletType: w.name,
      balance: `${balance} ${chain.nativeCurrency}`,
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowWalletModal(false)}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div>
                <h2 className="font-bold text-white text-base">Connect Wallet</h2>
                <p className="text-xs text-gray-500">{chain.name} compatible wallets</p>
              </div>
              <button onClick={() => setShowWalletModal(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Connected State */}
              {wallet.connected && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-400" />
                    <div>
                      <div className="text-xs text-green-400 font-semibold">Connected via {wallet.walletType}</div>
                      <div className="text-xs text-gray-400 font-mono">{truncateAddress(wallet.address || '')}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <LogOut size={12} />
                    Disconnect
                  </button>
                </div>
              )}

              {/* Wallet List */}
              <div className="grid grid-cols-2 gap-2">
                {compatible.map((w) => (
                  <motion.button
                    key={w.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleConnect(w)}
                    className="relative flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-700 bg-gray-900 hover:border-gray-500 transition-all"
                  >
                    {w.popular && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                    <span className="text-2xl">{w.icon}</span>
                    <span className="text-xs font-semibold text-gray-300">{w.name}</span>
                  </motion.button>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600 pt-1">
                <Shield size={11} />
                <span>Non-custodial • Your keys, your assets</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
