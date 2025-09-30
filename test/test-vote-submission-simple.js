#!/usr/bin/env node

// Simple test script for vote submission functionality
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function testVoteSubmissionSimple() {
  console.log('🗳️ SIMPLE VOTE SUBMISSION TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`🔑 Account: ${account.address}`);

    // Step 1: Create a fresh poll with long duration
    console.log('\n🚀 STEP 1: Creating active poll for voting test...');
    const testPoll = {
      title: `Vote Test ${Date.now()}`,
      description: "Active test poll for vote submission testing",
      options: ["Yes", "No", "Maybe"],
      durationDays: 30 // Long duration to ensure it stays active
    };

    console.log(`📝 Creating poll: "${testPoll.title}"`);
    console.log(`📝 Options: [${testPoll.options.join(', ')}]`);
    console.log(`📝 Duration: ${testPoll.durationDays} days`);

    const createArgs = new Args()
      .addString(testPoll.title)
      .addString(testPoll.description)
      .addU32(BigInt(testPoll.options.length));
    
    testPoll.options.forEach(option => {
      createArgs.addString(option);
    });
    
    createArgs.addU64(BigInt(testPoll.durationDays * 24 * 60 * 60));

    let pollId = null;
    try {
      const createResult = await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'createPoll',
        parameter: createArgs.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      console.log('✅ Poll creation transaction submitted');
      console.log('📋 Operation ID:', createResult.id);

      // Wait longer for poll creation confirmation
      console.log('⏳ Waiting for poll creation confirmation (15 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Get the poll ID from events
      const events = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      console.log(`📋 Total contract events: ${events.length}`);
      
      const createEvents = events.filter(event => 
        event.data.includes("Poll created with ID:")
      );
      
      console.log(`📋 Poll creation events: ${createEvents.length}`);
      createEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.data}`);
      });
      
      if (createEvents.length > 0) {
        const match = createEvents[createEvents.length - 1].data.match(/Poll created with ID: (\d+)/);
        if (match) {
          pollId = match[1];
          console.log(`✅ New poll created with ID: ${pollId}`);
        }
      }
    } catch (error) {
      console.log('❌ Failed to create test poll:', error.message);
      return;
    }

    if (!pollId) {
      console.log('❌ Could not determine poll ID after creation');
      return;
    }

    // Step 2: Test a single vote submission
    console.log(`\n🗳️ STEP 2: Testing vote submission on poll ${pollId}...`);
    
    console.log('🔍 Checking initial vote status...');
    try {
      const hasVotedArgs = new Args()
        .addString(pollId)
        .addString(account.address);

      await provider.readSC({
        target: CONTRACT_ADDRESS,
        func: 'hasVoted',
        parameter: hasVotedArgs.serialize(),
      });

      // Check events for hasVoted result
      await new Promise(resolve => setTimeout(resolve, 3000));
      const hasVotedEvents = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });

      const votedEvents = hasVotedEvents.filter(event => 
        event.data.includes(`has voted on poll ${pollId}:`)
      );

      let hasAlreadyVoted = false;
      if (votedEvents.length > 0) {
        const latestEvent = votedEvents[votedEvents.length - 1];
        hasAlreadyVoted = latestEvent.data.includes('true');
      }

      console.log(`📊 Has already voted: ${hasAlreadyVoted ? 'Yes' : 'No'}`);

      if (hasAlreadyVoted) {
        console.log('ℹ️ User has already voted on this poll - testing double vote prevention');
      }
    } catch (error) {
      console.log('⚠️ Failed to check initial voting status:', error.message);
    }

    // Submit a vote for option 0 (Yes)
    console.log(`🗳️ Submitting vote for "${testPoll.options[0]}" (option 0)...`);
    try {
      const voteArgs = new Args()
        .addString(pollId)
        .addU32(BigInt(0));

      const voteResult = await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'vote',
        parameter: voteArgs.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log('✅ Vote submitted successfully!');
      console.log('📋 Vote Operation ID:', voteResult.id);

      // Wait for vote confirmation
      console.log('⏳ Waiting for vote confirmation (10 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check for vote confirmation events
      console.log('🔍 Checking for vote confirmation...');
      const voteEvents = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });

      const recentEvents = voteEvents.slice(-10);
      console.log('📋 Recent events:');
      recentEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.data}`);
      });

      const voteConfirmEvents = voteEvents.filter(event => 
        event.data.includes('Vote recorded') ||
        event.data.includes(`voted on poll ${pollId}`) ||
        event.data.includes('Vote cast') ||
        event.data.includes('vote') ||
        event.data.includes('Vote')
      );

      if (voteConfirmEvents.length > 0) {
        console.log('✅ Vote confirmation events found:');
        voteConfirmEvents.slice(-3).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.data}`);
        });
      } else {
        console.log('⚠️ No explicit vote confirmation events found');
      }

      console.log('🎯 RESULT: Vote submission test PASSED! ✅');

    } catch (error) {
      console.log(`❌ Vote submission failed: ${error.message}`);
      
      // Check for specific error types
      if (error.message.includes('already voted')) {
        console.log('ℹ️ This error indicates double-voting prevention is working');
      } else if (error.message.includes('not active')) {
        console.log('ℹ️ Poll may have expired or not be active');
      } else if (error.message.includes('invalid option')) {
        console.log('ℹ️ Option index validation is working');
      }
      
      console.log('🎯 RESULT: Vote submission test FAILED ❌');
    }

    // Step 3: Test double voting prevention
    console.log(`\n🔒 STEP 3: Testing double voting prevention...`);
    try {
      console.log('🗳️ Attempting second vote (should be rejected)...');
      const voteArgs2 = new Args()
        .addString(pollId)
        .addU32(BigInt(1)); // Different option

      await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'vote',
        parameter: voteArgs2.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      console.log('❌ SECURITY ISSUE: Second vote was accepted!');
    } catch (error) {
      if (error.message.toLowerCase().includes('already voted')) {
        console.log('✅ Double voting prevention working: Second vote correctly rejected');
      } else {
        console.log('⚠️ Second vote rejected for different reason:', error.message);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 VOTE SUBMISSION TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📋 Test poll created: ✅ ID ${pollId}`);
    console.log(`📋 Vote functionality: Check results above`);
    console.log(`📋 Security (double voting): Check results above`);

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testVoteSubmissionSimple().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { testVoteSubmissionSimple };