import 'dotenv/config';

// Discord Webhook
export const DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL ??
  'https://discord.com/api/webhooks/1409126420957102166/Fg08DD25gvEla1wbUOCXspc_BlhOKwr1kB5xLcrIxpuB-GXG-BpKsAu6Z_YYTUwQ-e3T';

// Trading configuration
export const RSI_THRESHOLD = 85; // Alert when RSI >= 85
export const RSI_PERIOD = 14; // Standard RSI period
export const TIMEFRAMES = ['4h', '1h', '15m', '1m'];

// Volume and Open Interest filters
export const MIN_VOLUME_24H = Number(
  process.env.MIN_VOLUME_24H ?? '5000000',
); // $5M
export const MIN_OPEN_INTEREST = Number(
  process.env.MIN_OPEN_INTEREST ?? '2000000',
); // $2M

// Symbol blacklist
export const BLACKLISTED_SYMBOLS = ['ELXUSDT'];

// Monitoring
export const CHECK_INTERVAL = 30; // seconds (fallback loop sleep)

