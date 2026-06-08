// ==================== ExtPay Integration ====================
let extpay;
try {
  extpay = ExtPay('codelens-ai');
  
  extpay.getUser().then(user => {
    if (user && user.paid) {
      document.body.classList.add('pro-user');
      const badge = document.querySelector('.pro-badge');
      if (badge) badge.style.display = 'inline-block';
    } else {
      document.body.classList.add('free-user');
    }
  }).catch(e => console.error('ExtPay: getUser failed', e));
  
  window.openUpgrade = () => {
    try { extpay.openPaymentPage(); }
    catch(e) { console.error('ExtPay: payment failed', e); }
  };
  window.openLogin = () => {
    try { extpay.openLoginPage(); }
    catch(e) { console.error('ExtPay: login failed', e); }
  };
} catch(e) {
  console.error('codelens-ai: ExtPay init failed', e);
}

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
