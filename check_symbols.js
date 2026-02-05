import { BybitClient } from './bybitClient.js';
import { MIN_VOLUME_24H, MIN_OPEN_INTEREST, BLACKLISTED_SYMBOLS } from './config.js';

async function checkSymbols() {
  const client = new BybitClient({ testnet: false });
  
  console.log('🔄 Fetching all symbols from Bybit...');
  let allSymbols = await client.getAllSymbols('linear');
  console.log(`📊 Total symbols on Bybit: ${allSymbols.length}`);
  
  // Apply blacklist
  const afterBlacklist = allSymbols.filter((s) => !BLACKLISTED_SYMBOLS.includes(s));
  console.log(`🚫 After blacklist (${BLACKLISTED_SYMBOLS.length} excluded): ${afterBlacklist.length}`);
  
  // Get tickers for liquidity filter
  console.log('🔄 Fetching tickers for liquidity filter...');
  const tickerMap = await client.getAllLinearTickers();
  
  if (!tickerMap || Object.keys(tickerMap).length === 0) {
    console.log('❌ Could not fetch tickers');
    return;
  }
  
  console.log(`📊 Fetched tickers for ${Object.keys(tickerMap).length} symbols`);
  
  // Filter by liquidity
  const liquidSymbols = afterBlacklist.filter((s) => {
    const t = tickerMap[s];
    if (!t) return false;
    const volOk = t.volume24h >= MIN_VOLUME_24H;
    const oiOk = t.openInterest >= MIN_OPEN_INTEREST;
    return volOk && oiOk;
  });
  
  const removed = afterBlacklist.length - liquidSymbols.length;
  
  console.log('\n📈 LIQUIDITY FILTER RESULTS:');
  console.log(`   Minimum Volume 24h: $${MIN_VOLUME_24H.toLocaleString()}`);
  console.log(`   Minimum Open Interest: $${MIN_OPEN_INTEREST.toLocaleString()}`);
  console.log(`   Symbols before filter: ${afterBlacklist.length}`);
  console.log(`   Symbols after filter: ${liquidSymbols.length}`);
  console.log(`   Removed: ${removed}`);
  console.log(`\n✅ Bot monitors: ${liquidSymbols.length} symbols`);
  
  // Show some examples
  if (liquidSymbols.length > 0) {
    console.log(`\n📋 First 10 monitored symbols:`);
    liquidSymbols.slice(0, 10).forEach((s) => {
      const t = tickerMap[s];
      console.log(`   ${s}: Vol24h=$${t.volume24h.toLocaleString()}, OI=$${t.openInterest.toLocaleString()}`);
    });
  }
}

checkSymbols().catch(console.error);
