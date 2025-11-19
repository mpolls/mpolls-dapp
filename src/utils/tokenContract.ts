import {
  Args,
  Mas
} from "@massalabs/massa-web3";
import {
  getWallets,
  Wallet
} from "@massalabs/wallet-provider";
import { Provider } from "@massalabs/massa-web3";

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

export class TokenContract {
  private contractAddress: string;
  private wallet: Wallet | null = null;
  private account: Provider | null = null;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
    console.log(`🪙 Token Contract initialized with address: ${contractAddress}`);
  }

  async connectWallet(): Promise<boolean> {
    try {
      const wallets = await getWallets();
      if (wallets.length === 0) {
        throw new Error("No wallet providers found. Please install MassaStation or Bearby wallet.");
      }

      this.wallet = wallets[0];
      await this.wallet.connect();

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

  /**
   * Sync wallet connection from another contract instance (e.g., pollsContract)
   * This allows sharing wallet connection across different contract instances
   */
  async syncWalletConnection(): Promise<boolean> {
    try {
      const wallets = await getWallets();
      if (wallets.length === 0) {
        return false;
      }

      this.wallet = wallets[0];
      const connected = await this.wallet.connected();

      if (connected) {
        const accounts = await this.wallet.accounts();
        if (accounts.length === 0) {
          return false;
        }
        this.account = accounts[0];
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to sync wallet connection:", error);
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
          const accountProvider = accounts[0];
          if (accountProvider && typeof accountProvider === 'object' && 'address' in accountProvider) {
            return (accountProvider as any).address || null;
          }
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

  // ================= TOKEN INFO FUNCTIONS =================

  async getTokenInfo(): Promise<TokenInfo | null> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      // Call all info functions
      await Promise.all([
        provider.readSC({
          target: this.contractAddress,
          func: "name",
          parameter: new Args().serialize(),
        }),
        provider.readSC({
          target: this.contractAddress,
          func: "symbol",
          parameter: new Args().serialize(),
        }),
        provider.readSC({
          target: this.contractAddress,
          func: "decimals",
          parameter: new Args().serialize(),
        }),
        provider.readSC({
          target: this.contractAddress,
          func: "totalSupply",
          parameter: new Args().serialize(),
        }),
      ]);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      // Find the most recent events matching our patterns (reverse to get newest first)
      const recentEvents = [...events].reverse();

      const nameEvent = recentEvents.find(e => e.data.startsWith("Token name:"));
      const symbolEvent = recentEvents.find(e => e.data.startsWith("Token symbol:"));
      const decimalsEvent = recentEvents.find(e => e.data.startsWith("Token decimals:"));
      const supplyEvent = recentEvents.find(e => e.data.startsWith("Total supply:"));

      const name = nameEvent ? nameEvent.data.replace("Token name:", "").trim() : "MPOLLS";
      const symbol = symbolEvent ? symbolEvent.data.replace("Token symbol:", "").trim() : "MPOLLS";
      const decimals = decimalsEvent ? parseInt(decimalsEvent.data.replace("Token decimals:", "").trim()) : 9;
      const totalSupply = supplyEvent ? supplyEvent.data.replace("Total supply:", "").trim() : "0";

      return { name, symbol, decimals, totalSupply };
    } catch (error) {
      console.error("Error fetching token info:", error);
      return null;
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args().addString(address);

      await provider.readSC({
        target: this.contractAddress,
        func: "balanceOf",
        parameter: args.serialize(),
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      // Get most recent event (reverse to get newest first)
      const recentEvents = [...events].reverse();
      const balanceEvent = recentEvents.find(e => e.data.includes(`Balance of ${address}:`));
      if (balanceEvent) {
        const match = balanceEvent.data.match(/Balance of .+: (\d+)/);
        if (match) {
          return match[1];
        }
      }

      return "0";
    } catch (error) {
      console.error("Error fetching balance:", error);
      return "0";
    }
  }

  async getMyBalance(): Promise<string> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      await provider.readSC({
        target: this.contractAddress,
        func: "myBalance",
        parameter: new Args().serialize(),
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      // Get most recent event (reverse to get newest first)
      const recentEvents = [...events].reverse();
      const balanceEvent = recentEvents.find(e => e.data.includes("Your balance:"));
      if (balanceEvent) {
        const match = balanceEvent.data.match(/Your balance: (\d+)/);
        if (match) {
          return match[1];
        }
      }

      return "0";
    } catch (error) {
      console.error("Error fetching my balance:", error);
      return "0";
    }
  }

  // ================= TRANSFER FUNCTIONS =================

  async transfer(to: string, amount: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      const args = new Args()
        .addString(to)
        .addU64(BigInt(amount));

      console.log("💸 Transferring tokens:", {
        contractAddress: this.contractAddress,
        to,
        amount,
        walletName: this.getWalletName(),
      });

      await this.account.callSC({
        target: this.contractAddress,
        func: "transfer",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Transfer successful!");
      return true;
    } catch (error) {
      console.error("Error transferring tokens:", error);
      throw new Error(`Failed to transfer tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ================= MINTING FUNCTIONS =================

  async mint(to: string, amount: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      const args = new Args()
        .addString(to)
        .addU64(BigInt(amount));

      console.log("🪙 Minting tokens:", {
        contractAddress: this.contractAddress,
        to,
        amount,
        walletName: this.getWalletName(),
      });

      await this.account.callSC({
        target: this.contractAddress,
        func: "mint",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Mint successful!");
      return true;
    } catch (error) {
      console.error("Error minting tokens:", error);
      throw new Error(`Failed to mint tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async burn(amount: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      const args = new Args().addU64(BigInt(amount));

      console.log("🔥 Burning tokens:", {
        contractAddress: this.contractAddress,
        amount,
        walletName: this.getWalletName(),
      });

      await this.account.callSC({
        target: this.contractAddress,
        func: "burn",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Burn successful!");
      return true;
    } catch (error) {
      console.error("Error burning tokens:", error);
      throw new Error(`Failed to burn tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ================= ROLE MANAGEMENT =================

  async isMinter(address: string): Promise<boolean> {
    try {
      const { JsonRpcProvider } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args().addString(address);

      await provider.readSC({
        target: this.contractAddress,
        func: "isMinter",
        parameter: args.serialize(),
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      // Get most recent event (reverse to get newest first)
      const recentEvents = [...events].reverse();
      const minterEvent = recentEvents.find(e => e.data.includes(`Address ${address} is minter:`));
      if (minterEvent) {
        return minterEvent.data.includes("true");
      }

      return false;
    } catch (error) {
      console.error("Error checking minter status:", error);
      return false;
    }
  }

  async grantMinterRole(address: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      const args = new Args().addString(address);

      console.log("👑 Granting minter role:", {
        contractAddress: this.contractAddress,
        address,
        walletName: this.getWalletName(),
      });

      await this.account.callSC({
        target: this.contractAddress,
        func: "grantMinterRole",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Grant minter role successful!");
      return true;
    } catch (error) {
      console.error("Error granting minter role:", error);
      throw new Error(`Failed to grant minter role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async revokeMinterRole(address: string): Promise<boolean> {
    if (!this.account) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      const args = new Args().addString(address);

      console.log("🚫 Revoking minter role:", {
        contractAddress: this.contractAddress,
        address,
        walletName: this.getWalletName(),
      });

      await this.account.callSC({
        target: this.contractAddress,
        func: "revokeMinterRole",
        parameter: args.serialize(),
        coins: 0n,
        fee: Mas.fromString('0.01'),
      });

      console.log("✅ Revoke minter role successful!");
      return true;
    } catch (error) {
      console.error("Error revoking minter role:", error);
      throw new Error(`Failed to revoke minter role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper function to format token amount with decimals
  formatTokenAmount(amount: string, decimals: number = 9): string {
    const num = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const whole = num / divisor;
    const remainder = num % divisor;
    const remainderStr = remainder.toString().padStart(decimals, '0');
    return `${whole}.${remainderStr}`;
  }

  // Helper function to parse token amount to smallest unit
  parseTokenAmount(amount: string, decimals: number = 9): string {
    const [whole, fraction = '0'] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFraction)).toString();
  }

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

      // Convert MASSA to nanoMASSA
      const massaInNano = BigInt(Math.floor(massaAmount * 1e9));

      // Call buyTokens function on token contract
      const result = await this.account.callSC({
        target: this.contractAddress,
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
}

// Create a singleton instance (you'll need to add token contract address to .env)
const tokenContractAddress = import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS || '';
export const tokenContract = tokenContractAddress ? new TokenContract(tokenContractAddress) : null;
