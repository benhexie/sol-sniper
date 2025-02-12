import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { showOutput } from "./output";
import { Token } from "./subscriptionManager";
import { WalletManager } from "./wallet";
import { config } from "dotenv";
import bs58 from "bs58";

config({ path: `${__dirname}/../../.env` });
const MAX_ACTIVE_TRADES = Number(process.env.MAX_ACTIVE_TRADES!);
const MIN_MARKET_CAP_SOL = Number(process.env.MIN_MARKET_CAP_SOL!);
const MAX_MARKET_CAP_SOL = Number(process.env.MAX_MARKET_CAP_SOL!);
const MIN_LIQUIDITY_SOL = Number(process.env.MIN_LIQUIDITY_SOL!);
const BUY_AMOUNT_SOL = Number(process.env.BUY_AMOUNT_SOL!);
const FEE_AMOUNT_SOL = Number(process.env.FEE_AMOUNT_SOL!);
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const DEV_MODE = process.env.DEV_MODE! === "true";
const PRIORITY_FEE_SOL = Number(process.env.PRIORITY_FEE_SOL!);
const SLIPPAGE = Number(process.env.SLIPPAGE!);

const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY!));
const publicKey = keypair.publicKey;

export class Trader {
  private getActiveTrades: () => Token[];
  private removeActiveTrade: (token: Token) => void;
  private addActiveTrade: (token: Token) => void;
  private walletManager: WalletManager;
  private clearUnverifiedTokens: () => void;
  private addTradingHistory: (token: Token) => void;
  private getTradingHistory: () => Token[];
  private unverifiedTokens: Token[];
  private removeUnverifiedToken: (token: Token) => void;
  private connection: Connection;

  constructor({
    getActiveTrades,
    removeActiveTrade,
    addActiveTrade,
    walletManager,
    clearUnverifiedTokens,
    addTradingHistory,
    getTradingHistory,
    unverifiedTokens,
    removeUnverifiedToken,
    connection,
  }: {
    getActiveTrades: () => Token[];
    removeActiveTrade: (token: Token) => void;
    addActiveTrade: (token: Token) => void;
    walletManager: WalletManager;
    clearUnverifiedTokens: () => void;
    addTradingHistory: (token: Token) => void;
    getTradingHistory: () => Token[];
    unverifiedTokens: Token[];
    removeUnverifiedToken: (token: Token) => void;
    connection: Connection;
  }) {
    this.getActiveTrades = getActiveTrades;
    this.removeActiveTrade = removeActiveTrade;
    this.addActiveTrade = addActiveTrade;
    this.walletManager = walletManager;
    this.clearUnverifiedTokens = clearUnverifiedTokens;
    this.addTradingHistory = addTradingHistory;
    this.getTradingHistory = getTradingHistory;
    this.unverifiedTokens = unverifiedTokens;
    this.removeUnverifiedToken = removeUnverifiedToken;
    this.connection = connection;
  }

  private clearFinishedTrades() {
    this.getActiveTrades().forEach((token) => {
      if (this.getTradingHistory().some((t) => t.mint === token.mint)) {
        this.removeActiveTrade(token);
      }
    });
  }

  public async buyToken(token: Token) {
    try {
      if (this.getActiveTrades().length >= MAX_ACTIVE_TRADES)
        this.clearFinishedTrades();

      if (this.getActiveTrades().length >= MAX_ACTIVE_TRADES) {
        this.removeUnverifiedToken(token);
        return {
          safe: false,
          reason: "🧢 Trade limit reached",
        };
      }

      this.addActiveTrade(token);
      token.buyPrice = token.currentPrice as number;
      this.walletManager.updateBalance(-(BUY_AMOUNT_SOL + FEE_AMOUNT_SOL));
      showOutput({
        activeTokens: this.getActiveTrades(),
        walletManager: this.walletManager,
        text: `🟢 Buying ${token.name}...`,
        unverifiedTokens: this.unverifiedTokens,
      });

      if (!DEV_MODE)
        await this.sendPortalTransaction(
          token.mint,
          "buy",
          BUY_AMOUNT_SOL,
          "true"
        );
    } catch (error) {
      this.removeActiveTrade(token);
      showOutput({
        activeTokens: this.getActiveTrades(),
        walletManager: this.walletManager,
        text: `🚨 Error buying ${token.name}: ${error}`,
        unverifiedTokens: this.unverifiedTokens,
      });
    }
  }

  public async sellToken(token: Token) {
    try {
      showOutput({
        activeTokens: this.getActiveTrades(),
        walletManager: this.walletManager,
        text: `🔻 Selling ${token.name}...`,
        unverifiedTokens: this.unverifiedTokens,
      });

      this.addTradingHistory(token);
      token.sellPrice = token.currentPrice as number;
      let buyPrice = Number(token.buyPrice);
      const sellPrice = Number(token.sellPrice);

      if (!buyPrice || buyPrice <= 0) buyPrice = 0.000000001;

      const profitMultiplier = (sellPrice - buyPrice) / buyPrice;
      const cappedProfitMultiplier = Math.min(profitMultiplier, 10);

      this.walletManager.updateBalance(
        BUY_AMOUNT_SOL +
          cappedProfitMultiplier * BUY_AMOUNT_SOL -
          FEE_AMOUNT_SOL
      );

      if (!DEV_MODE)
        await this.sendPortalTransaction(token.mint, "sell", "100%", "false");
    } catch (error) {
      showOutput({
        activeTokens: this.getActiveTrades(),
        walletManager: this.walletManager,
        text: `🚨 Error selling ${token.name}: ${error}`,
        unverifiedTokens: this.unverifiedTokens,
      });
    }
  }

  async isSafeToken(message: any): Promise<{ safe: boolean; reason?: string }> {
    try {
      if (
        (await this.walletManager.getBalance()) <=
        BUY_AMOUNT_SOL + FEE_AMOUNT_SOL
      ) {
        return {
          safe: false,
          reason: "Insufficient balance to buy token",
        };
      }

      const marketCapSol =
        message.marketCapSol === "--" ? 0 : message.marketCapSol;
      const vSolInBondingCurve =
        message.vSolInBondingCurve === "--" ? 0 : message.vSolInBondingCurve;

      if (
        marketCapSol < MIN_MARKET_CAP_SOL ||
        marketCapSol > MAX_MARKET_CAP_SOL
      ) {
        return {
          safe: false,
          reason: `Market cap ${marketCapSol} SOL is out of range (min: ${MIN_MARKET_CAP_SOL} SOL, max: ${MAX_MARKET_CAP_SOL} SOL)`,
        };
      }

      if (vSolInBondingCurve < MIN_LIQUIDITY_SOL) {
        return {
          safe: false,
          reason: `Liquidity too low: ${vSolInBondingCurve} SOL (min: ${MIN_LIQUIDITY_SOL} SOL)`,
        };
      }

      if (MIN_LIQUIDITY_SOL > MIN_MARKET_CAP_SOL) {
        if (vSolInBondingCurve > marketCapSol) {
          return {
            safe: false,
            reason: `Liquidity should be higher than market cap`,
          };
        }
      }

      return { safe: true };
    } catch (error) {
      return {
        safe: false,
        reason: "Error checking token safety" + `\n${error}`,
      };
    }
  }

  private async sendPortalTransaction(
    ca: string,
    action: "buy" | "sell",
    amount: number | "100%",
    denominatedInSol: "true" | "false"
  ) {
    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        publicKey,
        action,
        mint: ca,
        denominatedInSol,
        amount,
        slippage: SLIPPAGE,
        priorityFee: PRIORITY_FEE_SOL,
        pool: "pump",
      }),
    });
    if (response.status === 200) {
      const data = await response.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(data));
      tx.sign([keypair]);
      const signature = await this.connection.sendTransaction(tx);
    } else {
      throw new Error(response.statusText);
    }
  }
}
