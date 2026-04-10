/**
 * popup.js — Focus Guard Popup Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  const focusToggle = document.getElementById('focus-toggle');
  const focusLabel = document.getElementById('focus-label');
  const currentStatus = document.getElementById('current-status');
  const urlInput = document.getElementById('url-input');
  const addBtn = document.getElementById('add-btn');
  const urlList = document.getElementById('url-list');
  const emptyMsg = document.getElementById('empty-msg');
  const statsContainer = document.getElementById('stats-container');

  // ─── Focus Mode Toggle ───
  chrome.storage.sync.get(['focusMode'], (data) => {
    const isOn = data.focusMode !== false;
    focusToggle.checked = isOn;
    focusLabel.textContent = isOn ? 'ON' : 'OFF';
  });

  focusToggle.addEventListener('change', () => {
    const isOn = focusToggle.checked;
    focusLabel.textContent = isOn ? 'ON' : 'OFF';
    chrome.storage.sync.set({ focusMode: isOn });
    updateCurrentStatus();
  });

  // ─── Add Allowed URL ───
  addBtn.addEventListener('click', addAllowedUrl);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addAllowedUrl();
  });

  function addAllowedUrl() {
    let url = urlInput.value.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    url = url.replace(/\/+$/, '');

    chrome.storage.sync.get(['allowedUrls'], (data) => {
      const urls = data.allowedUrls || [];
      if (urls.includes(url)) {
        urlInput.value = '';
        urlInput.placeholder = 'Already in list!';
        setTimeout(() => { urlInput.placeholder = 'e.g., https://leetcode.com'; }, 1500);
        return;
      }
      urls.push(url);
      chrome.storage.sync.set({ allowedUrls: urls }, () => {
        urlInput.value = '';
        renderAllowedList(urls);
        updateCurrentStatus();
      });
    });
  }

  function removeAllowedUrl(urlToRemove) {
    chrome.storage.sync.get(['allowedUrls'], (data) => {
      const urls = (data.allowedUrls || []).filter(u => u !== urlToRemove);
      chrome.storage.sync.set({ allowedUrls: urls }, () => {
        renderAllowedList(urls);
        updateCurrentStatus();
      });
    });
  }

  function renderAllowedList(urls) {
    urlList.innerHTML = '';
    if (urls.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';
    urls.forEach(url => {
      const li = document.createElement('li');
      li.className = 'url-item';
      li.innerHTML = `
        <span class="url-text" title="${url}">${url}</span>
        <button class="remove-btn" title="Remove">✕</button>
      `;
      li.querySelector('.remove-btn').addEventListener('click', () => removeAllowedUrl(url));
      urlList.appendChild(li);
    });
  }

  // ─── Current Tab Status ───
  function updateCurrentStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].url) {
        currentStatus.textContent = 'No active page';
        currentStatus.className = 'status-bar';
        return;
      }
      const url = tabs[0].url;
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        currentStatus.textContent = '🔒 Internal page — Ignored';
        currentStatus.className = 'status-bar';
        return;
      }
      chrome.runtime.sendMessage({ action: 'getStatus', url }, (response) => {
        if (!response) return;
        switch (response.status) {
          case 'allowed':
            currentStatus.textContent = '✅ Current site is ALLOWED';
            currentStatus.className = 'status-bar allowed';
            break;
          case 'blocked':
            currentStatus.textContent = '🚫 Current site is BLOCKED';
            currentStatus.className = 'status-bar blocked';
            break;
          case 'temp_allowed':
            currentStatus.textContent = `⏱️ Temporarily allowed (${response.remainingMin} min left)`;
            currentStatus.className = 'status-bar temp';
            break;
          case 'focus_off':
            currentStatus.textContent = '😴 Focus Mode is OFF';
            currentStatus.className = 'status-bar off';
            break;
          default:
            currentStatus.textContent = 'Status unknown';
            currentStatus.className = 'status-bar';
        }
      });
    });
  }

  // ─── Daily Stats ───
  function loadStats() {
    chrome.runtime.sendMessage({ action: 'getDailyStats' }, (stats) => {
      statsContainer.innerHTML = '';
      if (!stats || Object.keys(stats).length === 0) {
        statsContainer.innerHTML = '<div class="empty-state">No blocked visits today. Stay focused! 💪</div>';
        return;
      }
      const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
      sorted.forEach(([domain, count]) => {
        const item = document.createElement('div');
        item.className = 'stat-item';
        item.innerHTML = `
          <span class="stat-domain">${domain}</span>
          <span class="stat-count">${count} block${count > 1 ? 's' : ''}</span>
        `;
        statsContainer.appendChild(item);
      });
    });
  }

  // ─── Initialize ───
  chrome.storage.sync.get(['allowedUrls'], (data) => {
    renderAllowedList(data.allowedUrls || []);
  });
  updateCurrentStatus();
  loadStats();
});
