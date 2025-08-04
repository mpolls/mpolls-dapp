#!/usr/bin/env node

// Test to verify submitted values match retrieved values
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function testSubmitVsRetrieve() {
  console.log('🧪 SUBMIT vs RETRIEVE TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`🔑 Account: ${account.address}`);

    // Test data - exactly what we want to verify
    const testData = {
      title: "What is your favorite color?",
      description: "Please choose your preferred color from the options below",
      options: ["Red", "Blue", "Green", "Yellow"],
      durationDays: 7
    };

    console.log('\n📝 SUBMITTING POLL DATA:');
    console.log(`   Title: "${testData.title}"`);
    console.log(`   Description: "${testData.description}"`);
    console.log(`   Options: [${testData.options.map(o => `"${o}"`).join(', ')}]`);
    console.log(`   Duration: ${testData.durationDays} days (${testData.durationDays * 24 * 60 * 60} seconds)`);

    // Step 1: Create poll with exact data
    console.log('\n🚀 STEP 1: Creating poll...');
    const args = new Args()
      .addString(testData.title)
      .addString(testData.description)
      .addU32(BigInt(testData.options.length));
    
    testData.options.forEach(option => {
      args.addString(option);
    });
    
    args.addU64(BigInt(testData.durationDays * 24 * 60 * 60));

    let createResult = null;
    let createError = null;
    
    try {
      createResult = await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'createPoll',
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      console.log('✅ createPoll succeeded');
      console.log('📋 Operation ID:', createResult.id);
    } catch (error) {
      createError = error;
      console.log('❌ createPoll failed:', error.message);
      return;
    }

    // Step 2: Wait and find poll ID
    console.log('\n⏳ STEP 2: Waiting for blockchain confirmation...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    let pollId = null;
    try {
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
          console.log(`✅ Found poll ID: ${pollId}`);
        }
      }
    } catch (error) {
      console.log('❌ Failed to get poll ID:', error.message);
      return;
    }

    if (!pollId) {
      console.log('❌ No poll ID found - cannot proceed');
      return;
    }

    // Step 3: Try multiple retrieval methods
    console.log(`\n📊 STEP 3: Retrieving poll ${pollId} data...`);
    
    // Method 1: Use getPoll function
    console.log('\n🔍 METHOD 1: Using getPoll function');
    let getPollData = null;
    try {
      const getPollArgs = new Args().addString(pollId);
      const getPollResult = await provider.readSC({
        target: CONTRACT_ADDRESS,
        func: 'getPoll',
        parameter: getPollArgs.serialize(),
      });
      
      console.log('✅ getPoll call succeeded');
      console.log('📋 Result:', getPollResult);
      
      // Check if events were generated
      if (getPollResult.info && getPollResult.info.events) {
        console.log(`📋 Events in getPoll result: ${getPollResult.info.events.length}`);
        getPollResult.info.events.forEach((event, index) => {
          console.log(`   ${index + 1}. "${event.data}"`);
          if (event.data.includes('Poll data:')) {
            getPollData = event.data.substring('Poll data: '.length).trim();
          }
        });
      }
    } catch (error) {
      console.log('❌ getPoll failed:', error.message);
    }

    // Method 2: Use getAllPolls function
    console.log('\n🔍 METHOD 2: Using getAllPolls function');
    let allPollsData = null;
    try {
      const getAllPollsResult = await provider.readSC({
        target: CONTRACT_ADDRESS,
        func: 'getAllPolls',
        parameter: new Args().serialize(),
      });
      
      console.log('✅ getAllPolls call succeeded');
      console.log('📋 Result:', getAllPollsResult);
      
      // Check if events were generated
      if (getAllPollsResult.info && getAllPollsResult.info.events) {
        console.log(`📋 Events in getAllPolls result: ${getAllPollsResult.info.events.length}`);
        getAllPollsResult.info.events.forEach((event, index) => {
          console.log(`   ${index + 1}. "${event.data}"`);
          if (event.data.includes(`Poll ${pollId}:`)) {
            allPollsData = event.data.substring(`Poll ${pollId}: `.length).trim();
          }
        });
      }
    } catch (error) {
      console.log('❌ getAllPolls failed:', error.message);
    }

    // Method 3: Check contract events directly
    console.log('\n🔍 METHOD 3: Checking contract events directly');
    try {
      const events = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      console.log(`📋 Total contract events: ${events.length}`);
      
      // Look for poll data events
      const pollDataEvents = events.filter(event => 
        event.data.includes(`Poll ${pollId}:`) || 
        event.data.includes('Poll data:') ||
        (event.data.includes('Poll') && event.data.includes(pollId))
      );
      
      console.log(`📋 Poll data events for poll ${pollId}: ${pollDataEvents.length}`);
      pollDataEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. "${event.data}"`);
      });
      
    } catch (error) {
      console.log('❌ Failed to check contract events:', error.message);
    }

    // Step 4: Try to parse any retrieved data
    console.log('\n🔍 STEP 4: Analyzing retrieved data');
    
    const retrievedDataSources = [
      { name: 'getPoll', data: getPollData },
      { name: 'getAllPolls', data: allPollsData }
    ];

    let foundValidData = false;
    
    for (const source of retrievedDataSources) {
      if (source.data) {
        console.log(`\n📊 ANALYZING DATA FROM ${source.name.toUpperCase()}:`);
        console.log(`📋 Raw data: "${source.data}"`);
        
        try {
          const parts = source.data.split("|");
          console.log(`📋 Split into ${parts.length} parts:`, parts);
          
          if (parts.length >= 9) {
            const retrievedData = {
              id: parts[0].trim(),
              title: parts[1].trim(),
              description: parts[2].trim(),
              options: parts[3].trim().split("||").filter(opt => opt.length > 0),
              creator: parts[4].trim(),
              startTime: parseInt(parts[5].trim()),
              endTime: parseInt(parts[6].trim()),
              status: parseInt(parts[7].trim()),
              votes: parts[8].trim().split(",").map(v => parseInt(v.trim())).filter(v => !isNaN(v))
            };
            
            console.log('\n📊 PARSED RETRIEVED DATA:');
            console.log(`   ID: "${retrievedData.id}"`);
            console.log(`   Title: "${retrievedData.title}"`);
            console.log(`   Description: "${retrievedData.description}"`);
            console.log(`   Options: [${retrievedData.options.map(o => `"${o}"`).join(', ')}]`);
            console.log(`   Creator: "${retrievedData.creator}"`);
            console.log(`   Status: ${retrievedData.status}`);
            console.log(`   Votes: [${retrievedData.votes.join(', ')}]`);
            
            console.log('\n🔍 COMPARISON - SUBMITTED vs RETRIEVED:');
            
            // Title comparison
            const titleMatch = retrievedData.title === testData.title;
            console.log(`📝 Title:`);
            console.log(`   Submitted:  "${testData.title}"`);
            console.log(`   Retrieved:  "${retrievedData.title}"`);
            console.log(`   Match: ${titleMatch ? '✅ YES' : '❌ NO'}`);
            
            // Description comparison
            const descMatch = retrievedData.description === testData.description;
            console.log(`📄 Description:`);
            console.log(`   Submitted:  "${testData.description}"`);
            console.log(`   Retrieved:  "${retrievedData.description}"`);
            console.log(`   Match: ${descMatch ? '✅ YES' : '❌ NO'}`);
            
            // Options comparison
            const optionsMatch = JSON.stringify(retrievedData.options) === JSON.stringify(testData.options);
            console.log(`📋 Options:`);
            console.log(`   Submitted:  [${testData.options.map(o => `"${o}"`).join(', ')}]`);
            console.log(`   Retrieved:  [${retrievedData.options.map(o => `"${o}"`).join(', ')}]`);
            console.log(`   Match: ${optionsMatch ? '✅ YES' : '❌ NO'}`);
            
            // Duration comparison
            const expectedDurationSec = testData.durationDays * 24 * 60 * 60;
            const actualDurationSec = Math.floor((retrievedData.endTime - retrievedData.startTime) / 1000);
            const durationMatch = Math.abs(actualDurationSec - expectedDurationSec) < 60;
            console.log(`⏰ Duration:`);
            console.log(`   Submitted:  ${expectedDurationSec} seconds (${testData.durationDays} days)`);
            console.log(`   Retrieved:  ${actualDurationSec} seconds`);
            console.log(`   Match: ${durationMatch ? '✅ YES' : '❌ NO'}`);
            
            // Overall result
            const overallMatch = titleMatch && descMatch && optionsMatch && durationMatch;
            console.log(`\n🎯 OVERALL RESULT: ${overallMatch ? '✅ PERFECT MATCH!' : '❌ DATA MISMATCH!'}`);
            
            foundValidData = true;
            
            if (!overallMatch) {
              console.log('\n🔧 DETAILED MISMATCH ANALYSIS:');
              if (!titleMatch) {
                console.log(`   📝 Title differs by ${Math.abs(testData.title.length - retrievedData.title.length)} characters`);
              }
              if (!descMatch) {
                console.log(`   📄 Description differs by ${Math.abs(testData.description.length - retrievedData.description.length)} characters`);
              }
              if (!optionsMatch) {
                console.log(`   📋 Options: expected ${testData.options.length}, got ${retrievedData.options.length}`);
              }
              if (!durationMatch) {
                console.log(`   ⏰ Duration differs by ${Math.abs(actualDurationSec - expectedDurationSec)} seconds`);
              }
            }
            
          } else {
            console.log(`❌ Invalid serialized format: expected 9+ parts, got ${parts.length}`);
          }
          
        } catch (parseError) {
          console.log(`❌ Failed to parse data: ${parseError.message}`);
        }
      } else {
        console.log(`\n📊 NO DATA FROM ${source.name.toUpperCase()}`);
      }
    }

    if (!foundValidData) {
      console.log('\n🚨 CRITICAL ISSUE: NO VALID DATA RETRIEVED!');
      console.log('📋 This indicates:');
      console.log('   1. Poll data is not being stored in the contract');
      console.log('   2. getPoll/getAllPolls functions are not emitting events');
      console.log('   3. Contract storage/retrieval is fundamentally broken');
      console.log('\n🔧 DEBUGGING STEPS:');
      console.log('   1. Check if poll actually exists in contract storage');
      console.log('   2. Verify contract functions are working correctly');
      console.log('   3. Test with a simpler contract deployment');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 FINAL SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📋 Poll created: ✅ ID ${pollId}`);
    console.log(`📋 Data retrieved: ${foundValidData ? '✅ Yes' : '❌ No'}`);
    console.log(`📋 Values match: ${foundValidData ? 'See analysis above' : '❌ Cannot verify - no data'}`);

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSubmitVsRetrieve().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { testSubmitVsRetrieve };