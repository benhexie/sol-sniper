import { Token } from "./subscriptionManager";
import { WalletManager } from "./wallet";
import { config } from "dotenv";

config({ path: `${__dirname}/../../.env` });

const BUY_AMOUNT_SOL = Number(process.env.BUY_AMOUNT_SOL!);

let lastOutput: string = "";

export const showOutput = async ({
  activeTokens,
  unverifiedTokens,
  walletManager,
  text,
}: {
  activeTokens: Token[];
  unverifiedTokens?: Token[];
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
    "1.5x": token.hit150 ? "🟢" : "🔴",
    "TT1.5x": token.timeTo150,
    "2x": token.hit200 ? "🟢" : "🔴",
    TT2x: token.timeTo200,
    "4x": token.hit400 ? "🟢" : "🔴",
    TT4x: token.timeTo400,
    Rugged: token.rugged ? "🚨" : "--",
    TTR: token.timeToRug,
    "Trade Summary": `${BUY_AMOUNT_SOL} SOL -> ${
      token.sellPrice
        ? BUY_AMOUNT_SOL +
          ((Number(token.sellPrice) - Number(token.buyPrice)) /
            Number(token.buyPrice)) *
            BUY_AMOUNT_SOL
        : "--"
    } SOL`,
  }));
  if (table.length === 0) {
    table = [
      {
        CA: "--",
        Name: "--",
        "Market Cap": "--",
        "1.5x": "--",
        "TT1.5x": "",
        "2x": "--",
        TT2x: "",
        "4x": "--",
        TT4x: "",
        Rugged: "--",
        TTR: "",
        "Trade Summary": `${BUY_AMOUNT_SOL} SOL -> -- SOL`,
      },
    ];
  }

  console.clear();
  console.log(`💼 Wallet Balance: ${balance} SOL`);
  console.log(
    `💰 SOL Price: ${walletManager.solPriceInUSD.toFixed(2)} USD\n\n`
  );
  if (unverifiedTokens && unverifiedTokens.length > 0) {
    console.log("🚨 Unverified Tokens: " + unverifiedTokens.length);
  }
  console.table(table);
  if (text) lastOutput = text + "\n\n";
  if (lastOutput) console.log(lastOutput);
};
