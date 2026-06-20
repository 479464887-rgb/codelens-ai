// CodeLens AI — Background Service Worker
// GitHub API + DeepSeek AI code analysis

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';

let DEEPSEEK_KEY = '';
let GITHUB_TOKEN = '';

// Load keys from storage on startup
chrome.storage.sync.get(['deepseekKey', 'githubToken'], data => {
  DEEPSEEK_KEY = data.deepseekKey || '';
  GITHUB_TOKEN = data.githubToken || '';
});

// ExtPay initialization
try {
  const extpay = ExtPay('codelens-ai');
  extpay.startBackground();
} catch(e) {
  console.error('codelens-ai: ExtPay init failed', e);
}

chrome.runtime.onInstalled.addListener(() => console.log('CodeLens AI ready'));

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'analyze') {
    handleAnalysis(req).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (req.action === 'getSettings') {
    chrome.storage.sync.get(['apiKey', 'model', 'deepseekKey', 'githubToken'], data => sendResponse(data));
    return true;
  }
  if (req.action === 'saveSettings') {
    const updates = {};
    if (req.deepseekKey) { updates.deepseekKey = req.deepseekKey; DEEPSEEK_KEY = req.deepseekKey; }
    if (req.githubToken) { updates.githubToken = req.githubToken; GITHUB_TOKEN = req.githubToken; }
    if (req.apiKey) updates.apiKey = req.apiKey;
    if (req.model) updates.model = req.model;
    chrome.storage.sync.set(updates, () => sendResponse({ ok: true }));
    return true;
  }
});

async function handleAnalysis(req) {
  const { repo, type, filePath } = req;
  if (filePath && repo) {
    return await analyzeFile(repo, filePath, type);
  }
  if (repo) {
    return await analyzePR(repo);
  }
  return basicMetrics(req.code || '');
}

async function analyzePR(repo) {
  try {
    const prFiles = await githubAPI('/repos/' + repo + '/pulls?state=open&per_page=1');
    if (!prFiles.length) return { error: 'No open PRs found' };
    const pr = prFiles[0];
    const files = await githubAPI('/repos/' + repo + '/pulls/' + pr.number + '/files?per_page=10');
    if (!files.length) return { error: 'No changed files' };
    const analyses = [];
    for (const f of files.slice(0, 3)) {
      if (f.patch) {
        const aiResult = await aiAnalyze(f.filename, f.patch, 'review');
        analyses.push({ file: f.filename, changes: f.changes, additions: f.additions, deletions: f.deletions, analysis: aiResult });
      }
    }
    return { pr: { number: pr.number, title: pr.title, files: files.length }, files: analyses,
      summary: analyses.length > 1 ? await summarizePR(analyses.map(a => a.analysis).join('\n')) : '' };
  } catch (e) {
    return { error: 'GitHub API error: ' + e.message };
  }
}

async function analyzeFile(repo, filePath, type) {
  try {
    const content = await githubAPI('/repos/' + repo + '/contents/' + filePath);
    if (!content.content) return { error: 'File not found or binary' };
    const code = atob(content.content);
    const metrics = basicMetrics(code);
    const aiResult = await aiAnalyze(filePath, code, type || 'review');
    return { file: filePath, metrics, analysis: aiResult };
  } catch (e) {
    return { error: 'File analysis failed: ' + e.message };
  }
}

async function githubAPI(path) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) headers['Authorization'] = 'token ' + GITHUB_TOKEN;
  const resp = await fetch('https://api.github.com' + path, { headers });
  if (!resp.ok) throw new Error('GitHub ' + resp.status);
  return resp.json();
}

async function aiAnalyze(filename, code, mode) {
  const prompts = {
    review: 'Review this code from ' + filename + '. Identify bugs, security issues, performance problems, style improvements. Code:\n\n' + code.substring(0, 6000),
    explain: 'Explain this code from ' + filename + '. What does it do? What patterns? Code:\n\n' + code.substring(0, 6000),
    bugs: 'Find bugs in this code from ' + filename + '. List each with severity and fix. Code:\n\n' + code.substring(0, 6000)
  };
  const prompt = prompts[mode] || prompts.review;
  try {
    const resp = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1500 })
    });
    if (!resp.ok) throw new Error('AI API ' + resp.status);
    const data = await resp.json();
    return data.choices[0].message.content;
  } catch (e) {
    return 'AI analysis unavailable: ' + e.message;
  }
}

async function summarizePR(analyses) {
  try {
    const resp = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'Summarize code review findings in 3-5 bullets:\n\n' + analyses.substring(0, 4000) }], temperature: 0.3, max_tokens: 500 })
    });
    if (!resp.ok) return '';
    const data = await resp.json();
    return data.choices[0].message.content;
  } catch (e) { return ''; }
}

function basicMetrics(code) {
  const lines = code.split('\n').length;
  const chars = code.length;
  const functions = (code.match(/function\s+\w+|def\s+\w+|class\s+\w+|const\s+\w+\s*=\s*(\([^)]*\)\s*=>|async\s*\(|function\s*\()/g) || []).length;
  const comments = (code.match(/\/\/.*|\/\*[\s\S]*?\*\/|#.*/g) || []).length;
  const complexity = lines > 300 ? 'High' : lines > 100 ? 'Medium' : 'Low';
  return { lines, chars, functions, comments, complexity };
}
