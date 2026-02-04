import axios from 'axios';
import {
  DISCORD_WEBHOOK_URL,
} from './config.js';

function formatEetTimestamp() {
  const now = new Date();
  const options = {
    timeZone: 'Europe/Bucharest',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const time = now.toLocaleTimeString('en-US', options);
  return `Today at ${time}`;
}

export class DiscordAlert {
  constructor(webhookUrl = DISCORD_WEBHOOK_URL) {
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(symbol, rsi, timeframe = '4h', fundingRate = null, bias = 'SHORT') {
    try {
      const fundingRateStr =
        typeof fundingRate === 'number'
          ? `${(fundingRate * 100).toFixed(4)}%`
          : 'N/A';

      const timeframeMap = {
        '4h': '4H',
        '1h': '1H',
        '15m': '15',
        '1m': '1',
      };
      const tfParam = timeframeMap[timeframe.toLowerCase()] ?? '4H';

      const bybitUrl = `https://www.bybit.com/trade/usdt/${symbol}?interval=${tfParam}`;
      const tradingviewSymbol = `${symbol}.P`;
      const tradingviewUrl = `https://www.tradingview.com/chart/?symbol=BYBIT:${tradingviewSymbol}&interval=${tfParam}`;
      const mexcUrl = `https://www.mexc.com/exchange/${symbol}_USDT?interval=${tfParam}`;

      const ts = formatEetTimestamp();
      const tfLower = timeframe.toLowerCase();

      let timeframeDisplay;
      let rsiDisplay;
      let color;
      if (tfLower === '4h') {
        timeframeDisplay = '4h';
        rsiDisplay = `📊 **RSI:** ${rsi} (TF4H)`;
        color = 16711680; // Red
      } else if (tfLower === '1h') {
        timeframeDisplay = '1h';
        rsiDisplay = `📊 **RSI:** ${rsi} (TF1H)`;
        color = 16776960; // Yellow
      } else if (tfLower === '15m') {
        timeframeDisplay = '15m';
        rsiDisplay = `📊 **RSI:** ${rsi} (TF15M)`;
        color = 16711935; // Pink
      } else if (tfLower === '1m') {
        timeframeDisplay = '1m';
        rsiDisplay = `📊 **RSI:** ${rsi} (TF1M)`;
        color = 8388736; // Violet
      } else {
        timeframeDisplay = tfLower;
        rsiDisplay = `📊 **RSI:** ${rsi} (TF${timeframe.toUpperCase()})`;
        color = 16711680;
      }

      const description =
        `🪙 **Symbol:** [${symbol}](${bybitUrl})\n` +
        `⏱️ **Timeframe:** ${timeframeDisplay}\n` +
        `${rsiDisplay}\n` +
        `💱 **Funding Rate:** ${fundingRateStr}\n` +
        `🎯 **Bias:** ${bias}\n\n` +
        `**Trade on:** [Tradingview](${tradingviewUrl}) | [Bybit](${bybitUrl}) | [Mexc](${mexcUrl})\n\n` +
        `⚠️ These alerts are informational only and not profit guarantees or financial advice. Always DYOR before entering any trade!`;

      const embed = {
        title: '🎯 DYNASTY OVEREXHAUSTION ALERT',
        description,
        color,
        footer: {
          text: `⚡ Powered by DYNASTY • ${ts}`,
        },
      };

      const payload = {
        embeds: [embed],
        username: 'DYNASTY FUTURES BOT',
      };

      const res = await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
      });

      if (res.status === 204) {
        console.log(`✅ Alert sent for ${symbol} (RSI: ${rsi})`);
        return true;
      }
      console.error(`❌ Failed to send alert: ${res.status} - ${res.data ?? ''}`);
      return false;
    } catch (err) {
      console.error('❌ Error sending Discord alert:', err.message ?? err);
      return false;
    }
  }

  async sendMultiTimeframeAlert(symbol, rsi1m, rsiOther, timeframePair, fundingRate = null, bias = 'SHORT') {
    try {
      const fundingRateStr =
        typeof fundingRate === 'number'
          ? `${(fundingRate * 100).toFixed(4)}%`
          : 'N/A';

      const [tf1, tf2] = timeframePair.split('+');

      const bybitUrl = `https://www.bybit.com/trade/usdt/${symbol}?interval=1`;
      const tradingviewSymbol = `${symbol}.P`;
      const tradingviewUrl = `https://www.tradingview.com/chart/?symbol=BYBIT:${tradingviewSymbol}&interval=1`;
      const mexcUrl = `https://www.mexc.com/exchange/${symbol}_USDT?interval=1`;

      const ts = formatEetTimestamp();

      const tfDisplayMap = {
        '4h': '4H',
        '1h': '1H',
        '15m': '15M',
        '1m': '1M',
      };
      const tf1Display = tfDisplayMap[tf1] ?? tf1.toUpperCase();
      const tf2Display = tfDisplayMap[tf2] ?? tf2.toUpperCase();

      const description =
        `🪙 **Symbol:** [${symbol}](${bybitUrl})\n` +
        `⏱️ **Timeframes:** ${tf1Display} + ${tf2Display}\n` +
        `📊 **RSI ${tf1Display}:** ${rsiOther} | **RSI ${tf2Display}:** ${rsi1m}\n` +
        `💱 **Funding Rate:** ${fundingRateStr}\n` +
        `🎯 **Bias:** ${bias}\n\n` +
        `**Trade on:** [Tradingview](${tradingviewUrl}) | [Bybit](${bybitUrl}) | [Mexc](${mexcUrl})\n\n` +
        `⚠️ These alerts are informational only and not profit guarantees or financial advice. Always DYOR before entering any trade!`;

      const embed = {
        title: '🎯 DYNASTY OVEREXHAUSTION ALERT',
        description,
        color: 65280, // Green
        footer: {
          text: `⚡ Powered by DYNASTY • ${ts}`,
        },
      };

      const payload = {
        embeds: [embed],
        username: 'DYNASTY FUTURES BOT',
      };

      const res = await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
      });

      if (res.status === 204) {
        console.log(`✅ Multi-timeframe alert sent for ${symbol} (${timeframePair})`);
        return true;
      }
      console.error(
        `❌ Failed to send multi-timeframe alert: ${res.status} - ${res.data ?? ''}`,
      );
      return false;
    } catch (err) {
      console.error('❌ Error sending multi-timeframe alert:', err.message ?? err);
      return false;
    }
  }
}

