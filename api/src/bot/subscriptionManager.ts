import WebSocket from "ws";
import { showOutput } from "./output";
import { WalletManager } from "./wallet";
import { Trader } from "./trader";
import { config } from "dotenv";
config({ path: `${__dirname}/../../.env` });

const MAX_ACTIVE_TRADES = Number(process.env.MAX_ACTIVE_TRADES!);
const MAX_UNVERIFIED_TRADES = Number(process.env.MAX_UNVERIFIED_TRADES!);

export interface Token {
  mint: string;
  name: string;
  scoutPrice: number | "--";
  currentPrice: number | "--";
  marketCapSol: number | "--";
  vSolInBondingCurve: number | "--";
  hit150?: boolean;
  hit200?: boolean;
  hit400?: boolean;
  rugged?: boolean;
  createdAt: Date;
  timeTo150?: number | "";
  timeTo200?: number | "";
  timeTo400?: number | "";
  timeToRug?: number | "";
  maxPrice?: number;
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
      this.activeTrades.length >= MAX_ACTIVE_TRADES ||
      this.unverifiedTokens.length >= MAX_UNVERIFIED_TRADES
    ) {
      return;
    }

    const newToken: Token = {
      mint: message.mint as string,
      name: message.name as string,
      scoutPrice: "--", // Set when the first trade occurs
      currentPrice: "--",
      marketCapSol: "--",
      vSolInBondingCurve: "--",
      hit150: false,
      hit200: false,
      hit400: false,
      rugged: false,
      timeTo150: "",
      timeTo200: "",
      timeTo400: "",
      timeToRug: "",
      createdAt: new Date(),
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
    const tokenPriceInSol = message.solAmount / message.tokenAmount;

    if (isVerified) {
      const token = this.activeTrades.find((trade) => trade.mint === mint)!;
      token.marketCapSol = message.marketCapSol;
      token.currentPrice = tokenPriceInSol; // Update current price
      // Check for 50% and 100% profit milestones
      if (tokenPriceInSol > (token.maxPrice || 0)) {
        token.maxPrice = tokenPriceInSol;
      }
      if (
        !token.rugged &&
        !token.hit400 &&
        Number(token.currentPrice) >= Number(token.scoutPrice) * 4
      ) {
        token.hit400 = true;
        token.timeTo400 =
          (new Date().getTime() - token.createdAt.getTime()) / 1000;
      } else if (
        !token.rugged &&
        !token.hit200 &&
        Number(token.currentPrice) >= Number(token.scoutPrice) * 2
      ) {
        token.hit200 = true;
        token.timeTo200 =
          (new Date().getTime() - token.createdAt.getTime()) / 1000;
      }
      if (
        !token.rugged ||
        message.marketCapSol * this.walletManager.solPriceInUSD >= 80000 ||
        Number(token.currentPrice) <= token.maxPrice! * 0.6 ||
        (token.hit200 &&
          (tokenPriceInSol - Number(token.scoutPrice)) /
            (token.maxPrice! - Number(token.scoutPrice)) <
            0.5)
      ) {
        token.rugged = true;
        token.timeToRug =
          (new Date().getTime() - token.createdAt.getTime()) / 1000;
        if (
          (tokenPriceInSol - Number(token.scoutPrice)) /
            Number(token.scoutPrice) <=
          -0.1
        )
          return;
        // sell
      }

      showOutput({
        activeTokens: this.activeTrades,
        walletManager: this.walletManager,
      });
    } else {
      const token = this.unverifiedTokens.find((trade) => trade.mint === mint);
      if (!token) return;

      if (token.scoutPrice === "--") token.scoutPrice = tokenPriceInSol; // Set initial bought price
      token.marketCapSol = message.marketCapSol;
      token.vSolInBondingCurve = message.vSolInBondingCurve;
      token.currentPrice = tokenPriceInSol; // Update current price
      token.maxPrice =
        token.maxPrice && token.maxPrice > tokenPriceInSol
          ? token.maxPrice
          : tokenPriceInSol;

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
      if (
        Math.floor((new Date().getTime() - token.createdAt.getTime()) / 1000) >
        5
      ) {
        showOutput({
          activeTokens: this.activeTrades,
          walletManager: this.walletManager,
          text: `👴 Token is too old - Removed "${token.name}"`,
        });
        this.removeUnverifiedToken(token);
        return;
      }
      if (Number(token.currentPrice) >= Number(token.scoutPrice) * 1.5) {
        this.trader.buyToken(token);
        token.hit150 = true;
        token.timeTo150 =
          (new Date().getTime() - token.createdAt.getTime()) / 1000;
      }
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
