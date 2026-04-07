// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../FlashArbitrageExecutor.sol";

// Base-specific deployment entrypoint. Use this contract for Base Sepolia/mainnet deployments.
contract FlashArbitrageExecutorBase is FlashArbitrageExecutor {}
