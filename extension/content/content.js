// PixelPin Content Script — orchestrates inspection, CSS extraction, pin lifecycle

(function () {
  if (window.__pixelPinLoaded) return;
  window.__pixelPinLoaded = true;

  const overlay = window.__pixelPinOverlay;
  if (!overlay) {
    console.error('PixelPin: overlay not loaded');
    return;
  }

  let inspecting = false;
  let pins = [];
  let currentUrl = location.href;

  // ── CSS Extraction ──

  function extractCSS(el) {
    const cs = window.getComputedStyle(el);
    return {
      'margin': cs.margin,
      'padding': cs.padding,
      'font-size': cs.fontSize,
      'font-family': cs.fontFamily.split(',')[0].trim().replace(/['"]/g, ''),
      'font-weight': cs.fontWeight,
      'line-height': cs.lineHeight,
      'color': cs.color,
      'background': cs.backgroundColor,
      'border': cs.border,
      'border-radius': cs.borderRadius,
      'width': cs.width,
      'height': cs.height,
      'display': cs.display,
    };
  }

  // ── Selector Generation ──

  function generateSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;

    // Try stable classes (filter out dynamic-looking ones)
    const classes = Array.from(el.classList).filter(c =>
      !/^(js-|is-|has-|active|hover|focus|open|show|hide|visible|hidden|ng-|v-|react-|_|css-)/.test(c) &&
      c.length > 1 && c.length < 40 &&
      !/[0-9]{3,}/.test(c)
    );

    if (classes.length) {
      const selector = el.tagName.toLowerCase() + '.' + classes.map(CSS.escape).join('.');
      if (document.querySelectorAll(selector).length === 1) return selector;
    }

    // Data attributes
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-') && attr.value && attr.value.length < 50) {
        const selector = `${el.tagName.toLowerCase()}[${attr.name}="${CSS.escape(attr.value)}"]`;
        if (document.querySelectorAll(selector).length === 1) return selector;
      }
    }

    // Build path with nth-child
    const path = [];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      let seg = current.tagName.toLowerCase();
      if (current.id) {
        path.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          seg += `:nth-child(${idx})`;
        }
      }
      path.unshift(seg);
      current = parent;
    }

    return path.join(' > ');
  }

  function generateXPath(el) {
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let idx = 1;
      let sib = current.previousElementSibling;
      while (sib) {
        if (sib.tagName === current.tagName) idx++;
        sib = sib.previousElementSibling;
      }
      parts.unshift(`${current.tagName.toLowerCase()}[${idx}]`);
      current = current.parentElement;
    }
    return '/' + parts.join('/');
  }

  // ── Inspect Mode ──

  function startInspecting() {
    inspecting = true;
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    // Show existing pins when inspecting starts
    loadPins();
  }

  function stopInspecting() {
    inspecting = false;
    overlay.hideHighlight();
    overlay.hideForm();
    overlay.hidePopover();
    overlay.clearMarkers();
    pins = [];
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function isOwnElement(el) {
    return el.closest?.('pixelpin-overlay') || el.tagName === 'PIXELPIN-OVERLAY';
  }

  function onMouseMove(e) {
    if (!inspecting) return;
    if (overlay.isFormVisible) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOwnElement(el)) {
      overlay.hideHighlight();
      return;
    }
    const rect = el.getBoundingClientRect();
    overlay.showHighlight(rect);
  }

  function onClick(e) {
    if (!inspecting) return;
    if (overlay.isFormVisible) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOwnElement(el)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    overlay.hideHighlight();

    const rect = el.getBoundingClientRect();
    const cssProperties = extractCSS(el);
    const selector = generateSelector(el);
    const xpath = generateXPath(el);

    overlay.showForm(rect, cssProperties, (formData) => {
      savePin({
        url: currentUrl,
        selector,
        xpath,
        boundingBox: {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        },
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        cssProperties,
        feedbackType: formData.feedbackType,
        note: formData.note,
      });
    });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (overlay.isFormVisible) {
        overlay.hideForm();
      } else {
        stopInspecting();
        // Notify popup
        chrome.runtime.sendMessage({ type: 'INSPECT_STOPPED' }).catch(() => {});
      }
    }
  }

  // ── Pin CRUD ──

  async function savePin(pinData) {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_PIN',
      payload: pinData,
    });
    if (response?.success) {
      await loadPins();
    }
  }

  async function loadPins() {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PINS',
      payload: { url: currentUrl },
    });
    if (response?.success) {
      pins = response.pins;
      renderPins();
    }
  }

  function renderPins() {
    overlay.renderMarkers(pins, window.scrollX, window.scrollY, handlePinAction);
  }

  async function handlePinAction(action, pin) {
    if (action === 'resolve') {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_PIN',
        payload: { url: currentUrl, id: pin.id, updates: { status: 'Resolved' } },
      });
    } else if (action === 'reopen') {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_PIN',
        payload: { url: currentUrl, id: pin.id, updates: { status: 'Pending' } },
      });
    } else if (action === 'delete') {
      await chrome.runtime.sendMessage({
        type: 'DELETE_PIN',
        payload: { url: currentUrl, id: pin.id },
      });
    }
    await loadPins();
  }

  // ── Scroll/Resize handling ──

  let scrollTimer;
  function onScrollResize() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (inspecting && pins.length) renderPins();
    }, 100);
  }

  window.addEventListener('scroll', onScrollResize, { passive: true });
  window.addEventListener('resize', onScrollResize, { passive: true });

  // ── Message listener ──

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'TOGGLE_INSPECT':
        if (inspecting) {
          stopInspecting();
        } else {
          startInspecting();
        }
        sendResponse({ success: true, inspecting });
        break;

      case 'GET_STATE':
        sendResponse({ success: true, inspecting });
        break;

      case 'LOAD_PINS':
        if (inspecting) loadPins();
        sendResponse({ success: true });
        break;

      case 'SHOW_PINS':
        loadPins();
        sendResponse({ success: true });
        break;

      case 'HIDE_PINS':
        overlay.clearMarkers();
        overlay.hidePopover();
        pins = [];
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false });
    }
    return false; // synchronous responses
  });

  // Pins are only shown when the extension is actively used (inspecting or popup open).
  // No auto-load on page init — zero visual traces until user opens PixelPin.
})();
