// CodeLens AI - Content Script
// GitHub PR pages only — injects analysis UI, no DOM scraping for data
(function() {
  'use strict';

  // ==================== Page Detection ====================
  const pathMatch = window.location.pathname.match(/^\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (!pathMatch) return;

  const repoFullName = pathMatch[1];
  const prNumber = parseInt(pathMatch[2], 10);

  let analysisPanel = null;
  let isAnalyzing = false;

  // ==================== UI Injection ====================

  function createAnalysisPanel() {
    if (analysisPanel) return analysisPanel;

    // Find stable sidebar anchor
    const sidebar = document.getElementById('partial-discussion-sidebar');
    if (!sidebar) {
      console.warn('CodeLens: sidebar not found, retrying...');
      setTimeout(createAnalysisPanel, 1000);
      return null;
    }

    const container = document.createElement('div');
    container.id = 'codelens-panel';
    container.innerHTML = `
      <div class="codelens-header">
        <strong>CodeLens AI</strong>
        <span class="codelens-badge">BETA</span>
      </div>
      <div class="codelens-body">
        <button id="codelens-analyze-btn" class="btn btn-primary btn-block">
          Analyze this PR
        </button>
        <div id="codelens-result" style="display:none;"></div>
        <div id="codelens-limit-msg" style="display:none; color: #e36209; margin-top: 8px;"></div>
      </div>
      <div class="codelens-footer">
        <a href="#" id="codelens-settings-link">Settings</a>
        <span id="codelens-status"></span>
      </div>
    `;

    // Insert at the top of the sidebar
    sidebar.insertBefore(container, sidebar.firstChild);
    analysisPanel = container;

    // Attach listeners
    container.querySelector('#codelens-analyze-btn').addEventListener('click', startAnalysis);
    container.querySelector('#codelens-settings-link').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    return analysisPanel;
  }

  // ==================== Analysis Flow ====================

  async function startAnalysis() {
    if (isAnalyzing) return;
    isAnalyzing = true;

    const btn = document.getElementById('codelens-analyze-btn');
    const resultDiv = document.getElementById('codelens-result');
    const limitMsg = document.getElementById('codelens-limit-msg');
    const statusEl = document.getElementById('codelens-status');

    btn.disabled = true;
    btn.textContent = 'Analyzing...';
    resultDiv.style.display = 'none';
    limitMsg.style.display = 'none';
    statusEl.textContent = 'Fetching PR data...';

    try {
      const result = await chrome.runtime.sendMessage({
        type: "ANALYZE_PR",
        repoFullName,
        prNumber
      });

      if (result.error) {
        handleError(result.error, limitMsg);
      } else if (result.success) {
        displayAnalysis(result.analysis);
        statusEl.textContent = 'Analysis complete';
      }
    } catch (err) {
      limitMsg.textContent = 'Extension error. Check Settings for API key.';
      limitMsg.style.display = 'block';
      statusEl.textContent = '';
    }

    btn.disabled = false;
    btn.textContent = 'Analyze this PR';
    isAnalyzing = false;
  }

  function handleError(errorCode, msgEl) {
    const messages = {
      DAILY_LIMIT_REACHED:
        'Daily free limit reached (5/day). Upgrade to Pro for unlimited analyses.',
      NO_DEEPSEEK_KEY:
        'Set your DeepSeek API key in Settings.',
      NO_KIMI_KEY:
        'Set your Kimi API key in Settings.',
      GITHUB_API_ERROR:
        'Failed to fetch PR data from GitHub. The repo may be private or rate-limited.',
      API_ERROR:
        'AI analysis failed. Please try again.'
    };
    msgEl.textContent = messages[errorCode] || `Error: ${errorCode}`;
    msgEl.style.display = 'block';
    document.getElementById('codelens-status').textContent = '';
  }

  // ==================== Result Display ====================

  function displayAnalysis(analysisText) {
    const resultDiv = document.getElementById('codelens-result');
    if (!resultDiv) return;

    // Markdown → HTML
    let html = analysisText;
    // Code blocks
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`
    );
    // Headings
    html = html.replace(/^### (.*$)/gm, '<h5>$1</h5>');
    html = html.replace(/^## (.*$)/gm, '<h4>$1</h4>');
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // List items
    html = html.replace(/^- (.*)/gm, '<li>$1</li>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Paragraphs
    html = html.replace(/\n\n/g, '<br><br>');

    resultDiv.innerHTML = html;
    resultDiv.style.display = 'block';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== Init ====================

  function init() {
    createAnalysisPanel();

    // Auto-analyze if enabled
    chrome.storage.sync.get('settings').then(({ settings }) => {
      if (settings?.enableAutoAnalyze) {
        setTimeout(startAnalysis, 2000);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
