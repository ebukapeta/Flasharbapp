// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../FlashArbitrageExecutor.sol";

// Arbitrum-specific deployment entrypoint. Use this contract for Arbitrum Sepolia/mainnet deployments.
contract FlashArbitrageExecutorArbitrum is FlashArbitrageExecutor {}