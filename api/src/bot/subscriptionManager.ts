import WebSocket from "ws";
import { showOutput } from "./output";
import { WalletManager } from "./wallet";
import { Trader } from "./trader";
import { config } from "dotenv";
import { Connection } from "@solana/web3.js";
config({ path: `${__dirname}/../../.env` });

const MAX_UNVERIFIED_TRADES = Number(process.env.MAX_UNVERIFIED_TRADES!);
const MAX_TOKEN_AGE = Number(process.env.MAX_TOKEN_AGE!);
const MIN_LIQUIDITY_SOL = Number(process.env.MIN_LIQUIDITY_SOL!);
const BUY_AMOUNT_SOL = Number(process.env.BUY_AMOUNT_SOL!);
const FEE_AMOUNT_SOL = Number(process.env.FEE_AMOUNT_SOL!);

export interface Token {
  mint: string;
  name: string;
  scoutPrice: number | "--";
  currentPrice: number | "--";
  marketCapSol: number | "--";
  vSolInBondingCurve: number | "--";
  hit120?: boolean;
  hit200?: boolean;
  hit240?: boolean;
  hit300?: boolean;
  hit400?: boolean;
  rugged?: boolean;
  createdAt: Date;
  timeTo120?: number | "";
  timeTo200?: number | "";
  timeTo240?: number | "";
  timeTo300?: number | "";
  timeTo400?: number | "";
  timeToRug?: number | "";
  maxPrice?: number;
  buyPrice?: number;
  sellPrice?: number;
  lastUpdate: Date;
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
  private connection: Connection;

  constructor(walletManager: WalletManager, connection: Connection) {
    this.walletManager = walletManager;
    this.connection = connection;
    this.trader = new Trader({
      getActiveTrades: () => this.activeTrades,
      removeActiveTrade: (token: Token) => this.removeActiveTrade(token),
      addActiveTrade: (token: Token) => this.addActiveTrade(token),
      walletManager: this.walletManager,
      clearUnverifiedTokens: () => this.clearUnverifiedTokens(),
      addTradingHistory: (token: Token) => this.addTradingHistory(token),
      getTradingHistory: () => this.tradingHistory,
      unverifiedTokens: this.unverifiedTokens,
      removeUnverifiedToken: (token: Token) =>
        this.removeUnverifiedToken(token),
      connection: this.connection,
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

    this.autoSellStagnantTokens();
  }

  private async handleNewToken(message: any) {
    if (
      (await this.walletManager.getBalance()) <
      BUY_AMOUNT_SOL + FEE_AMOUNT_SOL
    ) {
      showOutput({
        activeTokens: this.activeTrades,
        walletManager: this.walletManager,
        unverifiedTokens: this.unverifiedTokens,
        text: `🚨 Insufficient balance. Minimum balance is ${
          BUY_AMOUNT_SOL + FEE_AMOUNT_SOL
        } SOL`,
      });
      return;
    }

    if (
      this.activeTrades.find((trade) => trade.mint === message.mint) ||
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
      hit120: false,
      hit200: false,
      hit240: false,
      hit300: false,
      hit400: false,
      rugged: false,
      timeTo120: "",
      timeTo200: "",
      timeTo240: "",
      timeTo300: "",
      timeTo400: "",
      timeToRug: "",
      createdAt: new Date(),
      lastUpdate: new Date(),
    };

    this.unverifiedTokens.push(newToken);

    showOutput({
      activeTokens: this.activeTrades,
      walletManager: this.walletManager,
      unverifiedTokens: this.unverifiedTokens,
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
      token.lastUpdate = new Date();
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
        this.trader.sellToken(token);
      } else if (
        !token.rugged &&
        !token.hit300 &&
        Number(token.currentPrice) >= Number(token.scoutPrice) * 3
      ) {
        token.hit300 = true;
        token.timeTo300 =
          (new Date().getTime() - token.createdAt.getTime()) / 1000;
      } else if (
        !token.rugged &&
        !token.hit240 &&
        Number(token.currentPrice) >= Number(token.scoutPrice) * 2.4
      ) {
        token.hit240 = true;
        token.timeTo240 =
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
        !token.rugged &&
        !token.hit400 &&
        // Condition 1: Market cap reaches high value - take profits
        (message.marketCapSol * this.walletManager.solPriceInUSD >= 80000 ||
          // Condition 2: Price drops significantly from peak after hitting milestones
          (token.maxPrice &&
            // If hit 2x but dropped 30% from peak
            ((token.hit200 &&
              Number(token.currentPrice) <= token.maxPrice * 0.7) ||
              // If hit 1.5x but dropped 20% from peak
              (token.hit120 &&
                Number(token.currentPrice) <= token.maxPrice * 0.8))) ||
          // Condition 3: Rapid price decline
          (token.maxPrice &&
            Number(token.currentPrice) <= token.maxPrice * 0.6 &&
            (new Date().getTime() - token.createdAt.getTime()) / 1000 <= 300) || // 5 minutes
          // Condition 4: Volume/liquidity concerns
          message.vSolInBondingCurve < MIN_LIQUIDITY_SOL * 0.8) // Liquidity dropping
      ) {
        token.rugged = true;
        token.timeToRug =
          (new Date().getTime() - token.createdAt.getTime()) / 1000;

        // Only exit if we're at a loss greater than 10%
        if (
          BUY_AMOUNT_SOL +
            ((Number(token.currentPrice) - Number(token.buyPrice)) /
              Number(token.buyPrice)) *
              BUY_AMOUNT_SOL <=
          FEE_AMOUNT_SOL
        ) {
          this.removeActiveTrade(token);
          return;
        }

        this.trader.sellToken(token);
      }

      showOutput({
        activeTokens: this.activeTrades,
        walletManager: this.walletManager,
        unverifiedTokens: this.unverifiedTokens,
      });
    } else {
      const token = this.unverifiedTokens.find((trade) => trade.mint === mint);
      if (!token) return;
      token.lastUpdate = new Date();
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
          unverifiedTokens: this.unverifiedTokens,
          text: `🚨 ${isSafe.reason}`,
        });
        this.removeUnverifiedToken(token);
        return;
      }
      if (
        (new Date().getTime() - token.createdAt.getTime()) / 1000 >
        MAX_TOKEN_AGE
      ) {
        showOutput({
          activeTokens: this.activeTrades,
          walletManager: this.walletManager,
          unverifiedTokens: this.unverifiedTokens,
          text: `😈 Token has high risk - Removed "${token.name}"`,
        });
        this.removeUnverifiedToken(token);
        return;
      }
      if (Number(token.currentPrice) >= Number(token.scoutPrice) * 1.2) {
        this.trader.buyToken(token);
        token.hit120 = true;
        token.timeTo120 =
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

  addTradingHistory(token: Token) {
    if (this.tradingHistory.find((t) => t.mint === token.mint)) return;
    this.tradingHistory.push(token);
  }

  addAllActiveTradesToHistory() {
    for (const token of this.activeTrades) {
      if (this.tradingHistory.find((t) => t.mint === token.mint)) continue;
      this.tradingHistory.push(token);
    }
    this.activeTrades = [];
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

  //   Auto-sell stagnant tokens
  private autoSellStagnantTokens() {
    let stagnantTokens: Set<string> = new Set();
    setInterval(() => {
      for (const token of this.activeTrades) {
        if (token.sellPrice) continue;
        if (stagnantTokens.has(token.mint)) continue;
        if ((new Date().getTime() - token.lastUpdate.getTime()) / 1000 > 10) {
          this.trader.sellToken(token);
          stagnantTokens.add(token.mint);
        }
      }
    }, 1000);
  }
}
