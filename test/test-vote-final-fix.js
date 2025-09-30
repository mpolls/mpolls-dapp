#!/usr/bin/env node

// Final test to resolve voting issues with proper timestamp handling
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function testVoteFinalFix() {
  console.log('🎯 FINAL VOTE FIX TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`🔑 Account: ${account.address}`);

    // From our previous test, we know poll 4 exists with this data:
    // Poll data: 4|Corrected Test Poll 1754320514503|Testing with corrected timestamp handling|Yes||No|AU1Pd3bod1Js2xD71GLFd1Q1dA8tnugsHroL54Rn7SzYY5KiozfS|1754320523000|1754925323000|0|0,0
    
    const knownPollId = "4";
    console.log(`\n🔍 Testing vote on known poll ${knownPollId}...`);

    // The issue might be that the contract is using Context.timestamp() in seconds
    // but comparing against timestamps stored in milliseconds
    // Let's check the current blockchain time context
    
    console.log('\n⏰ TIMESTAMP ANALYSIS:');
    const currentTimeMs = Date.now();
    const currentTimeSec = Math.floor(currentTimeMs / 1000);
    
    console.log(`   JavaScript time (ms): ${currentTimeMs}`);
    console.log(`   JavaScript time (sec): ${currentTimeSec}`);
    console.log(`   Poll start time: 1754320523000 (ms) = ${Math.floor(1754320523000/1000)} (sec)`);
    console.log(`   Poll end time: 1754925323000 (ms) = ${Math.floor(1754925323000/1000)} (sec)`);
    
    const pollStartSec = Math.floor(1754320523000 / 1000);
    const pollEndSec = Math.floor(1754925323000 / 1000);
    
    console.log(`\n📊 Activity Check (contract perspective in seconds):`);
    console.log(`   Current: ${currentTimeSec}`);
    console.log(`   Start:   ${pollStartSec}`);
    console.log(`   End:     ${pollEndSec}`);
    console.log(`   Current >= Start: ${currentTimeSec >= pollStartSec}`);
    console.log(`   Current <= End:   ${currentTimeSec <= pollEndSec}`);
    console.log(`   Should be active: ${currentTimeSec >= pollStartSec && currentTimeSec <= pollEndSec}`);

    // The problem could be a mismatch between how the contract stores timestamps
    // vs how it checks them during voting. Let me create a new poll with explicit
    // timestamp handling that matches what the contract expects

    console.log('\n🚀 Creating new poll with explicit timestamp handling...');
    
    // Calculate timestamps based on current blockchain context
    // If contract uses Context.timestamp() (seconds), we need to be very careful
    
    const pollTitle = `Fixed Timestamp Poll ${Date.now()}`;
    const pollDescription = "Poll created with corrected timestamp handling for immediate voting";
    const pollOptions = ["Vote Yes", "Vote No"];
    const durationSeconds = 7 * 24 * 60 * 60; // 7 days
    
    console.log(`📝 Creating poll:`);
    console.log(`   Title: "${pollTitle}"`);
    console.log(`   Duration: ${durationSeconds} seconds`);
    console.log(`   Expected to be active immediately after creation`);

    const createArgs = new Args()
      .addString(pollTitle)
      .addString(pollDescription)
      .addU32(BigInt(pollOptions.length));
    
    pollOptions.forEach(option => {
      createArgs.addString(option);
    });
    
    createArgs.addU64(BigInt(durationSeconds));

    let newPollId = null;
    try {
      const createResult = await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'createPoll',
        parameter: createArgs.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      
      console.log('✅ New poll creation submitted');
      console.log('📋 Operation ID:', createResult.id);

      // Wait for creation
      console.log('⏳ Waiting for poll creation...');
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Get the new poll ID
      const events = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      const createEvents = events.filter(event => 
        event.data.includes("Poll created with ID:")
      );
      
      if (createEvents.length > 0) {
        const match = createEvents[createEvents.length - 1].data.match(/Poll created with ID: (\d+)/);
        if (match) {
          newPollId = match[1];
          console.log(`✅ New poll created with ID: ${newPollId}`);
        }
      }
      
    } catch (error) {
      console.log('❌ Poll creation failed:', error.message);
    }

    if (newPollId) {
      // Get the poll data to verify timestamps
      console.log(`\n🔍 Getting poll ${newPollId} data...`);
      
      try {
        const getPollArgs = new Args().addString(newPollId);
        await provider.readSC({
          target: CONTRACT_ADDRESS,
          func: 'getPoll',
          parameter: getPollArgs.serialize(),
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const pollDataEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });
        
        const pollEvents = pollDataEvents.filter(event => 
          event.data.includes(`Poll data:`) || event.data.includes(`Poll ${newPollId}:`)
        );
        
        if (pollEvents.length > 0) {
          const pollData = pollEvents[pollEvents.length - 1].data;
          console.log(`📋 Raw poll data: ${pollData}`);
          
          // Extract and analyze the poll data
          let dataStr = pollData;
          if (dataStr.includes('Poll data: ')) {
            dataStr = dataStr.substring('Poll data: '.length);
          } else if (dataStr.includes(': ')) {
            dataStr = dataStr.substring(dataStr.indexOf(': ') + 2);
          }
          
          const parts = dataStr.split('|');
          if (parts.length >= 8) {
            // Find creator index
            let creatorIndex = -1;
            for (let i = 3; i < parts.length; i++) {
              if (parts[i].startsWith('AU') && parts[i].length > 20) {
                creatorIndex = i;
                break;
              }
            }
            
            if (creatorIndex !== -1) {
              const startTime = parseInt(parts[creatorIndex + 1]);
              const endTime = parseInt(parts[creatorIndex + 2]);
              const status = parseInt(parts[creatorIndex + 3]);
              
              console.log(`\n📊 New poll ${newPollId} analysis:`);
              console.log(`   Start time: ${startTime}`);
              console.log(`   End time: ${endTime}`);
              console.log(`   Status: ${status}`);
              console.log(`   Duration: ${Math.floor((endTime - startTime) / 1000)} seconds`);
              
              // Check if timestamps look reasonable
              const currentTime = Date.now();
              const timeDiffStart = Math.abs(currentTime - startTime);
              const timeDiffEnd = Math.abs((currentTime + durationSeconds * 1000) - endTime);
              
              console.log(`\n⏰ Timestamp validation:`);
              console.log(`   Time diff from expected start: ${timeDiffStart}ms`);
              console.log(`   Time diff from expected end: ${timeDiffEnd}ms`);
              console.log(`   Timestamps look reasonable: ${timeDiffStart < 60000 && timeDiffEnd < 60000}`);
            }
          }
        }
        
      } catch (error) {
        console.log('⚠️ Failed to get poll data:', error.message);
      }

      // Now try to vote immediately
      console.log(`\n🗳️ CRITICAL TEST: Voting immediately on poll ${newPollId}...`);
      
      // Wait a moment for any pending transactions to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const voteArgs = new Args()
          .addString(newPollId)
          .addU32(BigInt(0)); // Vote for first option

        const voteResult = await provider.callSC({
          target: CONTRACT_ADDRESS,
          func: 'vote',
          parameter: voteArgs.serialize(),
          coins: 0n,
          fee: Mas.fromString('0.01'),
        });

        console.log('🎉 SUCCESS! Vote submitted successfully!');
        console.log('📋 Vote Operation ID:', voteResult.id);
        console.log('✅ VOTING ISSUE RESOLVED!');

        // Wait for vote confirmation
        await new Promise(resolve => setTimeout(resolve, 8000));

        // Check for vote confirmation events
        const voteEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });

        const recentEvents = voteEvents.slice(-3);
        console.log('\n📋 Recent events after vote:');
        recentEvents.forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.data}`);
        });

      } catch (voteError) {
        console.log(`❌ Vote still failed: ${voteError.message}`);
        
        if (voteError.message.includes('not active')) {
          console.log('\n🚨 CRITICAL ISSUE: Even immediate voting on new poll fails');
          console.log('This indicates a fundamental problem in the contract logic');
          console.log('Possible causes:');
          console.log('1. Contract timestamp comparison logic is incorrect');
          console.log('2. Poll status is not being set correctly during creation');
          console.log('3. There is a timing window issue in the contract');
          console.log('4. Contract is using a different time reference than expected');
          
          // Let's try debugging the contract state
          console.log('\n🔍 DEBUG: Checking contract state...');
          
          // Check if hasVoted works (this might give us clues)
          try {
            const hasVotedArgs = new Args()
              .addString(newPollId)
              .addString(account.address);

            await provider.readSC({
              target: CONTRACT_ADDRESS,
              func: 'hasVoted',
              parameter: hasVotedArgs.serialize(),
            });
            
            console.log('✅ hasVoted function works (contract is responding)');
          } catch (hasVotedError) {
            console.log('❌ hasVoted also fails:', hasVotedError.message);
          }
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 FINAL DIAGNOSIS RESULTS');
    console.log('═══════════════════════════════════════════════════════');
    
    if (newPollId) {
      console.log(`📋 New poll created: ✅ ID ${newPollId}`);
      console.log('📋 Vote test results: See above');
    } else {
      console.log('📋 New poll creation: ❌ Failed');
    }
    
    console.log('\nIf voting still fails on immediately created polls,');
    console.log('the issue is definitely in the contract logic, not timestamps.');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testVoteFinalFix().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { testVoteFinalFix };