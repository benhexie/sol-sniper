import { showOutput } from "./output";
import { Token } from "./subscriptionManager";
import { WalletManager } from "./wallet";
import { config } from "dotenv";

config({ path: `${__dirname}/../../.env` });
const MAX_ACTIVE_TRADES = Number(process.env.MAX_ACTIVE_TRADES!);
const MIN_MARKET_CAP_SOL = Number(process.env.MIN_MARKET_CAP_SOL!);
const MIN_LIQUIDITY_SOL = Number(process.env.MIN_LIQUIDITY_SOL!);

export class Trader {
  private getActiveTrades: () => Token[];
  private removeActiveTrade: (token: Token) => void;
  private addActiveTrade: (token: Token) => void;
  private walletManager: WalletManager;
  private clearUnverifiedTokens: () => void;

  constructor({
    getActiveTrades,
    removeActiveTrade,
    addActiveTrade,
    walletManager,
    clearUnverifiedTokens,
  }: {
    getActiveTrades: () => Token[];
    removeActiveTrade: (token: Token) => void;
    addActiveTrade: (token: Token) => void;
    walletManager: WalletManager;
    clearUnverifiedTokens: () => void;
  }) {
    this.getActiveTrades = getActiveTrades;
    this.removeActiveTrade = removeActiveTrade;
    this.addActiveTrade = addActiveTrade;
    this.walletManager = walletManager;
    this.clearUnverifiedTokens = clearUnverifiedTokens;
  }

  public async buyToken(token: any) {
    this.addActiveTrade(token);
    if (this.getActiveTrades().length >= MAX_ACTIVE_TRADES) {
      this.clearUnverifiedTokens();
    }
    showOutput({
      activeTokens: this.getActiveTrades(),
      walletManager: this.walletManager,
      text: `🟢 Buying ${token.name}...`,
    });
  }

  public async sellToken(token: any, percentage: "50" | "100") {
    showOutput({
      activeTokens: this.getActiveTrades(),
      walletManager: this.walletManager,
      text: `🔻 Selling ${percentage === "100" ? "all" : "half"} of ${
        token.name
      }...`,
    });
    if (percentage === "100") this.removeActiveTrade(token);
  }

  async isSafeToken(message: any): Promise<{ safe: boolean; reason?: string }> {
    try {
      if (this.getActiveTrades().length >= MAX_ACTIVE_TRADES)
        return {
          safe: false,
          reason: "🧢 Trade limit reached",
        };

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
