#!/usr/bin/env node

// Simple diagnostic to isolate the exact issue
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

async function simpleDiagnostic() {
  console.log('🔬 SIMPLE DIAGNOSTIC TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const account = await Account.fromPrivateKey(process.env.PRIVATE_KEY);
    const provider = JsonRpcProvider.buildnet(account);
    
    console.log(`🔑 Account: ${account.address}`);

    // Step 1: Check current contract state BEFORE creating anything
    console.log('\n📋 STEP 1: Check current contract state');
    let initialEvents = [];
    try {
      initialEvents = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      console.log(`📊 Initial events: ${initialEvents.length}`);
      console.log('📋 Last 5 events:');
      initialEvents.slice(-5).forEach((event, index) => {
        console.log(`   ${index + 1}. "${event.data}"`);
      });
    } catch (error) {
      console.log('❌ Failed to get initial events:', error.message);
      return;
    }

    // Step 2: Create ONE simple poll
    console.log('\n📝 STEP 2: Create ONE simple poll');
    const testTitle = "Simple Test Poll";
    const testDescription = "A basic test poll for debugging";
    const testOptions = ["Yes", "No"];
    
    console.log(`📋 Creating poll:`);
    console.log(`   Title: "${testTitle}"`);
    console.log(`   Description: "${testDescription}"`);
    console.log(`   Options: [${testOptions.map(o => `"${o}"`).join(', ')}]`);
    console.log(`   Duration: 86400 seconds (1 day)`);

    const args = new Args()
      .addString(testTitle)
      .addString(testDescription)
      .addU32(BigInt(testOptions.length));
    
    testOptions.forEach(option => {
      args.addString(option);
    });
    
    args.addU64(BigInt(86400)); // 1 day

    let createResult = null;
    let createError = null;
    
    try {
      console.log('🚀 Calling createPoll...');
      createResult = await provider.callSC({
        target: CONTRACT_ADDRESS,
        func: 'createPoll',
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });
      console.log('✅ createPoll succeeded');
      console.log('📋 Result:', createResult);
    } catch (error) {
      createError = error;
      console.log('❌ createPoll failed:', error.message);
      console.log('📋 Full error:', error);
    }

    // Step 3: Wait and check for new events
    console.log('\n⏳ STEP 3: Wait and check for new events');
    console.log('Waiting 6 seconds for blockchain confirmation...');
    await new Promise(resolve => setTimeout(resolve, 6000));

    let afterCreateEvents = [];
    try {
      afterCreateEvents = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      console.log(`📊 Events after create: ${afterCreateEvents.length}`);
      
      const newEvents = afterCreateEvents.slice(initialEvents.length);
      console.log(`📋 NEW events since create: ${newEvents.length}`);
      newEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. "${event.data}"`);
      });
    } catch (error) {
      console.log('❌ Failed to get after-create events:', error.message);
    }

    // Step 4: Find poll ID from creation event
    console.log('\n🔍 STEP 4: Find poll ID from creation event');
    let pollId = null;
    const createEvents = afterCreateEvents.filter(event => 
      event.data.includes("Poll created with ID:")
    );
    
    console.log(`📋 Poll creation events found: ${createEvents.length}`);
    createEvents.forEach((event, index) => {
      console.log(`   ${index + 1}. "${event.data}"`);
    });
    
    if (createEvents.length > 0) {
      const match = createEvents[createEvents.length - 1].data.match(/Poll created with ID: (\d+)/);
      if (match) {
        pollId = match[1];
        console.log(`✅ Found poll ID: ${pollId}`);
      } else {
        console.log('❌ Could not extract poll ID from creation event');
      }
    } else {
      console.log('❌ No poll creation events found');
      console.log('🔍 This indicates createPoll function did not execute successfully');
    }

    if (!pollId) {
      console.log('\n🚨 CRITICAL: No poll ID found - createPoll failed');
      console.log('📋 Possible causes:');
      console.log('   1. Contract function threw an assertion error');
      console.log('   2. Transaction failed due to insufficient gas/fee');
      console.log('   3. Contract address is incorrect');
      console.log('   4. Network connectivity issues');
      
      if (createError) {
        console.log('\n❌ Create Error Details:');
        console.log(`   Message: ${createError.message}`);
        console.log(`   Type: ${createError.constructor.name}`);
      }
      return;
    }

    // Step 5: Try to retrieve the poll
    console.log(`\n📊 STEP 5: Try to retrieve poll ${pollId}`);
    let getPollResult = null;
    let getPollError = null;
    
    try {
      console.log(`🔍 Calling getPoll for ID ${pollId}...`);
      const getPollArgs = new Args().addString(pollId);
      getPollResult = await provider.readSC({
        target: CONTRACT_ADDRESS,
        func: 'getPoll',
        parameter: getPollArgs.serialize(),
      });
      console.log('✅ getPoll succeeded');
      console.log('📋 Result:', getPollResult);
    } catch (error) {
      getPollError = error;
      console.log('❌ getPoll failed:', error.message);
      console.log('📋 Full error:', error);
    }

    // Step 6: Check for poll data events after getPoll
    console.log('\n📋 STEP 6: Check for poll data events');
    let finalEvents = [];
    try {
      finalEvents = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      console.log(`📊 Final total events: ${finalEvents.length}`);
      
      const pollDataEvents = finalEvents.filter(event => 
        event.data.includes(`Poll ${pollId}:`) || 
        event.data.includes(`Poll data:`) ||
        event.data.match(new RegExp(`^${pollId}\\|`))
      );
      
      console.log(`📋 Poll data events for poll ${pollId}: ${pollDataEvents.length}`);
      pollDataEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. "${event.data}"`);
      });

      if (pollDataEvents.length > 0) {
        console.log('\n🔍 ANALYZING POLL DATA EVENT:');
        const event = pollDataEvents[0];
        let pollData = event.data;
        
        console.log(`📋 Raw event: "${pollData}"`);
        
        // Try to extract the serialized data
        if (pollData.includes("Poll data: ")) {
          pollData = pollData.substring("Poll data: ".length).trim();
          console.log(`📋 Extracted data: "${pollData}"`);
        } else if (pollData.includes(`Poll ${pollId}: `)) {
          pollData = pollData.substring(`Poll ${pollId}: `.length).trim();
          console.log(`📋 Extracted data: "${pollData}"`);
        }
        
        // Try to parse the serialized data
        console.log('\n🔍 ATTEMPTING TO PARSE:');
        try {
          const parts = pollData.split("|");
          console.log(`📋 Split into ${parts.length} parts:`, parts);
          
          if (parts.length >= 9) {
            console.log('📊 PARSED DATA:');
            console.log(`   ID: "${parts[0]}"`);
            console.log(`   Title: "${parts[1]}"`);
            console.log(`   Description: "${parts[2]}"`);
            console.log(`   Options string: "${parts[3]}"`);
            console.log(`   Creator: "${parts[4]}"`);
            console.log(`   Start time: "${parts[5]}"`);
            console.log(`   End time: "${parts[6]}"`);
            console.log(`   Status: "${parts[7]}"`);
            console.log(`   Votes: "${parts[8]}"`);
            
            const retrievedOptions = parts[3].split("||");
            console.log(`📋 Parsed options: [${retrievedOptions.map(o => `"${o}"`).join(', ')}]`);
            
            console.log('\n✅ DATA COMPARISON:');
            console.log(`📝 Title: "${testTitle}" vs "${parts[1]}" ${testTitle === parts[1] ? '✅' : '❌'}`);
            console.log(`📄 Description: "${testDescription}" vs "${parts[2]}" ${testDescription === parts[2] ? '✅' : '❌'}`);
            console.log(`📋 Options: [${testOptions.join(', ')}] vs [${retrievedOptions.join(', ')}] ${JSON.stringify(testOptions) === JSON.stringify(retrievedOptions) ? '✅' : '❌'}`);
            
          } else {
            console.log(`❌ Invalid format: expected 9+ parts, got ${parts.length}`);
          }
        } catch (parseError) {
          console.log(`❌ Parse error: ${parseError.message}`);
        }
      } else {
        console.log('❌ No poll data events found');
        console.log('🔍 This indicates getPoll function did not emit expected events');
      }
      
    } catch (error) {
      console.log('❌ Failed to get final events:', error.message);
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 DIAGNOSTIC SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📋 CreatePoll call: ${createError ? '❌ Failed' : '✅ Success'}`);
    console.log(`📋 Poll ID found: ${pollId ? '✅ ' + pollId : '❌ No'}`);
    console.log(`📋 GetPoll call: ${getPollError ? '❌ Failed' : '✅ Success'}`);
    console.log(`📋 Poll data events: ${finalEvents.filter(e => e.data.includes(`Poll ${pollId}:`) || e.data.includes(`Poll data:`)).length}`);
    
    if (createError) {
      console.log('\n❌ CREATE POLL ERROR:');
      console.log(`   ${createError.message}`);
    }
    
    if (getPollError) {
      console.log('\n❌ GET POLL ERROR:');
      console.log(`   ${getPollError.message}`);
    }

  } catch (error) {
    console.error('💥 Diagnostic failed:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simpleDiagnostic().catch(error => {
    console.error('💥 Diagnostic runner failed:', error);
    process.exit(1);
  });
}

export { simpleDiagnostic };