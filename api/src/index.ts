import { config } from "dotenv";
import { SniperBot } from "./bot";
config();

new SniperBot().start();
