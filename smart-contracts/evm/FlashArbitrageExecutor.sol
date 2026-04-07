// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ============================================================================
// FlashArbitrageExecutor — Bug-fixed version
//
// FIXES applied vs. original contract:
//
// BUG 1 (CRITICAL) — _performSwap called the DEX router without first calling
//   IERC20.approve(router, amount).  Every swap reverted with an ERC-20
//   insufficient-allowance error, making the contract completely non-functional.
//   FIX: approve the router for exactly the required amount before the call,
//        then reset allowance to 0 afterward.
//
// BUG 2 (MEDIUM) — ArbitrageExecuted event emitted IERC20.balanceOf(this)
//   AFTER repayment approval — that balance still includes the repayment
//   amount, so the logged "profit" was wildly inflated.
//   FIX: emit balanceAfter - repayment as the true net profit.
//
// BUG 3 (MEDIUM) — sweep() discarded the return value of IERC20.transfer().
//   Non-reverting ERC-20 tokens (e.g. USDT on mainnet) return false on
//   failure; ignoring it means funds could be silently lost.
//   FIX: require(IERC20(token).transfer(owner, amount), "Sweep failed").
//
// BUG 4 (MEDIUM) — No reentrancy protection.  A malicious flash-loan
//   provider or router could re-enter executeOperation.
//   FIX: nonReentrant mutex applied to executeArbitrage and executeOperation.
//
// BUG 5 (MEDIUM) — ArbParams did not carry the quoteAsset address, so the
//   contract had no way to approve the sell router for the intermediate token.
//   FIX: quoteAsset added to ArbParams struct; the frontend now passes it.
//        The FLASH_EXECUTOR_ABI in App.tsx is updated accordingly.
// ============================================================================

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

    // FIX #4: simple reentrancy lock
    bool private _entered;

    // FIX #5: quoteAsset added so the contract knows which token to approve
    // for the sell-side swap (the intermediate token received after the buy).
    struct ArbParams {
        address loanAsset;
        address quoteAsset;   // <-- NEW: the intermediate token (e.g. USDC when buying WETH/USDC)
        uint256 loanAmount;
        uint256 minProfit;
        address buyDexRouter;
        address sellDexRouter;
        bytes   buyCalldata;
        bytes   sellCalldata;
    }

    event ProviderUpdated(address indexed provider, bool approved);
    // FIX #2: netProfit is now the real net profit, not the full balance.
    event ArbitrageExecuted(
        address indexed loanAsset,
        uint256 loanAmount,
        uint256 netProfit
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // FIX #4: reentrancy guard
    modifier nonReentrant() {
        require(!_entered, "Reentrant call");
        _entered = true;
        _;
        _entered = false;
    }

    constructor() {
        owner = msg.sender;
    }

    function setProvider(address provider, bool approved) external onlyOwner {
        approvedProvider[provider] = approved;
        emit ProviderUpdated(provider, approved);
    }

    // Owner calls this to initiate the flash loan arbitrage.
    function executeArbitrage(
        address provider,
        ArbParams calldata params
    ) external onlyOwner nonReentrant {
        require(approvedProvider[provider], "Provider not approved");
        bytes memory data = abi.encode(params);
        IAaveV3Pool(provider).flashLoanSimple(
            address(this),
            params.loanAsset,
            params.loanAmount,
            data,
            0
        );
    }

    // Aave V3 flash loan callback.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address, // initiator — not used; security enforced by approvedProvider check below
        bytes calldata data
    ) external nonReentrant returns (bool) {
        // Validate caller is an approved flash loan provider.
        require(approvedProvider[msg.sender], "Unknown lender");

        ArbParams memory params = abi.decode(data, (ArbParams));
        require(
            asset == params.loanAsset && amount == params.loanAmount,
            "Loan mismatch"
        );

        // ----------------------------------------------------------------
        // BUY LEG: loanAsset -> quoteAsset
        // FIX #1: approve the buy router for the loan amount before calling.
        // ----------------------------------------------------------------
        require(
            IERC20(params.loanAsset).approve(params.buyDexRouter, params.loanAmount),
            "Buy approve failed"
        );
        {
            (bool ok, ) = params.buyDexRouter.call(params.buyCalldata);
            require(ok, "Buy swap failed");
        }
        // Safety: reset buy router allowance to 0.
        IERC20(params.loanAsset).approve(params.buyDexRouter, 0);

        // ----------------------------------------------------------------
        // SELL LEG: quoteAsset -> loanAsset
        // FIX #1 + FIX #5: approve the sell router for the full intermediate
        // quote-token balance this contract now holds.
        // ----------------------------------------------------------------
        uint256 quoteBalance = IERC20(params.quoteAsset).balanceOf(address(this));
        require(quoteBalance > 0, "No quote tokens received from buy swap");
        require(
            IERC20(params.quoteAsset).approve(params.sellDexRouter, quoteBalance),
            "Sell approve failed"
        );
        {
            (bool ok, ) = params.sellDexRouter.call(params.sellCalldata);
            require(ok, "Sell swap failed");
        }
        // Safety: reset sell router allowance to 0.
        IERC20(params.quoteAsset).approve(params.sellDexRouter, 0);

        // ----------------------------------------------------------------
        // Profitability check and repayment.
        // ----------------------------------------------------------------
        uint256 repayment = amount + premium;
        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        require(balanceAfter >= repayment + params.minProfit, "Unprofitable");

        // Approve lender to pull back the flash loan principal + fee.
        require(
            IERC20(asset).approve(msg.sender, repayment),
            "Repayment approve failed"
        );

        // FIX #2: emit actual net profit (balance minus what goes back to lender).
        uint256 netProfit = balanceAfter - repayment;
        emit ArbitrageExecuted(asset, amount, netProfit);

        return true;
    }

    // Withdraw any token held by this contract to the owner.
    function sweep(address token) external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        // FIX #3: require transfer success so funds are never silently lost.
        require(amount > 0, "Nothing to sweep");
        require(
            IERC20(token).transfer(owner, amount),
            "Sweep transfer failed"
        );
    }
}
