#!/usr/bin/env node

// Test poll creation with corrected timestamp handling
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function testCorrectedPollCreation() {
  console.log('🔧 CORRECTED POLL CREATION TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`🔑 Account: ${account.address}`);

    const currentTimeMs = Date.now();
    const currentTimeSec = Math.floor(currentTimeMs / 1000);

    console.log('\n⏰ TIMESTAMP ANALYSIS:');
    console.log(`   Current time (ms): ${currentTimeMs}`);
    console.log(`   Current time (sec): ${currentTimeSec}`);
    console.log(`   Human readable: ${new Date(currentTimeMs).toISOString()}`);

    // CRITICAL FIX: The issue is likely that we're sending duration in seconds
    // but the contract might be treating it differently, OR there's a bug in the contract
    // Let's test different approaches:

    console.log('\n🚀 APPROACH 1: Create poll with long duration in seconds');
    
    const testPoll1 = {
      title: `Corrected Test Poll ${Date.now()}`,
      description: "Testing with corrected timestamp handling",
      options: ["Yes", "No"],
      durationInSeconds: 7 * 24 * 60 * 60 // 7 days in seconds
    };

    console.log(`📝 Poll details:`);
    console.log(`   Title: "${testPoll1.title}"`);
    console.log(`   Duration: ${testPoll1.durationInSeconds} seconds (${testPoll1.durationInSeconds / 86400} days)`);
    console.log(`   Expected end time: ${new Date(currentTimeMs + (testPoll1.durationInSeconds * 1000)).toISOString()}`);

    const createArgs1 = new Args()
      .addString(testPoll1.title)
      .addString(testPoll1.description)
      .addU32(BigInt(testPoll1.options.length));
    
    testPoll1.options.forEach(option => {
      createArgs1.addString(option);
    });
    
    createArgs1.addU64(BigInt(testPoll1.durationInSeconds));

    let pollId1 = null;
    try {
      const createResult1 = await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'createPoll',
        parameter: createArgs1.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      
      console.log('✅ Poll creation 1 submitted');
      console.log('📋 Operation ID:', createResult1.id);

      // Wait for creation
      console.log('⏳ Waiting for poll creation confirmation...');
      await new Promise(resolve => setTimeout(resolve, 12000));

      // Get poll ID
      const events1 = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      const createEvents1 = events1.filter(event => 
        event.data.includes("Poll created with ID:")
      );
      
      if (createEvents1.length > 0) {
        const match1 = createEvents1[createEvents1.length - 1].data.match(/Poll created with ID: (\d+)/);
        if (match1) {
          pollId1 = match1[1];
          console.log(`✅ Poll created with ID: ${pollId1}`);
        }
      }
      
    } catch (error) {
      console.log('❌ Poll creation 1 failed:', error.message);
    }

    if (pollId1) {
      // Test voting on the newly created poll
      console.log(`\n🗳️ TESTING VOTE ON POLL ${pollId1}:`);
      
      // Wait a moment to ensure the poll is active
      console.log('⏳ Giving the blockchain time to process...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        const voteArgs = new Args()
          .addString(pollId1)
          .addU32(BigInt(0)); // Vote for first option

        console.log(`🗳️ Attempting to vote on poll ${pollId1}...`);
        const voteResult = await provider.callSC({
          target: CONTRACT_ADDRESS,
          func: 'vote',
          parameter: voteArgs.serialize(),
          coins: 0n,
          fee: Mas.fromString('0.01'),
        });

        console.log('✅ VOTE SUCCESSFUL!');
        console.log('📋 Vote Operation ID:', voteResult.id);
        console.log('🎉 TIMESTAMP ISSUE RESOLVED!');

        // Wait for vote confirmation
        await new Promise(resolve => setTimeout(resolve, 8000));

        // Check for vote events
        const voteEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });

        const recentEvents = voteEvents.slice(-5);
        console.log('\n📋 Recent events after vote:');
        recentEvents.forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.data}`);
        });

      } catch (voteError) {
        console.log(`❌ Vote failed: ${voteError.message}`);
        
        if (voteError.message.includes('not active')) {
          console.log('\n🔍 DETAILED ANALYSIS: Poll still showing as inactive');
          console.log('This suggests either:');
          console.log('1. Contract timestamp logic issue');
          console.log('2. Poll creation parameters incorrect');
          console.log('3. Contract bug in activity checking');
          
          // Let's try to understand what's happening by calling getPoll
          console.log('\n🔍 Calling getPoll to debug...');
          try {
            const getPollArgs = new Args().addString(pollId1);
            const getPollResult = await provider.readSC({
              target: CONTRACT_ADDRESS,
              func: 'getPoll',
              parameter: getPollArgs.serialize(),
            });
            
            console.log('✅ getPoll call succeeded');
            if (getPollResult.info && getPollResult.info.events) {
              console.log('📋 getPoll events:');
              getPollResult.info.events.forEach((event, index) => {
                console.log(`   ${index + 1}. ${event.data}`);
              });
            }
          } catch (getPollError) {
            console.log('❌ getPoll failed:', getPollError.message);
          }
          
        } else if (voteError.message.includes('already voted')) {
          console.log('ℹ️ User has already voted - double voting prevention working');
        }
      }
    }

    // Test approach 2: Very long duration
    console.log('\n🚀 APPROACH 2: Create poll with very long duration (1 year)');
    
    const testPoll2 = {
      title: `Long Duration Test ${Date.now()}`,
      description: "Testing with 1 year duration",
      options: ["Option 1", "Option 2"],
      durationInSeconds: 365 * 24 * 60 * 60 // 1 year in seconds
    };

    const createArgs2 = new Args()
      .addString(testPoll2.title)
      .addString(testPoll2.description)
      .addU32(BigInt(testPoll2.options.length));
    
    testPoll2.options.forEach(option => {
      createArgs2.addString(option);
    });
    
    createArgs2.addU64(BigInt(testPoll2.durationInSeconds));

    try {
      const createResult2 = await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'createPoll',
        parameter: createArgs2.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      
      console.log('✅ Long duration poll submitted');
      console.log('📋 Operation ID:', createResult2.id);
      
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Get poll ID
      const events2 = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      const createEvents2 = events2.filter(event => 
        event.data.includes("Poll created with ID:")
      );
      
      if (createEvents2.length > 0) {
        const match2 = createEvents2[createEvents2.length - 1].data.match(/Poll created with ID: (\d+)/);
        if (match2) {
          const pollId2 = match2[1];
          console.log(`✅ Long duration poll created with ID: ${pollId2}`);
          
          // Immediate vote test
          console.log(`🗳️ Testing immediate vote on poll ${pollId2}...`);
          
          try {
            const voteArgs2 = new Args()
              .addString(pollId2)
              .addU32(BigInt(0));

            const voteResult2 = await provider.callSC({
              target: CONTRACT_ADDRESS,
              func: 'vote',
              parameter: voteArgs2.serialize(),
              coins: 0n,
              fee: Mas.fromString('0.01'),
            });

            console.log('✅ IMMEDIATE VOTE SUCCESSFUL!');
            console.log('📋 Vote Operation ID:', voteResult2.id);
            console.log('🎉 PROBLEM SOLVED: Long duration polls work!');

          } catch (immediateVoteError) {
            console.log(`❌ Immediate vote failed: ${immediateVoteError.message}`);
            
            if (immediateVoteError.message.includes('not active')) {
              console.log('🚨 CRITICAL: Even 1-year duration poll is inactive immediately');
              console.log('This indicates a fundamental contract issue with timestamp handling');
            }
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Long duration poll creation failed:', error.message);
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 CORRECTED POLL CREATION RESULTS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📋 Regular duration poll: ${pollId1 ? 'Created' : 'Failed'}`);
    console.log('📋 Vote testing results: See above');
    console.log('\nIf votes are still failing with "not active", the issue is likely:');
    console.log('1. Contract bug in timestamp comparison logic');
    console.log('2. Contract using different time reference than expected');
    console.log('3. Contract state not being updated properly after creation');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCorrectedPollCreation().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { testCorrectedPollCreation };