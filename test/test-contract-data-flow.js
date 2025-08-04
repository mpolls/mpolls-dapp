#!/usr/bin/env node

// Comprehensive test to verify poll creation and retrieval data flow
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

// Test data that matches CreatePoll.tsx form structure
const TEST_POLLS = [
  {
    title: "What is your favorite programming language?",
    description: "Vote for the programming language you enjoy working with the most for web development projects.",
    options: ["JavaScript/TypeScript", "Python", "Rust", "Go", "Java"],
    durationDays: 7
  },
  {
    title: "Best blockchain for DeFi?",
    description: "Which blockchain do you think offers the best DeFi ecosystem and user experience?",
    options: ["Ethereum", "Massa", "Solana", "Polygon"],
    durationDays: 14
  },
  {
    title: "Preferred IDE for development?",
    description: "What integrated development environment do you use most often for coding?",
    options: ["VS Code", "IntelliJ IDEA", "Vim/Neovim", "Sublime Text"],
    durationDays: 5
  }
];

async function testCompleteDataFlow() {
  console.log('🧪 COMPREHENSIVE CONTRACT DATA FLOW TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network: Massa Buildnet`);
  console.log(`📋 Explorer: https://buildnet-explorer.massa.net/address/${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    // Create account from private key
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    console.log(`🔑 Using account: ${account.address}`);

    // Connect to buildnet
    const provider = JsonRpcProvider.buildnet(account);
    console.log('🌐 Connected to Massa buildnet');

    // Test each poll creation and retrieval
    const createdPolls = [];
    
    for (let i = 0; i < TEST_POLLS.length; i++) {
      const testPoll = TEST_POLLS[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🧪 TEST ${i + 1}: "${testPoll.title}"`);
      console.log(`${'='.repeat(60)}`);
      
      // Step 1: Create poll
      console.log('\n📝 STEP 1: Creating poll...');
      console.log('Input data:');
      console.log(`   Title: "${testPoll.title}"`);
      console.log(`   Description: "${testPoll.description}"`);
      console.log(`   Options: [${testPoll.options.map(opt => `"${opt}"`).join(', ')}]`);
      console.log(`   Duration: ${testPoll.durationDays} days (${testPoll.durationDays * 24 * 60 * 60} seconds)`);
      
      try {
        // Prepare arguments exactly like CreatePoll.tsx
        const args = new Args()
          .addString(testPoll.title)
          .addString(testPoll.description)
          .addU32(BigInt(testPoll.options.length));
        
        // Add each option separately
        testPoll.options.forEach(option => {
          args.addString(option);
        });
        
        args.addU64(BigInt(testPoll.durationDays * 24 * 60 * 60)); // Convert days to seconds
        
        console.log('\n🚀 Calling createPoll function...');
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
          
          console.log('✅ Poll creation transaction successful!');
          console.log(`📋 Transaction result:`, createResult);
          console.log(`📋 Result type: ${typeof createResult}`);
          console.log(`📋 Result keys: ${createResult ? Object.keys(createResult) : 'N/A'}`);
        } catch (error) {
          createError = error;
          console.log('❌ Poll creation transaction failed!');
          console.log(`📋 Error message: ${error.message}`);
          console.log(`📋 Error type: ${error.constructor.name}`);
          console.log(`📋 Full error:`, error);
          
          // Continue to check if transaction might have succeeded despite error
          console.log('⚠️ Checking if transaction succeeded despite error...');
        }
        
        // Wait for transaction to be processed
        console.log('⏳ Waiting 5 seconds for transaction to be processed...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Step 2: Get events to find poll ID
        console.log('\n📋 STEP 2: Getting contract events to find poll ID...');
        const events = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });
        
        console.log(`📋 Total events found: ${events.length}`);
        console.log('📋 All recent events:');
        events.slice(-10).forEach((event, index) => {
          console.log(`   ${events.length - 10 + index + 1}. "${event.data}"`);
        });
        
        // Look for the latest poll creation event
        const pollCreateEvents = events.filter(event => 
          event.data.includes("Poll created with ID:")
        );
        
        console.log(`📋 Poll creation events found: ${pollCreateEvents.length}`);
        pollCreateEvents.forEach((event, index) => {
          console.log(`   ${index + 1}. "${event.data}"`);
        });
        
        let pollId = null;
        if (pollCreateEvents.length > 0) {
          const latestEvent = pollCreateEvents[pollCreateEvents.length - 1];
          const match = latestEvent.data.match(/Poll created with ID: (\d+)/);
          if (match) {
            pollId = match[1];
            console.log(`✅ Found poll ID: ${pollId} from event: "${latestEvent.data}"`);
          } else {
            console.log(`❌ Could not extract poll ID from event: "${latestEvent.data}"`);
          }
        } else {
          console.log('❌ No poll creation events found');
          console.log('📋 This might indicate:');
          console.log('   1. The createPoll transaction failed');
          console.log('   2. The contract is not emitting creation events');
          console.log('   3. There is a delay in event propagation');
        }
        
        if (!pollId) {
          console.log('❌ Could not find poll ID from events - cannot proceed with data verification');
          continue;
        }
        
        // Step 3: Retrieve poll data
        console.log(`\n📊 STEP 3: Retrieving poll data for ID ${pollId}...`);
        
        let getPollError = null;
        let getPollResult = null;
        
        // Call getPoll function
        console.log(`📋 Calling getPoll function for poll ID ${pollId}...`);
        try {
          const getPollArgs = new Args().addString(pollId);
          getPollResult = await provider.readSC({
            target: CONTRACT_ADDRESS,
            func: 'getPoll',
            parameter: getPollArgs.serialize(),
          });
          console.log('✅ getPoll function call successful');
          console.log('📋 getPoll result:', getPollResult);
        } catch (error) {
          getPollError = error;
          console.log('❌ getPoll function call failed:', error.message);
          console.log('📋 Full error:', error);
        }
        
        console.log('📋 Getting fresh events to find poll data...');
        
        // Get fresh events to find poll data
        const freshEvents = await provider.getEvents({
          smartContractAddress: CONTRACT_ADDRESS,
        });
        
        console.log(`📋 Total fresh events: ${freshEvents.length}`);
        console.log('📋 Recent fresh events:');
        freshEvents.slice(-15).forEach((event, index) => {
          console.log(`   ${freshEvents.length - 15 + index + 1}. "${event.data}"`);
        });
        
        // Look for poll data events
        const pollDataEvents = freshEvents.filter(event => 
          event.data.includes(`Poll ${pollId}:`) || 
          event.data.includes(`Poll data:`) ||
          event.data.match(new RegExp(`^${pollId}\\|`))
        );
        
        console.log(`\n📋 Poll data events analysis:`);
        console.log(`   Looking for patterns:`);
        console.log(`     - "Poll ${pollId}:"`);
        console.log(`     - "Poll data:"`);
        console.log(`     - Events starting with "${pollId}|"`);
        console.log(`   Found ${pollDataEvents.length} matching poll data events`);
        
        if (pollDataEvents.length > 0) {
          pollDataEvents.forEach((event, index) => {
            console.log(`   ${index + 1}. "${event.data}"`);
          });
        } else {
          console.log('   ❌ No poll data events found');
          console.log('   📋 Checking if there are any events containing poll data in other formats...');
          
          // Look for any events that might contain the poll ID
          const anyPollEvents = freshEvents.filter(event => 
            event.data.includes(pollId) || 
            event.data.includes('Poll') ||
            event.data.includes('|')
          );
          
          console.log(`   📋 Events containing poll ID or "Poll" or "|": ${anyPollEvents.length}`);
          anyPollEvents.slice(-10).forEach((event, index) => {
            console.log(`     ${index + 1}. "${event.data}"`);
          });
        }
        
        let retrievedData = null;
        let parseErrors = [];
        
        for (const event of pollDataEvents) {
          console.log(`\n🔍 Processing poll data event: "${event.data}"`);
          
          let pollData = event.data;
          
          // Extract data if it's in "Poll X: data" format
          if (pollData.includes("Poll ") && pollData.includes(":")) {
            const originalData = pollData;
            pollData = pollData.substring(pollData.indexOf(":") + 1).trim();
            console.log(`   📋 Extracted from "Poll X:" format:`);
            console.log(`     Before: "${originalData}"`);
            console.log(`     After: "${pollData}"`);
          }
          
          // Try to parse the serialized data
          try {
            console.log(`   🔍 Attempting to parse: "${pollData}"`);
            const parts = pollData.split("|");
            console.log(`   📋 Split into ${parts.length} parts:`, parts);
            
            if (parts.length >= 9) {
              const rawData = {
                id: parts[0].trim(),
                title: parts[1].trim(),
                description: parts[2].trim(),
                optionsStr: parts[3].trim(),
                creator: parts[4].trim(),
                startTime: parts[5].trim(),
                endTime: parts[6].trim(),
                status: parts[7].trim(),
                votesStr: parts[8].trim()
              };
              
              console.log(`   📊 Raw parsed parts:`);
              console.log(`     ID: "${rawData.id}"`);
              console.log(`     Title: "${rawData.title}"`);
              console.log(`     Description: "${rawData.description}"`);
              console.log(`     Options string: "${rawData.optionsStr}"`);
              console.log(`     Creator: "${rawData.creator}"`);
              console.log(`     Start time: "${rawData.startTime}"`);
              console.log(`     End time: "${rawData.endTime}"`);
              console.log(`     Status: "${rawData.status}"`);
              console.log(`     Votes string: "${rawData.votesStr}"`);
              
              // Parse options and votes
              const options = rawData.optionsStr.split("||").map(opt => opt.trim()).filter(opt => opt.length > 0);
              const votes = rawData.votesStr.split(",").map(v => parseInt(v.trim())).filter(v => !isNaN(v));
              
              console.log(`   📋 Parsed options: [${options.map(opt => `"${opt}"`).join(', ')}]`);
              console.log(`   🗳️ Parsed votes: [${votes.join(', ')}]`);
              
              retrievedData = {
                id: rawData.id,
                title: rawData.title,
                description: rawData.description,
                options: options,
                creator: rawData.creator,
                startTime: parseInt(rawData.startTime),
                endTime: parseInt(rawData.endTime),
                status: parseInt(rawData.status),
                votes: votes
              };
              
              console.log(`   ✅ Successfully parsed poll data!`);
              break;
            } else {
              const error = `Expected 9+ parts, got ${parts.length}`;
              console.log(`   ❌ Parse failed: ${error}`);
              parseErrors.push(error);
            }
          } catch (parseError) {
            console.log(`   ❌ Parse error: ${parseError.message}`);
            parseErrors.push(parseError.message);
          }
        }
        
        if (!retrievedData && parseErrors.length > 0) {
          console.log(`\n❌ All parsing attempts failed. Errors:`);
          parseErrors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
          });
        }
        
        // Step 4: Compare input vs retrieved data
        console.log(`\n🔍 STEP 4: Comparing input vs retrieved data...`);
        console.log(`${'─'.repeat(80)}`);
        
        // Show summary of what we have
        console.log(`📋 SUMMARY OF RETRIEVAL ATTEMPT:`);
        console.log(`   Poll ID: ${pollId || 'N/A'}`);
        console.log(`   CreatePoll call: ${createError ? '❌ Failed' : '✅ Success'}`);
        console.log(`   GetPoll call: ${getPollError ? '❌ Failed' : '✅ Success'}`);
        console.log(`   Poll data events found: ${pollDataEvents.length}`);
        console.log(`   Retrieved data: ${retrievedData ? '✅ Yes' : '❌ No'}`);
        
        if (createError) {
          console.log(`\n❌ CREATE POLL ERROR DETAILS:`);
          console.log(`   Message: ${createError.message}`);
          console.log(`   Type: ${createError.constructor.name}`);
        }
        
        if (getPollError) {
          console.log(`\n❌ GET POLL ERROR DETAILS:`);
          console.log(`   Message: ${getPollError.message}`);
          console.log(`   Type: ${getPollError.constructor.name}`);
        }
        
        if (retrievedData) {
          console.log('\n✅ Successfully retrieved poll data from contract!');
          console.log('\n📊 COMPLETE RETRIEVED DATA:');
          console.log('   Raw object:', JSON.stringify(retrievedData, null, 2));
          
          console.log('\n📊 DATA COMPARISON:');
          
          // Title comparison
          const titleMatch = retrievedData.title === testPoll.title;
          console.log(`📝 Title:`);
          console.log(`   Input:     "${testPoll.title}" (length: ${testPoll.title.length})`);
          console.log(`   Retrieved: "${retrievedData.title}" (length: ${retrievedData.title.length})`);
          console.log(`   Match: ${titleMatch ? '✅ YES' : '❌ NO'}`);
          if (!titleMatch) {
            console.log(`   📋 Character-by-character comparison:`);
            const maxLen = Math.max(testPoll.title.length, retrievedData.title.length);
            for (let i = 0; i < maxLen; i++) {
              const inputChar = testPoll.title[i] || '(end)';
              const retrievedChar = retrievedData.title[i] || '(end)';
              const match = inputChar === retrievedChar;
              console.log(`     ${i}: "${inputChar}" vs "${retrievedChar}" ${match ? '✅' : '❌'}`);
            }
          }
          
          // Description comparison
          const descMatch = retrievedData.description === testPoll.description;
          console.log(`📄 Description:`);
          console.log(`   Input:     "${testPoll.description}" (length: ${testPoll.description.length})`);
          console.log(`   Retrieved: "${retrievedData.description}" (length: ${retrievedData.description.length})`);
          console.log(`   Match: ${descMatch ? '✅ YES' : '❌ NO'}`);
          if (!descMatch && retrievedData.description.length < 200) {
            console.log(`   📋 Input first 100 chars: "${testPoll.description.substring(0, 100)}"`);
            console.log(`   📋 Retrieved first 100 chars: "${retrievedData.description.substring(0, 100)}"`);
          }
          
          // Options comparison
          const optionsMatch = JSON.stringify(retrievedData.options) === JSON.stringify(testPoll.options);
          console.log(`📋 Options:`);
          console.log(`   Input count: ${testPoll.options.length}`);
          console.log(`   Retrieved count: ${retrievedData.options.length}`);
          console.log(`   Input:     [${testPoll.options.map(opt => `"${opt}"`).join(', ')}]`);
          console.log(`   Retrieved: [${retrievedData.options.map(opt => `"${opt}"`).join(', ')}]`);
          console.log(`   Match: ${optionsMatch ? '✅ YES' : '❌ NO'}`);
          if (!optionsMatch) {
            console.log(`   📋 Individual option comparison:`);
            const maxOptions = Math.max(testPoll.options.length, retrievedData.options.length);
            for (let i = 0; i < maxOptions; i++) {
              const inputOpt = testPoll.options[i] || '(missing)';
              const retrievedOpt = retrievedData.options[i] || '(missing)';
              const match = inputOpt === retrievedOpt;
              console.log(`     ${i}: "${inputOpt}" vs "${retrievedOpt}" ${match ? '✅' : '❌'}`);
            }
          }
          
          // Duration comparison (approximate, allowing for timestamp differences)
          const expectedDurationSec = testPoll.durationDays * 24 * 60 * 60;
          const actualDurationSec = Math.floor((retrievedData.endTime - retrievedData.startTime) / 1000);
          const durationMatch = Math.abs(actualDurationSec - expectedDurationSec) < 60; // Allow 1 minute difference
          console.log(`⏰ Duration:`);
          console.log(`   Input:     ${expectedDurationSec} seconds (${testPoll.durationDays} days)`);
          console.log(`   Retrieved: ${actualDurationSec} seconds (~${Math.round(actualDurationSec / (24 * 60 * 60))} days)`);
          console.log(`   Difference: ${Math.abs(actualDurationSec - expectedDurationSec)} seconds`);
          console.log(`   Match: ${durationMatch ? '✅ YES' : '❌ NO'}`);
          
          // Additional info
          console.log(`📊 Additional retrieved data:`);
          console.log(`   Poll ID: ${retrievedData.id}`);
          console.log(`   Creator: ${retrievedData.creator}`);
          console.log(`   Status: ${retrievedData.status} (0=active, 1=closed, 2=ended)`);
          console.log(`   Votes: [${retrievedData.votes.join(', ')}]`);
          console.log(`   Created: ${new Date(retrievedData.startTime).toLocaleString()}`);
          console.log(`   Expires: ${new Date(retrievedData.endTime).toLocaleString()}`);
          
          // Overall result
          const overallMatch = titleMatch && descMatch && optionsMatch && durationMatch;
          console.log(`\n🎯 OVERALL RESULT: ${overallMatch ? '✅ PASS - All data matches!' : '❌ FAIL - Data mismatch detected!'}`);
          
          createdPolls.push({
            testIndex: i + 1,
            pollId: retrievedData.id,
            inputData: testPoll,
            retrievedData: retrievedData,
            createError: createError?.message,
            getPollError: getPollError?.message,
            matches: {
              title: titleMatch,
              description: descMatch,
              options: optionsMatch,
              duration: durationMatch,
              overall: overallMatch
            }
          });
          
        } else {
          console.log('\n❌ Failed to retrieve poll data from contract');
          console.log('\n📋 POSSIBLE CAUSES:');
          console.log('   1. CreatePoll function failed to store data');
          console.log('   2. GetPoll function is not emitting the expected events');
          console.log('   3. Event data format doesn\'t match our parsing expectations');
          console.log('   4. Transaction timing - data not yet confirmed on blockchain');
          console.log('   5. Contract storage or retrieval logic issues');
          
          createdPolls.push({
            testIndex: i + 1,
            pollId: pollId,
            inputData: testPoll,
            retrievedData: null,
            createError: createError?.message,
            getPollError: getPollError?.message,
            matches: {
              title: false,
              description: false,
              options: false,
              duration: false,
              overall: false
            }
          });
        }
        
      } catch (error) {
        console.error(`❌ Test ${i + 1} failed:`, error.message);
        createdPolls.push({
          testIndex: i + 1,
          pollId: null,
          inputData: testPoll,
          retrievedData: null,
          error: error.message,
          matches: {
            title: false,
            description: false,
            options: false,
            duration: false,
            overall: false
          }
        });
      }
      
      // Wait before next test
      if (i < TEST_POLLS.length - 1) {
        console.log('\n⏳ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Final summary
    console.log(`\n${'═'.repeat(80)}`);
    console.log('🏁 FINAL TEST SUMMARY');
    console.log(`${'═'.repeat(80)}`);
    
    const passedTests = createdPolls.filter(test => test.matches.overall).length;
    const totalTests = createdPolls.length;
    
    console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);
    
    createdPolls.forEach(test => {
      console.log(`\n📋 Test ${test.testIndex}: "${test.inputData.title}"`);
      console.log(`   Poll ID: ${test.pollId || 'N/A'}`);
      console.log(`   Title Match: ${test.matches.title ? '✅' : '❌'}`);
      console.log(`   Description Match: ${test.matches.description ? '✅' : '❌'}`);
      console.log(`   Options Match: ${test.matches.options ? '✅' : '❌'}`);
      console.log(`   Duration Match: ${test.matches.duration ? '✅' : '❌'}`);
      console.log(`   Overall: ${test.matches.overall ? '✅ PASS' : '❌ FAIL'}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });
    
    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! The contract correctly stores and retrieves data.');
    } else {
      console.log('\n⚠️ SOME TESTS FAILED! There may be issues with data storage or retrieval.');
      console.log('\n🔧 Possible causes:');
      console.log('   1. Contract serialization/deserialization issues');
      console.log('   2. Event data format problems');
      console.log('   3. Timing issues with blockchain transactions');
      console.log('   4. Parameter encoding/decoding mismatches');
    }
    
    console.log(`\n📋 View contract on explorer: https://buildnet-explorer.massa.net/address/${CONTRACT_ADDRESS}`);
    return passedTests === totalTests;

  } catch (error) {
    console.error('💥 Test script failed:', error);
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Check if the contract is properly deployed');
    console.log('2. Verify the private key has sufficient MASSA balance');
    console.log('3. Ensure network connectivity to buildnet');
    console.log('4. Check the contract address is correct');
    return false;
  }
}

// Execute test if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCompleteDataFlow().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { testCompleteDataFlow };