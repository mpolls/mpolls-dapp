#!/usr/bin/env node

// Comprehensive test to retrieve and display all data from the contract
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

// Parsing function that matches the updated frontend logic
function parsePollData(serializedData) {
  try {
    console.log(`🔍 Parsing: "${serializedData}"`);
    
    const parts = serializedData.split("|");
    console.log(`📋 Split into ${parts.length} parts`);
    
    if (parts.length < 9) {
      console.log(`⚠️ Invalid format: expected 9+ parts, got ${parts.length}`);
      return null;
    }

    const id = parts[0].trim();
    const title = parts[1].trim();
    const description = parts[2].trim();
    
    // Find the creator, startTime, endTime, status, votes at the end
    const endIndex = parts.length - 1;
    const votesStr = parts[endIndex].trim();
    const status = parseInt(parts[endIndex - 1].trim());
    const endTime = parseInt(parts[endIndex - 2].trim());
    const startTime = parseInt(parts[endIndex - 3].trim());
    const creator = parts[endIndex - 4].trim();
    
    // Everything between description (index 2) and creator are the options
    const optionStartIndex = 3;
    const optionEndIndex = endIndex - 4;
    
    const optionParts = parts.slice(optionStartIndex, optionEndIndex);
    const options = optionParts.filter(opt => opt.trim().length > 0);
    
    // Parse votes
    const votes = votesStr.split(",").map(v => parseInt(v.trim())).filter(v => !isNaN(v));
    
    // Determine if poll is active
    const currentTime = Date.now();
    const isActive = status === 0 && currentTime < endTime;

    return {
      id,
      title,
      description,
      options,
      creator,
      votes,
      isActive,
      status,
      startTime,
      endTime,
      createdAt: startTime,
      totalVotes: votes.reduce((sum, v) => sum + v, 0)
    };
  } catch (error) {
    console.error("❌ Parse error:", error.message);
    return null;
  }
}

async function retrieveAllContractData() {
  console.log('📊 COMPREHENSIVE CONTRACT DATA RETRIEVAL');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network: Massa Buildnet`);
  console.log(`🔗 Explorer: https://buildnet-explorer.massa.net/address/${CONTRACT_ADDRESS}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    // Create provider (read-only, no account needed for most operations)
    const provider = JsonRpcProvider.buildnet();
    console.log('✅ Connected to Massa buildnet');

    // STEP 1: Get all contract events
    console.log('\n📋 STEP 1: Retrieving all contract events...');
    let allEvents = [];
    try {
      allEvents = await provider.getEvents({
        smartContractAddress: CONTRACT_ADDRESS,
      });
      
      console.log(`📊 Total contract events: ${allEvents.length}`);
      
      if (allEvents.length === 0) {
        console.log('⚠️ No events found - contract may not exist or have no activity');
        return;
      }
      
      console.log('\n📋 All contract events:');
      allEvents.forEach((event, index) => {
        const timestamp = new Date(event.timestamp || Date.now()).toLocaleString();
        console.log(`   ${index + 1}. [${timestamp}] "${event.data}"`);
      });
      
    } catch (error) {
      console.log('❌ Failed to get contract events:', error.message);
      return;
    }

    // STEP 2: Call getAllPolls function
    console.log('\n📊 STEP 2: Calling getAllPolls function...');
    let getAllPollsResult = null;
    let getAllPollsEvents = [];
    
    try {
      getAllPollsResult = await provider.readSC({
        target: CONTRACT_ADDRESS,
        func: 'getAllPolls',
        parameter: new Args().serialize(),
      });
      
      console.log('✅ getAllPolls call successful');
      
      if (getAllPollsResult.info && getAllPollsResult.info.events) {
        getAllPollsEvents = getAllPollsResult.info.events;
        console.log(`📋 Events from getAllPolls: ${getAllPollsEvents.length}`);
        
        getAllPollsEvents.forEach((event, index) => {
          console.log(`   ${index + 1}. "${event.data}"`);
        });
      }
    } catch (error) {
      console.log('❌ getAllPolls failed:', error.message);
    }

    // STEP 3: Parse and organize all poll data
    console.log('\n🔍 STEP 3: Parsing all poll data...');
    
    const allPollData = [];
    const processedIds = new Set();
    
    // First, collect poll data from getAllPolls events
    if (getAllPollsEvents.length > 0) {
      console.log('\n📊 Parsing getAllPolls events:');
      
      for (const event of getAllPollsEvents) {
        const eventData = event.data;
        
        if (eventData.startsWith('Total polls:')) {
          const match = eventData.match(/Total polls: (\d+)/);
          if (match) {
            console.log(`📈 Total polls in contract: ${match[1]}`);
          }
          continue;
        }
        
        if (eventData.startsWith('Poll ') && eventData.includes(':')) {
          const pollMatch = eventData.match(/^Poll (\d+): (.+)$/);
          if (pollMatch) {
            const pollId = pollMatch[1];
            const pollData = pollMatch[2];
            
            if (!processedIds.has(pollId)) {
              console.log(`\n🔍 Processing Poll ${pollId}:`);
              const parsed = parsePollData(pollData);
              
              if (parsed) {
                allPollData.push(parsed);
                processedIds.add(pollId);
                console.log(`✅ Successfully parsed Poll ${pollId}`);
              } else {
                console.log(`❌ Failed to parse Poll ${pollId}`);
              }
            }
          }
        }
      }
    }
    
    // Also check for poll data in global events
    console.log('\n📊 Checking global events for additional poll data:');
    const pollDataEvents = allEvents.filter(event => 
      event.data.includes('Poll data:') ||
      (event.data.startsWith('Poll ') && event.data.includes(':') && !event.data.includes('created'))
    );
    
    console.log(`📋 Found ${pollDataEvents.length} poll data events in global events`);
    
    for (const event of pollDataEvents) {
      let pollData = event.data;
      let pollId = null;
      
      if (pollData.startsWith('Poll data: ')) {
        pollData = pollData.substring('Poll data: '.length);
        // Extract ID from the data
        const idMatch = pollData.match(/^(\d+)\|/);
        if (idMatch) {
          pollId = idMatch[1];
        }
      } else if (pollData.startsWith('Poll ') && pollData.includes(': ')) {
        const match = pollData.match(/^Poll (\d+): (.+)$/);
        if (match) {
          pollId = match[1];
          pollData = match[2];
        }
      }
      
      if (pollId && !processedIds.has(pollId)) {
        console.log(`\n🔍 Processing Poll ${pollId} from global events:`);
        const parsed = parsePollData(pollData);
        
        if (parsed) {
          allPollData.push(parsed);
          processedIds.add(pollId);
          console.log(`✅ Successfully parsed Poll ${pollId}`);
        }
      }
    }

    // STEP 4: Display comprehensive poll information
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 COMPREHENSIVE POLL DATA SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    
    if (allPollData.length === 0) {
      console.log('❌ No valid poll data found');
      console.log('\n🔧 Possible reasons:');
      console.log('   1. No polls have been created yet');
      console.log('   2. Contract functions are not emitting expected events');
      console.log('   3. Data format has changed and parsing is failing');
      return;
    }
    
    // Sort polls by ID
    allPollData.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    console.log(`🎯 Found ${allPollData.length} valid polls\n`);
    
    // Display each poll in detail
    allPollData.forEach((poll, index) => {
      console.log(`${'─'.repeat(60)}`);
      console.log(`📋 POLL #${poll.id} (${index + 1}/${allPollData.length})`);
      console.log(`${'─'.repeat(60)}`);
      
      console.log(`📝 Title: "${poll.title}"`);
      console.log(`📄 Description: "${poll.description}"`);
      console.log(`👤 Creator: ${poll.creator}`);
      
      console.log(`\n📊 Options & Votes:`);
      poll.options.forEach((option, optIndex) => {
        const votes = poll.votes[optIndex] || 0;
        const percentage = poll.totalVotes > 0 ? ((votes / poll.totalVotes) * 100).toFixed(1) : '0.0';
        console.log(`   ${optIndex + 1}. "${option}": ${votes} votes (${percentage}%)`);
      });
      
      console.log(`\n📈 Statistics:`);
      console.log(`   Total Votes: ${poll.totalVotes}`);
      console.log(`   Status: ${poll.isActive ? '🟢 Active' : '🔴 Inactive'} (${poll.status})`);
      
      console.log(`\n⏰ Timing:`);
      console.log(`   Created: ${new Date(poll.startTime).toLocaleString()}`);
      console.log(`   Expires: ${new Date(poll.endTime).toLocaleString()}`);
      
      const timeLeft = poll.endTime - Date.now();
      if (timeLeft > 0) {
        const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        console.log(`   Time Left: ${days} days, ${hours} hours`);
      } else {
        console.log(`   Time Left: Expired`);
      }
      
      console.log(`\n🔍 Raw Data:`);
      console.log(`   ID: ${poll.id}`);
      console.log(`   Options: [${poll.options.map(o => `"${o}"`).join(', ')}]`);
      console.log(`   Votes: [${poll.votes.join(', ')}]`);
      console.log(`   Start Time: ${poll.startTime}`);
      console.log(`   End Time: ${poll.endTime}`);
    });

    // STEP 5: Contract statistics
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📈 CONTRACT STATISTICS');
    console.log(`${'═'.repeat(60)}`);
    
    const activePolls = allPollData.filter(p => p.isActive).length;
    const inactivePolls = allPollData.length - activePolls;
    const totalVotesAllPolls = allPollData.reduce((sum, poll) => sum + poll.totalVotes, 0);
    const averageOptions = allPollData.length > 0 ? (allPollData.reduce((sum, poll) => sum + poll.options.length, 0) / allPollData.length).toFixed(1) : 0;
    
    console.log(`📊 Total Polls: ${allPollData.length}`);
    console.log(`🟢 Active Polls: ${activePolls}`);
    console.log(`🔴 Inactive Polls: ${inactivePolls}`);
    console.log(`🗳️ Total Votes (All Polls): ${totalVotesAllPolls}`);
    console.log(`📋 Average Options per Poll: ${averageOptions}`);
    
    if (allPollData.length > 0) {
      const oldestPoll = allPollData.reduce((oldest, poll) => 
        poll.startTime < oldest.startTime ? poll : oldest
      );
      const newestPoll = allPollData.reduce((newest, poll) => 
        poll.startTime > newest.startTime ? poll : newest
      );
      
      console.log(`📅 Oldest Poll: #${oldestPoll.id} "${oldestPoll.title}" (${new Date(oldestPoll.startTime).toLocaleDateString()})`);
      console.log(`🆕 Newest Poll: #${newestPoll.id} "${newestPoll.title}" (${new Date(newestPoll.startTime).toLocaleDateString()})`);
      
      const mostVoted = allPollData.reduce((most, poll) => 
        poll.totalVotes > most.totalVotes ? poll : most
      );
      console.log(`🔥 Most Voted: #${mostVoted.id} "${mostVoted.title}" (${mostVoted.totalVotes} votes)`);
    }

    // STEP 6: Data validation summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log('✅ DATA VALIDATION SUMMARY');
    console.log(`${'═'.repeat(60)}`);
    
    let validationIssues = 0;
    
    allPollData.forEach(poll => {
      const issues = [];
      
      if (!poll.title || poll.title.trim().length === 0) {
        issues.push('Empty title');
      }
      
      if (!poll.description || poll.description.trim().length === 0) {
        issues.push('Empty description');
      }
      
      if (poll.options.length < 2) {
        issues.push(`Only ${poll.options.length} option(s)`);
      }
      
      if (poll.votes.length !== poll.options.length) {
        issues.push(`Vote count mismatch: ${poll.votes.length} votes vs ${poll.options.length} options`);
      }
      
      if (poll.startTime >= poll.endTime) {
        issues.push('Invalid time range');
      }
      
      if (issues.length > 0) {
        console.log(`⚠️ Poll #${poll.id}: ${issues.join(', ')}`);
        validationIssues++;
      }
    });
    
    if (validationIssues === 0) {
      console.log('✅ All polls have valid data structure');
    } else {
      console.log(`⚠️ Found ${validationIssues} poll(s) with validation issues`);
    }
    
    console.log(`\n🎉 Data retrieval completed successfully!`);
    console.log(`📊 Retrieved and parsed ${allPollData.length} polls from the contract`);
    
  } catch (error) {
    console.error('💥 Test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if the contract address is correct');
    console.log('2. Verify network connectivity');
    console.log('3. Ensure the contract is deployed and has data');
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  retrieveAllContractData().catch(error => {
    console.error('💥 Script runner failed:', error);
    process.exit(1);
  });
}

export { retrieveAllContractData };