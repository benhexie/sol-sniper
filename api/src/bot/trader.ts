import { showOutput } from "./output";
import { Token } from "./subscriptionManager";
import { WalletManager } from "./wallet";
import { config } from "dotenv";

config({ path: `${__dirname}/../../.env` });
const MAX_ACTIVE_TRADES = Number(process.env.MAX_ACTIVE_TRADES!);
const MIN_MARKET_CAP_SOL = Number(process.env.MIN_MARKET_CAP_SOL!);
const MIN_LIQUIDITY_SOL = Number(process.env.MIN_LIQUIDITY_SOL!);
const BUY_AMOUNT_SOL = Number(process.env.BUY_AMOUNT_SOL!);

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
  }

  private clearFinishedTrades() {
    this.getActiveTrades().forEach((token) => {
      if (this.getTradingHistory().some((t) => t.mint === token.mint)) {
        this.removeActiveTrade(token);
      }
    });
  }

  public async buyToken(token: Token) {
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
    if (this.getActiveTrades().length >= MAX_ACTIVE_TRADES) {
      this.clearUnverifiedTokens();
    }
    showOutput({
      activeTokens: this.getActiveTrades(),
      walletManager: this.walletManager,
      text: `🟢 Buying ${token.name}...`,
      unverifiedTokens: this.unverifiedTokens,
    });
    token.buyPrice = token.currentPrice as number;
    const fees = (() => {
      return 0.01;
    })();
    this.walletManager.updateBalance(-(BUY_AMOUNT_SOL + fees));
  }

  public async sellToken(token: Token) {
    showOutput({
      activeTokens: this.getActiveTrades(),
      walletManager: this.walletManager,
      text: `🔻 Selling ${token.name}...`,
      unverifiedTokens: this.unverifiedTokens,
    });
    this.addTradingHistory(token);
    token.sellPrice = token.currentPrice as number;

    // Safety checks for calculations
    let buyPrice = Number(token.buyPrice);
    const sellPrice = Number(token.sellPrice);

    if (!buyPrice || buyPrice <= 0) buyPrice = 0.000000001;

    const profitMultiplier = (sellPrice - buyPrice) / buyPrice;
    const cappedProfitMultiplier = Math.min(profitMultiplier, 10);

    this.walletManager.updateBalance(
      BUY_AMOUNT_SOL + cappedProfitMultiplier * BUY_AMOUNT_SOL - 0.01
    );
  }

  async isSafeToken(message: any): Promise<{ safe: boolean; reason?: string }> {
    try {
      if ((await this.walletManager.getBalance()) <= BUY_AMOUNT_SOL + 0.01) {
        return {
          safe: false,
          reason: "Insufficient balance to buy token",
        };
      }

      const marketCapSol =
        message.marketCapSol === "--" ? 0 : message.marketCapSol;
      const vSolInBondingCurve =
        message.vSolInBondingCurve === "--" ? 0 : message.vSolInBondingCurve;

      if (marketCapSol < MIN_MARKET_CAP_SOL) {
        return {
          safe: false,
          reason: `Market cap too low: ${marketCapSol} SOL (min: ${MIN_MARKET_CAP_SOL} SOL)`,
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
}
