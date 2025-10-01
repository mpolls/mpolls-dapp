# MPOLLS Token Minting Page - Setup Guide

## Overview

The Token Minting Page is a web interface for managing MPOLLS tokens. It allows administrators and minters to:
- Mint new MPOLLS tokens
- Transfer tokens between addresses
- Burn tokens to reduce supply
- Grant/revoke minter roles
- View token balances and information

## Prerequisites

1. **Token Contract Deployed**: You must have deployed the MPOLLS token contract
   - Contract location: `../mpolls-contract/assembly/contracts/token.ts`
   - See `../mpolls-contract/MPOLLS_TOKEN.md` for deployment instructions

2. **Wallet**: You need a Massa wallet (MassaStation or Bearby)
   - Must have MASSA tokens for transaction fees
   - Must have minter role to mint tokens (granted by contract owner)

## Setup Instructions

### Step 1: Deploy the Token Contract

First, deploy the token contract from the contract repository:

```bash
cd ../mpolls-contract

# Build the contracts
npm run build

# Deploy the token contract
massa-client deploy_sc \
  --path build/token.wasm \
  --parameter "" \
  --coins 0
```

Save the deployed contract address (starts with "AS").

### Step 2: Configure the Frontend

Add the token contract address to your `.env.local` file:

```bash
cd ../mpolls-dapp

# Edit .env.local
nano .env.local
```

Add or update the line:
```
VITE_TOKEN_CONTRACT_ADDRESS=AS1234...YourTokenAddress
```

### Step 3: Grant Minter Role (Optional)

If you want to mint tokens from the frontend, you need minter role. The contract owner can grant this:

```javascript
// Using massa-web3 or the frontend after owner connects
await tokenContract.grantMinterRole("<YOUR_WALLET_ADDRESS>");
```

Or set it during initial setup:

```javascript
// Grant minter role to polls contract (for automatic rewards)
await tokenContract.grantMinterRole("<POLLS_CONTRACT_ADDRESS>");
```

### Step 4: Start the Development Server

```bash
npm run dev
```

Navigate to the "Tokens" tab in the bottom navigation.

## Features

### 1. **Wallet Connection**
- Click "Connect Wallet" to connect your Massa wallet
- Supports MassaStation and Bearby wallets
- Displays wallet address and minter status

### 2. **Token Information**
- View token name, symbol, and decimals
- Check your token balance
- View total supply

### 3. **Mint Tokens** (Minter Role Required)
- Enter recipient address (can be your own or another address)
- Enter amount in MPOLLS (e.g., "100" for 100 tokens)
- Click "Mint Tokens"
- Wait for blockchain confirmation

### 4. **Transfer Tokens**
- Send your MPOLLS tokens to another address
- Enter recipient address
- Enter amount to transfer
- Requires sufficient balance

### 5. **Burn Tokens**
- Permanently remove tokens from circulation
- Enter amount to burn
- This reduces total supply
- Cannot be undone!

### 6. **Grant Minter Role** (Owner Only)
- Grant minting permission to other addresses
- Enter the address to grant permission
- Useful for:
  - Granting to the polls contract for automatic rewards
  - Granting to trusted administrators
  - Granting to reward distribution contracts

## Usage Examples

### Minting Rewards for Users

If you want to reward users manually:

1. Connect your wallet (ensure you have minter role)
2. Navigate to "Mint Tokens" section
3. Enter user's address: `AU1xxxxxxxxxxxxx`
4. Enter amount: `50` (for 50 MPOLLS)
5. Click "Mint Tokens"
6. Confirm transaction in wallet

### Setting Up Automatic Rewards

To enable automatic poll rewards:

1. Deploy both token and polls contracts
2. Set token contract in polls contract:
   ```javascript
   await pollsContract.setTokenContract("<TOKEN_CONTRACT_ADDRESS>");
   ```
3. Grant minter role to polls contract:
   ```javascript
   await tokenContract.grantMinterRole("<POLLS_CONTRACT_ADDRESS>");
   ```
4. Enable rewards in polls contract:
   ```javascript
   await pollsContract.enableRewards();
   ```

Now users will automatically receive MPOLLS tokens when:
- Creating polls (default: 50 MPOLLS)
- Voting on polls (default: 10 MPOLLS)

### Distributing Initial Tokens

To distribute initial tokens to team or early supporters:

1. Create a list of addresses and amounts
2. Use the mint function for each recipient:
   - Recipient: `AU1111...`
   - Amount: `1000`
3. Repeat for each recipient

Or use the `rewardBatch` function in the contract for bulk minting (requires direct contract interaction).

## Token Decimals

MPOLLS uses 9 decimals (like Massa):
- Displayed amount: `100 MPOLLS`
- Actual amount in contract: `100000000000` (100 × 10^9)

The frontend automatically handles conversion, so you can work with normal numbers.

## Security Considerations

### 1. **Minter Role Management**
- Only grant minter role to trusted addresses
- The contract owner can revoke minter role at any time
- Consider using a multisig wallet for the owner account in production

### 2. **Token Supply**
- Initial supply: 1 billion MPOLLS
- Minting increases total supply
- Burning decreases total supply
- Monitor total supply to prevent excessive inflation

### 3. **Wallet Security**
- Never share your private key
- Double-check addresses before minting or transferring
- Start with small test amounts
- Use hardware wallets for production

## Troubleshooting

### "Token contract address not configured"
- Make sure `VITE_TOKEN_CONTRACT_ADDRESS` is set in `.env.local`
- Restart the dev server after changing `.env.local`

### "You do not have minter role"
- Ask the contract owner to grant you minter role
- Verify you're connected with the correct wallet

### "Failed to mint tokens"
- Ensure you have sufficient MASSA for transaction fees (0.01 MASSA)
- Check that the recipient address is valid (starts with "AU")
- Verify the contract is deployed correctly

### "Insufficient balance to burn"
- You can only burn tokens you own
- Check your balance before attempting to burn

## Contract Addresses

After deployment, document your contract addresses:

- **Token Contract**: `AS1234...` (Add from deployment)
- **Polls Contract**: `AS12VEN7P9TPkXc4a56RJ6NXkr2cSfXX5zGvsDW1VyC1gBZeTjHgp`
- **Network**: Massa Buildnet
- **Explorer**: `https://buildnet-explorer.massa.net`

## Next Steps

1. **Deploy Token Contract**: Follow the deployment guide in `../mpolls-contract/MPOLLS_TOKEN.md`
2. **Configure Integration**: Connect token contract with polls contract
3. **Enable Rewards**: Activate the reward system
4. **Test**: Mint test tokens and verify functionality
5. **Launch**: Announce token to your community

## Support

For issues or questions:
- Check the main token documentation: `../mpolls-contract/MPOLLS_TOKEN.md`
- Review the contract code: `../mpolls-contract/assembly/contracts/token.ts`
- Create an issue in the repository

## License

MIT License - See LICENSE file for details
