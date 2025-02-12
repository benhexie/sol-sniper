import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "dotenv";

config();

const DEV_MODE = process.env.DEV_MODE! === "true";

export class WalletManager {
  private connection: Connection;
  private wallet: Keypair;
  private initialBalance: number = 0;
  private balance: number = 0;
  private checkedBalance: boolean = false;
  public solPriceInUSD: number = 0;

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
    if (DEV_MODE) this.balance = 0.6;
    else await this.setBalance();
    this.checkedBalance = true;
    this.initialBalance = this.balance;
    return this.balance;
  }

  getPublicKey(): PublicKey {
    return this.wallet.publicKey;
  }

  getKeyPair(): Keypair {
    return this.wallet;
  }

  getInitialBalance(): number {
    return this.initialBalance;
  }

  updateBalance(amount: number) {
    this.balance += amount;
  }

  private async getCurrentSolPriceInUSD() {
    if (DEV_MODE) return 200;
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const data = await response.json();
    return data.solana.usd;
  }
}
