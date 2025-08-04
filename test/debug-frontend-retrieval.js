#!/usr/bin/env node

// Debug script to test the same getAllPolls logic used by PollsApp.tsx
import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  JsonRpcProvider,
} from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = process.env.VITE_POLLS_CONTRACT_ADDRESS || 'AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6';

// Replicate the parsePollData function from contractInteraction.ts
function parsePollData(serializedData) {
  try {
    console.log(`🔍 Parsing serialized data: "${serializedData}"`);
    
    // Parse format: id|title|description|options|creator|startTime|endTime|status|votes
    const parts = serializedData.split("|");
    console.log(`📋 Split into ${parts.length} parts:`, parts);
    
    if (parts.length < 9) {
      console.log(`⚠️ Invalid poll data format: expected 9+ parts, got ${parts.length}`);
      return null;
    }

    const id = parts[0].trim();
    const title = parts[1].trim();
    const description = parts[2].trim();
    const optionsStr = parts[3].trim();
    const creator = parts[4].trim();
    const startTime = parseInt(parts[5].trim());
    const endTime = parseInt(parts[6].trim());
    const status = parseInt(parts[7].trim());
    const votesStr = parts[8].trim();

    console.log(`📊 Parsed basic fields:`);
    console.log(`   ID: "${id}"`);
    console.log(`   Title: "${title}"`);
    console.log(`   Description: "${description}"`);
    console.log(`   Options string: "${optionsStr}"`);
    console.log(`   Creator: "${creator}"`);
    console.log(`   Start time: ${startTime} (${new Date(startTime).toLocaleString()})`);
    console.log(`   End time: ${endTime} (${new Date(endTime).toLocaleString()})`);
    console.log(`   Status: ${status}`);
    console.log(`   Votes string: "${votesStr}"`);

    // Parse options (separated by ||)
    const options = optionsStr.split("||").map(opt => opt.trim()).filter(opt => opt.length > 0);
    console.log(`📋 Parsed options: [${options.map(opt => `"${opt}"`).join(', ')}]`);
    
    // Parse votes (comma-separated)
    const votes = votesStr.split(",").map(v => parseInt(v.trim())).filter(v => !isNaN(v));
    console.log(`🗳️ Parsed votes: [${votes.join(', ')}]`);
    
    // Determine if poll is active (status 0 = active, and within time bounds)
    const currentTime = Date.now();
    const isActive = status === 0 && currentTime < endTime;
    console.log(`⏰ Is active: ${isActive} (status=${status}, current=${currentTime}, end=${endTime})`);

    const result = {
      id,
      title,
      description,
      options,
      creator,
      votes,
      isActive,
      createdAt: startTime
    };
    
    console.log(`✅ Successfully parsed poll data:`, result);
    return result;
  } catch (error) {
    console.error("❌ Error parsing poll data:", error);
    return null;
  }
}

// Replicate the getAllPolls function logic from contractInteraction.ts
async function debugGetAllPolls() {
  console.log('🔍 DEBUG: Replicating frontend getAllPolls logic');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network: Massa Buildnet`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const provider = JsonRpcProvider.buildnet();
    
    console.log("🔍 Fetching all polls from blockchain...");
    
    // Call the getAllPolls function to trigger events
    try {
      console.log("📋 Calling getAllPolls function...");
      await provider.readSC({
        target: CONTRACT_ADDRESS,
        func: "getAllPolls",
        parameter: new Args().serialize(),
      });
      console.log("✅ Called getAllPolls function successfully");
    } catch (readError) {
      console.log("⚠️ ReadSC getAllPolls failed:", readError.message);
    }
    
    // Get all events from the contract
    console.log("\n📋 Fetching contract events...");
    const events = await provider.getEvents({
      smartContractAddress: CONTRACT_ADDRESS,
    });
    
    console.log(`📋 Found ${events.length} total contract events`);
    
    // Log all events for debugging
    console.log("\n📋 ALL CONTRACT EVENTS:");
    events.forEach((event, index) => {
      console.log(`   ${index + 1}. "${event.data}"`);
    });
    
    // Look for poll data events that contain serialized poll information
    console.log("\n🔍 Filtering for poll data events...");
    const pollDataEvents = events.filter(event => 
      event.data.match(/^Poll \d+:/) || // "Poll 1: data..."
      event.data.match(/^\d+\|/) // Serialized data starting with poll ID
    );
    
    console.log(`📊 Found ${pollDataEvents.length} poll data events:`);
    pollDataEvents.forEach((event, index) => {
      console.log(`   ${index + 1}. "${event.data}"`);
    });
    
    const polls = [];
    const processedIds = new Set();
    
    // Parse poll data events first (most reliable)
    console.log("\n🔍 Parsing poll data events...");
    for (const event of pollDataEvents) {
      try {
        let pollData = event.data;
        console.log(`\n📋 Processing event: "${pollData}"`);
        
        // Extract data if it's in "Poll X: data" format
        if (pollData.includes("Poll ") && pollData.includes(":")) {
          const originalData = pollData;
          pollData = pollData.substring(pollData.indexOf(":") + 1).trim();
          console.log(`📋 Extracted from "Poll X:" format:`);
          console.log(`   Original: "${originalData}"`);
          console.log(`   Extracted: "${pollData}"`);
        }
        
        const poll = parsePollData(pollData);
        if (poll && !processedIds.has(poll.id)) {
          polls.push(poll);
          processedIds.add(poll.id);
          console.log(`✅ Successfully processed poll ${poll.id}: "${poll.title}"`);
        } else if (poll && processedIds.has(poll.id)) {
          console.log(`⚠️ Skipping duplicate poll ID: ${poll.id}`);
        } else {
          console.log(`❌ Failed to parse poll data from event`);
        }
      } catch (parseError) {
        console.log(`❌ Failed to parse poll data event:`, parseError.message);
        continue;
      }
    }
    
    // If no data events found, fall back to creation events
    console.log(`\n📊 Processed ${polls.length} polls from data events`);
    if (polls.length === 0) {
      console.log("⚠️ No poll data events found, falling back to creation events");
      
      const pollCreateEvents = events.filter(event => 
        event.data.includes("Poll created with ID:")
      );
      
      console.log(`🗳️ Found ${pollCreateEvents.length} poll creation events:`);
      pollCreateEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. "${event.data}"`);
      });
      
      // Extract poll IDs from creation events and try to fetch individual poll data
      for (const event of pollCreateEvents) {
        const match = event.data.match(/Poll created with ID: (\d+)/);
        if (match) {
          const pollId = match[1];
          if (!processedIds.has(pollId)) {
            console.log(`\n📊 Processing poll ID from creation event: ${pollId}`);
            
            // Try to get individual poll data
            try {
              console.log(`📋 Calling getPoll for poll ${pollId}...`);
              const args = new Args().addString(pollId);
              await provider.readSC({
                target: CONTRACT_ADDRESS,
                func: "getPoll", 
                parameter: args.serialize(),
              });
              
              console.log(`📋 Called getPoll for poll ${pollId}, checking for new events...`);
              
              // Get fresh events to find poll data
              const freshEvents = await provider.getEvents({
                smartContractAddress: CONTRACT_ADDRESS,
              });
              
              // Look for poll data events that contain the serialized poll information
              const specificPollDataEvents = freshEvents.filter(event => 
                event.data.includes(`Poll ${pollId}:`) || 
                event.data.includes(`Poll data:`) ||
                event.data.match(new RegExp(`^${pollId}\\|`))
              );
              
              console.log(`📋 Found ${specificPollDataEvents.length} specific poll data events for poll ${pollId}`);
              
              let foundPollData = false;
              for (const dataEvent of specificPollDataEvents) {
                let pollData = dataEvent.data;
                console.log(`📋 Processing specific poll data event: "${pollData}"`);
                
                // Extract data if it's in "Poll X: data" format
                if (pollData.includes("Poll ") && pollData.includes(":")) {
                  pollData = pollData.substring(pollData.indexOf(":") + 1).trim();
                }
                
                const poll = parsePollData(pollData);
                if (poll && poll.id === pollId) {
                  polls.push(poll);
                  processedIds.add(pollId);
                  foundPollData = true;
                  console.log(`✅ Successfully retrieved individual poll data for poll ${pollId}`);
                  break;
                }
              }
              
              if (!foundPollData) {
                console.log(`⚠️ Could not retrieve data for poll ${pollId}, using fallback`);
                polls.push({
                  id: pollId,
                  creator: "Unknown",
                  title: `Poll #${pollId}`,
                  description: `Poll created on blockchain`,
                  options: ["Option 1", "Option 2"],
                  votes: [0, 0],
                  isActive: true,
                  createdAt: Date.now()
                });
                processedIds.add(pollId);
              }
              
            } catch (getPollError) {
              console.log(`❌ Failed to get individual poll data for poll ${pollId}:`, getPollError.message);
            }
          }
        }
      }
    }
    
    // Sort polls by ID (newest first)
    polls.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    
    console.log(`\n✅ Final result: Successfully retrieved ${polls.length} polls`);
    console.log('\n📊 FINAL POLL SUMMARY:');
    polls.forEach((poll, index) => {
      console.log(`\n   Poll ${index + 1}:`);
      console.log(`      ID: ${poll.id}`);
      console.log(`      Title: "${poll.title}"`);
      console.log(`      Description: "${poll.description}"`);
      console.log(`      Options: [${poll.options.map(opt => `"${opt}"`).join(', ')}]`);
      console.log(`      Votes: [${poll.votes.join(', ')}]`);
      console.log(`      Active: ${poll.isActive}`);
      console.log(`      Creator: ${poll.creator}`);
    });
    
    return polls;
    
  } catch (error) {
    console.error("❌ Error in debugGetAllPolls:", error);
    return [];
  }
}

// Execute debug if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugGetAllPolls().catch(error => {
    console.error('💥 Debug script failed:', error);
    process.exit(1);
  });
}

export { debugGetAllPolls, parsePollData };