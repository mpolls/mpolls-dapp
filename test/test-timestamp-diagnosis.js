#!/usr/bin/env node

// Diagnose timestamp conversion issues between frontend and contract
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function diagnoseTimestampIssues() {
  console.log('🕐 TIMESTAMP DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`🔑 Account: ${account.address}`);

    const currentTimeMs = Date.now();
    const currentTimeSec = Math.floor(currentTimeMs / 1000);

    console.log('\n⏰ CURRENT TIMESTAMP ANALYSIS:');
    console.log(`   JavaScript Date.now() (ms): ${currentTimeMs}`);
    console.log(`   JavaScript Date.now() (sec): ${currentTimeSec}`);
    console.log(`   Human readable: ${new Date(currentTimeMs).toISOString()}`);

    // Get existing polls and analyze their timestamps
    console.log('\n📊 ANALYZING EXISTING POLLS:');
    
    const events = await provider.getEvents({
      smartContractAddress: CONTRACT_ADDRESS,
    });
    
    const createEvents = events.filter(event => 
      event.data.includes("Poll created with ID:")
    );
    
    console.log(`📋 Found ${createEvents.length} poll creation events`);

    if (createEvents.length > 0) {
      // Try to get poll data using getAllPolls
      console.log('\n🔍 Calling getAllPolls to get timestamp data...');
      
      try {
        await provider.readSC({
          target: CONTRACT_ADDRESS,
          func: 'getAllPolls',
          parameter: new Args().serialize(),
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const pollEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });
        
        const pollDataEvents = pollEvents.filter(event => {
          const data = event.data;
          return data.includes('|') && (data.match(/^\d+\|/) || data.includes('Poll ') && data.includes(':'));
        });
        
        console.log(`📋 Found ${pollDataEvents.length} poll data events`);
        
        if (pollDataEvents.length > 0) {
          for (const event of pollDataEvents) {
            try {
              let pollData = event.data;
              
              if (pollData.includes('Poll ') && pollData.includes(':')) {
                pollData = pollData.substring(pollData.indexOf(':') + 1).trim();
              }
              
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
                  const startTime = parseInt(parts[creatorIndex + 1]);
                  const endTime = parseInt(parts[creatorIndex + 2]);
                  const status = parseInt(parts[creatorIndex + 3]);
                  
                  console.log(`\n📊 POLL ${id} TIMESTAMP ANALYSIS:`);
                  console.log(`   Raw startTime: ${startTime}`);
                  console.log(`   Raw endTime: ${endTime}`);
                  console.log(`   Status: ${status}`);
                  
                  // Check if these are seconds or milliseconds
                  const startTimeAsMs = new Date(startTime);
                  const endTimeAsMs = new Date(endTime);
                  const startTimeAsSecToMs = new Date(startTime * 1000);
                  const endTimeAsSecToMs = new Date(endTime * 1000);
                  
                  console.log(`\n   🔍 INTERPRETATION ATTEMPTS:`);
                  console.log(`   If timestamps are MILLISECONDS:`);
                  console.log(`     Start: ${startTimeAsMs.toISOString()} (${startTime})`);
                  console.log(`     End: ${endTimeAsMs.toISOString()} (${endTime})`);
                  console.log(`     Duration: ${Math.floor((endTime - startTime) / 1000)} seconds`);
                  
                  console.log(`   If timestamps are SECONDS:`);
                  console.log(`     Start: ${startTimeAsSecToMs.toISOString()} (${startTime * 1000})`);
                  console.log(`     End: ${endTimeAsSecToMs.toISOString()} (${endTime * 1000})`);
                  console.log(`     Duration: ${endTime - startTime} seconds`);
                  
                  // Check which interpretation makes sense
                  const msInterpretationValid = startTime > 1000000000000 && endTime > 1000000000000; // reasonable ms timestamp
                  const secInterpretationValid = startTime > 1000000000 && startTime < 10000000000; // reasonable sec timestamp
                  
                  console.log(`\n   📋 VALIDITY CHECK:`);
                  console.log(`     Milliseconds interpretation valid: ${msInterpretationValid}`);
                  console.log(`     Seconds interpretation valid: ${secInterpretationValid}`);
                  
                  // Check activity under different interpretations
                  console.log(`\n   🎯 ACTIVITY CHECK:`);
                  
                  if (msInterpretationValid) {
                    const isActiveMs = status === 0 && currentTimeMs >= startTime && currentTimeMs <= endTime;
                    console.log(`     If MS: Currently active? ${isActiveMs}`);
                    console.log(`       Current (${currentTimeMs}) >= Start (${startTime}): ${currentTimeMs >= startTime}`);
                    console.log(`       Current (${currentTimeMs}) <= End (${endTime}): ${currentTimeMs <= endTime}`);
                  }
                  
                  if (secInterpretationValid) {
                    const startTimeMs = startTime * 1000;
                    const endTimeMs = endTime * 1000;
                    const isActiveSec = status === 0 && currentTimeMs >= startTimeMs && currentTimeMs <= endTimeMs;
                    console.log(`     If SEC: Currently active? ${isActiveSec}`);
                    console.log(`       Current (${currentTimeMs}) >= Start (${startTimeMs}): ${currentTimeMs >= startTimeMs}`);
                    console.log(`       Current (${currentTimeMs}) <= End (${endTimeMs}): ${currentTimeMs <= endTimeMs}`);
                  }
                  
                  // The contract likely uses Context.timestamp() which returns seconds
                  console.log(`\n   💡 CONTRACT PERSPECTIVE (Context.timestamp() in seconds):`);
                  const contractCurrentTimeSec = Math.floor(currentTimeMs / 1000);
                  
                  if (secInterpretationValid) {
                    const isActiveContract = status === 0 && contractCurrentTimeSec >= startTime && contractCurrentTimeSec <= endTime;
                    console.log(`     Contract time (sec): ${contractCurrentTimeSec}`);
                    console.log(`     Poll start (sec): ${startTime}`);
                    console.log(`     Poll end (sec): ${endTime}`);
                    console.log(`     Status: ${status} (0=active)`);
                    console.log(`     Contract sees as active: ${isActiveContract}`);
                    
                    if (!isActiveContract) {
                      console.log(`\n   ❌ PROBLEM IDENTIFIED:`);
                      if (contractCurrentTimeSec < startTime) {
                        console.log(`     - Poll hasn't started yet (${startTime - contractCurrentTimeSec} seconds to go)`);
                      } else if (contractCurrentTimeSec > endTime) {
                        console.log(`     - Poll has expired (${contractCurrentTimeSec - endTime} seconds ago)`);
                      } else if (status !== 0) {
                        console.log(`     - Poll status is not active (status=${status})`);
                      }
                    }
                  }
                }
              }
            } catch (parseError) {
              console.log(`⚠️ Failed to parse poll event: ${parseError.message}`);
            }
          }
        } else {
          console.log('⚠️ No poll data events found from getAllPolls');
        }
      } catch (error) {
        console.log('❌ getAllPolls failed:', error.message);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 TIMESTAMP DIAGNOSIS SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Key findings will be shown above. Common issues:');
    console.log('1. Contract uses seconds, frontend sends milliseconds');
    console.log('2. Frontend interprets seconds as milliseconds');
    console.log('3. Poll duration calculation errors');
    console.log('4. Time zone or clock synchronization issues');

  } catch (error) {
    console.error('💥 Diagnosis failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  diagnoseTimestampIssues().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { diagnoseTimestampIssues };