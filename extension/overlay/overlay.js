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

    this.shadow.append(this.highlightEl, this.formContainer, this.markersContainer, this.popoverContainer);

    this._onFormSubmit = null;
    this._onPinAction = null;
    this._activePopoverId = null;
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
      .pp-marker.resolved { opacity: 0.5; }

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

    function updateSubmitState() {
      submitBtn.disabled = !(selectedType && selectedAssignee);
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
      if (!selectedType || !selectedAssignee) return;
      this._onFormSubmit?.({
        feedbackType: selectedType,
        assignee: selectedAssignee,
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

    const pop = this._el('div', 'pp-popover');

    // Header
    const header = this._el('div', 'pp-popover-header');
    const badge = this._el('span', 'pp-popover-badge');
    const dot = this._el('span', 'pp-popover-badge-dot');
    dot.style.background = TYPE_COLORS[pin.feedbackType] || '#95A5A6';
    const typeLabel = document.createTextNode(`#${pin.number} ${pin.feedbackType}`);
    badge.append(dot, typeLabel);

    const statusBadge = this._el('span', 'pp-popover-status ' +
      (pin.status === 'Resolved' ? 'pp-status-resolved' : 'pp-status-pending'));
    statusBadge.textContent = pin.status;

    header.append(badge, statusBadge);
    pop.appendChild(header);

    // Assignee
    if (pin.assignee) {
      const assignee = this._el('div', 'pp-popover-assignee');
      assignee.innerHTML = `Assigned to <strong>${pin.assignee}</strong>`;
      pop.appendChild(assignee);
    }

    // Note
    if (pin.note) {
      const note = this._el('div', 'pp-popover-note');
      note.textContent = pin.note;
      pop.appendChild(note);
    }

    // CSS properties
    if (pin.cssProperties && Object.keys(pin.cssProperties).length) {
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

    if (top + 250 > window.innerHeight) top = Math.max(8, markerRect.top - 250 - 8);
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

  destroy() {
    this.host.remove();
  }
}

// Make available to content script
window.__pixelPinOverlay = new PixelPinOverlay();
