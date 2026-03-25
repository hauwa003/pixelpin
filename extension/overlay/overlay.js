// PixelPin Overlay — Shadow DOM UI for highlights, pin form, markers, and popovers

const FEEDBACK_TYPES = [
  { label: 'Spacing', color: '#4A90D9' },
  { label: 'Typography', color: '#9B59B6' },
  { label: 'Color', color: '#E74C3C' },
  { label: 'Size', color: '#F39C12' },
  { label: 'Alignment', color: '#2ECC71' },
  { label: 'General', color: '#95A5A6' },
];

const TYPE_COLORS = Object.fromEntries(FEEDBACK_TYPES.map(t => [t.label, t.color]));

const SEVERITIES = [
  { label: 'Critical', color: '#E74C3C' },
  { label: 'Improvement', color: '#F39C12' },
  { label: 'Nice-to-have', color: '#95A5A6' },
];

const SEVERITY_COLORS = Object.fromEntries(SEVERITIES.map(s => [s.label, s.color]));

const TEAM_MEMBERS = ['Hauwa', 'Jaf', 'Nico', 'Dan'];

class PixelPinOverlay {
  constructor() {
    this.host = document.createElement('pixelpin-overlay');
    this.host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this._injectStyles();

    // Containers
    this.highlightEl = this._el('div', 'pp-highlight');
    this.formContainer = this._el('div', 'pp-form-container');
    this.markersContainer = this._el('div', 'pp-markers');
    this.popoverContainer = this._el('div', 'pp-popover-container');
    this.dockContainer = this._el('div', 'pp-dock');

    this.shadow.append(this.highlightEl, this.formContainer, this.markersContainer, this.popoverContainer, this.dockContainer);

    this._onFormSubmit = null;
    this._onPinAction = null;
    this._activePopoverId = null;
    this._dockExpanded = false;
    this._dockPins = [];
    this._dockFilter = 'all';
    this._dockOnPinAction = null;
  }

  _el(tag, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      .pp-highlight {
        position: fixed;
        pointer-events: none;
        border: 2px solid #4A90D9;
        background: rgba(74, 144, 217, 0.08);
        border-radius: 2px;
        transition: all 0.05s ease;
        display: none;
        z-index: 1;
      }

      .pp-form-container {
        position: fixed;
        display: none;
        z-index: 3;
        pointer-events: auto;
      }

      .pp-form {
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
        padding: 16px;
        width: 320px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        color: #1a1a1a;
      }

      .pp-form-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .pp-form-title {
        font-weight: 600;
        font-size: 14px;
        color: #1a1a1a;
      }

      .pp-form-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        color: #999;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1;
      }
      .pp-form-close:hover { background: #f0f0f0; color: #333; }

      .pp-css-preview {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 8px 10px;
        margin-bottom: 12px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 11px;
        color: #495057;
        max-height: 120px;
        overflow-y: auto;
        line-height: 1.5;
      }

      .pp-css-line {
        display: flex;
        justify-content: space-between;
        padding: 1px 0;
      }
      .pp-css-prop { color: #6741d9; }
      .pp-css-val { color: #1a1a1a; }

      .pp-type-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }

      .pp-chip {
        padding: 5px 12px;
        border-radius: 16px;
        border: 1.5px solid #e0e0e0;
        background: #fff;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        color: #555;
        transition: all 0.15s;
        pointer-events: auto;
      }
      .pp-chip:hover { border-color: #bbb; }
      .pp-chip.selected {
        color: #fff;
        border-color: transparent;
      }

      .pp-expected-input {
        width: 100%;
        padding: 8px 10px;
        border: 1.5px solid #e0e0e0;
        border-radius: 8px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 13px;
        outline: none;
        margin-bottom: 12px;
        color: #1a1a1a;
        background: #fff;
      }
      .pp-expected-input:focus { border-color: #4A90D9; }
      .pp-expected-input::placeholder { color: #aaa; }

      .pp-note-input {
        width: 100%;
        min-height: 60px;
        padding: 10px;
        border: 1.5px solid #e0e0e0;
        border-radius: 8px;
        font-family: inherit;
        font-size: 13px;
        resize: vertical;
        outline: none;
        margin-bottom: 12px;
        color: #1a1a1a;
        background: #fff;
      }
      .pp-note-input:focus { border-color: #4A90D9; }
      .pp-note-input::placeholder { color: #aaa; }

      .pp-form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .pp-btn {
        padding: 7px 16px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.15s;
        pointer-events: auto;
      }

      .pp-btn-primary {
        background: #4A90D9;
        color: #fff;
      }
      .pp-btn-primary:hover { background: #3a7bc8; }
      .pp-btn-primary:disabled { opacity: 0.5; cursor: default; }

      .pp-btn-secondary {
        background: #f0f0f0;
        color: #555;
      }
      .pp-btn-secondary:hover { background: #e0e0e0; }

      .pp-markers {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2;
      }

      .pp-marker {
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        transition: transform 0.15s;
        z-index: 2;
        user-select: none;
      }
      .pp-marker:hover { transform: scale(1.2); }
      .pp-marker.resolved {
        opacity: 0.3;
        width: 18px;
        height: 18px;
        font-size: 9px;
      }

      .pp-popover-container {
        position: fixed;
        display: none;
        z-index: 4;
        pointer-events: auto;
      }

      .pp-popover {
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
        padding: 14px;
        width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        color: #1a1a1a;
      }

      .pp-popover-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .pp-popover-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 13px;
      }

      .pp-popover-badge-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
      }

      .pp-popover-status {
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 10px;
        font-weight: 500;
      }
      .pp-status-pending { background: #FFF3CD; color: #856404; }
      .pp-status-resolved { background: #D4EDDA; color: #155724; }

      .pp-popover-note {
        padding: 8px 0;
        line-height: 1.5;
        color: #333;
        border-bottom: 1px solid #f0f0f0;
        margin-bottom: 8px;
        word-break: break-word;
      }

      .pp-popover-css {
        background: #f8f9fa;
        border-radius: 6px;
        padding: 8px 10px;
        margin-bottom: 10px;
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 11px;
        max-height: 100px;
        overflow-y: auto;
        line-height: 1.5;
      }

      .pp-popover-actions {
        display: flex;
        gap: 8px;
      }

      .pp-btn-resolve {
        background: #2ECC71;
        color: #fff;
      }
      .pp-btn-resolve:hover { background: #27ae60; }

      .pp-btn-danger {
        background: #fff;
        color: #E74C3C;
        border: 1px solid #E74C3C;
      }
      .pp-btn-danger:hover { background: #FEF0EF; }

      .pp-btn-reopen {
        background: #F39C12;
        color: #fff;
      }
      .pp-btn-reopen:hover { background: #e08e0b; }

      .pp-section-label {
        font-size: 11px;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }

      .pp-assignee-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }

      .pp-assignee-chip {
        padding: 5px 12px;
        border-radius: 16px;
        border: 1.5px solid #e0e0e0;
        background: #fff;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        color: #555;
        transition: all 0.15s;
        pointer-events: auto;
      }
      .pp-assignee-chip:hover { border-color: #bbb; }
      .pp-assignee-chip.selected {
        background: #1a1a1a;
        color: #fff;
        border-color: transparent;
      }

      .pp-popover-assignee {
        font-size: 12px;
        color: #666;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .pp-popover-assignee strong {
        color: #1a1a1a;
        font-weight: 600;
      }

      .pp-severity-badge {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 600;
        color: #fff;
        margin-left: 6px;
      }

      .pp-diff-section {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 10px;
        margin-bottom: 10px;
      }

      .pp-diff-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 12px;
      }

      .pp-diff-current {
        color: #E74C3C;
        text-decoration: line-through;
      }

      .pp-diff-arrow {
        color: #888;
        font-size: 14px;
      }

      .pp-diff-expected {
        color: #2ECC71;
        font-weight: 600;
      }

      .pp-diff-property {
        color: #6741d9;
        font-weight: 500;
        margin-bottom: 4px;
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 11px;
      }

      .pp-fix-block {
        background: #1a1a2e;
        border-radius: 6px;
        padding: 10px 12px;
        margin-bottom: 10px;
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 12px;
        color: #e0e0e0;
        line-height: 1.6;
        position: relative;
      }

      .pp-fix-css {
        color: #a8d8ea;
      }

      .pp-fix-tailwind {
        color: #95A5A6;
        font-size: 11px;
        margin-top: 4px;
      }

      .pp-copy-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: #ccc;
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        transition: all 0.15s;
        pointer-events: auto;
      }
      .pp-copy-btn:hover {
        background: rgba(255,255,255,0.2);
        color: #fff;
      }

      .pp-toast {
        position: fixed;
        bottom: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: #1a1a2e;
        color: #fff;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 10;
      }
      .pp-toast.visible { opacity: 1; }

      /* ── Dock ── */

      .pp-dock {
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        z-index: 5;
        pointer-events: auto;
        display: none;
      }

      .pp-dock.visible { display: block; }

      /* Collapsed bar */
      .pp-dock-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(26, 26, 46, 0.88);
        color: #ccc;
        padding: 7px 16px;
        border-radius: 20px;
        cursor: pointer;
        user-select: none;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: opacity 0.15s, background 0.15s;
        white-space: nowrap;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .pp-dock-bar:hover { background: rgba(26, 26, 46, 0.98); }

      .pp-dock-bar-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4A90D9;
        flex-shrink: 0;
      }

      .pp-dock-bar-label { font-weight: 600; color: #fff; font-size: 12px; }
      .pp-dock-bar-stat { font-size: 12px; color: #888; }
      .pp-dock-bar-sep { color: #444; font-size: 12px; }
      .pp-dock-bar-inspect-label { font-size: 12px; color: #888; }

      .pp-dock-toggle {
        padding: 3px 10px;
        border-radius: 10px;
        border: none;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        transition: all 0.15s;
        pointer-events: auto;
        margin-left: 4px;
      }
      .pp-dock-toggle.on { background: #2ECC71; color: #fff; }
      .pp-dock-toggle.off { background: #444; color: #aaa; }
      .pp-dock-toggle:hover { filter: brightness(1.1); }

      /* Expanded panel */
      .pp-dock-panel {
        display: none;
        width: 420px;
        max-height: 340px;
        background: rgba(26, 26, 46, 0.96);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        overflow: hidden;
        flex-direction: column;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .pp-dock-panel.visible { display: flex; }

      .pp-dock-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }

      .pp-dock-panel-title {
        font-weight: 700;
        font-size: 13px;
        color: #fff;
      }

      .pp-dock-filters {
        display: flex;
        gap: 2px;
      }

      .pp-dock-filter-btn {
        padding: 3px 10px;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: #777;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      .pp-dock-filter-btn:hover { color: #bbb; background: rgba(255,255,255,0.06); }
      .pp-dock-filter-btn.active { color: #fff; background: rgba(255,255,255,0.12); }

      .pp-dock-panel-list {
        flex: 1;
        overflow-y: auto;
        padding: 6px 0;
        scrollbar-width: thin;
        scrollbar-color: #333 transparent;
      }
      .pp-dock-panel-list::-webkit-scrollbar { width: 4px; }
      .pp-dock-panel-list::-webkit-scrollbar-track { background: transparent; }
      .pp-dock-panel-list::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

      .pp-dock-empty {
        text-align: center;
        color: #666;
        padding: 24px;
        font-size: 12px;
      }

      /* Pin item row */
      .pp-dock-pin {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 8px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        transition: background 0.1s;
      }
      .pp-dock-pin:hover { background: rgba(255,255,255,0.04); }
      .pp-dock-pin.resolved { opacity: 0.4; }

      .pp-dock-pin-num {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
        transition: transform 0.15s;
      }
      .pp-dock-pin-num:hover { transform: scale(1.15); }

      .pp-dock-pin-body { flex: 1; min-width: 0; }

      .pp-dock-pin-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 3px;
      }

      .pp-dock-pin-type {
        font-size: 12px;
        font-weight: 600;
        color: #ddd;
      }

      .pp-dock-pin-sev {
        font-size: 9px;
        padding: 1px 6px;
        border-radius: 8px;
        font-weight: 600;
        color: #fff;
      }

      .pp-dock-pin-diff {
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 11px;
        color: #888;
        margin-bottom: 3px;
      }
      .pp-dock-pin-diff-old { color: #E74C3C; text-decoration: line-through; }
      .pp-dock-pin-diff-arrow { color: #555; margin: 0 4px; }
      .pp-dock-pin-diff-new { color: #2ECC71; font-weight: 600; }

      .pp-dock-pin-fix {
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 11px;
        color: #a8d8ea;
        background: rgba(0,0,0,0.3);
        padding: 3px 6px;
        border-radius: 4px;
        display: inline-block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .pp-dock-pin-actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex-shrink: 0;
        align-self: center;
      }

      .pp-dock-copy-btn, .pp-dock-resolve-btn {
        padding: 3px 8px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-size: 10px;
        font-weight: 600;
        transition: all 0.15s;
        pointer-events: auto;
      }

      .pp-dock-copy-btn {
        background: rgba(255,255,255,0.08);
        color: #aaa;
      }
      .pp-dock-copy-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }

      .pp-dock-resolve-btn {
        background: rgba(46, 204, 113, 0.15);
        color: #2ECC71;
      }
      .pp-dock-resolve-btn:hover { background: rgba(46, 204, 113, 0.3); }

      .pp-dock-panel-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 14px;
        border-top: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }

      .pp-dock-hint {
        font-size: 11px;
        color: #555;
      }
      .pp-dock-hint kbd {
        background: rgba(255,255,255,0.08);
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 10px;
        color: #888;
        font-family: inherit;
      }

      .pp-dock-collapse-btn {
        background: none;
        border: none;
        color: #666;
        font-size: 16px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1;
      }
      .pp-dock-collapse-btn:hover { color: #aaa; background: rgba(255,255,255,0.06); }
    `;
    this.shadow.appendChild(style);
  }

  // ── Highlight ──

  showHighlight(rect) {
    const el = this.highlightEl;
    el.style.display = 'block';
    el.style.top = rect.top + 'px';
    el.style.left = rect.left + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
  }

  hideHighlight() {
    this.highlightEl.style.display = 'none';
  }

  // ── Pin Form ──

  showForm(rect, cssProperties, onSubmit) {
    this._onFormSubmit = onSubmit;
    this.formContainer.style.display = 'block';
    this.formContainer.innerHTML = '';

    const form = this._el('div', 'pp-form');

    // Header
    const header = this._el('div', 'pp-form-header');
    const title = this._el('span', 'pp-form-title');
    title.textContent = 'Add Pin';
    const closeBtn = this._el('button', 'pp-form-close');
    closeBtn.textContent = '\u00D7';
    closeBtn.onclick = () => this.hideForm();
    header.append(title, closeBtn);
    form.appendChild(header);

    // CSS preview
    if (cssProperties && Object.keys(cssProperties).length) {
      const preview = this._el('div', 'pp-css-preview');
      for (const [prop, val] of Object.entries(cssProperties)) {
        const line = this._el('div', 'pp-css-line');
        const propEl = this._el('span', 'pp-css-prop');
        propEl.textContent = prop + ':';
        const valEl = this._el('span', 'pp-css-val');
        valEl.textContent = val;
        line.append(propEl, valEl);
        preview.appendChild(line);
      }
      form.appendChild(preview);
    }

    // Feedback type chips
    const typeLabel = this._el('div', 'pp-section-label');
    typeLabel.textContent = 'Issue Type';
    form.appendChild(typeLabel);

    const chips = this._el('div', 'pp-type-chips');
    let selectedType = null;
    FEEDBACK_TYPES.forEach(ft => {
      const chip = this._el('button', 'pp-chip');
      chip.textContent = ft.label;
      chip.onclick = () => {
        chips.querySelectorAll('.pp-chip').forEach(c => {
          c.classList.remove('selected');
          c.style.background = '';
          c.style.color = '#555';
        });
        chip.classList.add('selected');
        chip.style.background = ft.color;
        chip.style.color = '#fff';
        selectedType = ft.label;
        updateSubmitState();
      };
      chips.appendChild(chip);
    });
    form.appendChild(chips);

    // Assignee chips
    const assignLabel = this._el('div', 'pp-section-label');
    assignLabel.textContent = 'Assign To';
    form.appendChild(assignLabel);

    const assigneeChips = this._el('div', 'pp-assignee-chips');
    let selectedAssignee = null;
    TEAM_MEMBERS.forEach(name => {
      const chip = this._el('button', 'pp-assignee-chip');
      chip.textContent = name;
      chip.onclick = () => {
        assigneeChips.querySelectorAll('.pp-assignee-chip').forEach(c => {
          c.classList.remove('selected');
        });
        chip.classList.add('selected');
        selectedAssignee = name;
        updateSubmitState();
      };
      assigneeChips.appendChild(chip);
    });
    form.appendChild(assigneeChips);

    // Severity chips
    const sevLabel = this._el('div', 'pp-section-label');
    sevLabel.textContent = 'Severity';
    form.appendChild(sevLabel);

    const sevChips = this._el('div', 'pp-type-chips');
    let selectedSeverity = null;
    SEVERITIES.forEach(sev => {
      const chip = this._el('button', 'pp-chip');
      chip.textContent = sev.label;
      chip.onclick = () => {
        sevChips.querySelectorAll('.pp-chip').forEach(c => {
          c.classList.remove('selected');
          c.style.background = '';
          c.style.color = '#555';
        });
        chip.classList.add('selected');
        chip.style.background = sev.color;
        chip.style.color = '#fff';
        selectedSeverity = sev.label;
        updateSubmitState();
      };
      sevChips.appendChild(chip);
    });
    form.appendChild(sevChips);

    // Expected value input
    const expectedLabel = this._el('div', 'pp-section-label');
    expectedLabel.textContent = 'Expected Value (optional)';
    form.appendChild(expectedLabel);

    const expectedInput = this._el('input', 'pp-expected-input');
    expectedInput.type = 'text';
    // Smart placeholder based on selected type
    const placeholders = {
      Spacing: 'e.g. 16px',
      Typography: 'e.g. 14px, bold',
      Color: 'e.g. #333333',
      Size: 'e.g. 200px',
      Alignment: 'e.g. center',
      General: 'What should it be?',
    };
    expectedInput.placeholder = 'What should it be?';
    form.appendChild(expectedInput);

    // Update placeholder when type changes
    chips.addEventListener('click', () => {
      if (selectedType) {
        expectedInput.placeholder = placeholders[selectedType] || 'What should it be?';
      }
    });

    function updateSubmitState() {
      submitBtn.disabled = !(selectedType && selectedAssignee && selectedSeverity);
    }

    // Note textarea
    const noteInput = this._el('textarea', 'pp-note-input');
    noteInput.placeholder = 'Describe the issue...';
    form.appendChild(noteInput);

    // Actions
    const actions = this._el('div', 'pp-form-actions');
    const cancelBtn = this._el('button', 'pp-btn pp-btn-secondary');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => this.hideForm();

    const submitBtn = this._el('button', 'pp-btn pp-btn-primary');
    submitBtn.textContent = 'Pin It';
    submitBtn.disabled = true;
    submitBtn.onclick = () => {
      if (!selectedType || !selectedAssignee || !selectedSeverity) return;
      this._onFormSubmit?.({
        feedbackType: selectedType,
        assignee: selectedAssignee,
        severity: selectedSeverity,
        expectedValue: expectedInput.value.trim(),
        note: noteInput.value.trim(),
      });
      this.hideForm();
    };

    actions.append(cancelBtn, submitBtn);
    form.appendChild(actions);

    this.formContainer.appendChild(form);

    // Position: below the element, centered, or adjusted to fit viewport
    const formWidth = 320;
    let top = rect.bottom + 8;
    let left = rect.left + (rect.width - formWidth) / 2;

    // Keep in viewport
    if (top + 280 > window.innerHeight) top = Math.max(8, rect.top - 280 - 8);
    if (left < 8) left = 8;
    if (left + formWidth > window.innerWidth - 8) left = window.innerWidth - formWidth - 8;

    this.formContainer.style.top = top + 'px';
    this.formContainer.style.left = left + 'px';

    // Focus the textarea
    setTimeout(() => noteInput.focus(), 50);
  }

  hideForm() {
    this.formContainer.style.display = 'none';
    this.formContainer.innerHTML = '';
    this._onFormSubmit = null;
  }

  get isFormVisible() {
    return this.formContainer.style.display !== 'none' && this.formContainer.innerHTML !== '';
  }

  // ── Pin Markers ──

  renderMarkers(pins, scrollX, scrollY, onPinAction) {
    this._onPinAction = onPinAction;
    this.markersContainer.innerHTML = '';

    pins.forEach(pin => {
      const marker = this._el('div', 'pp-marker' + (pin.status === 'Resolved' ? ' resolved' : ''));
      const color = TYPE_COLORS[pin.feedbackType] || '#95A5A6';
      marker.style.background = color;
      marker.textContent = pin.number;

      // Position relative to page, offset by scroll
      const x = pin.boundingBox.left + pin.boundingBox.width - 12 - (pin.scrollX - scrollX);
      const y = pin.boundingBox.top - 12 - (pin.scrollY - scrollY);
      marker.style.left = x + 'px';
      marker.style.top = y + 'px';

      marker.onclick = (e) => {
        e.stopPropagation();
        this._showPopover(pin, marker);
      };

      this.markersContainer.appendChild(marker);
    });
  }

  clearMarkers() {
    this.markersContainer.innerHTML = '';
  }

  // ── Pin Detail Popover ──

  _showPopover(pin, markerEl) {
    if (this._activePopoverId === pin.id) {
      this.hidePopover();
      return;
    }
    this._activePopoverId = pin.id;
    this.popoverContainer.style.display = 'block';
    this.popoverContainer.innerHTML = '';

    const isResolved = pin.status === 'Resolved';
    const pop = this._el('div', 'pp-popover');
    if (isResolved) pop.style.opacity = '0.7';

    // Header: #1 Spacing + severity badge + status
    const header = this._el('div', 'pp-popover-header');
    const badge = this._el('span', 'pp-popover-badge');
    const dot = this._el('span', 'pp-popover-badge-dot');
    dot.style.background = TYPE_COLORS[pin.feedbackType] || '#95A5A6';
    const typeLabel = document.createTextNode(`#${pin.number} ${pin.feedbackType}`);
    badge.append(dot, typeLabel);

    // Severity badge
    if (pin.severity) {
      const sevBadge = this._el('span', 'pp-severity-badge');
      sevBadge.textContent = pin.severity;
      sevBadge.style.background = SEVERITY_COLORS[pin.severity] || '#95A5A6';
      badge.appendChild(sevBadge);
    }

    const statusBadge = this._el('span', 'pp-popover-status ' +
      (isResolved ? 'pp-status-resolved' : 'pp-status-pending'));
    statusBadge.textContent = pin.status;

    header.append(badge, statusBadge);
    pop.appendChild(header);

    // Assignee
    if (pin.assignee) {
      const assignee = this._el('div', 'pp-popover-assignee');
      assignee.innerHTML = `Assigned to <strong>${this._escapeHtml(pin.assignee)}</strong>`;
      pop.appendChild(assignee);
    }

    // Note
    if (pin.note) {
      const note = this._el('div', 'pp-popover-note');
      note.textContent = pin.note;
      pop.appendChild(note);
    }

    // "What's wrong" — Current → Expected diff
    if (pin.fix && pin.fix.property) {
      const diffSection = this._el('div', 'pp-diff-section');

      const propLabel = this._el('div', 'pp-diff-property');
      propLabel.textContent = pin.fix.property;
      diffSection.appendChild(propLabel);

      const diffRow = this._el('div', 'pp-diff-row');
      const current = this._el('span', 'pp-diff-current');
      current.textContent = pin.fix.currentValue;
      const arrow = this._el('span', 'pp-diff-arrow');
      arrow.textContent = '\u2192';
      const expected = this._el('span', 'pp-diff-expected');
      expected.textContent = pin.fix.expectedValue;
      diffRow.append(current, arrow, expected);
      diffSection.appendChild(diffRow);

      pop.appendChild(diffSection);
    }

    // Copyable fix block
    if (pin.fix && pin.fix.cssFix) {
      const fixBlock = this._el('div', 'pp-fix-block');

      const cssLine = this._el('div', 'pp-fix-css');
      cssLine.textContent = pin.fix.cssFix;
      fixBlock.appendChild(cssLine);

      if (pin.fix.tailwindClass) {
        const twLine = this._el('div', 'pp-fix-tailwind');
        twLine.textContent = `Tailwind: ${pin.fix.tailwindClass}`;
        fixBlock.appendChild(twLine);
      }

      const copyBtn = this._el('button', 'pp-copy-btn');
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(pin.fix.cssFix).then(() => {
          this._showToast('Copied to clipboard');
        });
      };
      fixBlock.appendChild(copyBtn);

      pop.appendChild(fixBlock);
    }

    // Fallback: show CSS properties if no fix generated
    if (!pin.fix && pin.cssProperties && Object.keys(pin.cssProperties).length) {
      const css = this._el('div', 'pp-popover-css');
      for (const [prop, val] of Object.entries(pin.cssProperties)) {
        const line = this._el('div', 'pp-css-line');
        const propEl = this._el('span', 'pp-css-prop');
        propEl.textContent = prop + ':';
        const valEl = this._el('span', 'pp-css-val');
        valEl.textContent = val;
        line.append(propEl, valEl);
        css.appendChild(line);
      }
      pop.appendChild(css);
    }

    // Actions
    const actions = this._el('div', 'pp-popover-actions');

    if (pin.status === 'Pending') {
      const resolveBtn = this._el('button', 'pp-btn pp-btn-resolve');
      resolveBtn.textContent = 'Resolve';
      resolveBtn.onclick = () => {
        this._onPinAction?.('resolve', pin);
        this.hidePopover();
      };
      actions.appendChild(resolveBtn);
    } else {
      const reopenBtn = this._el('button', 'pp-btn pp-btn-reopen');
      reopenBtn.textContent = 'Reopen';
      reopenBtn.onclick = () => {
        this._onPinAction?.('reopen', pin);
        this.hidePopover();
      };
      actions.appendChild(reopenBtn);
    }

    const deleteBtn = this._el('button', 'pp-btn pp-btn-danger');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      this._onPinAction?.('delete', pin);
      this.hidePopover();
    };
    actions.appendChild(deleteBtn);

    const closeBtn = this._el('button', 'pp-btn pp-btn-secondary');
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => this.hidePopover();
    actions.appendChild(closeBtn);

    pop.appendChild(actions);
    this.popoverContainer.appendChild(pop);

    // Position near marker
    const markerRect = markerEl.getBoundingClientRect();
    let top = markerRect.bottom + 8;
    let left = markerRect.left - 138;

    if (top + 300 > window.innerHeight) top = Math.max(8, markerRect.top - 300 - 8);
    if (left < 8) left = 8;
    if (left + 300 > window.innerWidth - 8) left = window.innerWidth - 308;

    this.popoverContainer.style.top = top + 'px';
    this.popoverContainer.style.left = left + 'px';
  }

  hidePopover() {
    this.popoverContainer.style.display = 'none';
    this.popoverContainer.innerHTML = '';
    this._activePopoverId = null;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _showToast(message) {
    // Remove existing toast
    const existing = this.shadow.querySelector('.pp-toast');
    if (existing) existing.remove();

    const toast = this._el('div', 'pp-toast');
    toast.textContent = message;
    this.shadow.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 200);
      }, 1500);
    });
  }

  // ── Dock ──

  showDock(pins, onPinAction) {
    this._dockPins = pins || [];
    this._dockOnPinAction = onPinAction;
    this._dockExpanded = false;
    this._dockFilter = 'all';
    this.dockContainer.classList.add('visible');
    this._renderDockCollapsed();
  }

  hideDock() {
    this.dockContainer.classList.remove('visible');
    this.dockContainer.innerHTML = '';
    this._dockExpanded = false;
    this._dockPins = [];
    this._dockOnPinAction = null;
  }

  expandDock() {
    this._dockExpanded = true;
    this._renderDockExpanded();
  }

  collapseDock() {
    this._dockExpanded = false;
    this._renderDockCollapsed();
  }

  updateDockPins(pins) {
    this._dockPins = pins || [];
    if (this._dockExpanded) {
      this._renderDockExpanded();
    } else {
      this._renderDockCollapsed();
    }
  }

  updateDockInspectTarget(label) {
    if (this._dockExpanded) return;
    const inspectLabel = this.dockContainer.querySelector('.pp-dock-bar-inspect-label');
    if (inspectLabel) {
      inspectLabel.textContent = label ? `Inspecting: ${label}` : '';
    }
  }

  _renderDockCollapsed() {
    this.dockContainer.innerHTML = '';

    const bar = this._el('div', 'pp-dock-bar');
    const pins = this._dockPins;
    const total = pins.length;
    const critical = pins.filter(p => p.severity === 'Critical' && p.status !== 'Resolved').length;

    // Dot
    const dot = this._el('span', 'pp-dock-bar-dot');
    bar.appendChild(dot);

    // Label
    const label = this._el('span', 'pp-dock-bar-label');
    label.textContent = 'QA';
    bar.appendChild(label);

    // Issue count
    const stat = this._el('span', 'pp-dock-bar-stat');
    stat.textContent = `${total} issue${total !== 1 ? 's' : ''}`;
    bar.appendChild(stat);

    if (critical > 0) {
      const sep = this._el('span', 'pp-dock-bar-sep');
      sep.textContent = '|';
      bar.appendChild(sep);

      const critStat = this._el('span', 'pp-dock-bar-stat');
      critStat.textContent = `${critical} critical`;
      critStat.style.color = '#E74C3C';
      bar.appendChild(critStat);
    }

    const sep2 = this._el('span', 'pp-dock-bar-sep');
    sep2.textContent = '|';
    bar.appendChild(sep2);

    // Inspect label (updated on hover)
    const inspectLabel = this._el('span', 'pp-dock-bar-inspect-label');
    bar.appendChild(inspectLabel);

    // Inspect toggle
    const toggle = this._el('button', 'pp-dock-toggle on');
    toggle.textContent = 'Inspect ON';
    toggle.onclick = (e) => {
      e.stopPropagation();
      this._dockOnPinAction?.('stop-inspecting');
    };
    bar.appendChild(toggle);

    bar.onclick = () => this.expandDock();

    this.dockContainer.appendChild(bar);
  }

  _renderDockExpanded() {
    this.dockContainer.innerHTML = '';

    const panel = this._el('div', 'pp-dock-panel visible');

    // Header
    const header = this._el('div', 'pp-dock-panel-header');
    const title = this._el('span', 'pp-dock-panel-title');
    title.textContent = 'PixelPin QA';
    header.appendChild(title);

    // Filters
    const filters = this._el('div', 'pp-dock-filters');
    const filterOptions = ['All', 'Critical', 'Improvement', 'Nice-to-have'];
    filterOptions.forEach(f => {
      const btn = this._el('button', 'pp-dock-filter-btn' + (this._dockFilter === f.toLowerCase() || (f === 'All' && this._dockFilter === 'all') ? ' active' : ''));
      btn.textContent = f;
      btn.onclick = () => {
        this._dockFilter = f === 'All' ? 'all' : f;
        this._renderDockExpanded();
      };
      filters.appendChild(btn);
    });
    header.appendChild(filters);

    // Collapse button
    const collapseBtn = this._el('button', 'pp-dock-collapse-btn');
    collapseBtn.textContent = '\u2013'; // en-dash as minimize icon
    collapseBtn.title = 'Collapse';
    collapseBtn.onclick = () => this.collapseDock();
    header.appendChild(collapseBtn);

    panel.appendChild(header);

    // Pin list
    const list = this._el('div', 'pp-dock-panel-list');
    let filtered = this._dockPins;
    if (this._dockFilter !== 'all') {
      filtered = this._dockPins.filter(p => p.severity === this._dockFilter);
    }

    if (!filtered.length) {
      const empty = this._el('div', 'pp-dock-empty');
      empty.textContent = this._dockFilter === 'all' ? 'No issues pinned yet' : `No ${this._dockFilter.toLowerCase()} issues`;
      list.appendChild(empty);
    } else {
      filtered.forEach(pin => list.appendChild(this._renderDockPinItem(pin)));
    }

    panel.appendChild(list);

    // Footer
    const footer = this._el('div', 'pp-dock-panel-footer');

    const toggle = this._el('button', 'pp-dock-toggle on');
    toggle.textContent = 'Inspect ON';
    toggle.onclick = () => this._dockOnPinAction?.('stop-inspecting');
    footer.appendChild(toggle);

    const hint = this._el('span', 'pp-dock-hint');
    const kbd = this._el('kbd');
    kbd.textContent = 'Esc';
    hint.append(kbd, document.createTextNode(' to stop'));
    footer.appendChild(hint);

    panel.appendChild(footer);
    this.dockContainer.appendChild(panel);
  }

  _renderDockPinItem(pin) {
    const row = this._el('div', 'pp-dock-pin' + (pin.status === 'Resolved' ? ' resolved' : ''));

    // Pin number circle
    const num = this._el('div', 'pp-dock-pin-num');
    num.style.background = TYPE_COLORS[pin.feedbackType] || '#95A5A6';
    num.textContent = pin.number;
    num.title = 'Click to locate';
    num.onclick = (e) => {
      e.stopPropagation();
      this._dockOnPinAction?.('locate', pin);
    };
    row.appendChild(num);

    // Body
    const body = this._el('div', 'pp-dock-pin-body');

    // Meta: type + severity
    const meta = this._el('div', 'pp-dock-pin-meta');
    const typeLabel = this._el('span', 'pp-dock-pin-type');
    typeLabel.textContent = `#${pin.number} ${pin.feedbackType}`;
    meta.appendChild(typeLabel);

    if (pin.severity) {
      const sev = this._el('span', 'pp-dock-pin-sev');
      sev.textContent = pin.severity;
      sev.style.background = SEVERITY_COLORS[pin.severity] || '#95A5A6';
      meta.appendChild(sev);
    }
    body.appendChild(meta);

    // Diff
    if (pin.fix && pin.fix.currentValue && pin.fix.expectedValue) {
      const diff = this._el('div', 'pp-dock-pin-diff');
      const old = this._el('span', 'pp-dock-pin-diff-old');
      old.textContent = pin.fix.currentValue;
      const arrow = this._el('span', 'pp-dock-pin-diff-arrow');
      arrow.textContent = '\u2192';
      const nw = this._el('span', 'pp-dock-pin-diff-new');
      nw.textContent = pin.fix.expectedValue;
      diff.append(old, arrow, nw);
      body.appendChild(diff);
    }

    // Fix snippet
    if (pin.fix && pin.fix.cssFix) {
      const fix = this._el('span', 'pp-dock-pin-fix');
      fix.textContent = pin.fix.cssFix;
      body.appendChild(fix);
    }

    row.appendChild(body);

    // Actions
    const actions = this._el('div', 'pp-dock-pin-actions');

    if (pin.fix && pin.fix.cssFix) {
      const copyBtn = this._el('button', 'pp-dock-copy-btn');
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(pin.fix.cssFix).then(() => {
          copyBtn.textContent = '\u2713';
          this._showToast('Copied to clipboard');
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
        });
      };
      actions.appendChild(copyBtn);
    }

    if (pin.status === 'Pending') {
      const resolveBtn = this._el('button', 'pp-dock-resolve-btn');
      resolveBtn.textContent = '\u2713';
      resolveBtn.title = 'Resolve';
      resolveBtn.onclick = (e) => {
        e.stopPropagation();
        this._dockOnPinAction?.('resolve', pin);
      };
      actions.appendChild(resolveBtn);
    }

    row.appendChild(actions);
    return row;
  }

  get isDockVisible() {
    return this.dockContainer.classList.contains('visible');
  }

  get isDockExpanded() {
    return this._dockExpanded;
  }

  destroy() {
    this.host.remove();
  }
}

// Make available to content script
window.__pixelPinOverlay = new PixelPinOverlay();
