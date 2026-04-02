export type ChainId = 'bsc' | 'solana' | 'base' | 'arbitrum';
export type NetworkMode = 'mainnet' | 'testnet';

export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoColor: string;
  coingeckoId: string;
  testnetAddress?: string;
}

export interface Pool {
  address: string;
  token0: string;
  token1: string;
  fee?: number;
  dex: string;
  testnetAddress?: string;
}

export interface DexConfig {
  id: string;
  name: string;
  logo: string;
  color: string;
  routerAddress: string;
  factoryAddress: string;
  version: string;
  fee: number; // basis points
  testnetRouter?: string;
  testnetFactory?: string;
}

export interface FlashLoanProvider {
  id: string;
  name: string;
  color: string;
  contractAddress: string;
  fee: number; // basis points e.g. 9 = 0.09%
  maxLoanUSD: number;
  supportedTokens: string[];
  testnetAddress?: string;
}

export interface ChainConfig {
  id: ChainId;
  name: string;
  shortName: string;
  color: string;
  gradient: string;
  icon: string;
  rpcUrl: string;
  testnetRpcUrl: string;
  chainIdHex: string;
  testnetChainIdHex: string;
  explorerUrl: string;
  testnetExplorerUrl: string;
  nativeCurrency: string;
  multicallAddress: string;
  testnetMulticallAddress: string;
  gasPrice: number; // gwei estimate
  blockTime: number; // seconds
  tokens: Token[];
  dexes: DexConfig[];
  flashLoanProviders: FlashLoanProvider[];
  pools: Pool[];
}

// ═══════════════════════════════════════════════════════════════
//  BSC CHAIN CONFIG
// ═══════════════════════════════════════════════════════════════
const BSC_TOKENS: Token[] = [
  {
    symbol: 'WBNB',
    name: 'Wrapped BNB',
    address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    decimals: 18,
    logoColor: '#F3BA2F',
    coingeckoId: 'binancecoin',
    testnetAddress: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    logoColor: '#26A17B',
    coingeckoId: 'tether',
    testnetAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
    logoColor: '#2775CA',
    coingeckoId: 'usd-coin',
    testnetAddress: '0x64544969ed7EBf5f083679233325356EbE738930',
  },
  {
    symbol: 'BTCB',
    name: 'Bitcoin BEP2',
    address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    decimals: 18,
    logoColor: '#F7931A',
    coingeckoId: 'bitcoin',
    testnetAddress: '0x6ce8da28E2f864420840cF74474eFf5fD80E65B8',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    decimals: 18,
    logoColor: '#627EEA',
    coingeckoId: 'ethereum',
    testnetAddress: '0xd66c6B4F0be8CE5b39D52E0Fd1344c389929B378',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
    decimals: 8,
    logoColor: '#F7931A',
    coingeckoId: 'wrapped-bitcoin',
    testnetAddress: '0xfC8C40b9Ed2F4EBCEBBa4F01d91eB6d5B78EFAF',
  },
];

const BSC_DEXES: DexConfig[] = [
  {
    id: 'pancakev2',
    name: 'PancakeSwap V2',
    logo: '🥞',
    color: '#1FC7D4',
    routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    version: 'v2',
    fee: 25,
    testnetRouter: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
    testnetFactory: '0x6725F303b657a9451d8BA641348b6761A6CC7a17',
  },
  {
    id: 'pancakev3',
    name: 'PancakeSwap V3',
    logo: '🥞',
    color: '#7645D9',
    routerAddress: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
    factoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
    version: 'v3',
    fee: 5,
    testnetRouter: '0x9a489505a00cE272eAa5e07Dba6491314CaE3796',
    testnetFactory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
  },
  {
    id: 'biswap',
    name: 'Biswap',
    logo: '🔄',
    color: '#3AADFE',
    routerAddress: '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8',
    factoryAddress: '0x858E3312ed3A876947EA49d572A7C42DE08af7EE',
    version: 'v2',
    fee: 10,
  },
  {
    id: 'apeswap',
    name: 'ApeSwap',
    logo: '🦍',
    color: '#FFB300',
    routerAddress: '0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b',
    factoryAddress: '0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da6',
    version: 'v2',
    fee: 20,
  },
  {
    id: 'babyswap',
    name: 'BabySwap',
    logo: '👶',
    color: '#FF6F61',
    routerAddress: '0x325E343f1dE602396E256B67eFd1F61C3A6B38Bd',
    factoryAddress: '0x86407bEa2078ea5f5EB5A52B2caA963bC1F889Da',
    version: 'v2',
    fee: 30,
  },
  {
    id: 'thena',
    name: 'Thena',
    logo: '♾️',
    color: '#9D4EDD',
    routerAddress: '0xd4ae6eCA985340Dd434D38F470aCCce4DC78d109',
    factoryAddress: '0xAFD89d21BdB66d00817d4153E055830B1c2B3970',
    version: 'v2',
    fee: 20,
  },
];

const BSC_FLASH_LOAN_PROVIDERS: FlashLoanProvider[] = [
  {
    id: 'venus',
    name: 'Venus Protocol',
    color: '#FFD700',
    contractAddress: '0xfD36e2c2a6789Db23113685031d7F16329158384',
    fee: 0,
    maxLoanUSD: 50000000,
    supportedTokens: ['WBNB', 'USDT', 'USDC', 'BTCB', 'WETH'],
    testnetAddress: '0x94d1820b2D1c7cbb5172369a723Dc37bFd8492d8',
  },
  {
    id: 'pancakeflash',
    name: 'PancakeSwap Flash',
    color: '#1FC7D4',
    contractAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    fee: 25,
    maxLoanUSD: 30000000,
    supportedTokens: ['WBNB', 'USDT', 'USDC', 'BTCB', 'WETH', 'WBTC'],
    testnetAddress: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
  },
  {
    id: 'dodoflash',
    name: 'DODO Flash',
    color: '#FFEC40',
    contractAddress: '0x8F8Dd7DB1bDA5eD3da8C9daf3bfa471c12d58486',
    fee: 2,
    maxLoanUSD: 20000000,
    supportedTokens: ['WBNB', 'USDT', 'USDC', 'BUSD'],
    testnetAddress: '0xB76de21f04F677f07D9881174a1D8E624276314C',
  },
];

// Key BSC pools (high liquidity)
const BSC_POOLS: Pool[] = [
  { address: '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE', token0: 'WBNB', token1: 'USDT', dex: 'pancakev2' },
  { address: '0xD171B26E4484402de70e28ECB2b6AA4B6b6f0B81', token0: 'WBNB', token1: 'USDC', dex: 'pancakev2' },
  { address: '0x7EB5D86FD78f3852a3e0e064f2842d45a3dB6EA2', token0: 'WBNB', token1: 'WBTC', dex: 'pancakev2' },
  { address: '0xF45cd219aEF8618A92BAa7aD848364a158a24F33', token0: 'WBNB', token1: 'WETH', dex: 'pancakev2' },
  { address: '0x61EB789d75A95CAa3fF50ed7E47b96c132fEc082', token0: 'WBNB', token1: 'BTCB', dex: 'pancakev2' },
  { address: '0xBaaCc99123133851Ba2D6d34952aa08CBDf5A4E4', token0: 'USDT', token1: 'USDC', dex: 'pancakev2' },
  { address: '0x3F803EC2b816Ea7F06EC76Aa2B6f2532F9892d62', token0: 'BTCB', token1: 'USDT', dex: 'pancakev2' },
  { address: '0xEF8cD6Cb5c841A4f02986e8A8ab3cC545d1B8B6d', token0: 'WETH', token1: 'USDT', dex: 'pancakev2' },
  { address: '0x36696169C63e42cd08ce11f5deeBbCeBae652050', token0: 'WBNB', token1: 'USDT', dex: 'biswap' },
  { address: '0x46Cf1cF8c69595804ba91dFdd8d6b960c9B0a7C4', token0: 'WBNB', token1: 'BTCB', dex: 'biswap' },
  { address: '0x3f4f81928FFbb5A622cF9d5f9b70e3B5F9a7d3be', token0: 'WBNB', token1: 'WETH', dex: 'thena' },
  { address: '0xFDFef9d10d929cB3905C71400ce6be1990EA0F34', token0: 'USDT', token1: 'USDC', dex: 'thena' },
];

// ═══════════════════════════════════════════════════════════════
//  SOLANA CHAIN CONFIG
// ═══════════════════════════════════════════════════════════════
const SOLANA_TOKENS: Token[] = [
  {
    symbol: 'WSOL',
    name: 'Wrapped SOL',
    address: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    logoColor: '#9945FF',
    coingeckoId: 'solana',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    logoColor: '#2775CA',
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    logoColor: '#26A17B',
    coingeckoId: 'tether',
  },
  {
    symbol: 'MSOL',
    name: 'Marinade SOL',
    address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    decimals: 9,
    logoColor: '#04A7C0',
    coingeckoId: 'msol',
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    decimals: 5,
    logoColor: '#F4A418',
    coingeckoId: 'bonk',
  },
  {
    symbol: 'RAY',
    name: 'Raydium',
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6,
    logoColor: '#3FD9FF',
    coingeckoId: 'raydium',
  },
];

const SOLANA_DEXES: DexConfig[] = [
  {
    id: 'raydium',
    name: 'Raydium',
    logo: '⚡',
    color: '#3FD9FF',
    routerAddress: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    factoryAddress: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    version: 'v4',
    fee: 25,
  },
  {
    id: 'orca',
    name: 'Orca',
    logo: '🐋',
    color: '#00C2FF',
    routerAddress: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    factoryAddress: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    version: 'whirlpool',
    fee: 5,
  },
  {
    id: 'meteora',
    name: 'Meteora',
    logo: '🌠',
    color: '#8B5CF6',
    routerAddress: 'LBUZKhRxPF3XUpBCjp4YzTKgLLjcesxoLhaFYeNtHqo',
    factoryAddress: 'LBUZKhRxPF3XUpBCjp4YzTKgLLjicesxoLhaFYeNtHqo',
    version: 'dlmm',
    fee: 10,
  },
  {
    id: 'phoenix',
    name: 'Phoenix DEX',
    logo: '🔥',
    color: '#FF4500',
    routerAddress: 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
    factoryAddress: 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
    version: 'clob',
    fee: 8,
  },
  {
    id: 'lifinity',
    name: 'Lifinity',
    logo: '♾️',
    color: '#FF6B9D',
    routerAddress: 'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S',
    factoryAddress: 'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S',
    version: 'v2',
    fee: 15,
  },
  {
    id: 'saber',
    name: 'Saber',
    logo: '⚔️',
    color: '#FFD700',
    routerAddress: 'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ',
    factoryAddress: 'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ',
    version: 'stable',
    fee: 4,
  },
];

const SOLANA_FLASH_LOAN_PROVIDERS: FlashLoanProvider[] = [
  {
    id: 'solend',
    name: 'Solend',
    color: '#5BC7F5',
    contractAddress: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
    fee: 30,
    maxLoanUSD: 10000000,
    supportedTokens: ['WSOL', 'USDC', 'USDT', 'MSOL'],
  },
  {
    id: 'marginfi',
    name: 'MarginFi',
    color: '#98FF98',
    contractAddress: 'MFv2hWf31Z9kbCa1snEPdcgp168FHFjUKbvFKcxGUEj',
    fee: 0,
    maxLoanUSD: 20000000,
    supportedTokens: ['WSOL', 'USDC', 'USDT', 'MSOL', 'BONK'],
  },
  {
    id: 'kamino',
    name: 'Kamino Finance',
    color: '#7B61FF',
    contractAddress: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD',
    fee: 10,
    maxLoanUSD: 15000000,
    supportedTokens: ['WSOL', 'USDC', 'USDT', 'MSOL', 'RAY'],
  },
];

const SOLANA_POOLS: Pool[] = [
  { address: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2', token0: 'WSOL', token1: 'USDC', dex: 'raydium' },
  { address: '7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX', token0: 'WSOL', token1: 'USDT', dex: 'raydium' },
  { address: 'EGZ7tiLeH62TPV1gL8WwbXGzEPa9zmcpVnnkPKKnrE2U', token0: 'MSOL', token1: 'USDC', dex: 'raydium' },
  { address: 'HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ', token0: 'WSOL', token1: 'USDC', dex: 'orca' },
  { address: 'EFv1ETPrHEfFH1bKBJKHFGcx1kQka5e3s9UNbNWq6DH', token0: 'MSOL', token1: 'WSOL', dex: 'orca' },
  { address: '5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6', token0: 'USDC', token1: 'USDT', dex: 'saber' },
  { address: 'A1ZmH9dK1FMnNHYMFXMXHXiTTGdFALMJnEBGQXF6TFN', token0: 'WSOL', token1: 'BONK', dex: 'meteora' },
  { address: 'HkDpHC4ZjuPNxRCBMmMNhbNNGsRjJTVpTBvPqBeFE6n', token0: 'RAY', token1: 'USDC', dex: 'raydium' },
];

// ═══════════════════════════════════════════════════════════════
//  BASE CHAIN CONFIG
// ═══════════════════════════════════════════════════════════════
const BASE_TOKENS: Token[] = [
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    logoColor: '#627EEA',
    coingeckoId: 'ethereum',
    testnetAddress: '0x4200000000000000000000000000000000000006',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    logoColor: '#2775CA',
    coingeckoId: 'usd-coin',
    testnetAddress: '0xf175520c52418dfe19c8098071a252da48cd1c19',
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
    logoColor: '#F5AC37',
    coingeckoId: 'dai',
  },
  {
    symbol: 'cbETH',
    name: 'Coinbase ETH',
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    decimals: 18,
    logoColor: '#0052FF',
    coingeckoId: 'coinbase-wrapped-staked-eth',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x1C9aBD1f2Aa4eD42d3b1ea5e3aB2e28f0a5fD7A',
    decimals: 8,
    logoColor: '#F7931A',
    coingeckoId: 'wrapped-bitcoin',
    testnetAddress: '0x78b6F7E5a5E6e7D2Ef08C22eB2Aac5B03F83bE6b',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    decimals: 6,
    logoColor: '#26A17B',
    coingeckoId: 'tether',
  },
];

const BASE_DEXES: DexConfig[] = [
  {
    id: 'uniswapv3base',
    name: 'Uniswap V3',
    logo: '🦄',
    color: '#FF007A',
    routerAddress: '0x2626664c2603336E57B271c5C0b26F421741e481',
    factoryAddress: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    version: 'v3',
    fee: 5,
    testnetRouter: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
    testnetFactory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
  },
  {
    id: 'baseswap',
    name: 'BaseSwap',
    logo: '🔵',
    color: '#0052FF',
    routerAddress: '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86',
    factoryAddress: '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB',
    version: 'v2',
    fee: 30,
  },
  {
    id: 'aerodrome',
    name: 'Aerodrome',
    logo: '✈️',
    color: '#0EA5E9',
    routerAddress: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
    factoryAddress: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
    version: 'stable',
    fee: 5,
  },
  {
    id: 'sushiswapbase',
    name: 'SushiSwap',
    logo: '🍣',
    color: '#FA52A0',
    routerAddress: '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891',
    factoryAddress: '0x71524B4f93c58fcbF659783284E38825f0622859',
    version: 'v2',
    fee: 30,
  },
  {
    id: 'swapbasefi',
    name: 'SwapBased',
    logo: '💫',
    color: '#6366F1',
    routerAddress: '0xaaa3b1F1bd7BCc97fD1917c18ADE665C5D31F066',
    factoryAddress: '0x38015D05f4fEC8AFe15D7cc0386a126574e8077B',
    version: 'v2',
    fee: 20,
  },
  {
    id: 'pancakebase',
    name: 'PancakeSwap',
    logo: '🥞',
    color: '#1FC7D4',
    routerAddress: '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86',
    factoryAddress: '0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E',
    version: 'v3',
    fee: 5,
  },
];

const BASE_FLASH_LOAN_PROVIDERS: FlashLoanProvider[] = [
  {
    id: 'aavebase',
    name: 'Aave V3',
    color: '#B6509E',
    contractAddress: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    fee: 9,
    maxLoanUSD: 100000000,
    supportedTokens: ['WETH', 'USDC', 'DAI', 'WBTC', 'USDT'],
    testnetAddress: '0x07eA79F68B2B3df564D0A34F8e19791234D9179a',
  },
  {
    id: 'uniswapflashbase',
    name: 'Uniswap V3 Flash',
    color: '#FF007A',
    contractAddress: '0x2626664c2603336E57B271c5C0b26F421741e481',
    fee: 5,
    maxLoanUSD: 50000000,
    supportedTokens: ['WETH', 'USDC', 'DAI', 'cbETH', 'WBTC'],
    testnetAddress: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
  },
  {
    id: 'morphobase',
    name: 'Morpho Blue',
    color: '#6E56CF',
    contractAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    fee: 0,
    maxLoanUSD: 30000000,
    supportedTokens: ['WETH', 'USDC', 'cbETH', 'DAI'],
  },
];

const BASE_POOLS: Pool[] = [
  { address: '0xd0b53D9277642d899DF5C87A3966A349A798F224', token0: 'WETH', token1: 'USDC', dex: 'uniswapv3base' },
  { address: '0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B0', token0: 'WETH', token1: 'DAI', dex: 'aerodrome' },
  { address: '0x9f0B4E4Bd9AdFa6A674F6C1F21E3d2b5b1e3e7C3', token0: 'cbETH', token1: 'WETH', dex: 'uniswapv3base' },
  { address: '0x2d1d7Ef7b2Ab5A0A04B7C6EBcB2DA35B5e4b7c8A', token0: 'USDC', token1: 'DAI', dex: 'aerodrome' },
  { address: '0x3A5F43Cf0F9B7e2bA2C4F09e8B7f5Bd2f6C9d1A', token0: 'WETH', token1: 'WBTC', dex: 'baseswap' },
  { address: '0x7b4F5dC8Ae3B6C2fD9e4E5B3c8D7f2A1e6b9c0E', token0: 'WETH', token1: 'USDT', dex: 'sushiswapbase' },
];

// ═══════════════════════════════════════════════════════════════
//  ARBITRUM CHAIN CONFIG
// ═══════════════════════════════════════════════════════════════
const ARBITRUM_TOKENS: Token[] = [
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    logoColor: '#627EEA',
    coingeckoId: 'ethereum',
    testnetAddress: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    logoColor: '#2775CA',
    coingeckoId: 'usd-coin',
    testnetAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
    logoColor: '#26A17B',
    coingeckoId: 'tether',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    decimals: 8,
    logoColor: '#F7931A',
    coingeckoId: 'wrapped-bitcoin',
    testnetAddress: '0x95e1E7e8b1Cc6437b7a13a0e9D8e3BDf4B9e36B4',
  },
  {
    symbol: 'ARB',
    name: 'Arbitrum',
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    decimals: 18,
    logoColor: '#28A0F0',
    coingeckoId: 'arbitrum',
  },
  {
    symbol: 'GMX',
    name: 'GMX',
    address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    decimals: 18,
    logoColor: '#3BF4C7',
    coingeckoId: 'gmx',
  },
];

const ARBITRUM_DEXES: DexConfig[] = [
  {
    id: 'uniswapv3arb',
    name: 'Uniswap V3',
    logo: '🦄',
    color: '#FF007A',
    routerAddress: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    version: 'v3',
    fee: 5,
    testnetRouter: '0x101F443B4d1b059569D643917553c771E1b9663E',
    testnetFactory: '0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e',
  },
  {
    id: 'sushiswaparb',
    name: 'SushiSwap',
    logo: '🍣',
    color: '#FA52A0',
    routerAddress: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    version: 'v2',
    fee: 30,
  },
  {
    id: 'camelot',
    name: 'Camelot DEX',
    logo: '⚔️',
    color: '#FFD700',
    routerAddress: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
    factoryAddress: '0x6EcCab422D763aC031210895C81787E87B43A652',
    version: 'v2',
    fee: 30,
  },
  {
    id: 'traderjoe',
    name: 'Trader Joe',
    logo: '🏦',
    color: '#FF6600',
    routerAddress: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    factoryAddress: '0xaE4EC9901c3076D0DdBe76A520F9E90a6227aCB7',
    version: 'v2',
    fee: 30,
  },
  {
    id: 'balancerarb',
    name: 'Balancer V2',
    logo: '⚖️',
    color: '#1E1E1E',
    routerAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    factoryAddress: '0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9',
    version: 'v2',
    fee: 10,
  },
  {
    id: 'pancakearb',
    name: 'PancakeSwap',
    logo: '🥞',
    color: '#1FC7D4',
    routerAddress: '0x32226588378236Fd0c7c4053999F88aC0e5cAc77',
    factoryAddress: '0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E',
    version: 'v3',
    fee: 5,
  },
];

const ARBITRUM_FLASH_LOAN_PROVIDERS: FlashLoanProvider[] = [
  {
    id: 'aavearb',
    name: 'Aave V3',
    color: '#B6509E',
    contractAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    fee: 9,
    maxLoanUSD: 200000000,
    supportedTokens: ['WETH', 'USDC', 'USDT', 'WBTC', 'ARB'],
    testnetAddress: '0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff',
  },
  {
    id: 'balancerflasharb',
    name: 'Balancer Flash',
    color: '#1E1E1E',
    contractAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    fee: 0,
    maxLoanUSD: 50000000,
    supportedTokens: ['WETH', 'USDC', 'USDT', 'WBTC'],
    testnetAddress: '0xfA6e11bECE2a38F46e77E38a6c4A60bDa9bDE0c3',
  },
  {
    id: 'radiantarb',
    name: 'Radiant Capital',
    color: '#00E5FF',
    contractAddress: '0xd50Cf00b6e600Dd036Ba8eF475677d816d6c4281',
    fee: 9,
    maxLoanUSD: 30000000,
    supportedTokens: ['WETH', 'USDC', 'USDT', 'WBTC', 'ARB'],
  },
];

const ARBITRUM_POOLS: Pool[] = [
  { address: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443', token0: 'WETH', token1: 'USDC', dex: 'uniswapv3arb' },
  { address: '0x641C00A822e8b671738d32a431a4Fb6074E5c79d', token0: 'WETH', token1: 'USDT', dex: 'uniswapv3arb' },
  { address: '0x2f5e87C9312fa29aed5c179E456625D79015299c', token0: 'WBTC', token1: 'WETH', dex: 'uniswapv3arb' },
  { address: '0x80A9ae39310abf666A87C743d6ebBD0E8C42158E', token0: 'WETH', token1: 'USDC', dex: 'camelot' },
  { address: '0x0dDA5e11EC1A50ED5dC14e70c0E8DF3C41b07d0b', token0: 'ARB', token1: 'USDC', dex: 'camelot' },
  { address: '0xA7f42Ff7433cB268dD7D59be62b00c30dEd28d3D', token0: 'GMX', token1: 'WETH', dex: 'sushiswaparb' },
  { address: '0x7f90122BF0700F9E7e1F688fe926940E8839F353', token0: 'USDC', token1: 'USDT', dex: 'uniswapv3arb' },
  { address: '0xd74F5255023a808Db6324199d462717EDb8Cde4f', token0: 'WETH', token1: 'ARB', dex: 'traderjoe' },
];

// ═══════════════════════════════════════════════════════════════
//  MASTER CHAIN REGISTRY
// ═══════════════════════════════════════════════════════════════
export const CHAINS: Record<ChainId, ChainConfig> = {
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    color: '#F3BA2F',
    gradient: 'from-yellow-400 to-amber-500',
    icon: '⬡',
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    testnetRpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    chainIdHex: '0x38',
    testnetChainIdHex: '0x61',
    explorerUrl: 'https://bscscan.com',
    testnetExplorerUrl: 'https://testnet.bscscan.com',
    nativeCurrency: 'BNB',
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    testnetMulticallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    gasPrice: 3,
    blockTime: 3,
    tokens: BSC_TOKENS,
    dexes: BSC_DEXES,
    flashLoanProviders: BSC_FLASH_LOAN_PROVIDERS,
    pools: BSC_POOLS,
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    shortName: 'SOL',
    color: '#9945FF',
    gradient: 'from-purple-500 to-green-400',
    icon: '◎',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    testnetRpcUrl: 'https://api.devnet.solana.com',
    chainIdHex: 'mainnet-beta',
    testnetChainIdHex: 'devnet',
    explorerUrl: 'https://solscan.io',
    testnetExplorerUrl: 'https://solscan.io/?cluster=devnet',
    nativeCurrency: 'SOL',
    multicallAddress: 'CmFKq2GqMLhk6rrAGWJ4wFiRB4MJoNGBUvKiH8ZDVV1W',
    testnetMulticallAddress: 'CmFKq2GqMLhk6rrAGWJ4wFiRB4MJoNGBUvKiH8ZDVV1W',
    gasPrice: 0.000005,
    blockTime: 0.4,
    tokens: SOLANA_TOKENS,
    dexes: SOLANA_DEXES,
    flashLoanProviders: SOLANA_FLASH_LOAN_PROVIDERS,
    pools: SOLANA_POOLS,
  },
  base: {
    id: 'base',
    name: 'Base',
    shortName: 'BASE',
    color: '#0052FF',
    gradient: 'from-blue-600 to-blue-400',
    icon: '🔵',
    rpcUrl: 'https://mainnet.base.org',
    testnetRpcUrl: 'https://sepolia.base.org',
    chainIdHex: '0x2105',
    testnetChainIdHex: '0x14A34',
    explorerUrl: 'https://basescan.org',
    testnetExplorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: 'ETH',
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    testnetMulticallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    gasPrice: 0.001,
    blockTime: 2,
    tokens: BASE_TOKENS,
    dexes: BASE_DEXES,
    flashLoanProviders: BASE_FLASH_LOAN_PROVIDERS,
    pools: BASE_POOLS,
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    shortName: 'ARB',
    color: '#28A0F0',
    gradient: 'from-blue-400 to-sky-300',
    icon: '🔷',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    testnetRpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    chainIdHex: '0xA4B1',
    testnetChainIdHex: '0x66EEE',
    explorerUrl: 'https://arbiscan.io',
    testnetExplorerUrl: 'https://sepolia.arbiscan.io',
    nativeCurrency: 'ETH',
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    testnetMulticallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    gasPrice: 0.01,
    blockTime: 0.25,
    tokens: ARBITRUM_TOKENS,
    dexes: ARBITRUM_DEXES,
    flashLoanProviders: ARBITRUM_FLASH_LOAN_PROVIDERS,
    pools: ARBITRUM_POOLS,
  },
};

export const CHAIN_LIST: ChainId[] = ['bsc', 'solana', 'base', 'arbitrum'];
