#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function encodeStreamUrl(url) {
  return encodeURIComponent(url);
}

function convertM3U8File(inputPath, outputPath, proxyUrl) {
  const content = fs.readFileSync(inputPath, 'utf-8');
  const lines = content.split('\n');
  
  const converted = lines.map(line => {
    if (line.startsWith('#') || line.trim() === '') {
      return line;
    }

    if (line.startsWith('http://') || line.startsWith('https://')) {
      const encoded = encodeStreamUrl(line);
      return `${proxyUrl}/?url=${encoded}`;
    }

    return line;
  }).join('\n');

  fs.writeFileSync(outputPath, converted, 'utf-8');
}

function batchConvert(inputDir, proxyUrl, outputDir) {
  try {
    // Validate inputs
    if (!fs.existsSync(inputDir)) {
      console.error(`❌ Error: Input directory not found: ${inputDir}`);
      process.exit(1);
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get all .m3u8 files
    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.m3u8'));

    if (files.length === 0) {
      console.warn('⚠️  No .m3u8 files found in input directory');
      return;
    }

    console.log(`\n🔄 Batch converting ${files.length} file(s)...\n`);

    let successCount = 0;
    let errorCount = 0;

    files.forEach(file => {
      try {
        const inputPath = path.join(inputDir, file);
        const outputPath = path.join(outputDir, file);
        
        convertM3U8File(inputPath, outputPath, proxyUrl);
        
        console.log(`✅ ${file}`);
        successCount++;
      } catch (error) {
        console.log(`❌ ${file} - ${error.message}`);
        errorCount++;
      }
    });

    console.log(`\n📊 Results:`);
    console.log(`   ✔️  Success: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📁 Output: ${outputDir}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('Usage: node batch-convert.js <input-dir> <proxy-url> <output-dir>');
  console.log('');
  console.log('Example:');
  console.log('  node batch-convert.js ./playlists https://cors-proxy.workers.dev ./output');
  process.exit(1);
}

const [inputDir, proxyUrl, outputDir] = args;
batchConvert(inputDir, proxyUrl, outputDir);
