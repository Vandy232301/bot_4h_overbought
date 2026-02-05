import { AlertTracker } from './alertTracker.js';

const tracker = new AlertTracker();
const stats = tracker.getStats();

console.log('\n📊 ALERT STATISTICS\n');
console.log('═'.repeat(60));
console.log(`Total Alerts: ${stats.total}`);
console.log(`Target: ${stats.targetPercent}% from alert price (SHORT position)`);
console.log('─'.repeat(60));
console.log(`✅ Success: ${stats.success} (reached -1% target)`);
console.log(`⏳ Pending: ${stats.pending} (still monitoring)`);
console.log(`❌ Expired: ${stats.expired} (24h passed, no target)`);
console.log(`🔴 Failed: ${stats.failed}`);
console.log('─'.repeat(60));
console.log(`📈 Success Rate: ${stats.successRate}% (of completed alerts)`);
if (stats.avgTimeToTarget > 0) {
  console.log(`⏱️  Avg Time to Target: ${stats.avgTimeToTarget} minutes`);
}
console.log('─'.repeat(60));
console.log('📉 SHORT TRADE PERFORMANCE:');
console.log(`   📊 Average Maximum Drop: ${stats.avgMaxDrop.toFixed(4)}%`);
console.log(`   📊 Average Final Drop: ${stats.avgFinalDrop.toFixed(4)}%`);
console.log(`   🎯 Best Drop: ${stats.bestDrop.toFixed(4)}%`);
console.log(`   ⚠️  Worst Drop: ${stats.worstDrop.toFixed(4)}%`);
console.log('═'.repeat(60));

if (stats.total > 0) {
  console.log('\n📋 RECENT ALERTS (Last 10):\n');
  const recent = tracker.getRecentAlerts(10);
  recent.forEach((alert, idx) => {
    const date = new Date(alert.timestamp).toLocaleString();
    // For SHORT: drop is positive (price went down)
    const currentDrop = ((alert.price - alert.currentPrice) / alert.price) * 100;
    const statusEmoji =
      alert.status === 'success'
        ? '✅'
        : alert.status === 'pending'
          ? '⏳'
          : alert.status === 'expired'
            ? '⏰'
            : '❌';
    console.log(
      `${idx + 1}. ${statusEmoji} ${alert.symbol} (${alert.timeframe}) - RSI: ${alert.rsi}`,
    );
    console.log(`   Entry Price: ${alert.price}`);
    console.log(`   Current Price: ${alert.currentPrice}`);
    console.log(`   Current Drop: ${currentDrop.toFixed(4)}% (SHORT profit)`);
    if (alert.maxDropPercent > 0) {
      console.log(`   📉 Max Drop: ${alert.maxDropPercent.toFixed(4)}% (best SHORT entry)`);
      if (alert.maxDropAt) {
        const timeToMax = (alert.maxDropAt - alert.timestamp) / 1000 / 60;
        console.log(`   ⏱️  Max drop reached in ${timeToMax.toFixed(2)} minutes`);
      }
    }
    console.log(`   Target: ${alert.targetPrice} (-1%) | Status: ${alert.status}`);
    if (alert.timeToTargetMinutes) {
      console.log(`   ✅ Reached -1% target in ${alert.timeToTargetMinutes} minutes`);
    }
    console.log(`   📅 ${date}\n`);
  });
}

// Group by timeframe
console.log('\n📊 BY TIMEFRAME:\n');
const timeframes = ['4h', '1h', '15m', '1m'];
timeframes.forEach((tf) => {
  const tfAlerts = tracker.alerts.filter((a) => a.timeframe === tf);
  if (tfAlerts.length === 0) return;
  const tfSuccess = tfAlerts.filter((a) => a.status === 'success').length;
  const tfCompleted = tfAlerts.filter((a) => a.status !== 'pending').length;
  const tfRate = tfCompleted > 0 ? ((tfSuccess / tfCompleted) * 100).toFixed(2) : 0;
  console.log(
    `  ${tf.toUpperCase()}: ${tfAlerts.length} alerts | ${tfSuccess}/${tfCompleted} success (${tfRate}%)`,
  );
});

console.log('\n');
