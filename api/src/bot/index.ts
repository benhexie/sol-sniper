import { Connection } from "@solana/web3.js";
import { config } from "dotenv";
import { WalletManager } from "./wallet";
import { SubscriptionManager } from "./subscriptionManager";
import { showOutput } from "./output";
import { TradeReport } from "./tradeReport";
const readline = require("readline");
config();

export class SniperBot {
  private connection: Connection;
  private walletManager: WalletManager;
  private subscriptionManager: SubscriptionManager;
  private keypressListener: NodeJS.ReadStream & {
    fd: 0;
  };

  constructor() {
    // Configuration
    const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;
    const PRIVATE_KEY = process.env.PRIVATE_KEY!;

    // Initialize components
    this.connection = new Connection(SOLANA_RPC_URL, "confirmed");
    this.walletManager = new WalletManager(this.connection, PRIVATE_KEY);
    this.subscriptionManager = new SubscriptionManager(this.walletManager);

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    this.keypressListener = process.stdin.on("keypress", (str, key) => {
      if ((key.ctrl || key.meta) && key.name === "c") {
        this.shutdown.call(this);
      }
    });

    // Bind shutdown to process signals
    // process.on("SIGINT", this.shutdown.bind(this));
    // process.on("SIGTERM", this.shutdown.bind(this));
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
    await TradeReport.generate(
      this.subscriptionManager.getTradingHistory(),
      this.walletManager
    );
    
    process.exit(0);
  }
}
