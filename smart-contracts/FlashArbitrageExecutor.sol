// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IAaveV3Pool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

contract FlashArbitrageExecutor {
    address public owner;
    mapping(address => bool) public approvedProvider;

    struct ArbParams {
        address loanAsset;
        uint256 loanAmount;
        uint256 minProfit;
        address buyDexRouter;
        address sellDexRouter;
        bytes buyCalldata;
        bytes sellCalldata;
    }

    event ProviderUpdated(address indexed provider, bool approved);
    event ArbitrageExecuted(address indexed loanAsset, uint256 loanAmount, uint256 netProfit);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setProvider(address provider, bool approved) external onlyOwner {
        approvedProvider[provider] = approved;
        emit ProviderUpdated(provider, approved);
    }

    function executeArbitrage(address provider, ArbParams calldata params) external onlyOwner {
        require(approvedProvider[provider], "Provider not approved");
        bytes memory data = abi.encode(params);
        IAaveV3Pool(provider).flashLoanSimple(address(this), params.loanAsset, params.loanAmount, data, 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address,
        bytes calldata data
    ) external returns (bool) {
        require(approvedProvider[msg.sender], "Unknown lender");

        ArbParams memory params = abi.decode(data, (ArbParams));
        require(asset == params.loanAsset && amount == params.loanAmount, "Loan mismatch");

        _performSwap(params.buyDexRouter, params.buyCalldata);
        _performSwap(params.sellDexRouter, params.sellCalldata);

        uint256 repayment = amount + premium;
        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        require(balanceAfter >= repayment + params.minProfit, "Unprofitable");

        IERC20(asset).approve(msg.sender, repayment);
        uint256 profit = IERC20(asset).balanceOf(address(this));
        emit ArbitrageExecuted(asset, amount, profit);
        return true;
    }

    function sweep(address token) external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, amount);
    }

    function _performSwap(address router, bytes memory payload) internal {
        (bool ok, ) = router.call(payload);
        require(ok, "Swap failed");
    }
}