// CodeLens AI - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // Load usage stats
  const { dailyCount, dailyCountDate, history, isPro } = await chrome.storage.local.get([
    "dailyCount", "dailyCountDate", "history", "isPro"
  ]);

  const today = new Date().toDateString();
  const count = dailyCountDate === today ? (dailyCount || 0) : 0;
  document.getElementById('usage-count').textContent = `${count} / 5`;

  const total = (history || []).length;
  document.getElementById('total-count').textContent = total;

  if (isPro) {
    document.getElementById('pro-badge').style.display = 'inline';
    document.getElementById('usage-count').textContent = 'Unlimited';
  }

  // Open current PR
  document.getElementById('open-github').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('github.com')) {
      chrome.tabs.sendMessage(tab.id, { type: "OPEN_CODELENS" });
    } else {
      chrome.tabs.create({ url: 'https://github.com/pulls' });
    }
  });

  // Open settings
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Upgrade link
  document.getElementById('upgrade-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://codelens-ai.app/pricing' }); // Will replace with real URL
  });
});
