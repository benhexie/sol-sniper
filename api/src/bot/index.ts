import { Connection } from "@solana/web3.js";
import { config } from "dotenv";
import { WalletManager } from "./wallet";
import { SubscriptionManager } from "./subscriptionManager";
config();

export class SniperBot {
  constructor() {
    // Configuration
    const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;
    const PRIVATE_KEY = process.env.PRIVATE_KEY!;
    const BUY_AMOUNT_SOL = Number(process.env.BUY_AMOUNT_SOL!);
    const PROFIT_TARGET_1 = Number(process.env.PROFIT_TARGET_1!);
    const PROFIT_TARGET_2 = Number(process.env.PROFIT_TARGET_2!);
    const TRAILING_STOP = Number(process.env.TRAILING_STOP!);
    const MIN_MARKET_CAP_SOL = Number(process.env.MIN_MARKET_CAP_SOL!);
    const MIN_LIQUIDITY_SOL = Number(process.env.MIN_LIQUIDITY_SOL!);

    // Initialize components
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const walletManager = new WalletManager(connection, PRIVATE_KEY);
    const subscriptionManager = new SubscriptionManager(walletManager);

    // Bind shutdown to process signals
    process.on("SIGINT", this.shutdown.bind(this));
    process.on("SIGTERM", this.shutdown.bind(this));
  }

  start() {
    console.clear();
    console.log("🤖 Starting Sniper Bot...");
  }

  private async shutdown() {
    console.log("\n🛑 Shutting down bot...");

    // Sell all remaining tokens
    console.log("💸 Selling all remaining tokens...");

    // Generate trade report
    console.log("🧾 Generating trade report...");

    process.exit(0);
  }
}
