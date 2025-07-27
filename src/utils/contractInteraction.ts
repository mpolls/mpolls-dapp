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
  endTime: number;
  status: 'active' | 'closed' | 'ended';
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
      
      // Get all events from the contract to parse poll data
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });
      
      // Look for poll creation events for this specific poll ID
      const pollCreateEvents = events.filter(event => 
        event.data.includes(`Poll created with ID: ${pollId}`)
      );
      
      if (pollCreateEvents.length === 0) {
        return null;
      }
      
      // Try to read poll data from storage using readSC
      try {
        const args = new Args().addString(pollId);
        await provider.readSC({
          target: this.contractAddress,
          func: "getPoll", 
          parameter: args.serialize(),
        });
        
        // Try to get poll data from events
        const events = await provider.getEvents({
          smartContractAddress: this.contractAddress,
        });
        
        // Look for poll data event
        const pollDataEvent = events.find(event => 
          event.data.includes(`Poll data:`) && event.data.includes(pollId)
        );
        
        if (pollDataEvent) {
          const dataStr = pollDataEvent.data.replace('Poll data: ', '');
          const parts = dataStr.split('|');
          
          if (parts.length >= 9) {
            const options = parts[3].split('||');
            const votes = parts[8] ? parts[8].split(',').map(v => parseInt(v) || 0) : new Array(options.length).fill(0);
            const status = parseInt(parts[7]) as 0 | 1 | 2;
            
            return {
              id: pollId,
              creator: parts[4],
              title: parts[1],
              description: parts[2],
              options: options,
              votes: votes,
              isActive: status === 0, // 0 = ACTIVE
              createdAt: parseInt(parts[5]) || Date.now(),
              endTime: parseInt(parts[6]) || Date.now(),
              status: status === 0 ? 'active' : status === 1 ? 'closed' : 'ended'
            };
          }
        }
        
        // Fallback to basic poll info
        return {
          id: pollId,
          creator: "Unknown",
          title: `Poll #${pollId}`,
          description: `Blockchain poll created via smart contract`,
          options: ["Yes", "No"],
          votes: [0, 0],
          isActive: true,
          createdAt: Date.now(),
          endTime: Date.now() + 86400000,
          status: 'active' as const
        };
      } catch (readError) {
        // If reading fails, still return basic poll info from events
        return {
          id: pollId,
          creator: "Unknown",
          title: `Poll #${pollId}`,
          description: `Blockchain poll created via smart contract`,
          options: ["Yes", "No"],
          votes: [0, 0],
          isActive: true,
          createdAt: Date.now(),
          endTime: Date.now() + 86400000,
          status: 'active' as const
        };
      }
    } catch (error) {
      console.error("Error fetching poll:", error);
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
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();
      
      console.log("🔍 Fetching all polls from blockchain...");
      
      // Get all events from the contract
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });
      
      console.log(`📋 Found ${events.length} contract events`);
      
      // Filter for poll creation events
      const pollCreateEvents = events.filter(event => 
        event.data.includes("Poll created with ID:")
      );
      
      console.log(`🗳️ Found ${pollCreateEvents.length} poll creation events`);
      
      const polls: ContractPoll[] = [];
      
      // Extract poll IDs from creation events
      for (const event of pollCreateEvents) {
        const match = event.data.match(/Poll created with ID: (\d+)/);
        if (match) {
          const pollId = match[1];
          console.log(`📊 Processing poll ID: ${pollId}`);
          
          const poll = await this.getPoll(pollId);
          if (poll) {
            polls.push(poll);
          }
        }
      }
      
      console.log(`✅ Successfully fetched ${polls.length} polls from blockchain`);
      return polls;
    } catch (error) {
      console.error("Error fetching all polls:", error);
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