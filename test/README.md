# Contract Data Flow Testing

This directory contains comprehensive tests to verify that poll data is correctly stored in and retrieved from the smart contract.

## Problem Statement

The frontend creates polls using `CreatePoll.tsx`, but when retrieving polls via `PollsApp.tsx`, the actual submitted values (title, description, options) are not being displayed correctly. These tests help identify whether the issue is:

1. **Contract Storage Issue**: Data not being stored correctly in the contract
2. **Contract Retrieval Issue**: Data not being retrieved correctly from the contract
3. **Frontend Parsing Issue**: Data being retrieved but not parsed correctly by the frontend
4. **Event Handling Issue**: Contract events not being emitted or captured properly

## Test Scripts

### 1. `test-contract-data-flow.js`
**Purpose**: End-to-end test that creates polls and immediately verifies the data can be retrieved correctly.

**What it tests**:
- Creates 3 different test polls with varied titles, descriptions, and options
- Waits for blockchain confirmation
- Retrieves each poll individually using the same logic as the contract
- Compares input data vs retrieved data field by field
- Provides detailed pass/fail analysis

**Usage**:
```bash
npm run test:contract-flow
```

### 2. `debug-frontend-retrieval.js`
**Purpose**: Replicates the exact same retrieval logic used by `PollsApp.tsx` to debug frontend issues.

**What it tests**:
- Uses the same `getAllPolls()` logic as `contractInteraction.ts`
- Shows all contract events for debugging
- Demonstrates the data parsing process step by step
- Helps identify where the frontend logic breaks down

**Usage**:
```bash
npm run test:debug-retrieval
```

### 3. Run Both Tests
```bash
npm run test:all
```

## Setup Requirements

### 1. Environment Variables
Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
PRIVATE_KEY=your_massa_wallet_private_key
VITE_POLLS_CONTRACT_ADDRESS=your_deployed_contract_address
```

### 2. Wallet Setup
- Make sure your wallet has sufficient MASSA tokens for transaction fees
- The private key should correspond to a Massa buildnet wallet
- You can get buildnet tokens from the Massa faucet

### 3. Contract Deployment
- Ensure your contract is deployed and the address is correct in `.env`
- The contract should be deployed on Massa buildnet

## Expected Test Results

### ✅ **PASS Scenario**
If the contract is working correctly, you should see:

```
🧪 TEST 1: "What is your favorite programming language?"
📝 STEP 1: Creating poll...
✅ Poll creation transaction successful!
✅ Found poll ID: 1
📊 STEP 3: Retrieving poll data for ID 1...
✅ Successfully retrieved poll data from contract!
📊 DATA COMPARISON:
📝 Title:
   Input:     "What is your favorite programming language?"
   Retrieved: "What is your favorite programming language?"
   Match: ✅ YES
📄 Description:
   Input:     "Vote for the programming language you enjoy working with the most..."
   Retrieved: "Vote for the programming language you enjoy working with the most..."
   Match: ✅ YES
📋 Options:
   Input:     ["JavaScript/TypeScript", "Python", "Rust", "Go", "Java"]
   Retrieved: ["JavaScript/TypeScript", "Python", "Rust", "Go", "Java"]
   Match: ✅ YES
🎯 OVERALL RESULT: ✅ PASS - All data matches!
```

### ❌ **FAIL Scenarios**

#### Scenario A: Contract Storage Issue
```
📝 Title:
   Input:     "What is your favorite programming language?"
   Retrieved: "Poll #1"
   Match: ❌ NO
```
*This indicates the contract is not storing the actual submitted data.*

#### Scenario B: Event Parsing Issue
```
❌ Failed to retrieve poll data from contract
📋 Found 0 poll data events
```
*This indicates the contract events are not being emitted or captured correctly.*

#### Scenario C: Data Serialization Issue
```
⚠️ Invalid poll data format: expected 9+ parts, got 3
❌ Failed to parse poll data from event
```
*This indicates the serialization format doesn't match expectations.*

## Troubleshooting

### Common Issues

1. **"Contract does not exist"**
   - Check the contract address in `.env`
   - Verify the contract is deployed on buildnet
   - Use the block explorer to confirm contract existence

2. **"Insufficient balance"**
   - Add MASSA tokens to your wallet
   - Use the Massa buildnet faucet

3. **"No events found"**
   - Wait longer for blockchain confirmation
   - Check if the contract functions are emitting events correctly
   - Verify the event filtering logic

4. **"Failed to parse event data"**
   - Check the serialization format in the contract
   - Verify the parsing logic matches the contract's format
   - Look at raw event data to understand the actual format

### Debug Steps

1. **Run the debug script first**:
   ```bash
   npm run test:debug-retrieval
   ```
   This shows all events and parsing attempts.

2. **Check the contract on the explorer**:
   Visit `https://buildnet-explorer.massa.net/address/YOUR_CONTRACT_ADDRESS`

3. **Review the console logs**:
   Both scripts provide detailed logging at each step.

4. **Compare with working contract tests**:
   Look at the contract's own test files in `/Users/east/workspace/massa/mpolls-contract/test/`

## Next Steps Based on Results

### If Tests PASS ✅
The contract is working correctly. The issue is likely in:
- Frontend state management
- React component rendering
- Data transformation between contract and UI

### If Tests FAIL ❌
The issue is in the contract or retrieval logic:
- Check smart contract serialization format
- Verify event emission in contract functions
- Review parameter encoding/decoding
- Check blockchain transaction confirmation timing

## Files Modified for Testing

The test scripts replicate the logic from these frontend files:
- `src/utils/contractInteraction.ts` - Contract interaction logic
- `src/PollsApp.tsx` - Poll retrieval and display
- `src/CreatePoll.tsx` - Poll creation form

This ensures the tests accurately reflect the actual frontend behavior.