import axios from 'axios';
import WebSocket from 'ws';

const BASE_URL = 'https://api.bybit.com';

export class BybitClient {
  constructor({ testnet = false } = {}) {
    this.testnet = testnet;
    this.ws = null;
    this.wsRunning = false;
    this.subscriptions = new Map(); // topic -> callback
  }

  get baseUrl() {
    return this.testnet ? 'https://api-testnet.bybit.com' : BASE_URL;
  }

  async _get(path, params = {}) {
    const url = new URL(path, this.baseUrl);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
    const res = await axios.get(url.toString(), { timeout: 10_000 });
    return res.data;
  }

  async getAllSymbols(category = 'linear') {
    try {
      const data = await this._get('/v5/market/instruments-info', { category });
      if (data.retCode !== 0) return [];
      const all = data.result?.list ?? [];
      return all
        .map((i) => i.symbol)
        .filter((s) => s && String(s).trim().length > 0);
    } catch (err) {
      console.error('❌ Error fetching symbols:', err.message ?? err);
      return [];
    }
  }

  async getKlines(symbol, interval = '240', limit = 200) {
    if (!symbol || !String(symbol).trim()) return [];
    const retries = 3;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const data = await this._get('/v5/market/kline', {
          category: 'linear',
          symbol,
          interval,
          limit,
        });
        if (data.retCode !== 0) {
          console.warn(
            `⚠️ Failed to get klines for ${symbol}: ${data.retMsg ?? 'Unknown error'}`,
          );
          return [];
        }
        const list = data.result?.list ?? [];
        list.reverse();
        return list.map((k) => ({
          timestamp: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5]),
          turnover: Number(k[6]),
        }));
      } catch (err) {
        const msg = (err.response?.data?.retMsg ?? err.message ?? '').toString();
        const isRateLimit =
          msg.includes('x-bapi-limit') || msg.includes('rate limit') || msg.includes('10006');
        const isNetwork =
          msg.includes('timeout') ||
          msg.includes('ECONN') ||
          msg.includes('disconnected') ||
          msg.includes('aborted');
        if (attempt < retries - 1 && (isRateLimit || isNetwork)) {
          const wait = isRateLimit ? (attempt + 1) * 5_000 : (attempt + 1) * 2_000;
          console.debug(
            `⏳ ${isRateLimit ? 'Rate limit' : 'Network'} error for ${symbol}, retrying in ${
              wait / 1000
            }s...`,
          );
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        console.warn(
          `⚠️ Error fetching klines for ${symbol} after ${attempt + 1} attempts: ${msg}`,
        );
        return [];
      }
    }
    return [];
  }

  async getFundingRate(symbol) {
    try {
      const data = await this._get('/v5/market/funding/history', {
        category: 'linear',
        symbol,
        limit: 1,
      });
      if (data.retCode !== 0) return null;
      const list = data.result?.list ?? [];
      if (!list.length) return null;
      return Number(list[0].fundingRate);
    } catch {
      return null;
    }
  }

  async getTicker(symbol) {
    try {
      const data = await this._get('/v5/market/tickers', {
        category: 'linear',
        symbol,
      });
      if (data.retCode !== 0) return null;
      const list = data.result?.list ?? [];
      return list[0] ?? null;
    } catch {
      return null;
    }
  }

  async getVolume24h(symbol) {
    const t = await this.getTicker(symbol);
    if (!t) return null;
    return Number(t.turnover24h ?? 0);
  }

  async getOpenInterest(symbol) {
    const t = await this.getTicker(symbol);
    if (!t) return null;
    return Number(t.openInterestValue ?? 0);
  }

  // WebSocket
  startWebSocket() {
    if (this.wsRunning) return;
    this.wsRunning = true;
    const url = this.testnet
      ? 'wss://stream-testnet.bybit.com/v5/public/linear'
      : 'wss://stream.bybit.com/v5/public/linear';

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      const topics = Array.from(this.subscriptions.keys());
      const batchSize = 10;
      for (let i = 0; i < topics.length; i += batchSize) {
        const batch = topics.slice(i, i + batchSize);
        ws.send(JSON.stringify({ op: 'subscribe', args: batch }));
      }
    });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw);
        if (data.topic && data.data && data.data.length > 0) {
          const topic = data.topic;
          const cb = this.subscriptions.get(topic);
          if (!cb) return;
          const c = data.data[0];
          const candle = {
            timestamp: Number(c.start),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume),
            turnover: Number(c.turnover ?? 0),
          };
          cb(c.symbol, candle);
        }
      } catch (err) {
        console.error('❌ WS message error:', err.message ?? err);
      }
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket error:', err.message ?? err);
    });

    ws.on('close', () => {
      console.warn('⚠️ WebSocket closed');
      this.wsRunning = false;
      this.ws = null;
      // simple reconnect
      setTimeout(() => this.startWebSocket(), 5_000);
    });
  }

  stopWebSocket() {
    this.wsRunning = false;
    if (this.ws) this.ws.close();
  }

  subscribeKline(symbol, interval = '240', callback) {
    const topic = `kline.${interval}.${symbol}`;
    this.subscriptions.set(topic, callback);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
    }
  }
}

