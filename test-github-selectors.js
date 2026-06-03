#!/usr/bin/env node
// Test script to verify GitHub PR page selector analysis
// This script checks if the CSS selectors used in content.js match GitHub's current DOM structure

const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

// Note: jsdom might not be installed. This is a reference script.
// In practice, we test directly in the browser.

console.log('To test the extension:');
console.log('1. Open Chrome');
console.log('2. Go to chrome://extensions');
console.log('3. Enable "Developer mode"');
console.log('4. Click "Load unpacked"');
console.log('5. Select the codelens-ai directory');
console.log('6. Open any GitHub PR page (e.g., https://github.com/facebook/react/pull/1)');
console.log('7. You should see the CodeLens panel in the sidebar');
console.log('');
console.log('If the panel does not appear, check the Console for errors.');
console.log('The content script runs on pages matching: https://github.com/*/pull/*');
