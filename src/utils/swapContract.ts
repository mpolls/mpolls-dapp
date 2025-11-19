import {
  Args,
  Mas
} from "@massalabs/massa-web3";
import {
  getWallets,
  Wallet
} from "@massalabs/wallet-provider";
import { Provider } from "@massalabs/massa-web3";

export interface PoolReserves {
  massaReserve: bigint;
  mpollsReserve: bigint;
}

export interface PoolStats {
  massaReserve: bigint;
  mpollsReserve: bigint;
  totalVolume: bigint;
  spreadPercentage: number;
}

export class SwapContract {
  private contractAddress: string;
  private wallet: Wallet | null = null;
  private account: Provider | null = null;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
    console.log(`🔄 Swap Contract initialized with address: ${contractAddress}`);
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

  // ================= SWAP FUNCTIONS =================

  /**
   * Swap MASSA for MPOLLS tokens
   */
  async swapMassaForMpolls(massaAmount: number): Promise<void> {
    if (!this.account) {
      throw new Error("Wallet not connected");
    }

    // Convert MASSA amount to nanoMASSA (9 decimals)
    const massaNano = BigInt(Math.floor(massaAmount * 1_000_000_000));

    const args = new Args();

    await this.account.callSmartContract({
      targetAddress: this.contractAddress,
      targetFunction: "swapMassaForMpolls",
      parameter: args.serialize(),
      coins: massaNano,
      fee: Mas.fromString("0.01"),
      maxGas: BigInt(2000000000)
    });
  }

  /**
   * Swap MPOLLS for MASSA tokens
   */
  async swapMpollsForMassa(mpollsAmount: number): Promise<void> {
    if (!this.account) {
      throw new Error("Wallet not connected");
    }

    // Convert MPOLLS amount to smallest units (9 decimals)
    const mpollsNano = BigInt(Math.floor(mpollsAmount * 1_000_000_000));

    const args = new Args().addU64(mpollsNano);

    await this.account.callSmartContract({
      targetAddress: this.contractAddress,
      targetFunction: "swapMpollsForMassa",
      parameter: args.serialize(),
      fee: Mas.fromString("0.01"),
      maxGas: BigInt(2000000000)
    });
  }

  /**
   * Get quote for swapping MASSA to MPOLLS
   */
  async getQuoteMassaToMpolls(massaAmount: number): Promise<number> {
    try {
      const { JsonRpcProvider, Args, Mas } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      // Convert MASSA amount to nanoMASSA
      const massaNano = BigInt(Math.floor(massaAmount * 1_000_000_000));

      const args = new Args().addU64(massaNano);

      await provider.readSC({
        target: this.contractAddress,
        func: "getQuoteMassaToMpolls",
        parameter: args.serialize(),
        fee: Mas.fromString("0"),
        maxGas: BigInt(2000000000)
      });

      // Get events to read the quote
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      // Parse the quote from the latest event
      if (events && events.length > 0) {
        const latestEvent = events[events.length - 1];
        const quoteMatch = latestEvent.data.match(/Quote: [\d.]+ MASSA -> ([\d.]+) MPOLLS/);
        if (quoteMatch) {
          return parseFloat(quoteMatch[1]);
        }
      }

      // Fallback: calculate manually based on reserves
      const reserves = await this.getReserves();
      if (reserves.massaReserve > 0n && reserves.mpollsReserve > 0n) {
        const massaNanoNum = Number(massaNano);
        const massaReserveNum = Number(reserves.massaReserve);
        const mpollsReserveNum = Number(reserves.mpollsReserve);

        // Apply 2.5% spread
        const inputAfterSpread = massaNanoNum * 0.975;

        // Constant product formula
        const outputNano = (mpollsReserveNum * inputAfterSpread) / (massaReserveNum + inputAfterSpread);

        return outputNano / 1_000_000_000;
      }

      return 0;
    } catch (error) {
      console.error("Error getting quote:", error);
      return 0;
    }
  }

  /**
   * Get quote for swapping MPOLLS to MASSA
   */
  async getQuoteMpollsToMassa(mpollsAmount: number): Promise<number> {
    try {
      const { JsonRpcProvider, Args, Mas } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      // Convert MPOLLS amount to smallest units
      const mpollsNano = BigInt(Math.floor(mpollsAmount * 1_000_000_000));

      const args = new Args().addU64(mpollsNano);

      await provider.readSC({
        target: this.contractAddress,
        func: "getQuoteMpollsToMassa",
        parameter: args.serialize(),
        fee: Mas.fromString("0"),
        maxGas: BigInt(2000000000)
      });

      // Get events to read the quote
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      // Parse the quote from the latest event
      if (events && events.length > 0) {
        const latestEvent = events[events.length - 1];
        const quoteMatch = latestEvent.data.match(/Quote: [\d.]+ MPOLLS -> ([\d.]+) MASSA/);
        if (quoteMatch) {
          return parseFloat(quoteMatch[1]);
        }
      }

      // Fallback: calculate manually based on reserves
      const reserves = await this.getReserves();
      if (reserves.massaReserve > 0n && reserves.mpollsReserve > 0n) {
        const mpollsNanoNum = Number(mpollsNano);
        const massaReserveNum = Number(reserves.massaReserve);
        const mpollsReserveNum = Number(reserves.mpollsReserve);

        // Apply 2.5% spread
        const inputAfterSpread = mpollsNanoNum * 0.975;

        // Constant product formula
        const outputNano = (massaReserveNum * inputAfterSpread) / (mpollsReserveNum + inputAfterSpread);

        return outputNano / 1_000_000_000;
      }

      return 0;
    } catch (error) {
      console.error("Error getting quote:", error);
      return 0;
    }
  }

  /**
   * Get pool reserves by calling contract function
   */
  async getReserves(): Promise<PoolReserves> {
    try {
      const { JsonRpcProvider, Args, Mas } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args();

      // Call getReserves function
      await provider.readSC({
        target: this.contractAddress,
        func: "getReserves",
        parameter: args.serialize(),
        fee: Mas.fromString("0"),
        maxGas: BigInt(2000000000)
      });

      // Get events to read the reserves
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      let massaReserve = 0n;
      let mpollsReserve = 0n;

      // Parse the reserves from the latest events
      if (events && events.length > 0) {
        for (let i = events.length - 1; i >= Math.max(0, events.length - 10); i--) {
          const event = events[i];

          const massaMatch = event.data.match(/MASSA Reserve: ([\d.]+)/);
          if (massaMatch) {
            massaReserve = BigInt(Math.floor(parseFloat(massaMatch[1]) * 1_000_000_000));
          }

          const mpollsMatch = event.data.match(/MPOLLS Reserve: ([\d.]+)/);
          if (mpollsMatch) {
            mpollsReserve = BigInt(Math.floor(parseFloat(mpollsMatch[1]) * 1_000_000_000));
          }

          if (massaReserve > 0n && mpollsReserve > 0n) {
            break;
          }
        }
      }

      console.log('Reserves from contract:', {
        massaReserve: massaReserve.toString(),
        mpollsReserve: mpollsReserve.toString()
      });

      return {
        massaReserve,
        mpollsReserve
      };
    } catch (error) {
      console.error("Error getting reserves:", error);
      return {
        massaReserve: 0n,
        mpollsReserve: 0n
      };
    }
  }

  /**
   * Get pool statistics by calling contract function
   */
  async getPoolStats(): Promise<PoolStats> {
    try {
      const { JsonRpcProvider, Args, Mas } = await import("@massalabs/massa-web3");
      const provider = JsonRpcProvider.buildnet();

      const args = new Args();

      // Call getPoolStats function
      await provider.readSC({
        target: this.contractAddress,
        func: "getPoolStats",
        parameter: args.serialize(),
        fee: Mas.fromString("0"),
        maxGas: BigInt(2000000000)
      });

      // Get events to read the stats
      const events = await provider.getEvents({
        smartContractAddress: this.contractAddress,
      });

      let massaReserve = 0n;
      let mpollsReserve = 0n;
      let totalVolume = 0n;
      let spreadPercentage = 2.5;

      // Parse the stats from the latest events
      if (events && events.length > 0) {
        for (let i = events.length - 1; i >= Math.max(0, events.length - 10); i--) {
          const event = events[i];

          const massaMatch = event.data.match(/MASSA Reserve: ([\d.]+)/);
          if (massaMatch) {
            massaReserve = BigInt(Math.floor(parseFloat(massaMatch[1]) * 1_000_000_000));
          }

          const mpollsMatch = event.data.match(/MPOLLS Reserve: ([\d.]+)/);
          if (mpollsMatch) {
            mpollsReserve = BigInt(Math.floor(parseFloat(mpollsMatch[1]) * 1_000_000_000));
          }

          const volumeMatch = event.data.match(/Total Volume: ([\d.]+) MASSA/);
          if (volumeMatch) {
            totalVolume = BigInt(Math.floor(parseFloat(volumeMatch[1]) * 1_000_000_000));
          }

          const spreadMatch = event.data.match(/Spread: ([\d.]+)%/);
          if (spreadMatch) {
            spreadPercentage = parseFloat(spreadMatch[1]);
          }
        }
      }

      return {
        massaReserve,
        mpollsReserve,
        totalVolume,
        spreadPercentage
      };
    } catch (error) {
      console.error("Error getting pool stats:", error);
      return {
        massaReserve: 0n,
        mpollsReserve: 0n,
        totalVolume: 0n,
        spreadPercentage: 2.5
      };
    }
  }
}

// Export singleton instance
const swapContractAddress = import.meta.env.VITE_SWAP_CONTRACT_ADDRESS || "";
export const swapContract = new SwapContract(swapContractAddress);
