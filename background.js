// CodeLens AI — GitHub code analysis
chrome.runtime.onInstalled.addListener(() => console.log('CodeLens AI ready'));

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'analyze') {
    // Basic analysis — full GitHub API integration in next iteration
    const code = req.code || '';
    const lines = code.split('\n').length;
    const chars = code.length;
    const functions = (code.match(/function\s+\w+|def\s+\w+|class\s+\w+/g) || []).length;
    const complexity = lines > 200 ? 'High' : lines > 50 ? 'Medium' : 'Low';
    sendResponse({ lines, chars, functions, complexity, language: detectLang(code) });
    return true;
  }
});

function detectLang(code) {
  if (code.includes('function')||code.includes('const')) return 'JavaScript';
  if (code.includes('def ')) return 'Python';
  if (code.includes('class ')&&code.includes('public')) return 'Java';
  if (code.includes('package ')&&code.includes('func')) return 'Go';
  if (code.includes('<?php')) return 'PHP';
  return 'Unknown';
}
