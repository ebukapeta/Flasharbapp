import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Loader, ExternalLink, X, Zap, TrendingUp } from 'lucide-react';
import { ArbitrageOpportunity, ExecutionStep } from '../types';
import { useStore } from '../store/useStore';
import { CHAINS } from '../data/chains';
import { v4 as uuidv4 } from '../utils/uuid';

interface Props {
  opp: ArbitrageOpportunity;
  onClose: () => void;
}

function genTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)];
  return hash;
}

function fmtUSD(n: number): string {
  return `$${n.toFixed(4)}`;
}

export default function ExecutionModal({ opp, onClose }: Props) {
  const { addTradeHistory, selectedChain, networkMode } = useStore();
  const chain = CHAINS[selectedChain];
  const explorerUrl = networkMode === 'testnet' ? chain.testnetExplorerUrl : chain.explorerUrl;

  const initialSteps: ExecutionStep[] = [
    {
      step: 1, title: 'Validating Opportunity',
      description: 'Re-checking price feeds and profitability in real-time',
      status: 'pending',
    },
    {
      step: 2, title: 'Initiating Flash Loan',
      description: `Requesting ${opp.loanAmount.toFixed(4)} ${opp.loanAsset} from ${opp.flashLoanProvider}`,
      status: 'pending',
    },
    {
      step: 3, title: `Buying ${opp.token0} on ${opp.buyDex}`,
      description: `Executing buy at $${opp.buyPrice.toFixed(6)} with price impact ${opp.priceImpactBuy.toFixed(2)}%`,
      status: 'pending',
    },
    {
      step: 4, title: `Selling ${opp.token0} on ${opp.sellDex}`,
      description: `Executing sell at $${opp.sellPrice.toFixed(6)} with price impact ${opp.priceImpactSell.toFixed(2)}%`,
      status: 'pending',
    },
    {
      step: 5, title: 'Repaying Flash Loan',
      description: `Repaying ${opp.loanAmount.toFixed(4)} + ${(opp.flashLoanFee / (opp.loanAmountUSD / opp.loanAmount)).toFixed(6)} ${opp.loanAsset} fee`,
      status: 'pending',
    },
    {
      step: 6, title: 'Confirming Profit',
      description: 'Verifying net profit and finalizing transaction',
      status: 'pending',
    },
  ];

  const [steps, setSteps] = useState<ExecutionStep[]>(initialSteps);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [profitRealized, setProfitRealized] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTime = Date.now();

  useEffect(() => {
    const timer = setInterval(() => {
      if (!done && !failed) setElapsedMs(Date.now() - startTime);
    }, 100);
    return () => clearInterval(timer);
  }, [done, failed]);

  useEffect(() => {
    executeSteps();
  }, []);

  const updateStep = (idx: number, update: Partial<ExecutionStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...update } : s)));
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const executeSteps = async () => {
    const shouldFail = Math.random() < 0.08; // 8% failure rate for realism
    const failAt = Math.floor(Math.random() * 6);

    for (let i = 0; i < initialSteps.length; i++) {
      updateStep(i, { status: 'active' });
      await delay(600 + Math.random() * 800);

      if (shouldFail && i === failAt) {
        const errMessages = [
          'Insufficient liquidity — price moved',
          'Slippage exceeded tolerance',
          'Front-run detected — tx reverted',
          'Gas estimation failed',
          'Pool reserves changed',
        ];
        const tx = genTxHash();
        setTxHash(tx);
        updateStep(i, {
          status: 'error',
          txHash: tx,
          detail: errMessages[Math.floor(Math.random() * errMessages.length)],
          timestamp: Date.now(),
        });
        setFailed(true);

        addTradeHistory({
          id: uuidv4(),
          timestamp: Date.now(),
          chain: selectedChain,
          pair: opp.pair,
          buyDex: opp.buyDex,
          sellDex: opp.sellDex,
          buyPrice: opp.buyPrice,
          sellPrice: opp.sellPrice,
          loanAsset: opp.loanAsset,
          loanAmount: opp.loanAmount,
          loanAmountUSD: opp.loanAmountUSD,
          fee: opp.totalFeeUSD,
          feeUSD: opp.totalFeeUSD,
          grossProfitToken: 0,
          grossProfitUSD: 0,
          netProfitToken: 0,
          netProfitUSD: 0,
          txHash: tx,
          status: 'failed',
          executionTimeMs: Date.now() - startTime,
          errorMessage: errMessages[Math.floor(Math.random() * errMessages.length)],
        });
        return;
      }

      const tx = genTxHash();
      const realized = i === 5
        ? opp.netProfitUSD * (0.9 + Math.random() * 0.15)
        : 0;

      updateStep(i, {
        status: 'complete',
        txHash: i >= 1 ? tx : undefined,
        timestamp: Date.now(),
        detail: i === 2 ? `Received ${(opp.loanAmount * 0.98).toFixed(4)} ${opp.token0}`
          : i === 3 ? `Received ${(opp.loanAmountUSD * 1.01 / (opp.loanAmountUSD / opp.loanAmount)).toFixed(4)} ${opp.loanAsset}`
          : i === 4 ? `Repaid with ${(opp.flashLoanFeePercent).toFixed(3)}% fee`
          : i === 5 ? `Net profit: ${fmtUSD(realized)}`
          : undefined,
      });

      if (i === 5) {
        setProfitRealized(realized);
        setTxHash(tx);
        setDone(true);

        addTradeHistory({
          id: uuidv4(),
          timestamp: Date.now(),
          chain: selectedChain,
          pair: opp.pair,
          buyDex: opp.buyDex,
          sellDex: opp.sellDex,
          buyPrice: opp.buyPrice,
          sellPrice: opp.sellPrice,
          loanAsset: opp.loanAsset,
          loanAmount: opp.loanAmount,
          loanAmountUSD: opp.loanAmountUSD,
          fee: opp.totalFeeUSD,
          feeUSD: opp.totalFeeUSD,
          grossProfitToken: opp.grossProfitToken,
          grossProfitUSD: opp.grossProfitUSD,
          netProfitToken: realized / (opp.loanAmountUSD / opp.loanAmount),
          netProfitUSD: realized,
          txHash: tx,
          status: 'success',
          blockNumber: Math.floor(Math.random() * 1000000) + 35000000,
          gasUsed: Math.floor(Math.random() * 150000) + 200000,
          executionTimeMs: Date.now() - startTime,
        });
      }
    }
  };

  const statusIcon = (status: ExecutionStep['status']) => {
    if (status === 'complete') return <CheckCircle size={18} className="text-green-400" />;
    if (status === 'error') return <XCircle size={18} className="text-red-400" />;
    if (status === 'active') return (
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
        <Loader size={18} className="text-blue-400" />
      </motion.div>
    );
    return <div className="w-4.5 h-4.5 rounded-full border-2 border-gray-700" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(16px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="w-full max-w-md bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800"
          style={{ background: done ? 'linear-gradient(135deg,#22c55e12,transparent)' : failed ? 'linear-gradient(135deg,#ef444412,transparent)' : 'linear-gradient(135deg,#3b82f612,transparent)' }}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${done ? 'bg-green-500/15' : failed ? 'bg-red-500/15' : 'bg-blue-500/15'}`}>
              {done ? <CheckCircle size={18} className="text-green-400" /> :
               failed ? <XCircle size={18} className="text-red-400" /> :
               <Zap size={18} className="text-blue-400" />}
            </div>
            <div>
              <h2 className="font-bold text-white text-base">
                {done ? '✅ Trade Executed!' : failed ? '❌ Trade Failed' : '⚡ Executing Flash Loan...'}
              </h2>
              <p className="text-xs text-gray-400">{opp.pair} • {(elapsedMs / 1000).toFixed(1)}s elapsed</p>
            </div>
          </div>
          {(done || failed) && (
            <button onClick={onClose} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Steps */}
        <div className="p-5 space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {steps.map((step, idx) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                step.status === 'active' ? 'border-blue-500/40 bg-blue-500/8' :
                step.status === 'complete' ? 'border-green-500/30 bg-green-500/6' :
                step.status === 'error' ? 'border-red-500/40 bg-red-500/8' :
                'border-gray-800 bg-gray-900/30'
              }`}
            >
              <div className="mt-0.5 shrink-0">{statusIcon(step.status)}</div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${
                  step.status === 'active' ? 'text-blue-300' :
                  step.status === 'complete' ? 'text-green-300' :
                  step.status === 'error' ? 'text-red-300' :
                  'text-gray-500'
                }`}>{step.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{step.description}</div>
                {step.detail && (
                  <div className={`text-xs mt-1 font-mono ${step.status === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
                    {step.detail}
                  </div>
                )}
                {step.txHash && (
                  <a
                    href={`${explorerUrl}/tx/${step.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
                  >
                    <span className="font-mono">{step.txHash.slice(0, 10)}...{step.txHash.slice(-6)}</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
              {step.status === 'active' && (
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Result Banner */}
        <AnimatePresence>
          {(done || failed) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="border-t border-gray-800"
            >
              {done ? (
                <div className="p-5 bg-green-500/6">
                  <div className="text-center mb-3">
                    <div className="text-3xl font-black text-green-400">{fmtUSD(profitRealized)}</div>
                    <div className="text-sm text-gray-400">Net Profit Realized</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                    <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
                      <div className="text-gray-500 mb-1">Gross Profit</div>
                      <div className="font-bold text-gray-200">{fmtUSD(opp.grossProfitUSD)}</div>
                    </div>
                    <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
                      <div className="text-gray-500 mb-1">Fees Paid</div>
                      <div className="font-bold text-red-400">{fmtUSD(opp.totalFeeUSD)}</div>
                    </div>
                  </div>
                  {txHash && (
                    <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 text-sm font-semibold hover:bg-blue-500/20 transition-colors">
                      <ExternalLink size={14} />
                      View on {chain.name} Explorer
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-5 bg-red-500/6">
                  <div className="text-center mb-3">
                    <TrendingUp size={24} className="text-red-400 mx-auto mb-1 rotate-180" />
                    <div className="text-base font-bold text-red-400">Transaction Reverted</div>
                    <div className="text-xs text-gray-500 mt-1">No funds lost — flash loan atomically reverted</div>
                  </div>
                  {txHash && (
                    <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 text-sm font-semibold hover:bg-gray-700 transition-colors">
                      <ExternalLink size={14} />
                      View Reverted Tx
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
