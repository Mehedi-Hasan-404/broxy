#!/usr/bin/env node

console.log('🧪 Testing CORS Stream Proxy\n');

// Test URL encoding
const testUrls = [
  'https://example.com/stream.m3u8',
  'https://example.com/stream.m3u8?token=abc123',
  'https://example.com/stream.m3u8|Referer=https://example.com',
  'https://nxtlive.net/sliv/stream.m3u8?id=1000009246|Referer=https://nxtlive.net',
  'http://195.181.169.162:80/SONY_HD/index.mpd?token=test'
];

console.log('📝 Test URLs and their encodings:\n');
console.log('='.repeat(80));

testUrls.forEach((url, index) => {
  const encoded = encodeURIComponent(url);
  const proxyUrl = `https://cors-stream-proxy.workers.dev/?url=${encoded}`;
  
  console.log(`\n[Test ${index + 1}]`);
  console.log(`Original URL:`);
  console.log(`  ${url}\n`);
  console.log(`URL Encoded:`);
  console.log(`  ${encoded}\n`);
  console.log(`Proxied URL:`);
  console.log(`  ${proxyUrl}\n`);
  console.log('-'.repeat(80));
});

console.log('\n✅ Test complete!\n');
console.log('📋 Summary:');
console.log(`   • Total test cases: ${testUrls.length}`);
console.log(`   • All encodings generated successfully`);
console.log('\n🚀 Next steps:');
console.log('   1. Deploy the worker: npm run deploy');
console.log('   2. Replace "https://cors-stream-proxy.workers.dev" with your actual worker URL');
console.log('   3. Use the proxied URLs in your player or M3U8 playlist');
console.log('   4. Run: node scripts/convert-m3u8.js input.m3u8 YOUR_WORKER_URL output.m3u8\n');
