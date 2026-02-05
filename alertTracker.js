import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALERTS_FILE = path.join(__dirname, 'alerts_history.json');
const TARGET_PERCENT = -1; // -1% target

/**
 * Alert Tracker - Tracks alerts and calculates success rate
 */
export class AlertTracker {
  constructor() {
    this.alerts = this.loadAlerts();
  }

  loadAlerts() {
    try {
      if (fs.existsSync(ALERTS_FILE)) {
        const data = fs.readFileSync(ALERTS_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.warn('⚠️ Could not load alerts history:', err.message);
    }
    return [];
  }

  saveAlerts() {
    try {
      fs.writeFileSync(ALERTS_FILE, JSON.stringify(this.alerts, null, 2));
    } catch (err) {
      console.error('❌ Error saving alerts history:', err.message);
    }
  }

  /**
   * Record a new alert
   * @param {string} symbol
   * @param {number} rsi
   * @param {string} timeframe
   * @param {number} price - Price at alert time
   * @param {number} fundingRate
   */
  recordAlert(symbol, rsi, timeframe, price, fundingRate) {
    const alert = {
      id: `${symbol}_${timeframe}_${Date.now()}`,
      symbol,
      rsi: Number(rsi.toFixed(2)),
      timeframe,
      price: Number(price.toFixed(8)),
      targetPrice: Number((price * (1 + TARGET_PERCENT / 100)).toFixed(8)),
      fundingRate: fundingRate != null ? Number(fundingRate.toFixed(6)) : null,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      status: 'pending', // pending, success, failed, expired
      targetReached: null,
      targetReachedAt: null,
      maxPrice: price, // Track max price after alert
      minPrice: price, // Track min price after alert
      currentPrice: price,
      lastUpdate: Date.now(),
      maxDropPercent: 0, // Maximum drop percentage from alert price
      maxDropPrice: price, // Price at maximum drop
      maxDropAt: null, // Timestamp when max drop occurred
    };

    this.alerts.push(alert);
    this.saveAlerts();
    return alert;
  }

  /**
   * Update price tracking for an alert
   * @param {string} alertId
   * @param {number} currentPrice
   */
  updatePrice(alertId, currentPrice) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return;

    alert.currentPrice = Number(currentPrice.toFixed(8));
    alert.lastUpdate = Date.now();

    // Update min/max
    if (currentPrice > alert.maxPrice) alert.maxPrice = currentPrice;
    if (currentPrice < alert.minPrice) alert.minPrice = currentPrice;

    // Calculate drop percentage from alert price (for SHORT position)
    const dropPercent = ((alert.price - currentPrice) / alert.price) * 100;
    
    // Track maximum drop (best case for SHORT)
    if (dropPercent > alert.maxDropPercent) {
      alert.maxDropPercent = Number(dropPercent.toFixed(4));
      alert.maxDropPrice = currentPrice;
      alert.maxDropAt = Date.now();
    }

    // Check if target reached (-1%)
    if (alert.status === 'pending' && currentPrice <= alert.targetPrice) {
      alert.status = 'success';
      alert.targetReached = true;
      alert.targetReachedAt = Date.now();
      const timeToTarget = (Date.now() - alert.timestamp) / 1000 / 60; // minutes
      alert.timeToTargetMinutes = Number(timeToTarget.toFixed(2));
    }

    // Mark as expired if 24 hours passed without reaching target
    const hoursSinceAlert = (Date.now() - alert.timestamp) / 1000 / 3600;
    if (alert.status === 'pending' && hoursSinceAlert >= 24) {
      alert.status = 'expired';
      alert.targetReached = false;
      // Final drop calculation for expired alerts
      alert.finalDropPercent = Number(dropPercent.toFixed(4));
    }

    this.saveAlerts();
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.alerts.length;
    if (total === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
        expired: 0,
        successRate: 0,
        avgTimeToTarget: 0,
        avgMaxDrop: 0,
        avgFinalDrop: 0,
        bestDrop: 0,
        worstDrop: 0,
      };
    }

    const success = this.alerts.filter((a) => a.status === 'success').length;
    const failed = this.alerts.filter((a) => a.status === 'failed').length;
    const pending = this.alerts.filter((a) => a.status === 'pending').length;
    const expired = this.alerts.filter((a) => a.status === 'expired').length;

    const completed = success + failed + expired;
    const successRate = completed > 0 ? (success / completed) * 100 : 0;

    const successfulAlerts = this.alerts.filter((a) => a.status === 'success');
    const avgTimeToTarget =
      successfulAlerts.length > 0
        ? successfulAlerts.reduce((sum, a) => sum + (a.timeToTargetMinutes || 0), 0) /
          successfulAlerts.length
        : 0;

    // Calculate average maximum drop (best case for SHORT)
    const allDrops = this.alerts
      .filter((a) => a.maxDropPercent > 0)
      .map((a) => a.maxDropPercent);
    const avgMaxDrop = allDrops.length > 0 
      ? allDrops.reduce((sum, d) => sum + d, 0) / allDrops.length 
      : 0;

    // Calculate average final drop (for completed alerts)
    const completedAlerts = this.alerts.filter((a) => a.status !== 'pending');
    const finalDrops = completedAlerts.map((a) => {
      if (a.status === 'expired' && a.finalDropPercent != null) {
        return a.finalDropPercent;
      }
      // For success, use maxDropPercent or calculate from current price
      const currentDrop = ((a.price - a.currentPrice) / a.price) * 100;
      return a.maxDropPercent > 0 ? a.maxDropPercent : currentDrop;
    }).filter((d) => !isNaN(d) && d >= 0);
    
    const avgFinalDrop = finalDrops.length > 0
      ? finalDrops.reduce((sum, d) => sum + d, 0) / finalDrops.length
      : 0;

    // Best and worst drops
    const bestDrop = allDrops.length > 0 ? Math.max(...allDrops) : 0;
    const worstDrop = allDrops.length > 0 ? Math.min(...allDrops) : 0;

    return {
      total,
      success,
      failed,
      pending,
      expired,
      successRate: Number(successRate.toFixed(2)),
      avgTimeToTarget: Number(avgTimeToTarget.toFixed(2)),
      avgMaxDrop: Number(avgMaxDrop.toFixed(4)),
      avgFinalDrop: Number(avgFinalDrop.toFixed(4)),
      bestDrop: Number(bestDrop.toFixed(4)),
      worstDrop: Number(worstDrop.toFixed(4)),
      targetPercent: TARGET_PERCENT,
    };
  }

  /**
   * Get alerts by status
   */
  getAlertsByStatus(status) {
    return this.alerts.filter((a) => a.status === status);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 20) {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get alerts by symbol
   */
  getAlertsBySymbol(symbol) {
    return this.alerts.filter((a) => a.symbol === symbol);
  }
}
