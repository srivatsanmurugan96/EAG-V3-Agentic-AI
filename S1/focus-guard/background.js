/**
 * background.js — Focus Guard Service Worker
 *
 * Logic:
 * - When Focus Mode is ON: only Allowed Sites are permitted, everything else is blocked
 * - When Focus Mode is OFF: all sites are allowed
 * - Temporary whitelist overrides blocking for X minutes
 */

// ─── Tab Monitoring ───
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    checkAndBlock(tabId, changeInfo.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      checkAndBlock(activeInfo.tabId, tab.url);
    }
  } catch (e) {}
});

async function checkAndBlock(tabId, url) {
  if (shouldIgnoreUrl(url)) return;

  const data = await chrome.storage.sync.get(['allowedUrls', 'focusMode']);
  const tempData = await chrome.storage.local.get(['tempWhitelist']);

  // If Focus Mode is OFF, allow everything
  if (data.focusMode === false) return;

  const allowedUrls = data.allowedUrls || [];
  const tempWhitelist = tempData.tempWhitelist || {};
  const domain = getDomain(url);

  // Check temporary whitelist first
  if (tempWhitelist[domain] && Date.now() < tempWhitelist[domain]) {
    return; // Temporarily allowed
  }

  // Check if URL starts with any allowed base URL
  const isAllowed = allowedUrls.some(baseUrl => url.startsWith(baseUrl));
  if (isAllowed) return;

  // BLOCKED → redirect
  const blockedPageUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(url);
  chrome.tabs.update(tabId, { url: blockedPageUrl });
  trackBlockedVisit(domain);
}

function shouldIgnoreUrl(url) {
  if (!url) return true;
  if (url.startsWith('chrome://')) return true;
  if (url.startsWith('chrome-extension://')) return true;
  if (url.startsWith('about:')) return true;
  if (url.startsWith('edge://')) return true;
  if (url.startsWith('brave://')) return true;
  return false;
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ─── Message Handling ───
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'tempAllow') {
    handleTempAllow(request.domain, request.minutes)
      .then(() => {
        sendResponse({ status: 'ok' });
      });
    return true; // keep channel open for async
  }

  if (request.action === 'getStatus') {
    getUrlStatus(request.url).then(status => sendResponse(status));
    return true;
  }

  if (request.action === 'getDailyStats') {
    getDailyStats().then(stats => sendResponse(stats));
    return true;
  }
});

/**
 * Save the domain to temp whitelist and schedule enforcement.
 */
async function handleTempAllow(domain, minutes) {
  const tempData = await chrome.storage.local.get(['tempWhitelist']);
  const tempWhitelist = tempData.tempWhitelist || {};

  const expiresAt = Date.now() + (minutes * 60 * 1000);
  tempWhitelist[domain] = expiresAt;
  await chrome.storage.local.set({ tempWhitelist });

  // Start the enforcement alarm that periodically checks for expired entries.
  // chrome.alarms minimum is ~0.5 min, so we use the smallest possible interval.
  // For short durations (<1 min), the enforcer catches it on the next tick.
  startEnforcer();
}

/**
 * Start a recurring alarm that checks for expired temp whitelist entries
 * and re-blocks any open tabs on those domains.
 * Uses a 0.1-minute delay (Chrome will round up to ~30s minimum, which is fine).
 */
function startEnforcer() {
  chrome.alarms.create('enforcer', { delayInMinutes: 0.1, periodInMinutes: 0.1 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'enforcer') {
    await enforceExpiredWhitelist();
  }
});

/**
 * Check all temp whitelist entries. If any have expired:
 * 1. Remove them from storage
 * 2. Find any open tabs on those domains and redirect to blocked page
 * 3. If no more temp entries remain, stop the enforcer alarm
 */
async function enforceExpiredWhitelist() {
  const tempData = await chrome.storage.local.get(['tempWhitelist']);
  const tempWhitelist = tempData.tempWhitelist || {};

  const now = Date.now();
  const expiredDomains = [];
  let hasActiveEntries = false;

  for (const domain in tempWhitelist) {
    if (now >= tempWhitelist[domain]) {
      expiredDomains.push(domain);
      delete tempWhitelist[domain];
    } else {
      hasActiveEntries = true;
    }
  }

  // Save cleaned whitelist
  if (expiredDomains.length > 0) {
    await chrome.storage.local.set({ tempWhitelist });
  }

  // If no active temp entries left, stop the enforcer to save resources
  if (!hasActiveEntries) {
    chrome.alarms.clear('enforcer');
  }

  // Re-block any open tabs that are on expired domains
  if (expiredDomains.length > 0) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url || shouldIgnoreUrl(tab.url)) continue;
      const tabDomain = getDomain(tab.url);
      if (expiredDomains.includes(tabDomain)) {
        // Re-check: is this URL allowed by the main list?
        const data = await chrome.storage.sync.get(['allowedUrls', 'focusMode']);
        if (data.focusMode === false) continue;
        const isAllowed = (data.allowedUrls || []).some(baseUrl => tab.url.startsWith(baseUrl));
        if (!isAllowed) {
          const blockedPageUrl = chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(tab.url);
          chrome.tabs.update(tab.id, { url: blockedPageUrl });
          trackBlockedVisit(tabDomain);
        }
      }
    }
  }
}

async function getUrlStatus(url) {
  if (shouldIgnoreUrl(url)) return { status: 'ignored' };

  const data = await chrome.storage.sync.get(['allowedUrls', 'focusMode']);
  const tempData = await chrome.storage.local.get(['tempWhitelist']);

  if (data.focusMode === false) return { status: 'focus_off' };

  const allowedUrls = data.allowedUrls || [];
  const tempWhitelist = tempData.tempWhitelist || {};
  const domain = getDomain(url);

  if (tempWhitelist[domain] && Date.now() < tempWhitelist[domain]) {
    const remainingMin = Math.ceil((tempWhitelist[domain] - Date.now()) / 60000);
    return { status: 'temp_allowed', remainingMin };
  }

  const isAllowed = allowedUrls.some(baseUrl => url.startsWith(baseUrl));
  if (isAllowed) return { status: 'allowed' };

  return { status: 'blocked' };
}

// ─── Daily Stats ───
async function trackBlockedVisit(domain) {
  const today = new Date().toISOString().split('T')[0];
  const statsData = await chrome.storage.local.get(['dailyStats']);
  const stats = statsData.dailyStats || {};
  if (!stats[today]) stats[today] = {};
  if (!stats[today][domain]) stats[today][domain] = 0;
  stats[today][domain]++;
  await chrome.storage.local.set({ dailyStats: stats });
}

async function getDailyStats() {
  const today = new Date().toISOString().split('T')[0];
  const statsData = await chrome.storage.local.get(['dailyStats']);
  return (statsData.dailyStats || {})[today] || {};
}

// ─── Initialize ───
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['allowedUrls', 'focusMode'], (data) => {
    if (!data.allowedUrls) chrome.storage.sync.set({ allowedUrls: [] });
    if (data.focusMode === undefined) chrome.storage.sync.set({ focusMode: true });
  });
});
