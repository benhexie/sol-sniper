import { Token } from "./subscriptionManager";
import { WalletManager } from "./wallet";

let lastOutput: string = "";

export const showOutput = async ({
  activeTokens,
  walletManager,
  text,
}: {
  activeTokens: Token[];
  walletManager: WalletManager;
  text?: string;
}) => {
  const balance = await walletManager.getBalance();
  let table = activeTokens.map((token) => ({
    CA: token.mint,
    Name: token.name,
    "Market Cap":
      token.marketCapSol === "--"
        ? "--"
        : (token.marketCapSol * walletManager.solPriceInUSD).toFixed(2) +
          " USD",
    "1.5x": token.hit50 ? "🟢" : "🔴",
    "2x": token.hit100 ? "🟢" : "🔴",
    Rugged: token.rugged ? "🚨" : "",
  }));
  if (table.length === 0) {
    table = [
      {
        CA: "--",
        Name: "--",
        "Market Cap": "--",
        "1.5x": "--",
        "2x": "--",
        Rugged: "--",
      },
    ];
  }

  console.clear();
  console.log(`💼 Wallet Balance: ${balance} SOL`);
  console.log(`💰 SOL Price: ${walletManager.solPriceInUSD} USD\n\n`);
  console.table(table);
  if (text) lastOutput = text + "\n\n";
  if (lastOutput) console.log(lastOutput);
};
