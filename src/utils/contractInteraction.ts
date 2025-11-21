import { 
  Args,
  Mas
} from "@massalabs/massa-web3";
import { 
  getWallets,
  Wallet
} from "@massalabs/wallet-provider";
import { Provider } from "@massalabs/massa-web3";

export interface PollCreationParams {
  title: string;
  description: string;
  options: string[];
  durationInSeconds: number;
  projectId?: number; // Optional project assignment
  // New economics parameters
  fundingType: number; // 0=SELF_FUNDED, 1=COMMUNITY_FUNDED, 2=TREASURY_FUNDED
  distributionMode: number; // 0=EQUAL_SPLIT, 1=FIXED_REWARD, 2=WEIGHTED_QUALITY
  distributionType: number; // 0=MANUAL_PULL, 1=MANUAL_PUSH, 2=AUTONOMOUS
  fixedRewardAmount: number; // Amount per voter (if FIXED_REWARD mode)
  fundingGoal: number; // Target amount for community-funded polls
  rewardPoolAmount: number; // Initial funding for self-funded polls
  // Reward token parameters
  rewardTokenType: number; // 0=NATIVE_MASSA, 1=CUSTOM_TOKEN
  voteRewardAmount: number; // Reward amount per vote
  createPollRewardAmount: number; // Reward for creating the poll
}

export interface ProjectCreationParams {
  name: string;
  description: string;
}

export interface ContractProject {
  id: string;
  name: string;
  description: string;
  creator: string;
  createdAt: number;
  pollIds: string[];
}

export interface ContractPoll {
  id: string;
  creator: string;
  title: string;
  description: string;
  options: string[];
  votes: number[];
  createdAt: number;
  endTime: number;
  status: 'active' | 'closed' | 'ended' | 'for_claiming';
  projectId?: number; // Optional project assignment
  // New economics fields
  rewardPool: number; // Current reward pool in nanoMASSA
  fundingType: number; // 0=SELF_FUNDED, 1=COMMUNITY_FUNDED, 2=TREASURY_FUNDED
  distributionMode: number; // 0=EQUAL_SPLIT, 1=FIXED_REWARD, 2=WEIGHTED_QUALITY
  distributionType: number; // 0=MANUAL_PULL, 1=MANUAL_PUSH, 2=AUTONOMOUS
  fixedRewardAmount: number; // Amount per voter (if FIXED_REWARD mode)
  fundingGoal: number; // Target amount for community-funded polls
  treasuryApproved: boolean; // Approval status for treasury-funded polls
  rewardsDistributed: boolean; // Whether rewards have been distributed
}

export class PollsContract {
  private contractAddress: string;
  private wallet: Wallet | null = null;
  private account: Provider | null = null;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
    console.log(`🔗 Polls Contract initialized with address: ${contractAddress}`);
    console.log(`🌐 Network: Massa Buildnet`);
    console.log(`📋 Explorer: https://buildnet-explorer.massa.net/address/${contractAddress}`);
  }

  async connectWallet(): Promise<boolean> {
    try {
      // Get available wallet providers
      const wallets = await getWallets();
      if (wallets.length === 0) {
        throw new Error("No wallet providers found. Please install MassaStation or Bearby wallet.");
      }

      // Try to connect to the first available wallet
      this.wallet = wallets[0];
      await this.wallet.connect();
      
      // Get accounts from the connected wallet
      const accounts = await this.wallet.accounts();
      if (accounts.length === 0) {
        throw new Error("No accounts found in wallet");
      }

      this.account = accounts[0];
      return true;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      this.wallet = null;
      this.account = null;
      return false;
    }
  }

  async isWalletConnected(): Promise<boolean> {
    try {
      if (this.wallet && this.account) {
        const connected = await this.wallet.connected();
        return connected;
      }
      return false;
    } catch {
      return false;
    }
  }

  async getWalletAddress(): Promise<string | null> {
    try {
      if (this.wallet && this.account) {
        const accounts = await this.wallet.accounts();
        if (accounts.length > 0) {
          // Get the address from the account provider
          const accountProvider = accounts[0];
          // The account provider should have an address property
          if (accountProvider && typeof accountProvider === 'object' && 'address' in accountProvider) {
            return (accountProvider as any).address || null;
          }
          // Fallback: try to get address from wallet name
          // For now, return a placeholder since the wallet provider API varies
          return "Connected Wallet";
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  getWalletName(): string | null {
    return this.wallet ? this.wallet.name() : null;
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  getExplorerUrl(): string {
    return `https://buildnet-explorer.massa.net/address/${this.contractAddress}`;
  }

  async createPoll(params: PollCreationParams): Promise<string> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("🚀 Creating poll with parameters:", {
        contractAddress: this.contractAddress,
        functionName: "createPoll",
        title: params.title,
        description: params.description,
        options: params.options,
        duration: params.durationInSeconds,
        walletName: this.getWalletName(),
        network: "Massa Buildnet",
        explorer: `https://buildnet-explorer.massa.net/address/${this.contractAddress}`
      });

      // Build arguments with new economics parameters
      const args = new Args()
        .addString(params.title)
        .addString(params.description)
        .addU32(BigInt(params.options.length));

      // Add each option separately
      params.options.forEach(option => {
        args.addString(option);
      });

      args.addU64(BigInt(params.durationInSeconds));

      // Add optional projectId (0 means no project)
      if (params.projectId && params.projectId > 0) {
        args.addU64(BigInt(params.projectId));
      } else {
        args.addU64(BigInt(0));
      }

      // Add new economics parameters
      args.addU8(BigInt(params.fundingType));
      args.addU8(BigInt(params.distributionMode));
      args.addU8(BigInt(params.distributionType));

      // Convert MASSA to nanoMASSA (1 MASSA = 10^9 nanoMASSA)
      const fixedRewardInNano = BigInt(Math.floor(params.fixedRewardAmount * 1e9));
      const fundingGoalInNano = BigInt(Math.floor(params.fundingGoal * 1e9));

      args.addU64(fixedRewardInNano);
      args.addU64(fundingGoalInNano);

      // Add reward token parameters
      args.addU8(BigInt(params.rewardTokenType));

      // Convert token amounts to smallest unit (9 decimals for MPOLLS, nanoMASSA for native)
      const voteRewardInSmallestUnit = BigInt(Math.floor(params.voteRewardAmount * 1e9));
      const createRewardInSmallestUnit = BigInt(Math.floor(params.createPollRewardAmount * 1e9));

      args.addU64(voteRewardInSmallestUnit);
      args.addU64(createRewardInSmallestUnit);

      // Add reward pool amount (for MPOLLS token funding)
      const rewardPoolInSmallestUnit = BigInt(Math.floor(params.rewardPoolAmount * 1e9));
      args.addU64(rewardPoolInSmallestUnit);

      console.log("📦 Prepared arguments with economics:", {
        title: params.title,
        description: params.description,
        optionCount: params.options.length,
        options: params.options,
        duration: `${params.durationInSeconds} seconds`,
        fundingType: params.fundingType,
        distributionMode: params.distributionMode,
        distributionType: params.distributionType,
        fixedRewardAmount: params.fixedRewardAmount,
        fundingGoal: params.fundingGoal,
        rewardPoolAmount: params.rewardPoolAmount,
        rewardTokenType: params.rewardTokenType,
        voteRewardAmount: params.voteRewardAmount,
        createPollRewardAmount: params.createPollRewardAmount
      });

      // Make the actual blockchain transaction using wallet provider
      console.log("🔗 Calling smart contract with:");
      console.log("   Target:", this.contractAddress);
      console.log("   Function:", "createPoll");
      console.log("   Fee:", "0.01 MASSA");

      // Convert reward pool amount to nanoMASSA
      // Only send MASSA coins with transaction if using NATIVE_MASSA (rewardTokenType === 0)
      // For MPOLLS tokens (rewardTokenType === 1), coins should be 0 (tokens pulled via transferFrom)
      let coinsToSend: bigint;
      if (params.rewardTokenType === 0) {
        // NATIVE_MASSA: send MASSA with transaction
        coinsToSend = BigInt(Math.floor(params.rewardPoolAmount * 1e9));
      } else {
        // CUSTOM_TOKEN: don't send MASSA (tokens are pulled from user's balance)
        coinsToSend = BigInt(0);
      }

      console.log("   Coins to send:", coinsToSend, params.rewardTokenType === 0 ? "nanoMASSA" : "(0 - using MPOLLS tokens)");

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "createPoll",
        parameter: args.serialize(),
        coins: coinsToSend, // Send MASSA only for native token rewards
        fee: Mas.fromString('0.01'), // Use same fee format as working implementation
      });

      console.log("🔗 Transaction submitted to blockchain");

      console.log("✅ Poll creation transaction successful!");
      console.log("📋 Transaction result:", result);
      
      // The contract doesn't return a poll ID directly, but emits an event
      // We'll return "success" and let the frontend handle the refresh
      
      // Wait a moment for the transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to get the latest poll ID from events
      try {
        const { JsonRpcProvider } = await import("@massalabs/massa-web3");
        const provider = JsonRpcProvider.buildnet();
        
        const events = await provider.getEvents({
          smartContractAddress: this.contractAddress,
        });
        
        // Look for the latest poll creation event
        const pollCreateEvents = events.filter(event => 
          event.data.includes("Poll created with ID:")
        );
        
        if (pollCreateEvents.length > 0) {
          const latestEvent = pollCreateEvents[pollCreateEvents.length - 1];
          const match = latestEvent.data.match(/Poll created with ID: (\d+)/);
          if (match) {
            console.log(`🎉 Successfully created poll with ID: ${match[1]}`);
            return match[1];
          }
        }
      } catch (eventError) {
        console.log("Could not fetch event data, but transaction was successful");
      }
      
      return "Created successfully";
    } catch (error) {
      console.error("💥 Error creating poll:", error);
      
      // Log detailed error information
      if (error instanceof Error) {
        console.error("📋 Error message:", error.message);
        console.error("📋 Error stack:", error.stack);
      }
      
      // Check for specific error types
      let errorMessage = "Unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more specific error messages for common issues
        if (errorMessage.includes("insufficient balance")) {
          errorMessage = "Insufficient balance in your wallet. Please ensure you have enough MASSA tokens.";
        } else if (errorMessage.includes("does not exist")) {
          errorMessage = "Contract not found. Please verify the contract is deployed correctly.";
        } else if (errorMessage.includes("fee is too low")) {
          errorMessage = "Transaction fee is too low. This is a system configuration issue.";
        } else if (errorMessage.includes("function not found")) {
          errorMessage = "Contract function 'createPoll' not found. Please check contract deployment.";
        }
      }
      
      throw new Error(`Failed to create poll: ${errorMessage}`);
    }
  }

  async getPoll(pollId: string): Promise<ContractPoll | null> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();
      
      console.log(`📊 Fetching poll ${pollId} from contract...`);
      
      // Try to read poll data directly first
      try {
        const args = new Args().addString(pollId);
        await provider.readSC({
          target: this.contractAddress,
          func: "getPoll", 
          parameter: args.serialize(),
        });
        
        console.log(`📋 Called getPoll for poll ${pollId}, checking events...`);
      } catch (readError) {
        console.log(`⚠️ ReadSC failed for poll ${pollId}:`, readError);
      }

      // Get events from the contract to parse poll data
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      console.log(`📋 Found ${events.length} contract events`);

      // Look for poll data events that contain the serialized poll information
      const pollDataEvents = events.filter(event =>
        event.data.includes(`Poll ${pollId}:`) ||
        event.data.includes(`Poll data:`) ||
        event.data.match(new RegExp(`^${pollId}\\|`)) // Match serialized format starting with poll ID
      );

      console.log(`📊 Found ${pollDataEvents.length} poll data events for poll ${pollId}`);

      // If we found poll data events, parse the serialized data
      for (const event of pollDataEvents) {
        try {
          let pollData = event.data;

          // Extract data if it's in "Poll X: data" format
          if (pollData.includes("Poll ") && pollData.includes(":")) {
            pollData = pollData.substring(pollData.indexOf(":") + 1).trim();
          }

          // Parse the serialized poll data: id|title|description|options|creator|startTime|endTime|status|votes
          const pollInfo = this.parsePollData(pollData);
          if (pollInfo && pollInfo.id === pollId) {
            console.log(`✅ Successfully parsed poll data for poll ${pollId}`);
            return pollInfo;
          }
        } catch (parseError) {
          console.log(`⚠️ Failed to parse event data:`, parseError);
          continue;
        }
      }

      // If no data events found, look for creation events as fallback
      const pollCreateEvents = events.filter(event =>
        event.data.includes(`Poll created with ID: ${pollId}`)
      );

      if (pollCreateEvents.length === 0) {
        console.log(`❌ No events found for poll ${pollId}`);
        return null;
      }

      // Return basic poll info from creation event
      console.log(`⚠️ Using fallback data for poll ${pollId} - full data not available`);
      return {
        id: pollId,
        creator: "Unknown",
        title: `Poll #${pollId}`,
        description: `Poll created on blockchain`,
        options: ["Option 1", "Option 2"],
        votes: [0, 0],
        createdAt: Date.now(),
        endTime: Date.now() + (7 * 24 * 60 * 60 * 1000), // Default 7 days from now
        status: 'active' as const,
        projectId: 0,
        rewardPool: 0,
        fundingType: 0,
        distributionMode: 0,
        distributionType: 0,
        fixedRewardAmount: 0,
        fundingGoal: 0,
        treasuryApproved: false,
        rewardsDistributed: false
      };
    } catch (error) {
      console.error("Error fetching poll:", error);
      return null;
    }
  }

  // Helper method to parse serialized poll data from contract events
  // Uses the same parsing logic as list-all-polls.js from the contract project
  private parsePollData(pollDataStr: string): ContractPoll | null {
    try {
      console.log(`🔍 Parsing poll data: "${pollDataStr.substring(0, 150)}${pollDataStr.length > 150 ? '...' : ''}"`);

      // Format: id|title|description|option1||option2||option3|creator|startTime|endTime|status|voteCount|projectId|rewardPool|fundingType|distributionMode|distributionType|fixedRewardAmount|fundingGoal|treasuryApproved|rewardsDistributed
      const parts = pollDataStr.split('|');

      if (parts.length < 8) {
        console.log(`⚠️ Invalid poll data format: expected 8+ parts, got ${parts.length}`);
        return null;
      }

      // Find where the options end by looking for the creator (address starting with AU)
      let creatorIndex = -1;
      for (let i = 3; i < parts.length; i++) {
        if (parts[i].startsWith('AU') && parts[i].length > 20) {
          creatorIndex = i;
          break;
        }
      }

      if (creatorIndex === -1) {
        console.log(`⚠️ Could not find creator address in poll data`);
        return null;
      }

      // Reconstruct options by joining parts between index 3 and creator
      const optionsParts = parts.slice(3, creatorIndex);
      const optionsString = optionsParts.join('|');
      const options = optionsString.split('§§').filter(opt => opt.length > 0); // Updated to match contract's § separator

      const id = parts[0];
      const title = parts[1];
      const description = parts[2];
      const creator = parts[creatorIndex];
      const startTime = parseInt(parts[creatorIndex + 1]);
      const endTime = parseInt(parts[creatorIndex + 2]);
      const contractStatus = parseInt(parts[creatorIndex + 3]); // 0=ACTIVE, 1=CLOSED, 2=ENDED
      const voteCountStr = parts[creatorIndex + 4] || '';

      console.log(`🗳️ Raw vote count string at index ${creatorIndex + 4}: "${voteCountStr}"`);
      console.log(`🔍 Parsing economics fields from index ${creatorIndex + 5}:`);
      console.log(`   Total parts: ${parts.length}`);
      console.log(`   Parts after votes: [${parts.slice(creatorIndex + 5).join(', ')}]`);

      // Parse economics fields (with backward compatibility)
      const projectId = parts.length > creatorIndex + 5 ? parseInt(parts[creatorIndex + 5]) || 0 : 0;
      const rewardPool = parts.length > creatorIndex + 6 ? parseInt(parts[creatorIndex + 6]) || 0 : 0;
      const fundingType = parts.length > creatorIndex + 7 ? parseInt(parts[creatorIndex + 7]) || 0 : 0;
      const distributionMode = parts.length > creatorIndex + 8 ? parseInt(parts[creatorIndex + 8]) || 0 : 0;
      const distributionType = parts.length > creatorIndex + 9 ? parseInt(parts[creatorIndex + 9]) || 0 : 0;
      const fixedRewardAmount = parts.length > creatorIndex + 10 ? parseInt(parts[creatorIndex + 10]) || 0 : 0;
      const fundingGoal = parts.length > creatorIndex + 11 ? parseInt(parts[creatorIndex + 11]) || 0 : 0;
      const treasuryApproved = parts.length > creatorIndex + 12 ? parts[creatorIndex + 12] === 'true' : false;
      const rewardsDistributed = parts.length > creatorIndex + 13 ? parts[creatorIndex + 13] === 'true' : false;

      console.log(`📊 Parsed economics fields:`);
      console.log(`   projectId: ${projectId} (raw: "${parts[creatorIndex + 5] || 'undefined'}")`);
      console.log(`   rewardPool: ${rewardPool} (raw: "${parts[creatorIndex + 6] || 'undefined'}")`);
      console.log(`   fundingType: ${fundingType} (raw: "${parts[creatorIndex + 7] || 'undefined'}")`);
      console.log(`   treasuryApproved: ${treasuryApproved} (raw: "${parts[creatorIndex + 12] || 'undefined'}")`);
      console.log(`   rewardsDistributed: ${rewardsDistributed} (raw: "${parts[creatorIndex + 13] || 'undefined'}")`);

      // Parse vote counts (comma-separated)
      const votes = voteCountStr.length > 0 ?
        voteCountStr.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)) :
        new Array(options.length).fill(0);

      // Ensure votes array matches options length
      while (votes.length < options.length) {
        votes.push(0);
      }

      // Determine display status based on contract status and time
      // NOTE: Context.timestamp() in Massa returns MILLISECONDS, not seconds (despite what comments say)
      // Contract status: 0=ACTIVE, 1=CLOSED (manually closed), 2=ENDED (time expired), 3=FOR_CLAIMING (ready to claim rewards)
      const currentTimeMs = Date.now();

      let displayStatus: 'active' | 'closed' | 'ended' | 'for_claiming' = 'active';
      if (contractStatus === 1) {
        displayStatus = 'closed';
      } else if (contractStatus === 3) {
        displayStatus = 'for_claiming';
      } else if (contractStatus === 2 || currentTimeMs >= endTime) {
        displayStatus = 'ended';
      } else if (contractStatus === 0 && currentTimeMs >= startTime && currentTimeMs < endTime) {
        displayStatus = 'active';
      }

      console.log(`⏰ Timestamp Analysis:`);
      console.log(`   Current Time (ms): ${currentTimeMs} (${new Date(currentTimeMs).toLocaleString()})`);
      console.log(`   Start Time (ms): ${startTime} (${new Date(startTime).toLocaleString()})`);
      console.log(`   End Time (ms): ${endTime} (${new Date(endTime).toLocaleString()})`);
      console.log(`   Contract Status: ${contractStatus} (0=ACTIVE, 1=CLOSED, 2=ENDED)`);
      console.log(`   Time until end: ${((endTime - currentTimeMs) / 1000).toFixed(0)} seconds (${((endTime - currentTimeMs) / 3600000).toFixed(2)} hours)`);
      console.log(`   Time comparison: ${currentTimeMs} >= ${startTime} && ${currentTimeMs} < ${endTime} = ${currentTimeMs >= startTime && currentTimeMs < endTime}`);

      console.log(`📊 Successfully parsed poll:`);
      console.log(`   ID: ${id}`);
      console.log(`   Title: "${title}"`);
      console.log(`   Description: "${description}"`);
      console.log(`   Options: [${options.map(opt => `"${opt}"`).join(', ')}]`);
      console.log(`   Creator: ${creator}`);
      console.log(`   Start Time: ${new Date(startTime).toLocaleString()} (${startTime} ms)`);
      console.log(`   End Time: ${new Date(endTime).toLocaleString()} (${endTime} ms)`);
      console.log(`   Current Time: ${new Date(currentTimeMs).toLocaleString()} (${currentTimeMs} ms)`);
      console.log(`   Status: ${displayStatus} (from contract status ${contractStatus})`);
      console.log(`   Votes: [${votes.join(', ')}]`);
      console.log(`   Reward Pool: ${rewardPool} nanoMASSA`);
      console.log(`   Funding Type: ${fundingType}`);
      console.log(`   Distribution Mode: ${distributionMode}`);

      return {
        id,
        title,
        description,
        options,
        creator,
        votes,
        createdAt: startTime, // Already in milliseconds from contract
        endTime: endTime, // Already in milliseconds from contract
        status: displayStatus,
        projectId,
        rewardPool,
        fundingType,
        distributionMode,
        distributionType,
        fixedRewardAmount,
        fundingGoal,
        treasuryApproved,
        rewardsDistributed
      };
    } catch (error) {
      console.error('💥 Error parsing poll data:', error);
      return null;
    }
  }

  async vote(pollId: string, optionIndex: number): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      const args = new Args()
        .addString(pollId)
        .addU32(BigInt(optionIndex));

      console.log("🗳️ Voting on poll:", {
        contractAddress: this.contractAddress,
        pollId,
        optionIndex,
        walletName: this.getWalletName(),
        network: "Massa Buildnet",
        explorer: `https://buildnet-explorer.massa.net/address/${this.contractAddress}`
      });

      // Make the actual blockchain transaction using wallet provider
      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "vote",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'), // Use same fee format as working test scripts
      });

      console.log("Vote transaction result:", result);
      return true;
    } catch (error) {
      console.error("Error voting:", error);
      throw new Error(`Failed to vote on blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPollCount(): Promise<number> {
    try {
      if (!this.account) {
        // For read-only operations, we can use a provider without account
        const { JsonRpcProvider } = await import("@massalabs/massa-web3");
        const provider = JsonRpcProvider.buildnet();
        
        await provider.readSC({
          target: this.contractAddress,
          func: "getAllPolls",
          parameter: new Args().serialize(),
        });
        
        // The contract emits an event with total polls count
        // We'll parse the events to get the count
        const events = await provider.getEvents({
          smartContractAddress: this.contractAddress,
        });
        
        // Look for the most recent "Total polls:" event
        const pollCountEvents = events.filter(event => 
          event.data.includes("Total polls:")
        );
        
        if (pollCountEvents.length > 0) {
          const lastEvent = pollCountEvents[pollCountEvents.length - 1];
          const match = lastEvent.data.match(/Total polls: (\d+)/);
          if (match) {
            return parseInt(match[1]);
          }
        }
        
        return 0;
      } else {
        await this.account.readSC({
          target: this.contractAddress,
          func: "getAllPolls",
          parameter: new Args().serialize(),
        });
        
        // Similar parsing logic for when we have an account
        return 0;
      }
    } catch (error) {
      console.error("Error fetching poll count:", error);
      return 0;
    }
  }

  // Check voting status for multiple polls at once
  async checkVotedPolls(pollIds: string[], voterAddress: string): Promise<Set<number>> {
    const votedPollIds = new Set<number>();

    if (!voterAddress) {
      return votedPollIds;
    }

    console.log(`🔍 Checking voting status for ${pollIds.length} polls...`);

    // Check each poll in parallel
    const checkPromises = pollIds.map(async (pollId) => {
      try {
        const hasVoted = await this.hasVoted(pollId, voterAddress);
        if (hasVoted) {
          votedPollIds.add(parseInt(pollId));
          console.log(`✓ Already voted on poll #${pollId}`);
        }
      } catch (error) {
        console.log(`⚠️ Error checking vote status for poll ${pollId}:`, error);
      }
    });

    await Promise.all(checkPromises);
    console.log(`✅ Vote check complete: voted on ${votedPollIds.size} out of ${pollIds.length} polls`);

    return votedPollIds;
  }

  async hasVoted(pollId: string, voterAddress: string): Promise<boolean> {
    try {
      const { JsonRpcProvider, bytesToStr } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args()
        .addString(pollId)
        .addString(voterAddress);

      // Call the contract function to check if user has voted
      const result = await provider.readSC({
        target: this.contractAddress,
        func: "hasVoted",
        parameter: args.serialize(),
      });

      // The contract now returns "true" or "false" directly
      if (result.value && result.value.length > 0) {
        const resultStr = bytesToStr(result.value);
        return resultStr === "true";
      }

      return false;
    } catch (error) {
      console.error("Error checking vote status:", error);
      return false;
    }
  }

  // Utility method to get all polls (for listing)
  async getAllPolls(): Promise<ContractPoll[]> {
    console.log('📋 Listing All Polls in Contract');
    console.log('═════════════════════════════════════════════════════');
    console.log(`📍 Contract Address: ${this.contractAddress}`);
    console.log(`🌐 Network: Massa Buildnet`);
    console.log(`🔗 Explorer: https://buildnet-explorer.massa.net/address/${this.contractAddress}`);
    console.log('═════════════════════════════════════════════════════');

    try {
      const { JsonRpcProvider, bytesToStr } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      // Call getAllPolls function and get returned data directly
      console.log('\n📊 Fetching all polls from contract...');

      const result = await provider.readSC({
        target: this.contractAddress,
        func: 'getAllPolls',
        parameter: new Args().serialize(),
      });

      console.log('✅ Successfully called getAllPolls function');
      console.log('📦 Result structure:', result);

      // Parse the returned data (polls separated by newlines)
      // The data is in result.value, not result.returnValue
      if (!result.value || result.value.length === 0) {
        console.log('⚠️ No return value from getAllPolls, returning empty array');
        return [];
      }

      const pollsData = bytesToStr(result.value);
      console.log('📦 Decoded polls data:', pollsData);
      console.log(`📋 Received polls data (${pollsData.length} chars)`);

      const polls: ContractPoll[] = [];

      if (pollsData && pollsData.trim().length > 0) {
        const pollLines = pollsData.split('\n').filter(line => line.trim().length > 0);
        console.log(`🗳️ Found ${pollLines.length} polls`);

        for (const pollDataStr of pollLines) {
          try {
            console.log(`🔍 Processing poll data: "${pollDataStr.substring(0, 100)}${pollDataStr.length > 100 ? '...' : ''}"`);

            const poll = this.parsePollData(pollDataStr);
            if (poll) {
              polls.push(poll);
              console.log(`✅ Successfully parsed poll #${poll.id}: "${poll.title}"`);
            }
          } catch (parseError) {
            console.log(`⚠️ Failed to parse poll:`, parseError);
            continue;
          }
        }
      }

      // Sort polls by ID (newest first)
      polls.sort((a, b) => parseInt(b.id) - parseInt(a.id));

      console.log(`\n📈 POLL RETRIEVAL SUMMARY:`);
      console.log('═════════════════════════════════════════════════════');
      console.log(`   📊 Total Polls Found: ${polls.length}`);

      if (polls.length > 0) {
        const activePolls = polls.filter(p => p.status === 'active').length;
        const inactivePolls = polls.length - activePolls;
        const totalVotes = polls.reduce((sum, p) => sum + p.votes.reduce((s, v) => s + v, 0), 0);

        console.log(`   🟢 Active Polls: ${activePolls}`);
        console.log(`   🔴 Inactive Polls: ${inactivePolls}`);
        console.log(`   🗳️  Total Votes Cast: ${totalVotes}`);

        // List poll titles
        console.log(`   📋 Poll Titles: [${polls.map(p => `"${p.title}"`).join(', ')}]`);
      }

      console.log('═════════════════════════════════════════════════════');
      console.log('✅ Poll retrieval completed successfully!');

      return polls;
    } catch (error) {
      console.error('💥 Failed to retrieve polls:', error);
      console.log('\n🔧 Troubleshooting Steps:');
      console.log('1. Check if the contract is properly deployed');
      console.log('2. Verify the contract address is correct');
      console.log('3. Ensure network connectivity to buildnet');
      console.log('4. Check if there are any polls created in the contract');
      return [];
    }
  }

  // Admin function to update a poll (only creator can do this)
  async updatePoll(pollId: string, newTitle: string, newDescription: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("✏️ Updating poll with parameters:", {
        contractAddress: this.contractAddress,
        pollId,
        newTitle,
        newDescription,
        walletName: this.getWalletName(),
        network: "Massa Buildnet"
      });

      const args = new Args()
        .addString(pollId)
        .addString(newTitle)
        .addString(newDescription);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "updatePoll",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Poll update transaction result:", result);
      return true;
    } catch (error) {
      console.error("Error updating poll:", error);
      throw new Error(`Failed to update poll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Admin function to close a poll (only creator can do this)
  async closePoll(pollId: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("🔒 Closing poll with parameters:", {
        contractAddress: this.contractAddress,
        pollId,
        walletName: this.getWalletName(),
        network: "Massa Buildnet"
      });

      const args = new Args().addString(pollId);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "closePoll",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Poll close transaction result:", result);
      return true;
    } catch (error) {
      console.error("Error closing poll:", error);
      throw new Error(`Failed to close poll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async setForClaiming(pollId: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("🎁 Setting poll to FOR_CLAIMING status with parameters:", {
        contractAddress: this.contractAddress,
        pollId,
        walletName: this.getWalletName(),
        network: "Massa Buildnet"
      });

      const args = new Args().addString(pollId);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "setForClaiming",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Poll set to FOR_CLAIMING status:", result);
      return true;
    } catch (error) {
      console.error("Error setting poll to FOR_CLAIMING:", error);
      throw new Error(`Failed to set poll to FOR_CLAIMING: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ================= AUTONOMOUS SC METHODS =================

  async enableAutonomous(): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("🤖 Enabling autonomous SC execution");

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "enableAutonomous",
        parameter: new Args().serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Autonomous SC enabled!");
      return true;
    } catch (error) {
      console.error("Error enabling autonomous:", error);
      throw new Error(`Failed to enable autonomous SC: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disableAutonomous(): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("🤖 Disabling autonomous SC execution");

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "disableAutonomous",
        parameter: new Args().serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Autonomous SC disabled!");
      return true;
    } catch (error) {
      console.error("Error disabling autonomous:", error);
      throw new Error(`Failed to disable autonomous SC: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isAutonomousEnabled(): Promise<boolean> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      await provider.readSC({
        target: this.contractAddress,
        func: "isAutonomousEnabled",
        parameter: new Args().serialize(),
      });

      // Get events
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      const enabledEvents = events.filter(event =>
        event.data.includes("Autonomous SC enabled:")
      );

      if (enabledEvents.length > 0) {
        const latestEvent = enabledEvents[enabledEvents.length - 1];
        return latestEvent.data.includes(": true");
      }

      return false;
    } catch (error) {
      console.error("Error checking autonomous status:", error);
      return false;
    }
  }

  async setAutonomousInterval(intervalSeconds: number): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log(`🤖 Setting autonomous interval to ${intervalSeconds} seconds`);

      const args = new Args().addU64(BigInt(intervalSeconds));

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "setAutonomousInterval",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Autonomous interval updated!");
      return true;
    } catch (error) {
      console.error("Error setting autonomous interval:", error);
      throw new Error(`Failed to set interval: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAutonomousInterval(): Promise<number> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      await provider.readSC({
        target: this.contractAddress,
        func: "getAutonomousInterval",
        parameter: new Args().serialize(),
      });

      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      const intervalEvents = events.filter(event =>
        event.data.includes("Autonomous SC interval:")
      );

      if (intervalEvents.length > 0) {
        const latestEvent = intervalEvents[intervalEvents.length - 1];
        const match = latestEvent.data.match(/interval: (\d+) seconds/);
        if (match) {
          return parseInt(match[1]);
        }
      }

      return 3600; // Default 1 hour
    } catch (error) {
      console.error("Error getting autonomous interval:", error);
      return 3600;
    }
  }

  async getLastAutonomousRun(): Promise<number> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      await provider.readSC({
        target: this.contractAddress,
        func: "getLastAutonomousRun",
        parameter: new Args().serialize(),
      });

      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      const runEvents = events.filter(event =>
        event.data.includes("Last autonomous run:")
      );

      if (runEvents.length > 0) {
        const latestEvent = runEvents[runEvents.length - 1];
        const match = latestEvent.data.match(/run: (\d+)/);
        if (match) {
          return parseInt(match[1]);
        }
      }

      return 0;
    } catch (error) {
      console.error("Error getting last autonomous run:", error);
      return 0;
    }
  }

  async manualTriggerDistribution(pollId: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log(`🤖 Manually triggering distribution for poll ${pollId}`);

      const args = new Args().addString(pollId);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "manualTriggerDistribution",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Manual distribution triggered!");
      return true;
    } catch (error) {
      console.error("Error triggering manual distribution:", error);
      throw new Error(`Failed to trigger distribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Admin function to fund the contract
  async fundContract(amountInMassa: number): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("💰 Funding contract with parameters:", {
        contractAddress: this.contractAddress,
        amount: `${amountInMassa} MASSA`,
        walletName: this.getWalletName(),
        network: "Massa Buildnet",
        explorer: `https://buildnet-explorer.massa.net/address/${this.contractAddress}`
      });

      // Convert MASSA to nanoMAS (1 MASSA = 10^9 nanoMAS)
      const amountInNanoMas = BigInt(Math.floor(amountInMassa * 1000000000));
      const feeInNanoMas = BigInt(0.01 * 1000000000); // 0.01 MASSA fee

      // Make a transfer to the contract address
      const result = await this.account.transfer(
        this.contractAddress,
        amountInNanoMas,
        { fee: feeInNanoMas }
      );

      console.log("💸 Contract funding transaction result:", result);
      return true;
    } catch (error) {
      console.error("Error funding contract:", error);
      throw new Error(`Failed to fund contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ================= POLL FUNDING & REWARD METHODS =================

  async fundPoll(pollId: string, amountInMassa: number): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("💰 Funding poll with parameters:", {
        pollId,
        amount: `${amountInMassa} MASSA`,
        contractAddress: this.contractAddress
      });

      // Convert MASSA to nanoMASSA
      const amountInNano = BigInt(Math.floor(amountInMassa * 1e9));

      const args = new Args().addString(pollId);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "fundPoll",
        parameter: args.serialize(),
        coins: amountInNano, // Send funds with transaction
        fee: Mas.fromString('0.01'),
      });

      console.log("💸 Poll funding transaction result:", result);
      return true;
    } catch (error) {
      console.error("Error funding poll:", error);
      throw new Error(`Failed to fund poll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async claimReward(pollId: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("🎁 Claiming reward from poll:", pollId);

      const args = new Args().addString(pollId);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "claimReward",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Reward claim transaction successful!", result);
      return true;
    } catch (error) {
      console.error("Error claiming reward:", error);
      throw new Error(`Failed to claim reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async distributeRewards(pollId: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("📤 Distributing rewards for poll:", pollId);

      const args = new Args().addString(pollId);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "distributeRewards",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Reward distribution transaction successful!", result);
      return true;
    } catch (error) {
      console.error("Error distributing rewards:", error);
      throw new Error(`Failed to distribute rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPoolBalance(pollId: string): Promise<number> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args().addString(pollId);
      await provider.readSC({
        target: this.contractAddress,
        func: "getPoolBalance",
        parameter: args.serialize(),
      });

      // Get events to parse the balance
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      const balanceEvents = events.filter(event =>
        event.data.includes(`Poll ${pollId} reward pool balance:`)
      );

      if (balanceEvents.length > 0) {
        const latestEvent = balanceEvents[balanceEvents.length - 1];
        const match = latestEvent.data.match(/balance: (\d+) nanoMASSA/);
        if (match) {
          const balanceInNano = parseFloat(match[1]);
          return balanceInNano / 1e9; // Convert to MASSA
        }
      }

      return 0;
    } catch (error) {
      console.error("Error getting pool balance:", error);
      return 0;
    }
  }

  async getContribution(pollId: string, contributor: string): Promise<number> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args()
        .addString(pollId)
        .addString(contributor);

      await provider.readSC({
        target: this.contractAddress,
        func: "getContribution",
        parameter: args.serialize(),
      });

      // Get events to parse the contribution
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      const contributionEvents = events.filter(event =>
        event.data.includes(`Contributor ${contributor} contributed`) &&
        event.data.includes(`to poll ${pollId}`)
      );

      if (contributionEvents.length > 0) {
        const latestEvent = contributionEvents[contributionEvents.length - 1];
        const match = latestEvent.data.match(/contributed (\d+) nanoMASSA/);
        if (match) {
          const contributionInNano = parseFloat(match[1]);
          return contributionInNano / 1e9; // Convert to MASSA
        }
      }

      return 0;
    } catch (error) {
      console.error("Error getting contribution:", error);
      return 0;
    }
  }

  async hasClaimed(pollId: string, voterAddress: string): Promise<boolean> {
    try {
      const { JsonRpcProvider, bytesToStr } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args()
        .addString(pollId)
        .addString(voterAddress);

      const result = await provider.readSC({
        target: this.contractAddress,
        func: "hasClaimed",
        parameter: args.serialize(),
      });

      // The contract now returns "true" or "false" directly
      if (result.value && result.value.length > 0) {
        const resultStr = bytesToStr(result.value);
        return resultStr === "true";
      }

      return false;
    } catch (error) {
      console.error("Error checking claimed status:", error);
      return false;
    }
  }

  async getPollVotersAndClaims(pollId: string): Promise<{
    voters: Array<{ address: string; option: number; hasClaimed: boolean; claimAmount?: number }>;
    totalVotes: number;
    totalClaimed: number;
  }> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      console.log(`🔍 Fetching voters and claims for poll #${pollId}...`);

      // Get all events from the contract
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      console.log(`📋 Total events found: ${events.length}`);

      // Parse vote events for this poll
      const votePattern = new RegExp(`Vote cast by (AU[A-Za-z0-9]+) for option (\\d+) in poll ${pollId}`);
      const claimPattern = new RegExp(`Reward claimed: (\\d+) nanoMASSA by (AU[A-Za-z0-9]+) from poll ${pollId}`);

      const votersMap = new Map<string, { address: string; option: number; hasClaimed: boolean; claimAmount?: number }>();

      // First, collect all voters from vote events
      for (const event of events) {
        const voteMatch = event.data.match(votePattern);
        if (voteMatch) {
          const voterAddress = voteMatch[1];
          const optionIndex = parseInt(voteMatch[2]);

          if (!votersMap.has(voterAddress)) {
            votersMap.set(voterAddress, {
              address: voterAddress,
              option: optionIndex,
              hasClaimed: false
            });
          }
        }
      }

      // Then, mark voters who have claimed
      let totalClaimed = 0;
      for (const event of events) {
        const claimMatch = event.data.match(claimPattern);
        if (claimMatch) {
          const claimAmount = parseInt(claimMatch[1]);
          const voterAddress = claimMatch[2];

          const voter = votersMap.get(voterAddress);
          if (voter) {
            voter.hasClaimed = true;
            voter.claimAmount = claimAmount;
            totalClaimed++;
          }
        }
      }

      const voters = Array.from(votersMap.values());

      console.log(`✅ Found ${voters.length} voters, ${totalClaimed} have claimed rewards`);

      return {
        voters,
        totalVotes: voters.length,
        totalClaimed
      };
    } catch (error) {
      console.error("Error fetching poll voters and claims:", error);
      return {
        voters: [],
        totalVotes: 0,
        totalClaimed: 0
      };
    }
  }

  // ================= PROJECT MANAGEMENT METHODS =================

  async createProject(params: ProjectCreationParams): Promise<string> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("🚀 Creating project with parameters:", {
        name: params.name,
        description: params.description
      });

      const args = new Args()
        .addString(params.name)
        .addString(params.description);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "createProject",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Project creation transaction successful!");

      // Wait for transaction to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to get the project ID from events
      try {
        const { JsonRpcProvider } = await import("@massalabs/massa-web3");
        const provider = JsonRpcProvider.buildnet();

        // Get events from the contract
        const events = await provider.getEvents({
          smartContractAddress: this.contractAddress,
        });

        const projectCreateEvents = events.filter(event =>
          event.data.includes("Project created with ID:")
        );

        if (projectCreateEvents.length > 0) {
          const latestEvent = projectCreateEvents[projectCreateEvents.length - 1];
          const match = latestEvent.data.match(/Project created with ID: (\d+)/);
          if (match) {
            console.log(`🎉 Successfully created project with ID: ${match[1]}`);
            return match[1];
          }
        }
      } catch (eventError) {
        console.log("Could not fetch event data, but transaction was successful");
      }

      return "Created successfully";
    } catch (error) {
      console.error("Error creating project:", error);
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateProject(projectId: string, params: ProjectCreationParams): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("🔄 Updating project", projectId, "with parameters:", {
        name: params.name,
        description: params.description
      });

      const args = new Args()
        .addString(projectId)
        .addString(params.name)
        .addString(params.description);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "updateProject",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Project update transaction successful!");

      // Wait for transaction to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      return true;
    } catch (error) {
      console.error("Error updating project:", error);
      throw new Error(`Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllProjects(): Promise<ContractProject[]> {
    console.log('📁 Fetching All Projects');

    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      console.log('📊 Fetching all projects from contract...');

      try {
        await provider.readSC({
          target: this.contractAddress,
          func: 'getAllProjects',
          parameter: new Args().serialize(),
        });
        console.log('✅ Successfully called getAllProjects function');
      } catch (readError) {
        console.log('⚠️ ReadSC getAllProjects call failed, continuing with event retrieval');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get events from the contract
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      console.log(`📋 Retrieved ${events.length} events from contract`);

      // Log all events for debugging
      if (events.length > 0) {
        console.log('📄 Sample events:', events.slice(0, 3).map(e => ({
          data: e.data.substring(0, 100),
          context: e.context
        })));
      }

      // Try multiple patterns to find project events
      const projectEvents = events.filter(event => {
        const data = event.data;
        // Pattern 1: Contains pipe separator and "Project"
        const pattern1 = data.includes('|') && (data.includes('Project ') || data.includes('project'));
        // Pattern 2: Project created event
        const pattern2 = data.includes('Project created') || data.includes('project created');
        // Pattern 3: Contains project ID pattern
        const pattern3 = data.match(/Project created with ID: \d+/i);

        return pattern1 || pattern2 || pattern3;
      });

      console.log(`📁 Found ${projectEvents.length} project events using flexible patterns`);

      const projectsMap = new Map<string, ContractProject>();

      for (const event of projectEvents) {
        try {
          let projectDataStr = event.data;

          console.log(`🔍 Processing event: "${projectDataStr.substring(0, 150)}..."`);

          // Handle project creation notification as fallback
          if (projectDataStr.includes('Project created with ID:')) {
            // Extract basic info from creation notification
            // Format: "Project created with ID: X by ADDRESS"
            const match = projectDataStr.match(/Project created with ID: (\d+) by (AU\w+)/);
            if (match) {
              const projectId = match[1];
              const creator = match[2];

              // Only use fallback if we don't already have this project
              if (!projectsMap.has(projectId)) {
                // Create a basic project object from the notification
                const basicProject: ContractProject = {
                  id: projectId,
                  name: `Project #${projectId}`,
                  description: 'Created on Massa blockchain',
                  creator: creator,
                  createdAt: Date.now(),
                  pollIds: []
                };

                projectsMap.set(projectId, basicProject);
                console.log(`⚠️ Using fallback data for project #${projectId} (will be updated if full data is found)`);
              }
            }
            continue;
          }

          // Remove "Project :" prefix if present
          if (projectDataStr.includes('Project ') && projectDataStr.includes(':')) {
            const colonIndex = projectDataStr.indexOf(':');
            projectDataStr = projectDataStr.substring(colonIndex + 1).trim();
          }

          const project = this.parseProjectData(projectDataStr);
          if (project) {
            // Always overwrite with full data (this replaces fallback data)
            projectsMap.set(project.id, project);
            console.log(`✅ Successfully parsed project #${project.id}: "${project.name}"`);
          }
        } catch (parseError) {
          console.log(`⚠️ Failed to parse project event:`, parseError);
          console.log(`   Event data was: "${event.data}"`);
          continue;
        }
      }

      // Convert map to array and sort by ID (newest first)
      const projects = Array.from(projectsMap.values()).sort((a, b) => parseInt(b.id) - parseInt(a.id));

      console.log(`\n✅ Project retrieval completed! Found ${projects.length} projects`);

      if (projects.length === 0 && events.length > 0) {
        console.warn('⚠️ No projects found despite having events. This could mean:');
        console.warn('   1. The smart contract is not emitting project data in the expected format');
        console.warn('   2. Events are being emitted but not yet indexed');
        console.warn('   3. The contract address may be incorrect');
        console.warn(`   Current contract address: ${this.contractAddress}`);
      }

      return projects;
    } catch (error) {
      console.error('💥 Failed to retrieve projects:', error);
      return [];
    }
  }

  private parseProjectData(projectDataStr: string): ContractProject | null {
    try {
      console.log(`🔍 Parsing project data: "${projectDataStr.substring(0, 100)}${projectDataStr.length > 100 ? '...' : ''}"`);

      // Format: id|name|description|creator|createdAt|pollIds
      const parts = projectDataStr.split('|');

      if (parts.length < 5) {
        console.log(`⚠️ Invalid project data format: expected 5+ parts, got ${parts.length}`);
        return null;
      }

      const id = parts[0];
      const name = parts[1];
      const description = parts[2];
      const creator = parts[3];
      const createdAt = parseInt(parts[4]);

      const pollIds = parts.length > 5 && parts[5] && parts[5].length > 0
        ? parts[5].split(',').filter(id => id.length > 0)
        : [];

      console.log(`📁 Successfully parsed project:`);
      console.log(`   ID: ${id}`);
      console.log(`   Name: "${name}"`);
      console.log(`   Description: "${description}"`);
      console.log(`   Creator: ${creator}`);
      console.log(`   Polls: ${pollIds.length}`);

      return {
        id,
        name,
        description,
        creator,
        createdAt,
        pollIds
      };
    } catch (error) {
      console.error('💥 Error parsing project data:', error);
      return null;
    }
  }


  async deleteProject(projectId: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      const args = new Args().addString(projectId);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "deleteProject",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Project delete transaction result:", result);
      return true;
    } catch (error) {
      console.error("Error deleting project:", error);
      throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPollsByProject(projectId: string): Promise<ContractPoll[]> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args().addString(projectId);

      await provider.readSC({
        target: this.contractAddress,
        func: "getPollsByProject",
        parameter: args.serialize(),
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      const pollEvents = events.filter(event => {
        const data = event.data;
        return data.includes('|') && data.includes('Poll ') && data.includes(':');
      });

      const polls: ContractPoll[] = [];
      const processedIds = new Set<string>();

      for (const event of pollEvents) {
        try {
          let pollDataStr = event.data;

          if (pollDataStr.includes('Poll ') && pollDataStr.includes(':')) {
            const colonIndex = pollDataStr.indexOf(':');
            pollDataStr = pollDataStr.substring(colonIndex + 1).trim();
          }

          const poll = this.parsePollData(pollDataStr);
          if (poll && !processedIds.has(poll.id)) {
            polls.push(poll);
            processedIds.add(poll.id);
          }
        } catch (parseError) {
          console.log(`⚠️ Failed to parse poll event:`, parseError);
          continue;
        }
      }

      return polls;
    } catch (error) {
      console.error("Error fetching polls by project:", error);
      return [];
    }
  }

  // ============= TREASURY FUNCTIONS =============

  async approveTreasuryPoll(pollId: string, fundingAmount: number = 0): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log(`✅ Approving treasury poll ${pollId}${fundingAmount > 0 ? ` with ${fundingAmount} MASSA funding` : ''}`);

      const args = new Args().addString(pollId);
      const coins = fundingAmount > 0 ? BigInt(Math.floor(fundingAmount * 1e9)) : 0n;

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "approveTreasuryPoll",
        parameter: args.serialize(),
        coins,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Treasury poll approved!");
      return true;
    } catch (error) {
      console.error("Error approving treasury poll:", error);
      throw new Error(`Failed to approve poll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async rejectTreasuryPoll(pollId: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log(`❌ Rejecting treasury poll ${pollId}`);

      const args = new Args().addString(pollId);

      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "rejectTreasuryPoll",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Treasury poll rejected!");
      return true;
    } catch (error) {
      console.error("Error rejecting treasury poll:", error);
      throw new Error(`Failed to reject poll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPendingTreasuryPolls(): Promise<string[]> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      await provider.readSC({
        target: this.contractAddress,
        func: "getPendingTreasuryPolls",
        parameter: new Uint8Array(),
      });

      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      const pendingEvents = events.filter(event =>
        event.data.includes("Pending treasury polls:")
      );

      if (pendingEvents.length > 0) {
        const latestEvent = pendingEvents[pendingEvents.length - 1];
        const dataMatch = latestEvent.data.match(/Pending treasury polls: (.*)/);
        if (dataMatch && dataMatch[1] && dataMatch[1].trim() !== '') {
          return dataMatch[1].split(',').map(id => id.trim());
        }
      }

      return [];
    } catch (error) {
      console.error("Error fetching pending treasury polls:", error);
      return [];
    }
  }

  async getTreasuryApprovalStatus(pollId: string): Promise<{ fundingType: string; status: string }> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args().addString(pollId);

      await provider.readSC({
        target: this.contractAddress,
        func: "getTreasuryApprovalStatus",
        parameter: args.serialize(),
      });

      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      const statusEvents = events.filter(event =>
        event.data.includes(`Poll ${pollId} - Funding type:`)
      );

      if (statusEvents.length > 0) {
        const latestEvent = statusEvents[statusEvents.length - 1];
        const fundingTypeMatch = latestEvent.data.match(/Funding type: (\w+)/);
        const statusMatch = latestEvent.data.match(/Approval status: (\w+)/);

        return {
          fundingType: fundingTypeMatch ? fundingTypeMatch[1] : 'unknown',
          status: statusMatch ? statusMatch[1] : 'unknown',
        };
      }

      return { fundingType: 'unknown', status: 'unknown' };
    } catch (error) {
      console.error("Error getting treasury approval status:", error);
      return { fundingType: 'unknown', status: 'unknown' };
    }
  }

  // ================= TOKEN FUNCTIONS =================

  /**
   * Buy MPOLLS tokens by sending MASSA
   * @param massaAmount - Amount of MASSA to spend
   */
  async buyTokens(massaAmount: number): Promise<void> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log(`💰 Buying MPOLLS tokens with ${massaAmount} MASSA`);

      // Get token contract address from environment
      const tokenContractAddress = import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS;
      if (!tokenContractAddress) {
        throw new Error("Token contract address not configured");
      }

      // Convert MASSA to nanoMASSA
      const massaInNano = BigInt(Math.floor(massaAmount * 1e9));

      // Call buyTokens function on token contract
      const result = await this.account.callSC({
        target: tokenContractAddress,
        func: "buyTokens",
        parameter: new Args().serialize(), // No parameters needed
        coins: massaInNano, // Send MASSA with transaction
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Token purchase successful!");
      console.log("📋 Transaction result:", result);

      // Wait for transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
      console.error("Failed to buy tokens:", error);
      throw error;
    }
  }

  /**
   * Get caller's MPOLLS token balance
   */
  async getMyTokenBalance(): Promise<number> {
    try {
      const tokenContractAddress = import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS;
      if (!tokenContractAddress) {
        throw new Error("Token contract address not configured");
      }

      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      // Call myBalance function on token contract
      const events = await provider.getEvents({
        smartContractAddress: tokenContractAddress,
      });

      // Look for balance events - in a real implementation, we'd call the contract
      // For now, return 0 as placeholder
      // TODO: Implement proper balance reading from contract storage
      console.log("Note: Token balance reading not yet fully implemented");
      return 0;

    } catch (error) {
      console.error("Error getting token balance:", error);
      return 0;
    }
  }

  /**
   * Approve polls contract to spend MPOLLS tokens
   * @param amount - Amount of tokens to approve
   */
  async approveTokenSpending(amount: number): Promise<void> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log(`✅ Approving polls contract to spend ${amount} MPOLLS tokens`);

      const tokenContractAddress = import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS;
      if (!tokenContractAddress) {
        throw new Error("Token contract address not configured");
      }

      // Convert amount to smallest unit
      const amountInSmallestUnit = BigInt(Math.floor(amount * 1e9));

      // Call approve function on token contract
      const args = new Args()
        .addString(this.contractAddress) // spender (polls contract)
        .addU64(amountInSmallestUnit); // amount

      const result = await this.account.callSC({
        target: tokenContractAddress,
        func: "approve",
        parameter: args.serialize(),
        coins: BigInt(0),
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Token approval successful!");
      console.log("📋 Transaction result:", result);

      // Wait for transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
      console.error("Failed to approve token spending:", error);
      throw error;
    }
  }
}

// Create a singleton instance
const contractAddress = import.meta.env.VITE_POLLS_CONTRACT_ADDRESS;
console.log('contractAddress', contractAddress);
export const pollsContract = new PollsContract(contractAddress);