use anchor_lang::prelude::*;

declare_id!("Arb111111111111111111111111111111111111111");

#[program]
pub mod flash_arb_executor {
    use super::*;

    pub fn execute_arbitrage(
        ctx: Context<ExecuteArbitrage>,
        loan_amount: u64,
        min_profit: u64,
    ) -> Result<()> {
        // Hook point for Solend or Marginfi flash loan CPI.
        // 1) Borrow loan asset
        // 2) Swap on buy DEX CPI route
        // 3) Swap on sell DEX CPI route
        // 4) Repay principal + fee
        // 5) Verify post-trade profit threshold
        let state = &mut ctx.accounts.strategy_state;
        state.last_loan_amount = loan_amount;
        state.last_min_profit = min_profit;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct ExecuteArbitrage<'info> {
    #[account(mut, has_one = authority)]
    pub strategy_state: Account<'info, StrategyState>,
    pub authority: Signer<'info>,
}

#[account]
pub struct StrategyState {
    pub authority: Pubkey,
    pub last_loan_amount: u64,
    pub last_min_profit: u64,
}