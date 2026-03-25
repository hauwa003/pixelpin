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
  let currentUser = '';

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

  // ── Code Generation Engine ──

  const tokens = window.__pixelPinTokens || {};

  function mapToTailwind(property, value) {
    if (!value) return null;
    const val = value.trim();
    const prefixes = tokens.propertyPrefix || {};

    // Border radius has full class names
    if (property === 'border-radius' && tokens.borderRadius?.[val]) {
      return tokens.borderRadius[val];
    }

    // Font weight
    if (property === 'font-weight' && tokens.fontWeight?.[val]) {
      const prefix = prefixes[property] || 'font';
      return `${prefix}-${tokens.fontWeight[val]}`;
    }

    // Font size
    if (property === 'font-size' && tokens.fontSize?.[val]) {
      const prefix = prefixes[property] || 'text';
      return `${prefix}-${tokens.fontSize[val]}`;
    }

    // Spacing-based properties (margin, padding, width, height, gap)
    const spacingProps = [
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'width', 'height', 'gap',
    ];
    if (spacingProps.includes(property) && tokens.spacing?.[val]) {
      const prefix = prefixes[property] || property.charAt(0);
      return `${prefix}-${tokens.spacing[val]}`;
    }

    return null;
  }

  // Determine which CSS property to fix based on feedback type
  function getRelevantProperty(feedbackType, cssProperties) {
    const typeMap = {
      Spacing: ['padding', 'margin'],
      Typography: ['font-size', 'font-weight', 'line-height', 'font-family'],
      Color: ['color', 'background'],
      Size: ['width', 'height'],
      Alignment: ['display'],
    };

    const candidates = typeMap[feedbackType] || [];
    for (const prop of candidates) {
      if (cssProperties[prop] !== undefined) return prop;
    }
    return null;
  }

  function generateFix(cssProperties, feedbackType, expectedValue) {
    if (!expectedValue) return null;

    const property = getRelevantProperty(feedbackType, cssProperties);
    if (!property && feedbackType !== 'General') return null;

    // For General type, try to parse "property: value" from expectedValue
    if (feedbackType === 'General') {
      const match = expectedValue.match(/^([\w-]+)\s*:\s*(.+)$/);
      if (match) {
        const prop = match[1];
        const val = match[2].replace(/;$/, '').trim();
        const currentVal = cssProperties[prop] || 'unknown';
        const tw = mapToTailwind(prop, val);
        return {
          cssFix: `${prop}: ${val}; /* was ${currentVal} */`,
          tailwindClass: tw,
          property: prop,
          currentValue: currentVal,
          expectedValue: val,
        };
      }
      return null;
    }

    const currentValue = cssProperties[property] || 'unknown';
    const tw = mapToTailwind(property, expectedValue);

    return {
      cssFix: `${property}: ${expectedValue}; /* was ${currentValue} */`,
      tailwindClass: tw,
      property,
      currentValue,
      expectedValue,
    };
  }

  // ── Inspect Mode ──

  function startInspecting() {
    inspecting = true;
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    // Show existing pins + dock when inspecting starts
    loadPins().then(() => {
      overlay.showDock(pins, handleDockAction);
    });
  }

  function stopInspecting() {
    inspecting = false;
    overlay.hideHighlight();
    overlay.hideForm();
    overlay.hidePopover();
    overlay.hideDock();
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
      overlay.updateDockInspectTarget('');
      return;
    }
    const rect = el.getBoundingClientRect();
    overlay.showHighlight(rect);

    // Update dock with hovered element label
    if (overlay.isDockVisible) {
      const tag = el.tagName.toLowerCase();
      const cls = el.classList[0] ? `.${el.classList[0]}` : '';
      overlay.updateDockInspectTarget(`${tag}${cls}`);
    }
  }

  function onClick(e) {
    if (!inspecting) return;
    if (overlay.isFormVisible) return;

    // Collapse dock if expanded and user clicks on page (not on dock itself)
    if (overlay.isDockExpanded) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!isOwnElement(el)) {
        overlay.collapseDock();
      }
      return;
    }

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
      const fix = generateFix(cssProperties, formData.feedbackType, formData.expectedValue);
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
        assignee: formData.assignee,
        note: formData.note,
        severity: formData.severity,
        expectedValue: formData.expectedValue || '',
        fix: fix,
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
      // Keep dock in sync
      if (overlay.isDockVisible) {
        overlay.updateDockPins(pins);
      }
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

  // Dock-specific action handler
  async function handleDockAction(action, pin) {
    if (action === 'stop-inspecting') {
      stopInspecting();
      chrome.runtime.sendMessage({ type: 'INSPECT_STOPPED' }).catch(() => {});
      return;
    }

    if (action === 'locate' && pin) {
      // Scroll to pin location and flash the marker
      const targetY = pin.boundingBox.top - window.innerHeight / 3;
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      // Flash marker after scroll
      setTimeout(() => {
        renderPins();
        const markers = overlay.markersContainer.querySelectorAll('.pp-marker');
        markers.forEach(m => {
          if (m.textContent == pin.number) {
            m.style.transition = 'transform 0.2s';
            m.style.transform = 'scale(1.6)';
            setTimeout(() => { m.style.transform = 'scale(1)'; }, 400);
          }
        });
      }, 400);
      return;
    }

    if (action === 'resolve' && pin) {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_PIN',
        payload: { url: currentUrl, id: pin.id, updates: { status: 'Resolved' } },
      });
      await loadPins();
    }
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

      case 'SET_USER':
        currentUser = msg.payload?.user || '';
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
