# 🚀 Sol Sniper Bot

An automated trading bot for Solana that targets high-momentum token launches on pump.fun, implementing smart entry and exit strategies to maximize profits while minimizing rug pull risks.

## ✨ Features

- 🎯 **Smart Entry Detection**

  - Monitors new token launches in real-time
  - Validates market cap and liquidity thresholds
  - Enters positions at optimal momentum points (1.2x from launch)

- 📈 **Multi-Target Profit Taking**

  - Tracks multiple profit targets (2x, 2.4x, 3x, 4x)
  - Implements trailing stop losses
  - Automatic profit taking at key milestones

- 🛡️ **Risk Management**

  - Real-time market cap monitoring
  - Liquidity validation
  - Automatic rug pull detection
  - Market stagnation protection
  - Maximum trade limits

- 📊 **Performance Tracking**
  - Real-time trade monitoring
  - Detailed session reports
  - Win rate calculation
  - Profit/loss tracking
  - Trade timing analytics

## 🔧 Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/sol-sniper.git
cd sol-sniper
```

2. Install dependencies:

```bash
cd api
npm install
```

3. Configure your environment variables by copying `.env.example` to `.env`:

```bash
cp .env.example .env
```

4. Set up your environment variables in `.env`:

```env
# Required Configuration
PRIVATE_KEY=your_wallet_private_key
SOLANA_RPC_URL=your_rpc_url
PUMPPORTAL_API_KEY=your_api_key

# Trading Parameters
BUY_AMOUNT_SOL=0.1
FEE_AMOUNT_SOL=0.01
PRIORITY_FEE_SOL=0.0001
SLIPPAGE=0.5
MAX_ACTIVE_TRADES=3
MAX_UNVERIFIED_TRADES=5
MAX_TOKEN_AGE=60

# Risk Management
MIN_MARKET_CAP_SOL=1
MAX_MARKET_CAP_SOL=50
MIN_LIQUIDITY_SOL=0.5

# Development
DEV_MODE=true
```

## 🚀 Usage

Start the bot:

```bash
npm start
```

## 📊 Trading Strategy

1. **Entry Conditions**

   - New token launch detected
   - Market cap within safe range
   - Sufficient liquidity
   - Price increases by 20% (1.2x)

2. **Exit Strategies**

   - Take profit at 2x, 2.4x, 3x, or 4x
   - Auto-sell on market cap stagnation
   - Rug pull protection triggers
   - Trailing stop loss activation

3. **Risk Management**
   - Maximum active trades limit
   - Minimum liquidity requirements
   - Market cap validation
   - Stagnation detection
   - Maximum token age limit

## ⚠️ Risk Warning

Trading cryptocurrencies carries significant risk. This bot is designed to minimize risks but cannot guarantee profits. Always:

- Use funds you can afford to lose
- Start with small amounts to test
- Monitor the bot's performance
- Understand the risks involved

## 📝 License

MIT License - feel free to modify and use as needed.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
