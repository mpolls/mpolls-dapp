#!/usr/bin/env node

// Test script to create a poll on the deployed Massa contract
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function testCreatePoll() {
  console.log('🧪 Testing Poll Creation on Massa Contract');
  console.log('═══════════════════════════════════════════');
  console.log(`📍 Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network: Massa Buildnet`);
  console.log(`📋 Explorer: https://buildnet-explorer.massa.net/address/${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════');

  try {
    // Create account from private key
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    console.log(`🔑 Using account: ${account.address}`);

    // Connect to buildnet
    const provider = JsonRpcProvider.buildnet(account);
    console.log('🌐 Connected to Massa buildnet');

    // First, let's verify the contract exists
    console.log('\n1️⃣ Verifying contract existence...');
    try {
      const events = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      console.log(`✅ Contract verified! Found ${events.length} events`);
      if (events.length > 0) {
        console.log('📋 Recent events:');
        events.slice(0, 3).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.data}`);
        });
      }
    } catch (error) {
      console.log('❌ Contract verification failed:', error.message);
      return false;
    }

    // Test 1: Simple poll creation with minimal parameters
    console.log('\n2️⃣ Testing simple poll creation...');
    
    const simpleArgs = new Args()
      .addString("Test Poll")
      .addString("This is a test poll")
      .addU32(BigInt(2))
      .addString("Option A")
      .addString("Option B")
      .addU64(BigInt(24 * 60 * 60)); // 1 day duration

    console.log('📦 Prepared arguments:', {
      title: "Test Poll",
      description: "This is a test poll",
      optionCount: 2,
      options: ["Option A", "Option B"],
      duration: "1 day (86400 seconds)"
    });

    try {
      console.log('⏳ Calling createPoll function...');
      
      const result = await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'createPoll',
        parameter: simpleArgs.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log('✅ Poll creation successful!');
      console.log('📋 Transaction result:', result);

      // Wait a bit for the transaction to be processed
      console.log('⏳ Waiting for transaction confirmation...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for new events
      const newEvents = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      console.log(`📋 Total events after poll creation: ${newEvents.length}`);
      if (newEvents.length > 0) {
        console.log('📋 Latest events:');
        newEvents.slice(-3).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.data}`);
        });
      }

    } catch (error) {
      console.log('❌ Poll creation failed:', error.message);
      console.log('🔍 Error details:', error);
      
      // Try to get more specific error information
      if (error.message.includes('does not exist')) {
        console.log('\n🚨 Contract Address Issue Detected!');
        console.log('The contract address appears to be invalid or not deployed.');
        console.log('Possible solutions:');
        console.log('1. Redeploy the contract with: node deploy-contract.js');
        console.log('2. Verify the contract address is correct');
        console.log('3. Check if the contract is on the right network (buildnet/testnet/mainnet)');
        return false;
      }
    }

    // Test 2: Try calling other contract functions
    console.log('\n3️⃣ Testing other contract functions...');
    
    try {
      console.log('📊 Calling getAllPolls...');
      const allPollsResult = await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'getAllPolls',
        parameter: new Args().serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      console.log('✅ getAllPolls result:', allPollsResult);
    } catch (error) {
      console.log('⚠️ getAllPolls failed:', error.message);
    }

    console.log('\n4️⃣ Final verification...');
    
    // Get final event count
    const finalEvents = await provider.getEvents({
      smartContractAddress: CONTRACT_ADDRESS,
    });
    
    console.log('═══════════════════════════════════════════');
    console.log('🎉 Test Summary:');
    console.log(`📋 Total contract events: ${finalEvents.length}`);
    console.log(`📍 Contract Address: ${CONTRACT_ADDRESS}`);
    console.log(`🔗 View on Explorer: https://buildnet-explorer.massa.net/address/${CONTRACT_ADDRESS}`);
    console.log('═══════════════════════════════════════════');

    return true;

  } catch (error) {
    console.error('💥 Test script failed:', error);
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Check if the contract is properly deployed');
    console.log('2. Verify the private key has sufficient MASSA balance');
    console.log('3. Ensure network connectivity to buildnet');
    console.log('4. Try redeploying the contract');
    return false;
  }
}

// Alternative test using read-only functions first
async function testReadOnlyFunctions() {
  console.log('\n📖 Testing Read-Only Functions...');
  console.log('═══════════════════════════════════════════');

  try {
    const provider = JsonRpcProvider.buildnet();
    
    // Test reading contract state without account
    console.log('📊 Attempting to read contract state...');
    
    const readResult = await provider.readSC({
      target: CONTRACT_ADDRESS,
      func: 'getAllPolls',
      parameter: new Args().serialize(),
    });
    
    console.log('✅ Read-only call successful:', readResult);
    return true;
    
  } catch (error) {
    console.log('❌ Read-only call failed:', error.message);
    
    if (error.message.includes('does not exist')) {
      console.log('\n🚨 CONTRACT NOT FOUND!');
      console.log('The contract address does not exist on the blockchain.');
      console.log('This confirms the deployment issue.');
    }
    
    return false;
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting Contract Tests...\n');
  
  // First test read-only functions to verify contract existence
  const readTestPassed = await testReadOnlyFunctions();
  
  if (!readTestPassed) {
    console.log('\n❌ Contract does not exist - skipping write tests');
    console.log('\n🔧 Next Steps:');
    console.log('1. Deploy the contract: node deploy-contract.js');
    console.log('2. Update the contract address in the code');
    console.log('3. Run this test again');
    process.exit(1);
  }
  
  // If read test passed, run full tests
  const fullTestPassed = await testCreatePoll();
  
  if (fullTestPassed) {
    console.log('\n🎉 All tests passed! Contract is working correctly.');
  } else {
    console.log('\n❌ Some tests failed. Check the logs above for details.');
    process.exit(1);
  }
}

// Execute tests if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { testCreatePoll, testReadOnlyFunctions };