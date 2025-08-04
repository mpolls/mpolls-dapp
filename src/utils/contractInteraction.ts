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
}

export interface ContractPoll {
  id: string;
  creator: string;
  title: string;
  description: string;
  options: string[];
  votes: number[];
  isActive: boolean;
  createdAt: number;
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

      // Use the exact same argument structure as the working create-poll.js
      const args = new Args()
        .addString(params.title)
        .addString(params.description)
        .addU32(BigInt(params.options.length));
      
      // Add each option separately
      params.options.forEach(option => {
        args.addString(option);
      });
      
      args.addU64(BigInt(params.durationInSeconds));

      console.log("📦 Prepared arguments (matching working implementation):", {
        title: params.title,
        description: params.description,
        optionCount: params.options.length,
        options: params.options,
        duration: `${params.durationInSeconds} seconds`
      });

      // Make the actual blockchain transaction using wallet provider
      console.log("🔗 Calling smart contract with:");
      console.log("   Target:", this.contractAddress);
      console.log("   Function:", "createPoll");
      console.log("   Fee:", "0.01 MASSA");
      
      const result = await this.account.callSC({
        target: this.contractAddress,
        func: "createPoll",
        parameter: args.serialize(),
        coins: 0n,
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
        isActive: true,
        createdAt: Date.now()
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
      
      // Format: id|title|description|option1||option2||option3|creator|startTime|endTime|status|voteCount
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
      const options = optionsString.split('||').filter(opt => opt.length > 0);

      const id = parts[0];
      const title = parts[1];
      const description = parts[2];
      const creator = parts[creatorIndex];
      const startTime = parseInt(parts[creatorIndex + 1]);
      const endTime = parseInt(parts[creatorIndex + 2]);
      const status = parseInt(parts[creatorIndex + 3]);
      const voteCountStr = parts[creatorIndex + 4] || '';
      
      // Parse vote counts (comma-separated)
      const votes = voteCountStr.length > 0 ? 
        voteCountStr.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)) : 
        new Array(options.length).fill(0);
      
      // Ensure votes array matches options length
      while (votes.length < options.length) {
        votes.push(0);
      }
      
      // Determine if poll is active
      const currentTime = Date.now();
      const isActive = status === 0 && currentTime < endTime;

      console.log(`📊 Successfully parsed poll:`);
      console.log(`   ID: ${id}`);
      console.log(`   Title: "${title}"`);
      console.log(`   Description: "${description}"`);
      console.log(`   Options: [${options.map(opt => `"${opt}"`).join(', ')}]`);
      console.log(`   Creator: ${creator}`);
      console.log(`   Start Time: ${new Date(startTime).toLocaleString()}`);
      console.log(`   End Time: ${new Date(endTime).toLocaleString()}`);
      console.log(`   Status: ${status} (${isActive ? 'Active' : 'Inactive'})`);
      console.log(`   Votes: [${votes.join(', ')}]`);

      return {
        id,
        title,
        description,
        options,
        creator,
        votes,
        isActive,
        createdAt: startTime
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
        fee: BigInt(0.01 * (10 ** 9)), // 0.01 MASSA in nanoMAS for fee
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

  async hasVoted(): Promise<boolean> {
    try {
      // const args = new Args()
      //   .addString(pollId)
      //   .addString(voterAddress);

      // In real implementation:
      // const result = await this.client.readSmartContract({
      //   address: this.contractAddress,
      //   functionName: "hasVoted",
      //   parameter: args.serialize(),
      // });

      // Simulate voting status
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
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();
      
      // Call getAllPolls function to trigger events (using readSC for compatibility)
      console.log('\n📊 Fetching all polls from contract...');
      
      try {
        await provider.readSC({
          target: this.contractAddress,
          func: 'getAllPolls',
          parameter: new Args().serialize(),
        });
        console.log('✅ Successfully called getAllPolls function');
      } catch (readError) {
        console.log('⚠️ ReadSC getAllPolls call failed, continuing with event retrieval:', readError);
      }

      // Wait for events to be generated
      console.log('⏳ Waiting for contract events...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get all events from the contract
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      console.log(`📋 Retrieved ${events.length} events from contract`);

      // Filter for poll data events
      const pollEvents = events.filter(event => {
        const data = event.data;
        // Look for events that contain poll data (either direct serialized data or "Poll X: data" format)
        return data.includes('|') && (data.match(/^\d+\|/) || data.includes('Poll ') && data.includes(':'));
      });

      console.log(`🗳️ Found ${pollEvents.length} poll events`);

      const polls: ContractPoll[] = [];
      const processedIds = new Set<string>();

      // Process each poll event
      for (const event of pollEvents) {
        try {
          let pollDataStr = event.data;
          
          // Extract data if it's in "Poll X: data" format
          if (pollDataStr.includes('Poll ') && pollDataStr.includes(':')) {
            const colonIndex = pollDataStr.indexOf(':');
            pollDataStr = pollDataStr.substring(colonIndex + 1).trim();
          }
          
          console.log(`🔍 Processing poll data: "${pollDataStr.substring(0, 100)}${pollDataStr.length > 100 ? '...' : ''}"`);
          
          const poll = this.parsePollData(pollDataStr);
          if (poll && !processedIds.has(poll.id)) {
            polls.push(poll);
            processedIds.add(poll.id);
            console.log(`✅ Successfully parsed poll #${poll.id}: "${poll.title}"`);
          }
        } catch (parseError) {
          console.log(`⚠️ Failed to parse poll event:`, parseError);
          continue;
        }
      }

      // Sort polls by ID (newest first)
      polls.sort((a, b) => parseInt(b.id) - parseInt(a.id));

      console.log(`\n📈 POLL RETRIEVAL SUMMARY:`);
      console.log('═════════════════════════════════════════════════════');
      console.log(`   📊 Total Polls Found: ${polls.length}`);
      
      if (polls.length > 0) {
        const activePolls = polls.filter(p => p.isActive).length;
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
}

// Create a singleton instance
const contractAddress = import.meta.env.VITE_POLLS_CONTRACT_ADDRESS || "AS1S3n9oCcsQmzPLKydnqZAFyhCyVhvaThnC11f7xyMzKDEkjkX6";
export const pollsContract = new PollsContract(contractAddress);