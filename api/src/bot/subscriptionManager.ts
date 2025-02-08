import WebSocket from "ws";
import { showOutput } from "./output";
import { WalletManager } from "./wallet";
import { Trader } from "./trader";

export interface Token {
  mint: string;
  name: string;
  boughtPrice: number | "--";
  currentPrice: number | "--";
  marketCapSol: number | "--";
  vSolInBondingCurve: number | "--";
  hit50?: boolean;
  hit100?: boolean;
  rugged?: boolean;
}

export class SubscriptionManager {
  private walletManager: WalletManager;
  private trader: Trader;
  private ws: WebSocket;
  private activeTrades: Token[] = [];
  private unverifiedTokens: Token[] = [];
  private lastErrorMessage: string = "";
  private solPriceInUSD: number = 0;
  private tradingHistory: Token[] = [];

  constructor(walletManager: WalletManager) {
    this.walletManager = walletManager;
    this.trader = new Trader({
      getActiveTrades: () => this.activeTrades,
      removeActiveTrade: (token: Token) => this.removeActiveTrade(token),
      addActiveTrade: (token: Token) => this.addActiveTrade(token),
      walletManager: this.walletManager,
      clearUnverifiedTokens: () => this.clearUnverifiedTokens(),
    });
    this.ws = new WebSocket("wss://pumpportal.fun/api/data");

    this.ws.on("open", () => {
      console.log("🤖 Connected to PumpPortal");
      this.subscribeToNewToken();
    });

    this.ws.on("message", async (data: WebSocket.Data) => {
      const message = JSON.parse(data.toString());

      if (message.txType === "create") {
        this.handleNewToken(message);
      } else if (message.txType === "buy" || message.txType === "sell") {
        this.handleTokenTrade(message);
      }
    });

    this.ws.on("close", () => {
      console.log("🔌 Disconnected from PumpPortal. Reconnecting...");
      setTimeout(() => this.reconnect(), 3000);
    });
  }

  private async handleNewToken(message: any) {
    if ((await this.walletManager.getBalance()) < 0.01) {
      showOutput({
        activeTokens: this.activeTrades,
        walletManager: this.walletManager,
        text: `🚨 Insufficient balance. Minimum balance is 0.01 SOL`,
      });
      return;
    }

    if (
      this.activeTrades.find((trade) => trade.mint === message.mint) ||
      this.activeTrades.length >= 4 ||
      this.unverifiedTokens.length >= 100
    ) {
      return;
    }

    const newToken: Token = {
      mint: message.mint as string,
      name: message.name as string,
      boughtPrice: "--", // Set when the first trade occurs
      currentPrice: "--",
      marketCapSol: "--",
      vSolInBondingCurve: "--",
      hit50: false,
      hit100: false,
      rugged: false,
    };

    this.unverifiedTokens.push(newToken);

    showOutput({
      activeTokens: this.activeTrades,
      walletManager: this.walletManager,
    });

    this.subscribeToTokenTrade();
  }

  private async handleTokenTrade(message: any) {
    const { mint, price } = message;
    const isVerified =
      this.activeTrades.find((trade) => trade.mint === mint) !== undefined;

    if (isVerified) {
      const token = this.activeTrades.find((trade) => trade.mint === mint)!;
      const tokenPriceInSol = message.solAmount / message.tokenAmount;
      token.marketCapSol = message.marketCapSol;
      if (token.boughtPrice === "--") {
        token.boughtPrice = tokenPriceInSol; // Set initial bought price
      }
      token.currentPrice = tokenPriceInSol; // Update current price
      // Check for 50% and 100% profit milestones
      if (
        !token.hit50 &&
        Number(token.currentPrice) >= Number(token.boughtPrice) * 1.5
      ) {
        token.hit50 = true;
      }
      if (
        !token.hit100 &&
        Number(token.currentPrice) >= Number(token.boughtPrice) * 2
      ) {
        token.hit100 = true;
      }
      if (Number(token.currentPrice) < Number(token.boughtPrice) * 0.45) {
        token.rugged = true;
      }

      showOutput({
        activeTokens: this.activeTrades,
        walletManager: this.walletManager,
      });
    } else {
      const token = this.unverifiedTokens.find((trade) => trade.mint === mint);
      if (!token) return;
      if (token.marketCapSol === "--") {
        token.marketCapSol = message.marketCapSol;
        token.vSolInBondingCurve = message.vSolInBondingCurve;
      }
      const isSafe = await this.trader.isSafeToken(token);
      if (!isSafe.safe) {
        showOutput({
          activeTokens: this.activeTrades,
          walletManager: this.walletManager,
          text: `🚨 ${isSafe.reason}`,
        });
        this.removeUnverifiedToken(token);
        return;
      }
      this.trader.buyToken(token);
    }
  }

  private subscribeToNewToken() {
    this.ws.send(JSON.stringify({ method: "subscribeNewToken" }));
  }

  private subscribeToTokenTrade() {
    this.ws.send(
      JSON.stringify({
        method: "subscribeTokenTrade",
        keys: this.activeTrades
          .map((trade) => trade.mint)
          .concat(this.unverifiedTokens.map((trade) => trade.mint)),
      })
    );
  }

  private reconnect() {
    this.ws = new WebSocket("wss://pumpportal.fun/api/data");

    this.ws.on("open", () => {
      console.log("🔄 Reconnected to PumpPortal");
      this.subscribeToNewToken();
      this.subscribeToTokenTrade();
    });

    this.ws.on("message", async (data: WebSocket.Data) => {
      const message = JSON.parse(data.toString());
      if (message.txType === "create") {
        this.handleNewToken(message);
      } else if (message.txType === "buy" || message.txType === "sell") {
        this.handleTokenTrade(message);
      }
    });

    this.ws.on("close", () => {
      console.log("🔌 Disconnected again. Retrying...");
      setTimeout(() => this.reconnect(), 3000);
    });
  }

  addActiveTrade(token: Token) {
    this.activeTrades.push(token);
  }

  removeActiveTrade(token: Token) {
    this.activeTrades = this.activeTrades.filter((t) => t.mint !== token.mint);
    this.tradingHistory.push(token);
  }

  getTradingHistory() {
    return this.tradingHistory;
  }

  getActiveTrades() {
    return this.activeTrades;
  }

  addUnverifiedToken(token: Token) {
    this.unverifiedTokens.push(token);
  }

  removeUnverifiedToken(token: Token) {
    this.unverifiedTokens = this.unverifiedTokens.filter(
      (t) => t.mint !== token.mint
    );
  }

  clearUnverifiedTokens() {
    this.unverifiedTokens = [];
  }
}
