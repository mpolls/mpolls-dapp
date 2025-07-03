#!/usr/bin/env node

// Contract verification script for Massa blockchain
import { JsonRpcProvider } from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = 'AS12jYTN2iddXPrUruw65M7imA9nfDaGozXGjtPoi5b456EzegSSa';
const NETWORK = 'buildnet'; // Change to 'mainnet' or 'testnet' as needed

async function verifyContract() {
  console.log('🔍 Verifying contract deployment on Massa blockchain...');
  console.log(`📍 Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network: ${NETWORK}`);
  console.log('─'.repeat(60));

  try {
    // Initialize provider
    const provider = JsonRpcProvider[NETWORK]();
    
    // Method 1: Check if address exists and has bytecode
    console.log('1️⃣ Checking contract existence...');
    try {
      const addressInfo = await provider.getAddresses([CONTRACT_ADDRESS]);
      if (addressInfo && addressInfo.length > 0) {
        console.log('✅ Contract address exists on blockchain');
        console.log(`   Balance: ${addressInfo[0].candidate_balance} MASSA`);
        console.log(`   Final Balance: ${addressInfo[0].final_balance} MASSA`);
      } else {
        console.log('❌ Contract address not found on blockchain');
        return false;
      }
    } catch (error) {
      console.log('❌ Failed to fetch address info:', error.message);
    }

    // Method 2: Try to read contract bytecode
    console.log('\n2️⃣ Checking contract bytecode...');
    try {
      const bytecode = await provider.getScBytecode(CONTRACT_ADDRESS);
      if (bytecode && bytecode.length > 0) {
        console.log('✅ Contract has bytecode (deployed successfully)');
        console.log(`   Bytecode size: ${bytecode.length} bytes`);
      } else {
        console.log('❌ No bytecode found - contract may not be deployed');
        return false;
      }
    } catch (error) {
      console.log('❌ Failed to fetch bytecode:', error.message);
    }

    // Method 3: Check contract events
    console.log('\n3️⃣ Checking contract events...');
    try {
      const events = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      if (events && events.length > 0) {
        console.log(`✅ Found ${events.length} contract events`);
        console.log('   Recent events:');
        events.slice(0, 3).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.data}`);
        });
      } else {
        console.log('ℹ️  No events found (contract might be new or unused)');
      }
    } catch (error) {
      console.log('⚠️  Could not fetch events:', error.message);
    }

    // Method 4: Try to call a read-only function
    console.log('\n4️⃣ Testing contract interaction...');
    try {
      // Try calling getPollCount function
      const result = await provider.readSmartContract({
        target: CONTRACT_ADDRESS,
        func: 'getPollCount',
        parameter: new Uint8Array([]), // Empty parameters
      });
      
      console.log('✅ Contract is callable and responsive');
      console.log(`   getPollCount result: ${result}`);
    } catch (error) {
      console.log('⚠️  Contract call failed:', error.message);
      console.log('   This might be normal if the function doesn\'t exist or requires parameters');
    }

    console.log('\n' + '─'.repeat(60));
    console.log('🎉 Contract verification complete!');
    console.log('🌐 View on Massa Explorer:');
    
    // Provide explorer links for different networks
    const explorerUrls = {
      mainnet: `https://explorer.massa.net/address/${CONTRACT_ADDRESS}`,
      testnet: `https://explorer.testnet.massa.net/address/${CONTRACT_ADDRESS}`,
      buildnet: `https://explorer.buildnet.massa.net/address/${CONTRACT_ADDRESS}`
    };
    
    console.log(`   ${explorerUrls[NETWORK]}`);
    
    return true;

  } catch (error) {
    console.error('💥 Error verifying contract:', error);
    return false;
  }
}

// Run verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyContract()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { verifyContract };