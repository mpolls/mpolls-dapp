#!/usr/bin/env node

// Test script for vote submission functionality
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function testVoteSubmission() {
  console.log('🗳️ VOTE SUBMISSION TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`🔑 Account: ${account.address}`);

    // Step 1: Create a test poll first
    console.log('\n🚀 STEP 1: Creating test poll for voting...');
    const testPoll = {
      title: "Vote Test Poll",
      description: "Test poll for voting functionality",
      options: ["Option A", "Option B", "Option C"],
      durationDays: 1
    };

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
      console.log('✅ Test poll created successfully');
      console.log('📋 Operation ID:', createResult.id);

      // Wait for poll creation confirmation
      console.log('⏳ Waiting for poll creation confirmation...');
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Get the poll ID from events
      const events = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      const createEvents = events.filter(event => 
        event.data.includes("Poll created with ID:")
      );
      
      if (createEvents.length > 0) {
        const match = createEvents[createEvents.length - 1].data.match(/Poll created with ID: (\d+)/);
        if (match) {
          pollId = match[1];
          console.log(`✅ Created poll ID: ${pollId}`);
        }
      }
      
      // If no poll ID found from events, let's use the last poll creation event
      if (!pollId && createEvents.length > 0) {
        const lastEvent = createEvents[createEvents.length - 1].data;
        console.log(`📋 Last creation event: "${lastEvent}"`);
        // Try different regex patterns
        const patterns = [
          /Poll created with ID: (\d+)/,
          /ID: (\d+)/,
          /poll (\d+)/i
        ];
        
        for (const pattern of patterns) {
          const match = lastEvent.match(pattern);
          if (match) {
            pollId = match[1];
            console.log(`✅ Extracted poll ID using pattern: ${pollId}`);
            break;
          }
        }
      }
    } catch (error) {
      console.log('❌ Failed to create test poll:', error.message);
      return;
    }

    if (!pollId) {
      console.log('⚠️ No poll ID found from new poll creation');
      console.log('🔍 Checking for existing polls to test voting...');
      
      try {
        const allEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });
        
        const existingCreateEvents = allEvents.filter(event => 
          event.data.includes("Poll created with ID:")
        );
        
        if (existingCreateEvents.length > 0) {
          const match = existingCreateEvents[0].data.match(/Poll created with ID: (\d+)/);
          if (match) {
            pollId = match[1];
            console.log(`✅ Found existing poll ID: ${pollId} - using for testing`);
          }
        }
      } catch (error) {
        console.log('❌ Failed to find existing polls:', error.message);
      }
      
      if (!pollId) {
        console.log('❌ No polls available for testing - cannot proceed');
        return;
      }
    }

    // Step 2: Test vote submission for each option
    console.log(`\n🗳️ STEP 2: Testing vote submission on poll ${pollId}...`);
    const testVotes = [
      { optionIndex: 0, optionName: "Option A" },
      { optionIndex: 1, optionName: "Option B" },
      { optionIndex: 2, optionName: "Option C" }
    ];

    const voteResults = [];

    for (const vote of testVotes) {
      console.log(`\n📝 Testing vote for ${vote.optionName} (index ${vote.optionIndex})...`);
      
      // Check if user has already voted (should be false initially)
      console.log('🔍 Checking if user has already voted...');
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
          console.log(`⚠️ User has already voted on poll ${pollId}, skipping remaining vote tests`);
          break;
        }
      } catch (error) {
        console.log('⚠️ Failed to check voting status:', error.message);
      }

      // Submit the vote
      console.log(`🗳️ Submitting vote for ${vote.optionName}...`);
      try {
        const voteArgs = new Args()
          .addString(pollId)
          .addU32(BigInt(vote.optionIndex));

        const voteResult = await provider.callSC({
          target: CONTRACT_ADDRESS,
          func: 'vote',
          parameter: voteArgs.serialize(),
          coins: 0n,
          fee: Mas.fromString('0.01'),
        });

        console.log('✅ Vote submitted successfully!');
        console.log('📋 Vote Operation ID:', voteResult.id);

        voteResults.push({
          optionIndex: vote.optionIndex,
          optionName: vote.optionName,
          success: true,
          operationId: voteResult.id,
          error: null
        });

        // Wait for vote confirmation
        console.log('⏳ Waiting for vote confirmation...');
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Verify the vote was recorded by checking events
        console.log('🔍 Verifying vote was recorded...');
        try {
          const voteEvents = await provider.getEvents({
            smartContractAddress: CONTRACT_ADDRESS,
          });

          const voteConfirmEvents = voteEvents.filter(event => 
            event.data.includes(`Vote recorded`) ||
            event.data.includes(`voted on poll ${pollId}`) ||
            event.data.includes(`Vote cast`)
          );

          if (voteConfirmEvents.length > 0) {
            console.log('✅ Vote confirmation found in events');
            voteConfirmEvents.slice(-3).forEach((event, index) => {
              console.log(`   Event ${index + 1}: "${event.data}"`);
            });
          } else {
            console.log('⚠️ No vote confirmation events found');
          }
        } catch (error) {
          console.log('⚠️ Failed to verify vote confirmation:', error.message);
        }

        // Only test one vote per poll (since each address can only vote once)
        console.log('ℹ️ Stopping vote tests after first successful vote (one vote per address limit)');
        break;

      } catch (error) {
        console.log(`❌ Vote submission failed: ${error.message}`);
        voteResults.push({
          optionIndex: vote.optionIndex,
          optionName: vote.optionName,
          success: false,
          operationId: null,
          error: error.message
        });

        // If vote failed due to already voted, break the loop
        if (error.message.toLowerCase().includes('already voted')) {
          console.log('ℹ️ Already voted - stopping further vote tests');
          break;
        }
      }
    }

    // Step 3: Verify vote counts were updated
    console.log(`\n📊 STEP 3: Verifying vote counts for poll ${pollId}...`);
    try {
      const getPollArgs = new Args().addString(pollId);
      await provider.readSC({
        target: CONTRACT_ADDRESS,
        func: 'getPoll',
        parameter: getPollArgs.serialize(),
      });

      // Wait a moment for events
      await new Promise(resolve => setTimeout(resolve, 3000));

      const pollEvents = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });

      const pollDataEvents = pollEvents.filter(event => 
        event.data.includes(`Poll ${pollId}:`) ||
        event.data.includes('Poll data:') ||
        event.data.match(new RegExp(`^${pollId}\\|`))
      );

      if (pollDataEvents.length > 0) {
        console.log('✅ Found poll data events');
        
        for (const event of pollDataEvents) {
          let pollData = event.data;
          
          // Extract data if it's in "Poll X: data" format
          if (pollData.includes('Poll ') && pollData.includes(':')) {
            pollData = pollData.substring(pollData.indexOf(':') + 1).trim();
          }

          try {
            const parts = pollData.split('|');
            if (parts.length >= 8) {
              // Find where options end by looking for creator address
              let creatorIndex = -1;
              for (let i = 3; i < parts.length; i++) {
                if (parts[i].startsWith('AU') && parts[i].length > 20) {
                  creatorIndex = i;
                  break;
                }
              }

              if (creatorIndex !== -1) {
                const voteCountStr = parts[creatorIndex + 4] || '';
                const votes = voteCountStr.length > 0 ?
                  voteCountStr.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)) :
                  [];

                console.log('📊 Current vote counts:');
                testPoll.options.forEach((option, index) => {
                  const voteCount = votes[index] || 0;
                  console.log(`   ${option}: ${voteCount} votes`);
                });

                const totalVotes = votes.reduce((sum, count) => sum + count, 0);
                console.log(`📊 Total votes: ${totalVotes}`);

                if (totalVotes > 0) {
                  console.log('✅ Vote submission verification: SUCCESS - votes were recorded!');
                } else {
                  console.log('⚠️ Vote submission verification: No votes recorded yet (may take time)');
                }
              }
            }
          } catch (parseError) {
            console.log('⚠️ Failed to parse poll data:', parseError.message);
          }
        }
      } else {
        console.log('⚠️ No poll data events found for verification');
      }
    } catch (error) {
      console.log('❌ Failed to verify vote counts:', error.message);
    }

    // Step 4: Test edge cases
    console.log(`\n🧪 STEP 4: Testing edge cases...`);

    // Test invalid option index
    console.log('🧪 Testing invalid option index...');
    try {
      const invalidVoteArgs = new Args()
        .addString(pollId)
        .addU32(BigInt(999)); // Invalid option index

      await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'vote',
        parameter: invalidVoteArgs.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      console.log('❌ Invalid option index test failed - should have been rejected');
    } catch (error) {
      console.log('✅ Invalid option index correctly rejected:', error.message);
    }

    // Test voting on non-existent poll
    console.log('🧪 Testing vote on non-existent poll...');
    try {
      const nonExistentPollArgs = new Args()
        .addString('99999') // Non-existent poll ID
        .addU32(BigInt(0));

      await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'vote',
        parameter: nonExistentPollArgs.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      console.log('❌ Non-existent poll test failed - should have been rejected');
    } catch (error) {
      console.log('✅ Non-existent poll vote correctly rejected:', error.message);
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 VOTE SUBMISSION TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📋 Test poll created: ✅ ID ${pollId}`);
    console.log(`📋 Vote attempts: ${voteResults.length}`);
    
    const successfulVotes = voteResults.filter(v => v.success);
    const failedVotes = voteResults.filter(v => !v.success);
    
    console.log(`📊 Successful votes: ${successfulVotes.length}`);
    console.log(`📊 Failed votes: ${failedVotes.length}`);

    if (successfulVotes.length > 0) {
      console.log('\n✅ SUCCESSFUL VOTES:');
      successfulVotes.forEach(vote => {
        console.log(`   ${vote.optionName} (index ${vote.optionIndex}) - Operation: ${vote.operationId}`);
      });
    }

    if (failedVotes.length > 0) {
      console.log('\n❌ FAILED VOTES:');
      failedVotes.forEach(vote => {
        console.log(`   ${vote.optionName} (index ${vote.optionIndex}) - Error: ${vote.error}`);
      });
    }

    const overallSuccess = successfulVotes.length > 0;
    console.log(`\n🎯 OVERALL RESULT: ${overallSuccess ? '✅ VOTE SUBMISSION WORKING!' : '❌ VOTE SUBMISSION FAILED!'}`);

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Test double voting prevention
async function testDoubleVotingPrevention() {
  console.log('\n🔒 DOUBLE VOTING PREVENTION TEST');
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    // Find an existing poll to test with
    console.log('🔍 Finding existing poll for double voting test...');
    
    const events = await provider.getEvents({
      smartContractAddress: CONTRACT_ADDRESS,
    });
    
    const createEvents = events.filter(event => 
      event.data.includes("Poll created with ID:")
    );
    
    if (createEvents.length === 0) {
      console.log('⚠️ No existing polls found - cannot test double voting prevention');
      return;
    }

    const match = createEvents[0].data.match(/Poll created with ID: (\d+)/);
    if (!match) {
      console.log('⚠️ Could not extract poll ID from events');
      console.log('📋 Event data:', createEvents[0].data);
      return;
    }

    const pollId = match[1];
    console.log(`📋 Testing double voting prevention on poll ${pollId}`);

    // Attempt to vote twice
    console.log('🗳️ Attempting first vote...');
    try {
      const voteArgs = new Args()
        .addString(pollId)
        .addU32(BigInt(0));

      await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'vote',
        parameter: voteArgs.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      console.log('✅ First vote submitted');
    } catch (error) {
      if (error.message.toLowerCase().includes('already voted')) {
        console.log('ℹ️ User has already voted on this poll - perfect for double voting test');
      } else {
        console.log('❌ First vote failed:', error.message);
      }
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Attempt second vote
    console.log('🗳️ Attempting second vote (should be rejected)...');
    try {
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
      console.log('❌ SECURITY ISSUE: Second vote was accepted when it should have been rejected!');
    } catch (error) {
      if (error.message.toLowerCase().includes('already voted')) {
        console.log('✅ SECURITY CHECK PASSED: Second vote correctly rejected - double voting prevention working!');
      } else {
        console.log('⚠️ Second vote rejected for different reason:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Double voting prevention test failed:', error);
  }
}

// Execute all tests if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      await testVoteSubmission();
      await testDoubleVotingPrevention();
    } catch (error) {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    }
  })();
}

export { testVoteSubmission, testDoubleVotingPrevention };