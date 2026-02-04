import {
  BLACKLISTED_SYMBOLS,
  CHECK_INTERVAL,
  MIN_OPEN_INTEREST,
  MIN_VOLUME_24H,
  RSI_PERIOD,
  RSI_THRESHOLD,
  TIMEFRAMES,
} from './config.js';
import { BybitClient } from './bybitClient.js';
import { RSICalculator } from './rsiCalculator.js';
import { DiscordAlert } from './discordAlert.js';

const timeframeMap = {
  '4h': '240',
  '1h': '60',
  '15m': '15',
  '1m': '1',
};

class OverboughtBotNode {
  constructor() {
    this.bybit = new BybitClient({ testnet: false });
    this.rsiCalc = new RSICalculator(RSI_PERIOD);
    this.discord = new DiscordAlert();

    this.symbolData = {}; // symbol -> timeframe -> { candles, lastCheck }
    this.alerted = {
      '4h': new Set(),
      '1h': new Set(),
      '15m': new Set(),
      '1m': new Set(),
      multi: new Set(),
    };
    this.lastRsi = {}; // symbol -> timeframe -> rsi
    this.running = false;
  }

  async initSymbols() {
    console.log('🔄 Fetching all symbols from Bybit (Node.js)...');
    let symbols = await this.bybit.getAllSymbols('linear');
    if (!symbols.length) {
      console.error('❌ No symbols retrieved');
      return false;
    }

    // blacklist
    symbols = symbols.filter((s) => !BLACKLISTED_SYMBOLS.includes(s));
    console.log(`✅ Found ${symbols.length} symbols. Initializing ${TIMEFRAMES.join(', ')}...`);

    for (const sym of symbols) {
      if (!sym) continue;
      if (!this.symbolData[sym]) this.symbolData[sym] = {};
      for (const tf of TIMEFRAMES) {
        if (!this.symbolData[sym][tf]) {
          this.symbolData[sym][tf] = { candles: [], lastCheck: 0 };
        }
      }
    }

    let initialized = 0;
    for (const [idx, sym] of symbols.entries()) {
      if (!sym) continue;
      // Rate limiting: delay every 10 symbols (like Python version)
      // Rate limiting: delay every 10 symbols (like Python version)
      if (idx > 0 && idx % 10 === 0) {
        await new Promise((r) => setTimeout(r, 200)); // 200ms delay every 10 symbols
      }
      let anyTf = false;
      for (const tf of TIMEFRAMES) {
        try {
          // Add delay between timeframe requests to avoid rate limits
          // Python version had delays between requests - we need this too
          await new Promise((r) => setTimeout(r, 100)); // 100ms delay between timeframe requests
          
          const interval = timeframeMap[tf] ?? '240';
          const candles = await this.bybit.getKlines(
            sym,
            interval,
            RSI_PERIOD + 10,
          );
          if (candles.length >= RSI_PERIOD + 1) {
            this.symbolData[sym][tf].candles = candles;
            this.symbolData[sym][tf].lastCheck = Date.now() / 1000;
            anyTf = true;
            this.bybit.subscribeKline(sym, interval, (symbol, candle) =>
              this.onNewCandle(symbol, candle, tf),
            );
          }
        } catch (err) {
          console.warn(`⚠️ Failed to init ${sym} ${tf}:`, err.message ?? err);
        }
      }
      if (anyTf) initialized++;
      if (initialized > 0 && initialized % 50 === 0) {
        console.log(`📊 Progress: ${initialized}/${symbols.length} symbols initialized...`);
      }
    }

    console.log(`✅ Initialized ${initialized} symbols for monitoring (Node.js)`);
    return initialized > 0;
  }

  onNewCandle(symbol, candle, timeframe) {
    if (BLACKLISTED_SYMBOLS.includes(symbol)) return;
    const data = this.symbolData[symbol]?.[timeframe];
    if (!data) return;
    const arr = data.candles;
    if (arr.length && arr[arr.length - 1].timestamp !== candle.timestamp) {
      arr.push(candle);
      if (arr.length > RSI_PERIOD + 10) arr.shift();
    } else if (arr.length) {
      arr[arr.length - 1] = candle;
    } else {
      arr.push(candle);
    }
    this.checkSymbol(symbol, timeframe);
  }

  async checkSymbol(symbol, timeframe) {
    if (BLACKLISTED_SYMBOLS.includes(symbol)) return;
    const data = this.symbolData[symbol]?.[timeframe];
    if (!data || data.candles.length < RSI_PERIOD + 1) return;

    const rsi = this.rsiCalc.calculateRsiFromCandles(data.candles);
    if (rsi == null) return;

    if (!this.lastRsi[symbol]) this.lastRsi[symbol] = {};
    const lastRsiTf = this.lastRsi[symbol][timeframe];
    this.lastRsi[symbol][timeframe] = rsi;

    if (rsi >= RSI_THRESHOLD) {
      const set = this.alerted[timeframe] ?? new Set();
      this.alerted[timeframe] = set;

      if (set.has(symbol)) {
        const resetThreshold = RSI_THRESHOLD - 5;
        if (rsi < resetThreshold) {
          set.delete(symbol);
          console.log(
            `🔄 ${symbol} RSI dropped to ${rsi} on ${timeframe} (below ${resetThreshold}), reset`,
          );
        } else if (
          lastRsiTf != null &&
          lastRsiTf < resetThreshold &&
          rsi >= RSI_THRESHOLD
        ) {
          set.delete(symbol);
          console.log(
            `🔄 ${symbol} RSI recovered to ${rsi} on ${timeframe} after drop (${lastRsiTf}), allowing re-alert`,
          );
        } else {
          return;
        }
      }

      const [volume24h, oi] = await Promise.all([
        this.bybit.getVolume24h(symbol),
        this.bybit.getOpenInterest(symbol),
      ]);
      if (volume24h != null && volume24h < MIN_VOLUME_24H) return;
      if (oi != null && oi < MIN_OPEN_INTEREST) return;

      const funding = await this.bybit.getFundingRate(symbol);
      console.log(
        `🚨 ALERT: ${symbol} RSI=${rsi} on ${timeframe}, Vol24h=${volume24h}, OI=${oi}`,
      );
      const ok = await this.discord.sendAlert(symbol, rsi, timeframe, funding, 'SHORT');
      if (ok) set.add(symbol);

      await this.checkMultiTimeframe(symbol);
    } else if (rsi >= RSI_THRESHOLD - 10) {
      console.debug?.(
        `📊 ${symbol} RSI ${rsi.toFixed(2)} on ${timeframe} (below threshold)`,
      );
    }
  }

  async checkMultiTimeframe(symbol) {
    if (BLACKLISTED_SYMBOLS.includes(symbol)) return;
    const sd = this.symbolData[symbol];
    if (!sd || !sd['1m']) return;
    const candles1m = sd['1m'].candles;
    if (candles1m.length < RSI_PERIOD + 1) return;
    const rsi1m = this.rsiCalc.calculateRsiFromCandles(candles1m);
    if (rsi1m == null || rsi1m < RSI_THRESHOLD) return;

    const tfsOther = ['4h', '1h', '15m'];
    let pair = null;
    let rsiOther = null;
    for (const tf of tfsOther) {
      const d = sd[tf];
      if (!d || d.candles.length < RSI_PERIOD + 1) continue;
      const r = this.rsiCalc.calculateRsiFromCandles(d.candles);
      if (r != null && r >= RSI_THRESHOLD) {
        pair = `${tf}+1m`;
        rsiOther = r;
        break;
      }
    }
    if (!pair || rsiOther == null) return;

    const set = this.alerted.multi;
    const resetThreshold = RSI_THRESHOLD - 5;
    if (set.has(symbol)) {
      if (rsi1m < resetThreshold || rsiOther < resetThreshold) {
        set.delete(symbol);
        console.log(`🔄 ${symbol} Multi-TF alert reset (RSI dropped below ${resetThreshold})`);
      } else {
        return;
      }
    }

    const funding = await this.bybit.getFundingRate(symbol);
    const ok = await this.discord.sendMultiTimeframeAlert(
      symbol,
      rsi1m,
      rsiOther,
      pair,
      funding,
      'SHORT',
    );
    if (ok) set.add(symbol);
  }

  async periodicCheck() {
    const now = Date.now() / 1000;
    let checked = 0;
    for (const [symbol, tfData] of Object.entries(this.symbolData)) {
      if (BLACKLISTED_SYMBOLS.includes(symbol)) continue;
      for (const tf of TIMEFRAMES) {
        const d = tfData[tf];
        if (!d) continue;
        let intervalSec;
        if (tf === '1m') intervalSec = 10;
        else if (tf === '15m') intervalSec = 15;
        else if (tf === '1h') intervalSec = 20;
        else intervalSec = 30;
        if (now - d.lastCheck > intervalSec) {
          const interval = timeframeMap[tf] ?? '240';
          // Add delay to avoid rate limits (like Python version: 0.1s = 100ms)
          await new Promise((r) => setTimeout(r, 100));
          const candles = await this.bybit.getKlines(
            symbol,
            interval,
            RSI_PERIOD + 10,
          );
          if (candles.length >= RSI_PERIOD + 1) {
            d.candles = candles;
            d.lastCheck = now;
            await this.checkSymbol(symbol, tf);
            checked++;
          }
        }
      }
    }
    console.log(`✅ Periodic check completed: ${checked} symbol-timeframe combinations checked`);
  }

  async start() {
    console.log(
      `📊 Initialized Node bot with RSI threshold ${RSI_THRESHOLD}, timeframes ${TIMEFRAMES.join(
        ', ',
      )}`,
    );
    const ok = await this.initSymbols();
    if (!ok) return;
    this.bybit.startWebSocket();
    this.running = true;
    while (this.running) {
      await this.periodicCheck();
      await new Promise((r) => setTimeout(r, CHECK_INTERVAL * 1000));
    }
  }

  stop() {
    this.running = false;
    this.bybit.stopWebSocket();
  }
}

async function main() {
  const bot = new OverboughtBotNode();
  process.on('SIGINT', () => {
    console.log('🛑 Stopping bot...');
    bot.stop();
    process.exit(0);
  });
  await bot.start();
}

main().catch((err) => {
  console.error('❌ Fatal error in bot:', err);
});

