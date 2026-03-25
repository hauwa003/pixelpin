// PixelPin Popup — inspect toggle, pin list, stats

const TYPE_COLORS = {
  Spacing: '#4A90D9',
  Typography: '#9B59B6',
  Color: '#E74C3C',
  Size: '#F39C12',
  Alignment: '#2ECC71',
  General: '#95A5A6',
};

const inspectBtn = document.getElementById('inspectBtn');
const inspectLabel = document.getElementById('inspectLabel');
const totalCount = document.getElementById('totalCount');
const pendingCount = document.getElementById('pendingCount');
const pinList = document.getElementById('pinList');
const emptyState = document.getElementById('emptyState');
const clearBtn = document.getElementById('clearBtn');

let isInspecting = false;
let currentTabUrl = '';

// ── Init ──

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab?.url || '';

  // Check current state
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  isInspecting = state?.inspecting || false;
  updateInspectButton();

  await loadPins();
}

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

// ── Pin List ──

async function loadPins() {
  if (!currentTabUrl) return;

  const response = await chrome.runtime.sendMessage({
    type: 'GET_PINS',
    payload: { url: currentTabUrl },
  });

  if (!response?.success) return;

  const pins = response.pins;
  renderPinList(pins);
  updateStats(pins);
}

function renderPinList(pins) {
  // Clear existing items (keep empty state)
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

    const badge = document.createElement('span');
    badge.className = 'pin-status-badge ' +
      (pin.status === 'Resolved' ? 'badge-resolved' : 'badge-pending');
    badge.textContent = pin.status;

    typeRow.append(type, badge);

    const note = document.createElement('div');
    note.className = 'pin-note';
    note.textContent = pin.note || 'No description';

    info.append(typeRow, note);

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

    item.append(number, info, deleteBtn);
    pinList.appendChild(item);
  });
}

function updateStats(pins) {
  const total = pins.length;
  const pending = pins.filter(p => p.status === 'Pending').length;
  totalCount.textContent = `${total} pin${total !== 1 ? 's' : ''}`;
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

// ── Listen for inspect stop from content script ──

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'INSPECT_STOPPED') {
    isInspecting = false;
    updateInspectButton();
  }
});

init();
