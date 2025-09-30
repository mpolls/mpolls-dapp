#!/usr/bin/env node

// Test script to check poll status and understand why polls are inactive
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function testPollStatus() {
  console.log('📊 POLL STATUS ANALYSIS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`🔑 Account: ${account.address}`);
    console.log(`⏰ Current time: ${new Date().toISOString()}`);
    console.log(`⏰ Current timestamp (ms): ${Date.now()}`);
    console.log(`⏰ Current timestamp (sec): ${Math.floor(Date.now() / 1000)}`);

    // Get all contract events to find polls
    console.log('\n🔍 Analyzing existing polls...');
    const events = await provider.getEvents({
      smartContractAddress: CONTRACT_ADDRESS,
    });
    
    console.log(`📋 Total contract events: ${events.length}`);
    
    const createEvents = events.filter(event => 
      event.data.includes("Poll created with ID:")
    );
    
    console.log(`📋 Poll creation events: ${createEvents.length}`);
    
    if (createEvents.length === 0) {
      console.log('⚠️ No polls found - creating one for testing');
      
      // Create a poll with very long duration
      const createArgs = new Args()
        .addString("Status Test Poll")
        .addString("Testing poll status and timing")
        .addU32(BigInt(2));
      
      createArgs.addString("Option 1");
      createArgs.addString("Option 2");
      
      // 365 days in seconds
      createArgs.addU64(BigInt(365 * 24 * 60 * 60));

      try {
        const createResult = await provider.callSC({
          target: CONTRACT_ADDRESS,
          func: 'createPoll',
          parameter: createArgs.serialize(),
          coins: 0n,
          fee: Mas.fromString('0.01'),
        });
        console.log('✅ Poll creation submitted:', createResult.id);
        
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Refresh events
        const newEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });
        
        const newCreateEvents = newEvents.filter(event => 
          event.data.includes("Poll created with ID:")
        );
        
        console.log(`📋 Poll creation events after creation: ${newCreateEvents.length}`);
        
      } catch (error) {
        console.log('❌ Failed to create test poll:', error.message);
      }
    }

    // Analyze each poll
    for (let i = 0; i < createEvents.length; i++) {
      const event = createEvents[i];
      const match = event.data.match(/Poll created with ID: (\d+)/);
      if (!match) continue;
      
      const pollId = match[1];
      console.log(`\n📊 ANALYZING POLL ${pollId}:`);
      console.log(`   Creation event: "${event.data}"`);
      
      // Try to get poll data
      try {
        console.log('🔍 Calling getPoll function...');
        const getPollArgs = new Args().addString(pollId);
        await provider.readSC({
          target: CONTRACT_ADDRESS,
          func: 'getPoll',
          parameter: getPollArgs.serialize(),
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check for poll data events
        const pollEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });
        
        const pollDataEvents = pollEvents.filter(event => 
          event.data.includes(`Poll ${pollId}:`) ||
          event.data.includes('Poll data:') ||
          event.data.match(new RegExp(`^${pollId}\\|`))
        );
        
        console.log(`📋 Poll data events for poll ${pollId}: ${pollDataEvents.length}`);
        
        if (pollDataEvents.length > 0) {
          for (const dataEvent of pollDataEvents) {
            let pollData = dataEvent.data;
            
            // Extract data if it's in "Poll X: data" format
            if (pollData.includes('Poll ') && pollData.includes(':')) {
              pollData = pollData.substring(pollData.indexOf(':') + 1).trim();
            }
            
            console.log(`📋 Raw poll data: "${pollData}"`);
            
            try {
              const parts = pollData.split('|');
              console.log(`📋 Data parts (${parts.length}):`, parts);
              
              if (parts.length >= 8) {
                // Find creator index
                let creatorIndex = -1;
                for (let j = 3; j < parts.length; j++) {
                  if (parts[j].startsWith('AU') && parts[j].length > 20) {
                    creatorIndex = j;
                    break;
                  }
                }
                
                if (creatorIndex !== -1) {
                  const id = parts[0];
                  const title = parts[1];
                  const description = parts[2];
                  const creator = parts[creatorIndex];
                  const startTime = parseInt(parts[creatorIndex + 1]);
                  const endTime = parseInt(parts[creatorIndex + 2]);
                  const status = parseInt(parts[creatorIndex + 3]);
                  
                  console.log(`📊 POLL ${id} DETAILS:`);
                  console.log(`   Title: "${title}"`);
                  console.log(`   Description: "${description}"`);
                  console.log(`   Creator: ${creator}`);
                  console.log(`   Status: ${status} (0=active, 1=closed)`);
                  console.log(`   Start Time: ${startTime} (${new Date(startTime).toISOString()})`);
                  console.log(`   End Time: ${endTime} (${new Date(endTime).toISOString()})`);
                  
                  const currentTimeMs = Date.now();
                  const currentTimeSec = Math.floor(currentTimeMs / 1000);
                  
                  console.log(`⏰ TIMING ANALYSIS:`);
                  console.log(`   Current Time (ms): ${currentTimeMs}`);
                  console.log(`   Current Time (sec): ${currentTimeSec}`);
                  console.log(`   Poll Start (ms): ${startTime}`);
                  console.log(`   Poll End (ms): ${endTime}`);
                  console.log(`   Poll Start (sec): ${Math.floor(startTime / 1000)}`);
                  console.log(`   Poll End (sec): ${Math.floor(endTime / 1000)}`);
                  
                  const isAfterStart = currentTimeMs >= startTime;
                  const isBeforeEnd = currentTimeMs <= endTime;
                  const statusActive = status === 0;
                  const shouldBeActive = isAfterStart && isBeforeEnd && statusActive;
                  
                  console.log(`🔍 ACTIVITY CHECK:`);
                  console.log(`   Current >= Start: ${isAfterStart}`);
                  console.log(`   Current <= End: ${isBeforeEnd}`);
                  console.log(`   Status is active (0): ${statusActive}`);
                  console.log(`   Should be active: ${shouldBeActive}`);
                  
                  if (!shouldBeActive) {
                    console.log(`❌ POLL ${id} IS INACTIVE:`);
                    if (!isAfterStart) console.log(`   - Poll hasn't started yet`);
                    if (!isBeforeEnd) console.log(`   - Poll has ended`);
                    if (!statusActive) console.log(`   - Poll status is closed`);
                  } else {
                    console.log(`✅ POLL ${id} SHOULD BE ACTIVE`);
                    
                    // Test voting on this active poll
                    console.log(`🗳️ Testing vote on active poll ${id}...`);
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
                      
                      console.log(`✅ VOTE SUCCESSFUL on poll ${id}!`);
                      console.log(`📋 Vote operation: ${voteResult.id}`);
                      
                    } catch (voteError) {
                      console.log(`❌ Vote failed on poll ${id}: ${voteError.message}`);
                      
                      if (voteError.message.includes('already voted')) {
                        console.log(`ℹ️ User has already voted - this is expected`);
                      } else if (voteError.message.includes('not active')) {
                        console.log(`❌ Contract says poll is not active despite our calculation`);
                      }
                    }
                  }
                }
              }
            } catch (parseError) {
              console.log(`❌ Failed to parse poll data: ${parseError.message}`);
            }
          }
        } else {
          console.log(`⚠️ No poll data events found for poll ${pollId}`);
        }
        
      } catch (error) {
        console.log(`❌ Failed to get poll ${pollId} data: ${error.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 POLL STATUS ANALYSIS COMPLETE');
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPollStatus().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { testPollStatus };