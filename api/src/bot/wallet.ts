import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export class WalletManager {
  private connection: Connection;
  private wallet: Keypair;
  private balance: number = 0;
  private checkedBalance: boolean = false;
  solPriceInUSD: number = 0;

  constructor(connection: Connection, privateKey: string) {
    this.connection = connection;
    this.wallet = Keypair.fromSecretKey(bs58.decode(privateKey));

    (async () => {
      try {
        this.solPriceInUSD = await this.getCurrentSolPriceInUSD();
      } catch (error) {
        console.error("Error fetching SOL price:", error);
      }
      setInterval(async () => {
        try {
          this.solPriceInUSD = await this.getCurrentSolPriceInUSD();
        } catch (error) {
          console.error("Error fetching SOL price:", error);
        }
      }, 60000);
    })();
  }

  private async setBalance() {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    this.balance = balance / 1_000_000_000;
  }

  async getBalance(): Promise<number> {
    if (this.checkedBalance) return this.balance;
    await this.setBalance();
    this.checkedBalance = true;
    return this.balance;
  }

  getPublicKey(): PublicKey {
    return this.wallet.publicKey;
  }

  getKeyPair(): Keypair {
    return this.wallet;
  }

  private async getCurrentSolPriceInUSD() {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const data = await response.json();
    return data.solana.usd;
  }
}
