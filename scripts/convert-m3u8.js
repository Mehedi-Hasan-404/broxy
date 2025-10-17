#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function encodeStreamUrl(url) {
  return encodeURIComponent(url);
}

function convertM3U8(inputFile, proxyUrl, outputFile) {
  try {
    // Validate files
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ Error: Input file not found: ${inputFile}`);
      process.exit(1);
    }

    if (!proxyUrl.startsWith('http')) {
      console.error('❌ Error: Invalid proxy URL. Must start with http:// or https://');
      process.exit(1);
    }

    // Ensure proxy URL doesn't end with slash
    const cleanProxyUrl = proxyUrl.endsWith('/') ? proxyUrl.slice(0, -1) : proxyUrl;

    const content = fs.readFileSync(inputFile, 'utf-8');
    const lines = content.split('\n');
    
    const converted = lines.map(line => {
      // Keep comments and empty lines unchanged
      if (line.startsWith('#') || line.trim() === '') {
        return line;
      }

      // Check if it's a URL
      if (line.startsWith('http://') || line.startsWith('https://')) {
        const encoded = encodeStreamUrl(line);
        const proxiedUrl = `${cleanProxyUrl}/?url=${encoded}`;
        return proxiedUrl;
      }

      return line;
    }).join('\n');

    // Write output
    fs.writeFileSync(outputFile, converted, 'utf-8');
    
    const urlCount = lines.filter(l => l.startsWith('http')).length;
    console.log(`✅ Conversion complete!`);
    console.log(`   📄 Input: ${inputFile}`);
    console.log(`   📤 Output: ${outputFile}`);
    console.log(`   🔗 Proxy: ${cleanProxyUrl}`);
    console.log(`   ✔️  URLs converted: ${urlCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('Usage: node convert-m3u8.js <input.m3u8> <proxy-url> <output.m3u8>');
  console.log('');
  console.log('Example:');
  console.log('  node convert-m3u8.js streams.m3u8 https://cors-proxy.workers.dev output.m3u8');
  console.log('');
  console.log('Format with Referer:');
  console.log('  Original: https://example.com/stream.m3u8|Referer=https://example.com');
  console.log('  Proxied: https://proxy.url/?url=https%3A%2F%2Fexample.com%2Fstream.m3u8%7CReferer%3Dhttps%3A%2F%2Fexample.com');
  process.exit(1);
}

const [inputFile, proxyUrl, outputFile] = args;
convertM3U8(inputFile, proxyUrl, outputFile);
