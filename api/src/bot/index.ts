import { Connection } from "@solana/web3.js";
import { config } from "dotenv";
import { WalletManager } from "./wallet";
import { SubscriptionManager } from "./subscriptionManager";
import { showOutput } from "./output";
config();

export class SniperBot {
  private connection: Connection;
  private walletManager: WalletManager;
  private subscriptionManager: SubscriptionManager;

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
    this.connection = new Connection(SOLANA_RPC_URL, "confirmed");
    this.walletManager = new WalletManager(this.connection, PRIVATE_KEY);
    this.subscriptionManager = new SubscriptionManager(this.walletManager);

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
    (() => {
      // Sell all tokens
      this.subscriptionManager.addAllActiveTradesToHistory();
    })();

    // Generate trade report
    showOutput({
      activeTokens: this.subscriptionManager.getTradingHistory(),
      walletManager: this.walletManager,
      text: `🧾 Trade report: ${this.walletManager.getInitialBalance()} SOL -> ${this.walletManager.getBalance()} SOL`,
    });

    process.exit(0);
  }
}
