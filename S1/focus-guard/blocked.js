const params = new URLSearchParams(window.location.search);
const blockedUrl = params.get('url') || '';

document.getElementById('blocked-url').textContent = blockedUrl || 'Unknown URL';

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Send temp allow request to background and redirect on success
 */
function allowAndRedirect(minutes) {
  const domain = getDomain(blockedUrl);
  const statusMsg = document.getElementById('status-msg');

  statusMsg.textContent = `Allowing ${domain} for ${formatTime(minutes)}...`;
  statusMsg.className = 'status-msg success';

  chrome.runtime.sendMessage({
    action: 'tempAllow',
    domain: domain,
    minutes: minutes
  }, (response) => {
    if (response && response.status === 'ok') {
      statusMsg.textContent = '✅ Allowed! Redirecting...';
      setTimeout(() => {
        window.location.replace(blockedUrl);
      }, 500);
    } else {
      statusMsg.textContent = '❌ Something went wrong. Try again.';
      statusMsg.className = 'status-msg error';
    }
  });
}

/**
 * Format minutes into a human-readable string
 */
function formatTime(minutes) {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)} seconds`;
  } else if (minutes >= 60) {
    const hrs = Math.round(minutes / 60 * 10) / 10;
    return `${hrs} hour${hrs !== 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
}

// Go Back
document.getElementById('go-back').addEventListener('click', () => {
  if (history.length > 2) {
    history.back();
  } else {
    window.location.href = 'chrome://newtab';
  }
});

// Toggle timer options
document.getElementById('temp-btn').addEventListener('click', () => {
  document.getElementById('timer-section').classList.toggle('visible');
});

// Preset timer buttons (5 min, 15 min, 30 min, 1 hour)
document.querySelectorAll('.timer-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const minutes = parseInt(btn.getAttribute('data-minutes'));

    // Visual feedback
    document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active-choice'));
    btn.classList.add('active-choice');

    allowAndRedirect(minutes);
  });
});

// Custom time — "Allow" button
document.getElementById('custom-go-btn').addEventListener('click', () => {
  const value = parseFloat(document.getElementById('custom-time').value);
  const unit = document.getElementById('custom-unit').value;
  const statusMsg = document.getElementById('status-msg');

  if (!value || value <= 0) {
    statusMsg.textContent = '⚠️ Please enter a valid number.';
    statusMsg.className = 'status-msg error';
    return;
  }

  // Convert to minutes (chrome.alarms needs minutes)
  let minutes;
  switch (unit) {
    case 'seconds':
      minutes = value / 60;
      break;
    case 'hours':
      minutes = value * 60;
      break;
    default: // minutes
      minutes = value;
  }

  // Clear preset highlights
  document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active-choice'));

  allowAndRedirect(minutes);
});
