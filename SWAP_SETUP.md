# MPOLLS Swap Contract Setup Guide

This guide explains how to deploy and use the new MPOLLS/MASSA swap contract with a 2.5% spread.

## Overview

The swap contract implements an Automated Market Maker (AMM) with a constant product formula (x × y = k) for trading MPOLLS and MASSA tokens. Key features:

- **Two-way trading**: Swap MASSA → MPOLLS or MPOLLS → MASSA
- **2.5% spread**: Applied to all swaps for liquidity providers
- **Decentralized**: No intermediaries, fully on-chain
- **Transparent pricing**: Real-time quotes based on pool reserves

## Contract Structure

### New Files Created

**Contract Files:**
- `/Users/east/workspace/massa/mpolls-contract/assembly/contracts/swap.ts` - Main swap contract
- `/Users/east/workspace/massa/mpolls-contract/test/deploy-swap.js` - Deployment script

**DApp Files:**
- `/Users/east/workspace/massa/mpolls-dapp/src/SwapPage.tsx` - Swap UI component
- `/Users/east/workspace/massa/mpolls-dapp/src/SwapPage.css` - Swap page styles
- `/Users/east/workspace/massa/mpolls-dapp/src/utils/swapContract.ts` - Contract interaction utility

## Deployment Steps

### 1. Build the Contracts

```bash
cd /Users/east/workspace/massa/mpolls-contract
npm run build
```

This will compile both the token and swap contracts to WASM bytecode.

### 2. Deploy Token Contract (if not already deployed)

```bash
npm run deploy-token
```

Save the deployed token contract address.

### 3. Set Up Environment Variables

In `/Users/east/workspace/massa/mpolls-contract/.env`:
```env
PRIVATE_KEY=your_private_key_here
TOKEN_CONTRACT_ADDRESS=AS1xxx...  # From step 2
```

### 4. Deploy Swap Contract

```bash
npm run deploy-swap
```

Save the deployed swap contract address.

### 5. Configure DApp Environment

In `/Users/east/workspace/massa/mpolls-dapp/.env.local`:
```env
VITE_TOKEN_CONTRACT_ADDRESS=AS1xxx...  # Token contract address
VITE_SWAP_CONTRACT_ADDRESS=AS1xxx...  # Swap contract address
```

### 6. Grant Permissions

The swap contract needs permission to transfer MPOLLS tokens. You need to:

a. **Approve the swap contract on the token contract:**
   - Use the token contract's `approve` function
   - Spender: Swap contract address
   - Amount: Large number (e.g., 1,000,000,000 MPOLLS in smallest units)

b. **Grant minter role to polls contract (optional, for rewards):**
   ```bash
   # From token manager page in the DApp
   # Or via script
   ```

### 7. Add Initial Liquidity

The swap contract needs initial liquidity to function. As the owner:

a. **Approve MPOLLS tokens for the swap contract** (see step 6a)

b. **Add liquidity:**
   - Call `addLiquidity` on the swap contract
   - Send MASSA with the transaction
   - Specify MPOLLS amount in the arguments

Example:
- MASSA: 100 MASSA (sent with transaction)
- MPOLLS: 10,000 MPOLLS (in arguments)
- This sets initial rate: 1 MASSA ≈ 100 MPOLLS

## Contract Functions

### Swap Functions

**`swapMassaForMpolls()`**
- Swap MASSA for MPOLLS tokens
- Send MASSA coins with the transaction
- No parameters needed

**`swapMpollsForMassa(mpollsAmount: u64)`**
- Swap MPOLLS for MASSA tokens
- Parameters: Amount of MPOLLS to swap (in smallest units)

### Quote Functions

**`getQuoteMassaToMpolls(massaAmount: u64)`**
- Get quote for swapping MASSA to MPOLLS
- Returns expected output amount

**`getQuoteMpollsToMassa(mpollsAmount: u64)`**
- Get quote for swapping MPOLLS to MASSA
- Returns expected output amount

### Pool Management (Owner Only)

**`addLiquidity(mpollsAmount: u64)`**
- Add liquidity to the pool
- Send MASSA with transaction
- Specify MPOLLS amount in parameters

**`removeLiquidity(massaAmount: u64, mpollsAmount: u64)`**
- Remove liquidity from the pool
- Transfers tokens back to owner

**`getReserves()`**
- Get current pool reserves
- Returns MASSA and MPOLLS reserve amounts

**`getPoolStats()`**
- Get detailed pool statistics
- Returns reserves, total volume, and spread percentage

### Admin Functions

**`pause()` / `unpause()`**
- Pause/unpause swapping (owner only)
- Pool management still works when paused

**`transferOwnership(newOwner: string)`**
- Transfer contract ownership

## Using the Swap Page

### Accessing the Swap Page

1. Navigate to the DApp
2. Connect your wallet
3. Click on "Swap" in the bottom navigation
4. Or click "Open Swap Page" from the Token Manager

### Trading

1. **Select Direction:**
   - Click the swap icon to switch between MASSA → MPOLLS and MPOLLS → MASSA

2. **Enter Amount:**
   - Input the amount you want to swap
   - Output amount is calculated automatically

3. **Review:**
   - Check the price impact
   - Review the output amount
   - Verify pool reserves

4. **Execute Swap:**
   - Click "Swap" button
   - Confirm transaction in wallet
   - Wait for confirmation

## Pricing Formula

The swap uses a constant product AMM formula:

```
x * y = k

Where:
- x = MASSA reserve
- y = MPOLLS reserve
- k = constant (product of reserves)

Output calculation with 2.5% spread:
1. Apply spread: inputAfterSpread = input * 0.975
2. Calculate output: output = (outputReserve * inputAfterSpread) / (inputReserve + inputAfterSpread)
```

### Price Impact

Price impact increases with larger swaps relative to pool size:
- Small swaps: ~2.5% (just the spread)
- Large swaps: Higher due to slippage

Formula:
```
Price Impact = |(currentPrice - effectivePrice) / currentPrice| * 100
```

## Security Considerations

1. **Slippage Protection**: Large swaps will have high price impact
2. **Spread**: 2.5% spread applies to all swaps
3. **Liquidity**: More liquidity = less price impact
4. **Owner Powers**: Owner can pause swaps and manage liquidity
5. **Approval Required**: Users must approve MPOLLS before swapping MPOLLS → MASSA

## Monitoring

### Pool Health Metrics

- **Reserves**: Check `getReserves()` for current liquidity
- **Volume**: Track total volume via `getPoolStats()`
- **Rate**: Current exchange rate = mpollsReserve / massaReserve

### Events

The contract emits events for:
- Swaps (direction, amounts, user)
- Liquidity changes
- Admin actions (pause, ownership transfer)

## Troubleshooting

### Common Issues

**"Insufficient liquidity" error:**
- Pool needs more liquidity
- Owner should add liquidity via `addLiquidity()`

**"Insufficient allowance" error (MPOLLS → MASSA):**
- User needs to approve swap contract on token contract
- Use token contract's `approve()` function

**"Contract is paused" error:**
- Owner has paused the contract
- Wait for unpause or contact owner

**"Output amount too small" error:**
- Swap amount is too small
- Try increasing the input amount

## Next Steps

1. **Deploy Contracts**: Follow deployment steps above
2. **Add Liquidity**: Provide initial liquidity to the pool
3. **Test Swaps**: Try small swaps in both directions
4. **Monitor**: Watch pool metrics and adjust liquidity as needed
5. **Iterate**: Based on usage, adjust parameters or add features

## Support

For questions or issues:
- Check contract events for error details
- Review transaction logs on Massa explorer
- Verify environment variables are set correctly
- Ensure wallet has sufficient balance for gas fees
