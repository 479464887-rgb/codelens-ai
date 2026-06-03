// CodeLens AI - Background Service Worker
// GitHub API + AI analysis + state management

const GITHUB_API = 'https://api.github.com';
const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
const KIMI_API = 'https://api.moonshot.cn/v1/chat/completions';

const DEFAULTS = {
  apiProvider: 'deepseek',
  deepseekKey: '',
  kimiKey: '',
  githubToken: '',
  maxAnalysesPerDay: 5,
  analysisLanguage: 'auto',
  enableAutoAnalyze: true
};

// ==================== Init ====================

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.sync.get('settings');
  if (!settings) {
    await chrome.storage.sync.set({ settings: DEFAULTS });
  }
  const now = new Date();
  await chrome.storage.local.set({
    dailyCount: 0,
    dailyCountDate: now.toDateString()
  });
});

// Daily reset alarm
chrome.alarms.create('resetDaily', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'resetDaily') {
    const now = new Date().toDateString();
    const { dailyCountDate } = await chrome.storage.local.get('dailyCountDate');
    if (dailyCountDate !== now) {
      await chrome.storage.local.set({ dailyCount: 0, dailyCountDate: now });
    }
  }
});

// ==================== Message Routing ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'ANALYZE_PR':
      handlePRAnalysis(request).then(sendResponse).catch(e => sendResponse({ error: e.message }));
      return true;

    case 'CHECK_LIMIT':
      checkDailyLimit().then(sendResponse);
      return true;

    case 'GET_SETTINGS':
      chrome.storage.sync.get('settings').then(sendResponse);
      return true;

    case 'SAVE_SETTINGS':
      chrome.storage.sync.set({ settings: request.settings }).then(() =>
        sendResponse({ success: true })
      );
      return true;

    case 'GET_ANALYSIS_HISTORY':
      chrome.storage.local.get('history').then(sendResponse);
      return true;
  }
});

// ==================== Daily Limit ====================

async function checkDailyLimit() {
  const { isPro } = await chrome.storage.local.get('isPro');
  if (isPro) return { allowed: true, remaining: Infinity };

  const { dailyCount, dailyCountDate } = await chrome.storage.local.get(['dailyCount', 'dailyCountDate']);
  const today = new Date().toDateString();
  const count = dailyCountDate === today ? (dailyCount || 0) : 0;
  const settings = (await chrome.storage.sync.get('settings')).settings || DEFAULTS;
  const limit = settings.maxAnalysesPerDay || 5;

  if (count >= limit) {
    throw new Error('DAILY_LIMIT_REACHED');
  }
  return { allowed: true, remaining: limit - count };
}

// ==================== GitHub API ====================

async function fetchPRData(repoFullName, prNumber, githubToken) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'CodeLens-AI-Extension'
  };
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }

  // Fetch PR metadata
  const prUrl = `${GITHUB_API}/repos/${repoFullName}/pulls/${prNumber}`;
  const prResp = await fetch(prUrl, { headers });
  if (!prResp.ok) {
    if (prResp.status === 404) throw new Error('GITHUB_API_ERROR: PR not found');
    if (prResp.status === 403) throw new Error('GITHUB_API_ERROR: Rate limited (try adding GitHub token in Settings)');
    throw new Error(`GITHUB_API_ERROR: ${prResp.status}`);
  }
  const prData = await prResp.json();

  // Fetch changed files (max 300)
  const filesUrl = `${GITHUB_API}/repos/${repoFullName}/pulls/${prNumber}/files?per_page=300`;
  const filesResp = await fetch(filesUrl, { headers });
  if (!filesResp.ok) throw new Error(`GITHUB_API_ERROR: ${filesResp.status}`);
  const filesData = await filesResp.json();

  // Build files list
  const files = filesData.map(f => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions || 0,
    deletions: f.deletions || 0,
    changes: f.changes || 0
  }));

  // Build diffs (truncated per file)
  const diffs = filesData.map(f => ({
    filename: f.filename,
    status: f.status,
    // Truncate patch to fit token budget
    diff: (f.patch || '(binary or empty file)').substring(0, 4000)
  }));

  return {
    title: prData.title || '',
    description: prData.body || '',
    repoFullName,
    prNumber,
    baseBranch: prData.base?.ref || '',
    headBranch: prData.head?.ref || '',
    files,
    diffs
  };
}

// ==================== AI Analysis ====================

function buildAnalysisPrompt(prData, language) {
  const { title, description, files, diffs, repoFullName, prNumber } = prData;
  const langInstruction = language === 'zh'
    ? '请使用中文输出分析结果。'
    : language === 'en'
    ? 'Please output analysis in English.'
    : 'Use the same language as the PR description.';

  const fileSummary = files.length > 0
    ? files.map(f => `- \`${f.filename}\` (${f.status}, +${f.additions}/-${f.deletions})`).join('\n')
    : '(no files listed)';

  const diffContent = diffs.slice(0, 10).map(d => {
    const header = `### File: \`${d.filename}\` (${d.status})`;
    return `${header}\n\`\`\`diff\n${d.diff}\n\`\`\``;
  }).join('\n\n');

  return `You are an expert code reviewer. Analyze this Pull Request and provide a detailed code review.

**PR Info**
- Repository: ${repoFullName}
- PR #${prNumber}: ${title}
- Description: ${description || '(no description provided)'}

**Changed Files (${files.length} total)**
${fileSummary}

**Code Changes**
${diffContent || '(no diff content available)'}

${langInstruction}

Provide your review in this exact format:

## Summary
(A concise 1-3 sentence overview of what this PR does and its overall quality)

## Code Quality
- (Specific observations about code style, readability, naming, structure)

## Security
- (Any security concerns: injection, auth, data exposure, etc.)

## Best Practices
- (Suggestions for following language/framework/industry conventions)

## Performance
- (Any performance implications or bottlenecks)

## Rating
(Choose one: 👍 Looks Good | ⚠️ Minor Issues | 🔴 Needs Changes)

Keep each section focused. Be specific with code examples when relevant.`;
}

async function callAI(prompt, settings) {
  const provider = settings.apiProvider || 'deepseek';

  if (provider === 'deepseek') {
    if (!settings.deepseekKey) throw new Error('NO_DEEPSEEK_KEY');
    const resp = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.deepseekKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 4096
      })
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API_ERROR: ${resp.status} ${err.substring(0, 200)}`);
    }
    const data = await resp.json();
    return data.choices[0].message.content;
  }

  if (provider === 'kimi') {
    if (!settings.kimiKey) throw new Error('NO_KIMI_KEY');
    const resp = await fetch(KIMI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.kimiKey}`
      },
      body: JSON.stringify({
        model: 'kimi-k2.6',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API_ERROR: ${resp.status} ${err.substring(0, 200)}`);
    }
    const data = await resp.json();
    return data.choices[0].message.content;
  }

  throw new Error('UNKNOWN_PROVIDER');
}

// ==================== Analysis Pipeline ====================

async function handlePRAnalysis({ repoFullName, prNumber }) {
  // 1. Check limit
  const { isPro } = await chrome.storage.local.get('isPro');
  if (!isPro) {
    const { dailyCount, dailyCountDate } = await chrome.storage.local.get(['dailyCount', 'dailyCountDate']);
    const settings = (await chrome.storage.sync.get('settings')).settings || DEFAULTS;
    const today = new Date().toDateString();
    const count = dailyCountDate === today ? (dailyCount || 0) : 0;
    if (count >= (settings.maxAnalysesPerDay || 5)) {
      throw new Error('DAILY_LIMIT_REACHED');
    }
  }

  const settings = (await chrome.storage.sync.get('settings')).settings || DEFAULTS;

  // 2. Fetch PR data from GitHub
  const prData = await fetchPRData(repoFullName, prNumber, settings.githubToken);

  // 3. Build prompt
  const prompt = buildAnalysisPrompt(prData, settings.analysisLanguage);

  // 4. Call AI
  const analysis = await callAI(prompt, settings);

  // 5. Update count
  if (!isPro) {
    const { dailyCount, dailyCountDate } = await chrome.storage.local.get(['dailyCount', 'dailyCountDate']);
    const today = new Date().toDateString();
    const newCount = dailyCountDate === today ? (dailyCount || 0) + 1 : 1;
    await chrome.storage.local.set({ dailyCount: newCount, dailyCountDate: today });
  }

  // 6. Save history
  await saveToHistory(prData, analysis);

  return { success: true, analysis };
}

async function saveToHistory(prData, analysis) {
  const { history } = await chrome.storage.local.get('history');
  const entry = {
    id: Date.now().toString(),
    repo: prData.repoFullName,
    prNumber: prData.prNumber,
    prTitle: prData.title,
    timestamp: new Date().toISOString(),
    analysis: analysis.substring(0, 500)
  };
  const updated = [entry, ...(history || [])].slice(0, 50);
  await chrome.storage.local.set({ history: updated });
}

// ==================== ExtensionPay Placeholder ====================

async function verifyProStatus() {
  // TODO: Replace with real ExtensionPay integration
  // const ep = new ExtensionPay('YOUR_PRODUCT_ID');
  // const status = await ep.getStatus();
  // await chrome.storage.local.set({ isPro: status.active });
  return false;
}
