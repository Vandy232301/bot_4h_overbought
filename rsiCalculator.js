// RSI calculator using Wilder's smoothing method

export class RSICalculator {
  constructor(period = 14) {
    this.period = period;
  }

  calculateRsi(prices) {
    if (!prices || prices.length < this.period + 1) return null;

    const deltas = [];
    for (let i = 1; i < prices.length; i++) {
      deltas.push(prices[i] - prices[i - 1]);
    }

    const gains = [];
    const losses = [];
    for (const d of deltas) {
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }

    // Initial averages
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < this.period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    avgGain /= this.period;
    avgLoss /= this.period;

    // Wilder smoothing
    for (let i = this.period; i < gains.length; i++) {
      avgGain = (avgGain * (this.period - 1) + gains[i]) / this.period;
      avgLoss = (avgLoss * (this.period - 1) + losses[i]) / this.period;
    }

    if (avgLoss === 0) return 100.0;
    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    return Number(rsi.toFixed(2));
  }

  calculateRsiFromCandles(candles) {
    if (!candles || candles.length < this.period + 1) return null;
    const prices = candles.map((c) => Number(c.close));
    return this.calculateRsi(prices);
  }
}

