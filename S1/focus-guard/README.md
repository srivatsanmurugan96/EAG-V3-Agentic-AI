# 🛡️ Focus Guard — Chrome Extension

> Stay focused. Block distractions. Work smarter.

Focus Guard is a Chrome extension designed to help you stay on task while studying or working. It blocks distracting websites, lets you manage your allowed sites, and gives you the flexibility to temporarily unblock a site during breaks — all without breaking your workflow.

---

## ✨ Features

- **Focus Mode Toggle** — Turn blocking on or off with a single click from the popup.
- **Allowed Sites Management** — Add any URLs you want to whitelist. Everything else gets blocked when Focus Mode is active.
- **Smart Blocking** — Automatically redirects you to a friendly blocked page whenever you visit a site that isn't on your allowed list.
- **Temporary Access** — From the blocked page, unblock a site for a set duration (5 min, 15 min, 30 min, 1 hour, or a custom time you choose). Access is automatically revoked when the timer expires.
- **Daily Block Stats** — See how many times each site was blocked today, so you can track your focus habits over time.
- **Live Tab Status** — The popup shows whether the current tab is allowed, blocked, or temporarily allowed (with time remaining).

---

## 📁 File Structure

```
focus-guard/
├── manifest.json      # Extension manifest (MV3)
├── background.js      # Service worker — blocking logic, alarms, stats
├── popup.html         # Popup UI layout
├── popup.css          # Popup styles
├── popup.js           # Popup interactions and state management
├── blocked.html       # Page shown when a site is blocked
└── blocked.js         # Blocked page logic (temp allow, redirect)
```

---

## 🚀 Installation

Since this extension is not published on the Chrome Web Store, you can load it manually as an unpacked extension.

1. Download or clone this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the folder containing the extension files.
5. The 🛡️ Focus Guard icon will appear in your Chrome toolbar.

---

## 🔧 How It Works

### Blocking Logic

When Focus Mode is **ON**, every URL you navigate to is checked against your allowed list. If the URL is not on the list (and not temporarily whitelisted), you are redirected to the blocked page.

When Focus Mode is **OFF**, all sites are permitted regardless of the allowed list.

### Temporary Whitelist

On the blocked page, you can choose to allow the site for a short time. The extension stores the expiry timestamp and uses a Chrome alarm to enforce re-blocking once the timer runs out — even if you already have the tab open.

### Stats Tracking

Every time a site is blocked, the domain and count are saved to local storage under today's date. You can view this in the popup and clear it whenever you want.

---

## 🖥️ Usage

1. Click the 🛡️ Focus Guard icon in your toolbar to open the popup.
2. Use the **ON/OFF toggle** to enable or disable Focus Mode.
3. In the **Allowed Sites** section, type a URL (e.g., `https://leetcode.com`) and click **+ Add**.
4. To remove a site, click the **✕** button next to it.
5. Visit any non-allowed site — you'll be redirected to the blocked page.
6. On the blocked page, click **Allow Temporarily** to choose how long to unblock that site.
7. Check **Today's Blocks** in the popup to review your distraction attempts.

---

## 🔐 Permissions

| Permission | Reason |
|---|---|
| `tabs` | Monitor tab navigation to detect and block URLs |
| `storage` | Save allowed sites, focus mode state, and stats |
| `activeTab` | Read the current tab's URL for status display |
| `scripting` | Reserved for potential future content script use |
| `webNavigation` | Detect page navigations reliably |
| `alarms` | Schedule re-blocking when temporary access expires |
| `host_permissions: <all_urls>` | Required to intercept and redirect any website |

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension API
- **Vanilla JavaScript** (no frameworks)
- **Chrome Storage API** (`sync` for settings, `local` for stats and temp whitelist)
- **Chrome Alarms API** for timed whitelist enforcement
- **Inter** font via Google Fonts

---

## 📌 Notes

- Allowed URLs are matched as prefixes. Adding `https://github.com` will permit all pages under that domain.
- Internal Chrome pages (`chrome://`, `chrome-extension://`, `about:`) are never blocked.
- Sync storage is used for allowed sites and focus mode so your settings carry across devices if you're signed into Chrome.
- The minimum alarm interval in Chrome is approximately 30 seconds, so temporary access for very short durations (under 30s) will be enforced on the next alarm tick.

---

## 📄 License

This project is open for personal use. Feel free to modify it to suit your workflow.
