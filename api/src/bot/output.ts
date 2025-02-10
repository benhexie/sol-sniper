import { Token } from "./subscriptionManager";
import { WalletManager } from "./wallet";
import { config } from "dotenv";

config({ path: `${__dirname}/../../.env` });

const BUY_AMOUNT_SOL = Number(process.env.BUY_AMOUNT_SOL!);

let lastOutput: string = "";
let startTime = Date.now();

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
    "1.2x": token.hit120 ? "🟢" : "🔴",
    "TT1.2x": token.timeTo120,
    "2x": token.hit200 ? "🟢" : "🔴",
    TT2x: token.timeTo200,
    "2.4x": token.hit240 ? "🟢" : "🔴",
    TT24x: token.timeTo240,
    "3x": token.hit300 ? "🟢" : "🔴",
    TT3x: token.timeTo300,
    "4x": token.hit400 ? "🟢" : "🔴",
    TT4x: token.timeTo400,
    Rugged: token.rugged ? "🚨" : "--",
    TTR: token.timeToRug,
    "Trade Summary": `${BUY_AMOUNT_SOL} SOL -> ${
      token.sellPrice
        ? (() => {
            const profitMultiplier =
              (Number(token.sellPrice) - Number(token.buyPrice)) /
              Number(token.buyPrice);
            const cappedMultiplier = Math.min(profitMultiplier, 10); // Cap at 1000% profit
            return (BUY_AMOUNT_SOL + cappedMultiplier * BUY_AMOUNT_SOL).toFixed(
              3
            );
          })()
        : "--"
    } SOL`,
  }));
  if (table.length === 0) {
    table = [
      {
        CA: "--",
        Name: "--",
        "Market Cap": "--",
        "1.2x": "--",
        "TT1.2x": "",
        "2x": "--",
        TT2x: "",
        "2.4x": "--",
        TT24x: "",
        "3x": "--",
        TT3x: "",
        "4x": "--",
        TT4x: "",
        Rugged: "--",
        TTR: "",
        "Trade Summary": `${BUY_AMOUNT_SOL} SOL -> -- SOL`,
      },
    ];
  }

  console.clear();
  const timeElapsed = (Date.now() - startTime) / 1000;
  console.log(`🕒 Time Elapsed: ${Math.floor(timeElapsed)}s`);
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
