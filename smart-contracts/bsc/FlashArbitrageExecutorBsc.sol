// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../FlashArbitrageExecutor.sol";

// BSC-specific deployment entrypoint. Use this contract for BSC testnet/mainnet deployments.
contract FlashArbitrageExecutorBsc is FlashArbitrageExecutor {}
