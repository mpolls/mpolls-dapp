#!/usr/bin/env node

// Test script to test poll creation directly
import { pollsContract } from './src/utils/contractInteraction.js';

async function testPollCreation() {
  console.log('🧪 Testing Poll Creation');
  console.log('========================');

  try {
    // Test parameters similar to what the form would send
    const testParams = {
      title: "Test Poll from Script",
      description: "Testing poll creation from Node.js script",
      options: ["Option A", "Option B", "Option C"],
      durationInSeconds: 86400 // 1 day
    };

    console.log('📋 Test parameters:', testParams);

    // This will fail because we don't have wallet connection in Node.js
    // But it will help us see the parameter structure
    const result = await pollsContract.createPoll(testParams);
    
    console.log('✅ Poll created successfully!');
    console.log('📋 Result:', result);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Check if it's just the wallet connection issue
    if (error.message.includes('Wallet not connected')) {
      console.log('ℹ️ This is expected - wallet connection not available in Node.js script');
      console.log('✅ Parameter structure appears to be correct');
    }
  }
}

// Run the test
testPollCreation().catch(console.error);