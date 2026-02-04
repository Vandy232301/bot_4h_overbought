# DYNASTY Overbought RSI Bot

Bot Node.js pentru monitorizarea tokenurilor Bybit cu RSI overbought (≥85) pe multiple timeframe-uri și trimiterea de alerte pe Discord.

## Funcționalități

- ✅ Monitorizează **4H, 1H, 15M, 1M** timeframe-uri
- ✅ RSI ≥ 85 (Wilder smoothing, period 14)
- ✅ Alerte colorate separate pentru fiecare timeframe:
  - 🔴 **4H** - Roșu
  - 🟡 **1H** - Galben
  - 🟣 **1M** - Violet
  - 🩷 **15M** - Roz
  - 🟢 **Multi-timeframe** - Verde (1M + 4H/1H/15M simultan)
- ✅ Filtre: Volume 24h ≥ $5M, Open Interest ≥ $2M
- ✅ Blacklist: `ELXUSDT` exclus
- ✅ Re-alerting: Detectează când RSI scade și revine la 85+
- ✅ Linkuri directe: TradingView, Bybit, MEXC cu timeframe-ul corect
- ✅ Timestamp EET în footer

## Instalare

```bash
npm install
```

## Configurare

Creează un fișier `.env` (opțional) pentru a suprascrie valorile implicite:

```env
DISCORD_WEBHOOK_URL=your_webhook_url_here
MIN_VOLUME_24H=5000000
MIN_OPEN_INTEREST=2000000
```

Valorile implicite sunt deja configurate în `config.js` și includ webhook-ul Discord și blacklist-ul.

## Pornire

```bash
npm start
```

## Structură

- `bot.js` - Orchestrator principal
- `bybitClient.js` - Client Bybit (HTTP + WebSocket)
- `discordAlert.js` - Sistem de alerte Discord
- `rsiCalculator.js` - Calculator RSI (Wilder's method)
- `config.js` - Configurări

## Logging

Log-urile sunt afișate în consolă. Pentru logging în fișier, poți adăuga un logger (ex: `winston` sau `pino`).

## Note

- Botul folosește WebSocket pentru actualizări în timp real
- Verificări periodice HTTP ca fallback
- Gestionare automată a rate limiting și retry logic
- Re-alerting inteligent: resetează alerta când RSI scade sub 80