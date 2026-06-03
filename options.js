// CodeLens AI - Options/Settings

const DEFAULTS = {
  apiProvider: 'deepseek',
  deepseekKey: '',
  kimiKey: '',
  githubToken: '',
  analysisLanguage: 'auto',
  enableAutoAnalyze: true,
  maxAnalysesPerDay: 5
};

document.addEventListener('DOMContentLoaded', async () => {
  const { settings } = await chrome.storage.sync.get('settings');
  const s = settings || DEFAULTS;

  document.getElementById('api-provider').value = s.apiProvider || 'deepseek';
  document.getElementById('deepseek-key').value = s.deepseekKey || '';
  document.getElementById('kimi-key').value = s.kimiKey || '';
  document.getElementById('github-token').value = s.githubToken || '';
  document.getElementById('analysis-language').value = s.analysisLanguage || 'auto';
  document.getElementById('auto-analyze').checked = s.enableAutoAnalyze !== false;

  toggleProviderFields(s.apiProvider);
  document.getElementById('api-provider').addEventListener('change', (e) => {
    toggleProviderFields(e.target.value);
  });

  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('clear-history').addEventListener('click', async () => {
    if (confirm('Clear all analysis history?')) {
      await chrome.storage.local.set({ history: [] });
      showStatus('History cleared', false);
    }
  });

  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveSettings();
    });
  });
});

function toggleProviderFields(provider) {
  document.getElementById('deepseek-field').style.display =
    provider === 'deepseek' ? 'block' : 'none';
  document.getElementById('kimi-field').style.display =
    provider === 'kimi' ? 'block' : 'none';
}

async function saveSettings() {
  const btn = document.getElementById('save-settings');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const settings = {
    apiProvider: document.getElementById('api-provider').value,
    deepseekKey: document.getElementById('deepseek-key').value.trim(),
    kimiKey: document.getElementById('kimi-key').value.trim(),
    githubToken: document.getElementById('github-token').value.trim(),
    analysisLanguage: document.getElementById('analysis-language').value,
    enableAutoAnalyze: document.getElementById('auto-analyze').checked,
    maxAnalysesPerDay: 5
  };

  await chrome.storage.sync.set({ settings });
  btn.disabled = false;
  btn.textContent = 'Save Settings';
  showStatus('Settings saved!', false);
}

function showStatus(msg, isError) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = isError ? 'error' : '';
  el.style.display = 'inline';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}
