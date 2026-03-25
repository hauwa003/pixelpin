// PixelPin Service Worker — message router + storage CRUD

const STORAGE_PREFIX = 'pins::';

function storageKey(url) {
  try {
    const u = new URL(url);
    return STORAGE_PREFIX + u.origin + u.pathname;
  } catch {
    return STORAGE_PREFIX + url;
  }
}

async function getPins(url) {
  const key = storageKey(url);
  const result = await chrome.storage.local.get(key);
  return result[key] || [];
}

async function savePins(url, pins) {
  const key = storageKey(url);
  await chrome.storage.local.set({ [key]: pins });
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // keep channel open for async
});

async function handleMessage(msg, sender) {
  const { type, payload } = msg;

  switch (type) {
    case 'GET_PINS': {
      const pins = await getPins(payload.url);
      return { success: true, pins };
    }

    case 'SAVE_PIN': {
      const pins = await getPins(payload.url);
      // Assign next number
      const maxNum = pins.reduce((max, p) => Math.max(max, p.number || 0), 0);
      payload.number = maxNum + 1;
      payload.id = `pin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      payload.createdAt = new Date().toISOString();
      payload.status = payload.status || 'Pending';
      pins.push(payload);
      await savePins(payload.url, pins);
      return { success: true, pin: payload };
    }

    case 'UPDATE_PIN': {
      const pins = await getPins(payload.url);
      const idx = pins.findIndex(p => p.id === payload.id);
      if (idx === -1) return { success: false, error: 'Pin not found' };
      pins[idx] = { ...pins[idx], ...payload.updates };
      await savePins(payload.url, pins);
      // Notify content script to re-render
      notifyContentScript(payload.url, 'LOAD_PINS');
      return { success: true, pin: pins[idx] };
    }

    case 'DELETE_PIN': {
      const pins = await getPins(payload.url);
      const filtered = pins.filter(p => p.id !== payload.id);
      await savePins(payload.url, filtered);
      notifyContentScript(payload.url, 'LOAD_PINS');
      return { success: true };
    }

    case 'CLEAR_PINS': {
      await savePins(payload.url, []);
      notifyContentScript(payload.url, 'LOAD_PINS');
      return { success: true };
    }

    case 'TOGGLE_INSPECT': {
      // Forward to content script in active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: 'No active tab' };
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_INSPECT',
          payload: payload
        });
        return response || { success: true };
      } catch (e) {
        return { success: false, error: 'Content script not loaded. Refresh the page.' };
      }
    }

    case 'GET_STATE': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, inspecting: false };
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
        return response || { success: true, inspecting: false };
      } catch {
        return { success: true, inspecting: false };
      }
    }

    default:
      return { success: false, error: `Unknown message type: ${type}` };
  }
}

async function notifyContentScript(url, type) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      const tabUrl = new URL(tab.url);
      const pinUrl = new URL(url);
      if (tabUrl.origin + tabUrl.pathname === pinUrl.origin + pinUrl.pathname) {
        chrome.tabs.sendMessage(tab.id, { type }).catch(() => {});
      }
    } catch {}
  }
}
