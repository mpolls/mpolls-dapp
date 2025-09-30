#!/usr/bin/env node

// Test vote submission using getAllPolls to find active polls
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function testVoteWithGetAllPolls() {
  console.log('🗳️ VOTE TEST USING getAllPolls');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`🔑 Account: ${account.address}`);

    // Step 1: Use getAllPolls to get poll data
    console.log('\n📊 STEP 1: Getting all polls data...');
    
    try {
      await provider.readSC({
        target: CONTRACT_ADDRESS,
        func: 'getAllPolls',
        parameter: new Args().serialize(),
      });
      
      console.log('✅ getAllPolls call succeeded');
      
      // Wait for events
      console.log('⏳ Waiting for getAllPolls events...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const events = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      console.log(`📋 Total contract events: ${events.length}`);
      
      // Look for poll data events
      const pollDataEvents = events.filter(event => {
        const data = event.data;
        return data.includes('|') && (data.match(/^\d+\|/) || data.includes('Poll ') && data.includes(':'));
      });
      
      console.log(`📋 Found ${pollDataEvents.length} poll data events`);
      
      if (pollDataEvents.length === 0) {
        console.log('❌ No poll data events found - contract may not be emitting data correctly');
        return;
      }
      
      // Parse poll data
      const polls = [];
      for (const event of pollDataEvents) {
        try {
          let pollData = event.data;
          
          // Extract data if it's in "Poll X: data" format
          if (pollData.includes('Poll ') && pollData.includes(':')) {
            pollData = pollData.substring(pollData.indexOf(':') + 1).trim();
          }
          
          console.log(`🔍 Processing poll data: "${pollData.substring(0, 100)}..."`);
          
          const parts = pollData.split('|');
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
              const id = parts[0];
              const title = parts[1];
              const creator = parts[creatorIndex];
              const startTime = parseInt(parts[creatorIndex + 1]);
              const endTime = parseInt(parts[creatorIndex + 2]);
              const status = parseInt(parts[creatorIndex + 3]);
              
              const currentTime = Date.now();
              const isActive = status === 0 && currentTime >= startTime && currentTime <= endTime;
              
              const poll = {
                id,
                title,
                creator,
                startTime,
                endTime,
                status,
                isActive
              };
              
              polls.push(poll);
              
              console.log(`📊 Poll ${id}: "${title}"`);
              console.log(`   Status: ${status} (${isActive ? 'ACTIVE' : 'INACTIVE'})`);
              console.log(`   Start: ${new Date(startTime).toISOString()}`);
              console.log(`   End: ${new Date(endTime).toISOString()}`);
            }
          }
        } catch (parseError) {
          console.log(`⚠️ Failed to parse poll event: ${parseError.message}`);
        }
      }
      
      console.log(`\n📊 Summary: Found ${polls.length} polls`);
      const activePolls = polls.filter(p => p.isActive);
      console.log(`📊 Active polls: ${activePolls.length}`);
      
      if (activePolls.length === 0) {
        console.log('❌ No active polls found for voting test');
        
        // Create a new poll for testing
        console.log('\n🚀 Creating new poll for testing...');
        
        const createArgs = new Args()
          .addString("Vote Test Poll")
          .addString("Test poll for vote submission")
          .addU32(BigInt(3));
        
        createArgs.addString("Option A");
        createArgs.addString("Option B");
        createArgs.addString("Option C");
        
        // 30 days duration
        createArgs.addU64(BigInt(30 * 24 * 60 * 60));
        
        try {
          const createResult = await provider.callSC({
            target: CONTRACT_ADDRESS,
            func: 'createPoll',
            parameter: createArgs.serialize(),
            coins: 0n,
            fee: Mas.fromString('0.01'),
          });
          
          console.log('✅ New poll created:', createResult.id);
          console.log('⏳ Please run this test again in a few minutes to test voting on the new poll');
          return;
          
        } catch (createError) {
          console.log('❌ Failed to create new poll:', createError.message);
          return;
        }
      }
      
      // Test voting on the first active poll
      const testPoll = activePolls[0];
      console.log(`\n🗳️ STEP 2: Testing vote on poll ${testPoll.id}...`);
      console.log(`📊 Poll: "${testPoll.title}"`);
      
      // Check if user has already voted
      console.log('🔍 Checking if user has already voted...');
      try {
        const hasVotedArgs = new Args()
          .addString(testPoll.id)
          .addString(account.address);

        await provider.readSC({
          target: CONTRACT_ADDRESS,
          func: 'hasVoted',
          parameter: hasVotedArgs.serialize(),
        });

        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const hasVotedEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });

        const votedEvents = hasVotedEvents.filter(event => 
          event.data.includes(`has voted on poll ${testPoll.id}:`)
        );

        let hasAlreadyVoted = false;
        if (votedEvents.length > 0) {
          const latestEvent = votedEvents[votedEvents.length - 1];
          hasAlreadyVoted = latestEvent.data.includes('true');
        }

        console.log(`📊 Has already voted: ${hasAlreadyVoted ? 'Yes' : 'No'}`);

      } catch (error) {
        console.log('⚠️ Failed to check voting status:', error.message);
      }
      
      // Submit vote
      console.log(`🗳️ Submitting vote for option 0...`);
      try {
        const voteArgs = new Args()
          .addString(testPoll.id)
          .addU32(BigInt(0));

        const voteResult = await provider.callSC({
          target: CONTRACT_ADDRESS,
          func: 'vote',
          parameter: voteArgs.serialize(),
          coins: 0n,
          fee: Mas.fromString('0.01'),
        });

        console.log('✅ VOTE SUBMITTED SUCCESSFULLY!');
        console.log('📋 Vote Operation ID:', voteResult.id);
        
        // Wait for confirmation
        console.log('⏳ Waiting for vote confirmation...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Check for vote events
        const voteEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });
        
        const recentEvents = voteEvents.slice(-5);
        console.log('📋 Recent events after vote:');
        recentEvents.forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.data}`);
        });
        
        console.log('\n🎯 VOTE SUBMISSION TEST: ✅ SUCCESS!');
        
        // Test double voting
        console.log('\n🔒 Testing double voting prevention...');
        try {
          const voteArgs2 = new Args()
            .addString(testPoll.id)
            .addU32(BigInt(1)); // Different option

          await provider.callSC({
            target: CONTRACT_ADDRESS,
            func: 'vote',
            parameter: voteArgs2.serialize(),
            coins: 0n,
            fee: Mas.fromString('0.01'),
          });
          
          console.log('❌ SECURITY ISSUE: Second vote was accepted!');
        } catch (doubleVoteError) {
          if (doubleVoteError.message.toLowerCase().includes('already voted')) {
            console.log('✅ Double voting prevention: WORKING!');
          } else {
            console.log('⚠️ Second vote rejected for different reason:', doubleVoteError.message);
          }
        }

      } catch (voteError) {
        console.log(`❌ Vote submission failed: ${voteError.message}`);
        
        if (voteError.message.includes('already voted')) {
          console.log('ℹ️ User has already voted - testing double voting prevention');
          console.log('✅ Double voting prevention: WORKING!');
        } else if (voteError.message.includes('not active')) {
          console.log('❌ Poll is not active despite our calculations');
        }
        
        console.log('\n🎯 VOTE SUBMISSION TEST: ❌ FAILED');
      }
      
    } catch (error) {
      console.log('❌ getAllPolls call failed:', error.message);
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 VOTE TEST COMPLETE');
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testVoteWithGetAllPolls().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { testVoteWithGetAllPolls };