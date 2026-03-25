// PixelPin Popup — name selection, inspect toggle, severity filter, developer-friendly pin list

const TYPE_COLORS = {
  Spacing: '#4A90D9',
  Typography: '#9B59B6',
  Color: '#E74C3C',
  Size: '#F39C12',
  Alignment: '#2ECC71',
  General: '#95A5A6',
};

const SEVERITY_COLORS = {
  Critical: '#E74C3C',
  Improvement: '#F39C12',
  'Nice-to-have': '#95A5A6',
};

const TEAM_MEMBERS = ['Hauwa', 'Jaf', 'Nico', 'Dan'];

// Screens
const nameScreen = document.getElementById('nameScreen');
const mainScreen = document.getElementById('mainScreen');
const nameButtons = document.getElementById('nameButtons');

// Main screen elements
const inspectBtn = document.getElementById('inspectBtn');
const inspectLabel = document.getElementById('inspectLabel');
const userName = document.getElementById('userName');
const totalCount = document.getElementById('totalCount');
const criticalCount = document.getElementById('criticalCount');
const pendingCount = document.getElementById('pendingCount');
const filterBar = document.getElementById('filterBar');
const pinList = document.getElementById('pinList');
const emptyState = document.getElementById('emptyState');
const clearBtn = document.getElementById('clearBtn');
const switchUserBtn = document.getElementById('switchUserBtn');

let isInspecting = false;
let currentTabUrl = '';
let currentUser = '';
let currentFilter = 'all';
let cachedPins = [];

// ── Name Selection ──

function buildNameScreen() {
  nameButtons.innerHTML = '';
  TEAM_MEMBERS.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'name-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => selectUser(name));
    nameButtons.appendChild(btn);
  });
}

async function selectUser(name) {
  currentUser = name;
  await chrome.storage.local.set({ pixelpin_user: name });
  showMainScreen();
}

function showMainScreen() {
  nameScreen.style.display = 'none';
  mainScreen.style.display = '';
  userName.textContent = currentUser;
  switchUserBtn.textContent = currentUser;
  init();
}

// ── Init ──

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab?.url || '';

  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  isInspecting = state?.inspecting || false;
  updateInspectButton();

  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_PINS' }).catch(() => {});
  }

  await loadPins();
}

window.addEventListener('unload', () => {
  if (!isInspecting) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'HIDE_PINS' }).catch(() => {});
      }
    });
  }
});

// ── Inspect Toggle ──

inspectBtn.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({
    type: 'TOGGLE_INSPECT',
    payload: { active: !isInspecting },
  });

  if (response?.success === false && response.error) {
    inspectLabel.textContent = response.error;
    setTimeout(() => {
      inspectLabel.textContent = 'Start Inspecting';
    }, 2000);
    return;
  }

  isInspecting = !isInspecting;
  updateInspectButton();
});

function updateInspectButton() {
  if (isInspecting) {
    inspectBtn.classList.add('active');
    inspectLabel.textContent = 'Stop Inspecting';
  } else {
    inspectBtn.classList.remove('active');
    inspectLabel.textContent = 'Start Inspecting';
  }
}

// ── Severity Filter ──

filterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  currentFilter = btn.dataset.filter;
  applyFilter();
});

function applyFilter() {
  let filtered = cachedPins;
  if (currentFilter !== 'all') {
    filtered = cachedPins.filter(p => p.severity === currentFilter);
  }
  renderPinList(filtered);
}

// ── Pin List (filtered by current user + severity) ──

async function loadPins() {
  if (!currentTabUrl) return;

  const response = await chrome.runtime.sendMessage({
    type: 'GET_PINS',
    payload: { url: currentTabUrl },
  });

  if (!response?.success) return;

  const allPins = response.pins;
  cachedPins = allPins.filter(p => p.assignee === currentUser);
  updateStats(cachedPins);
  applyFilter();
}

function renderPinList(pins) {
  pinList.querySelectorAll('.pin-item').forEach(el => el.remove());

  if (!pins.length) {
    emptyState.style.display = '';
    clearBtn.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  clearBtn.style.display = '';

  pins.forEach(pin => {
    const item = document.createElement('div');
    item.className = 'pin-item';

    // Severity dot
    const sevDot = document.createElement('div');
    sevDot.className = 'pin-severity-dot';
    sevDot.style.background = SEVERITY_COLORS[pin.severity] || '#ccc';
    sevDot.title = pin.severity || '';

    const number = document.createElement('div');
    number.className = 'pin-number';
    number.style.background = TYPE_COLORS[pin.feedbackType] || '#95A5A6';
    number.textContent = pin.number;

    const info = document.createElement('div');
    info.className = 'pin-info';

    const typeRow = document.createElement('div');
    typeRow.className = 'pin-type-row';

    const type = document.createElement('span');
    type.className = 'pin-type';
    type.textContent = pin.feedbackType;

    // Severity badge inline
    if (pin.severity) {
      const sevBadge = document.createElement('span');
      sevBadge.className = 'pin-severity-badge';
      sevBadge.textContent = pin.severity;
      sevBadge.style.background = SEVERITY_COLORS[pin.severity] || '#95A5A6';
      typeRow.append(type, sevBadge);
    } else {
      typeRow.appendChild(type);
    }

    const badge = document.createElement('span');
    badge.className = 'pin-status-badge ' +
      (pin.status === 'Resolved' ? 'badge-resolved' : 'badge-pending');
    badge.textContent = pin.status;
    typeRow.appendChild(badge);

    info.appendChild(typeRow);

    // Current → Expected diff inline
    if (pin.fix && pin.fix.currentValue && pin.fix.expectedValue) {
      const diff = document.createElement('div');
      diff.className = 'pin-diff';

      const current = document.createElement('span');
      current.className = 'pin-diff-current';
      current.textContent = pin.fix.currentValue;

      const arrow = document.createTextNode(' \u2192 ');

      const expected = document.createElement('span');
      expected.className = 'pin-diff-expected';
      expected.textContent = pin.fix.expectedValue;

      diff.append(current, arrow, expected);
      info.appendChild(diff);
    }

    // Note
    if (pin.note) {
      const note = document.createElement('div');
      note.className = 'pin-note';
      note.textContent = pin.note;
      info.appendChild(note);
    }

    // Copyable fix snippet
    if (pin.fix && pin.fix.cssFix) {
      const snippet = document.createElement('div');
      snippet.className = 'pin-fix-snippet';
      snippet.title = 'Click to copy';

      const code = document.createElement('span');
      code.textContent = pin.fix.cssFix;

      const copyIcon = document.createElement('span');
      copyIcon.className = 'pin-fix-copy-icon';
      copyIcon.textContent = '\u2398';

      snippet.append(code, copyIcon);
      snippet.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(pin.fix.cssFix).then(() => {
          copyIcon.textContent = '\u2713';
          setTimeout(() => { copyIcon.textContent = '\u2398'; }, 1200);
        });
      });

      info.appendChild(snippet);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'pin-delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Delete pin';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({
        type: 'DELETE_PIN',
        payload: { url: currentTabUrl, id: pin.id },
      });
      await loadPins();
    });

    item.append(sevDot, number, info, deleteBtn);
    pinList.appendChild(item);
  });
}

function updateStats(pins) {
  const total = pins.length;
  const pending = pins.filter(p => p.status === 'Pending').length;
  const critical = pins.filter(p => p.severity === 'Critical').length;
  totalCount.textContent = `${total} pin${total !== 1 ? 's' : ''}`;
  criticalCount.textContent = `${critical} critical`;
  pendingCount.textContent = `${pending} pending`;
}

// ── Clear All ──

clearBtn.addEventListener('click', async () => {
  if (!currentTabUrl) return;
  await chrome.runtime.sendMessage({
    type: 'CLEAR_PINS',
    payload: { url: currentTabUrl },
  });
  await loadPins();
});

// ── Switch User ──

switchUserBtn.addEventListener('click', () => {
  mainScreen.style.display = 'none';
  nameScreen.style.display = '';
});

// ── Listen for inspect stop ──

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'INSPECT_STOPPED') {
    isInspecting = false;
    updateInspectButton();
  }
});

// ── Startup: check for saved user ──

(async () => {
  buildNameScreen();
  const result = await chrome.storage.local.get('pixelpin_user');
  if (result.pixelpin_user) {
    currentUser = result.pixelpin_user;
    showMainScreen();
  }
})();
