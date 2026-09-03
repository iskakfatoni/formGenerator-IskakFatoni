/**
 * FORMCRAFT - Production Bundler & Obfuscator (Terser + Vite Pipeline)
 * Concatenates, minifies, mangles variable names, and removes comments
 * to create protected, ultra-fast production bundles for GitHub Pages.
 */

import fs from 'fs';
import path from 'path';
import { minify } from 'terser';

const ROOT_DIR = process.cwd();

const LANDING_FILES = [
  'js/firebase-config.js',
  'js/storage.js',
  'js/auth.js'
];

const FORMCRAFT_FILES = [
  'js/firebase-config.js',
  'js/storage.js',
  'js/auth.js',
  'js/image-uploader.js',
  'js/gdrive-uploader.js',
  'js/export-excel.js',
  'js/builder/templates.js',
  'js/builder/flowchart.js',
  'js/builder/renderer.js',
  'js/builder.js',
  'js/form-view.js',
  'js/responses.js',
  'js/app.js'
];

const TERSER_CONFIG = {
  ecma: 2020,
  compress: {
    passes: 2,
    dead_code: true,
    drop_debugger: true,
    drop_console: false // Retain status warnings
  },
  mangle: {
    toplevel: false, // Keep constructors like FormBuilder, FormViewer available globally
    keep_classnames: true
  },
  format: {
    comments: false
  }
};

async function bundleFiles(fileList, outputFileName) {
  console.log(`\n📦 Bundling ${fileList.length} files into ${outputFileName}...`);
  let combinedCode = '';
  let rawTotalSize = 0;

  for (const relPath of fileList) {
    const fullPath = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    rawTotalSize += content.length;
    combinedCode += `\n/* --- Source: ${relPath} --- */\n` + content + '\n;\n';
  }

  const result = await minify(combinedCode, TERSER_CONFIG);
  if (!result || !result.code) {
    throw new Error(`Terser failed to minify ${outputFileName}`);
  }

  const outPath = path.join(ROOT_DIR, outputFileName);
  fs.writeFileSync(outPath, result.code, 'utf8');

  const savings = Math.round((1 - result.code.length / rawTotalSize) * 100);
  console.log(`✅ Generated: ${outputFileName}`);
  console.log(`   Original: ${(rawTotalSize / 1024).toFixed(1)} KB -> Obfuscated: ${(result.code.length / 1024).toFixed(1)} KB (Saved ${savings}%)`);
}

async function run() {
  console.log('🚀 Starting Formcraft Production Bundler (Terser)...');
  try {
    await bundleFiles(LANDING_FILES, 'js/landing.bundle.min.js');
    await bundleFiles(FORMCRAFT_FILES, 'js/formcraft.bundle.min.js');
    console.log('\n✨ All production bundles generated successfully!');
  } catch (err) {
    console.error('❌ Build failed:', err);
    process.exit(1);
  }
}

run();
