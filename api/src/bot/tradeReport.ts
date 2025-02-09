import { WalletManager } from "./wallet";
import { Token } from "./subscriptionManager";
import { showOutput } from "./output";

export class TradeReport {
  static async generate(
    tradingHistory: Token[],
    walletManager: WalletManager
  ): Promise<void> {
    const initialBalance = walletManager.getInitialBalance();
    const finalBalance = await walletManager.getBalance();
    const totalProfit = finalBalance - initialBalance;
    const profitPercentage = (totalProfit / initialBalance) * 100;

    // Calculate trading statistics
    const successfulTrades = tradingHistory.filter(
      (t) =>
        t.sellPrice &&
        t.buyPrice &&
        (Number(t.sellPrice) - Number(t.buyPrice)) / Number(t.buyPrice) > 0
    ).length;
    const totalTrades = tradingHistory.length;
    const winRate = (successfulTrades / totalTrades) * 100;

    // Find best and worst trades
    const tradesWithReturns = tradingHistory
      .filter((t) => t.sellPrice && t.buyPrice)
      .map((t) => ({
        name: t.name,
        return:
          ((Number(t.sellPrice) - Number(t.buyPrice)) / Number(t.buyPrice)) *
          100,
        timeToProfit: t.timeTo150 ? Number(t.timeTo150) : 0,
      }))
      .sort((a, b) => b.return - a.return);

    const bestTrade = tradesWithReturns[0];
    const worstTrade = tradesWithReturns[tradesWithReturns.length - 1];

    // Calculate average time to 1.5x
    const avgTimeTo150 =
      tradingHistory
        .filter((t) => t.timeTo150)
        .reduce((acc, t) => acc + (Number(t.timeTo150) || 0), 0) /
        tradingHistory.filter((t) => t.timeTo150).length || 0;

    // Generate report
    showOutput({
      activeTokens: tradingHistory,
      walletManager: walletManager,
      text: `
🧾 TRADING SESSION REPORT
═══════════════════════
📊 Performance Metrics:
• Initial Balance: ${initialBalance.toFixed(3)} SOL
• Final Balance: ${finalBalance.toFixed(3)} SOL
• Total Profit: ${totalProfit.toFixed(3)} SOL (${profitPercentage.toFixed(2)}%)
• Win Rate: ${winRate.toFixed(1)}% (${successfulTrades}/${totalTrades} trades)

🏆 Best Performing Trade:
• Token: ${bestTrade ? bestTrade.name : "N/A"}
• Return: ${bestTrade ? bestTrade.return.toFixed(2) : 0}%
• Time to 1.5x: ${bestTrade ? bestTrade.timeToProfit.toFixed(1) : 0}s

📉 Worst Performing Trade:
• Token: ${worstTrade ? worstTrade.name : "N/A"}
• Return: ${worstTrade ? worstTrade.return.toFixed(2) : 0}%

⚡ Trading Speed:
• Average Time to 1.5x: ${avgTimeTo150.toFixed(1)}s

Session ended at: ${new Date().toLocaleString()}
═══════════════════════`,
    });
  }
}
