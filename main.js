var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => RangeCalendarPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var VIEW_TYPE_CALENDAR = "custom-range-calendar-view";
var CALENDAR_FOLDER = "calendar";
var GOALS_FOLDER = "calendar/goals";
var RangeCalendarPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.registerView(
      VIEW_TYPE_CALENDAR,
      (leaf) => new CalendarView(leaf, this)
    );
    this.addRibbonIcon("calendar", "Open Custom Calendar", () => {
      this.activateView();
    });
    this.app.workspace.onLayoutReady(async () => {
      await this.ensureFolders();
      await this.initView();
    });
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR);
  }
  async initView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
  async ensureFolders() {
    try {
      if (!this.app.vault.getAbstractFileByPath(CALENDAR_FOLDER)) {
        await this.app.vault.createFolder(CALENDAR_FOLDER);
      }
      if (!this.app.vault.getAbstractFileByPath(GOALS_FOLDER)) {
        await this.app.vault.createFolder(GOALS_FOLDER);
      }
    } catch (e) {
    }
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
      }
    }
    if (leaf) workspace.revealLeaf(leaf);
  }
};
var CalendarView = class extends import_obsidian.ItemView {
  plugin;
  currentDate = /* @__PURE__ */ new Date();
  isSelecting = false;
  dragStartDate = null;
  dragCurrentDate = null;
  cellMap = /* @__PURE__ */ new Map();
  dateToNotesMap = /* @__PURE__ */ new Map();
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_CALENDAR;
  }
  getDisplayText() {
    return "CALENDAR";
  }
  getIcon() {
    return "calendar";
  }
  async onOpen() {
    this.registerEvent(this.app.vault.on("create", () => this.render()));
    this.registerEvent(this.app.vault.on("delete", () => this.render()));
    this.registerEvent(this.app.vault.on("rename", () => this.render()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.render()));
    this.registerDomEvent(window, "mouseup", () => {
      if (this.isSelecting && this.dragStartDate && this.dragCurrentDate) {
        const start = this.dragStartDate < this.dragCurrentDate ? this.dragStartDate : this.dragCurrentDate;
        const end = this.dragStartDate < this.dragCurrentDate ? this.dragCurrentDate : this.dragStartDate;
        this.createRangeNote(start, end);
      }
      this.isSelecting = false;
      this.dragStartDate = null;
      this.dragCurrentDate = null;
      this.syncAllConnections();
    });
    this.render();
  }
  render() {
    const container = this.contentEl;
    container.empty();
    container.addClass("calendar-view-container");
    this.cellMap.clear();
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const header = container.createDiv({ cls: "calendar-header" });
    const title = header.createDiv({ cls: "calendar-title" });
    title.innerHTML = `${monthNames[month]} <span>${year}</span>`;
    const controls = header.createDiv({ cls: "calendar-controls" });
    const prevBtn = controls.createEl("button", { text: "<", cls: "calendar-btn" });
    const todayBtn = controls.createEl("button", { text: "TODAY", cls: "calendar-btn" });
    const nextBtn = controls.createEl("button", { text: ">", cls: "calendar-btn" });
    prevBtn.onclick = () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    };
    todayBtn.onclick = () => {
      this.currentDate = /* @__PURE__ */ new Date();
      this.render();
    };
    nextBtn.onclick = () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    };
    const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const weekdaysEl = container.createDiv({ cls: "calendar-weekdays" });
    weekdays.forEach((d) => weekdaysEl.createDiv({ text: d }));
    const grid = container.createDiv({ cls: "calendar-grid" });
    this.loadNotesData();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const prevLastDay = new Date(year, month, 0).getDate();
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < 42; i++) {
      const cell = grid.createDiv({ cls: "calendar-cell" });
      const inner = cell.createDiv({ cls: "day-inner" });
      const colIndex = i % 7;
      let cellDateStr = "";
      if (i < firstDayIndex) {
        const d = prevLastDay - firstDayIndex + i + 1;
        inner.setText(d.toString());
        cell.addClass("other-month");
        cellDateStr = this.formatDate(new Date(year, month - 1, d));
      } else if (i < firstDayIndex + totalDays) {
        const d = i - firstDayIndex + 1;
        inner.setText(d.toString());
        cellDateStr = this.formatDate(new Date(year, month, d));
        if (cellDateStr === this.formatDate(/* @__PURE__ */ new Date())) cell.addClass("today");
      } else {
        const d = i - (firstDayIndex + totalDays) + 1;
        inner.setText(d.toString());
        cell.addClass("other-month");
        cellDateStr = this.formatDate(new Date(year, month + 1, d));
      }
      this.cellMap.set(cellDateStr, { cell, inner, col: colIndex, dateStr: cellDateStr });
      const notes = this.dateToNotesMap.get(cellDateStr);
      if (notes && notes.length > 0) {
        inner.style.background = this.getHorizontalSplitGradient(notes.map((n) => n.color));
        inner.createDiv({ cls: "calendar-day-dot" });
      }
      cell.onmousedown = (e) => {
        if (e.button !== 0) return;
        this.isSelecting = true;
        this.dragStartDate = cellDateStr;
        this.dragCurrentDate = cellDateStr;
        this.syncAllConnections();
      };
      cell.onmouseenter = () => {
        if (this.isSelecting && this.dragCurrentDate !== cellDateStr) {
          this.dragCurrentDate = cellDateStr;
          requestAnimationFrame(() => this.syncAllConnections());
        }
      };
      cell.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentNotes = this.dateToNotesMap.get(cellDateStr);
        if (!currentNotes || currentNotes.length === 0) return;
        let targetNote = currentNotes[0];
        if (currentNotes.length > 1) {
          const rect = inner.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const ratio = Math.max(0, Math.min(1, relativeY / rect.height));
          const index = Math.floor(ratio * currentNotes.length);
          targetNote = currentNotes[Math.min(index, currentNotes.length - 1)];
        }
        this.openContextMenu(e, targetNote, currentNotes);
      };
    }
    this.syncAllConnections();
    this.renderGoalsSection(container);
  }
  renderGoalsSection(container) {
    const section = container.createDiv({ cls: "calendar-goals-section" });
    const header = section.createDiv({ cls: "calendar-goals-header" });
    header.createDiv({ text: "GOALS", cls: "calendar-goals-title" });
    const goals = this.loadGoals();
    if (goals.length > 0) {
      const addBtn = header.createEl("button", { text: "+ ADD GOAL", cls: "calendar-add-goal-btn" });
      addBtn.onclick = () => {
        new GoalModal(this.app, this.plugin, () => this.render()).open();
      };
      const list = section.createDiv({ cls: "calendar-goals-list" });
      goals.forEach((goal, index) => {
        const item = list.createDiv({ cls: "calendar-goal-item" });
        const numEl = item.createDiv({ cls: "calendar-goal-number" });
        numEl.setText(`#${index + 1}`);
        const infoEl = item.createDiv({ cls: "calendar-goal-info" });
        infoEl.createDiv({ text: goal.title, cls: "calendar-goal-title" });
        const daysText = goal.diffDays === 0 ? "TODAY" : goal.diffDays > 0 ? `IN ${goal.diffDays} DAYS (${goal.targetDate})` : `${Math.abs(goal.diffDays)} DAYS AGO (${goal.targetDate})`;
        infoEl.createDiv({ text: daysText, cls: "calendar-goal-meta" });
        item.onclick = async () => {
          await this.app.workspace.getLeaf(false).openFile(goal.file);
        };
        const delBtn = item.createEl("button", { cls: "calendar-goal-delete-btn" });
        delBtn.setText("\u2715");
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          await this.app.vault.trash(goal.file, true);
        };
      });
    } else {
      const emptyContainer = section.createDiv({ cls: "calendar-goals-empty" });
      emptyContainer.createDiv({ text: "NO GOALS SET YET", cls: "calendar-goals-empty-text" });
      const setGoalBtn = emptyContainer.createEl("button", { text: "SET GOAL", cls: "calendar-add-goal-btn" });
      setGoalBtn.onclick = () => {
        new GoalModal(this.app, this.plugin, () => this.render()).open();
      };
    }
  }
  loadGoals() {
    const goals = [];
    const files = this.app.vault.getFiles();
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    files.forEach((file) => {
      if (!file.path.startsWith(`${GOALS_FOLDER}/`)) return;
      const cache = this.app.metadataCache.getFileCache(file);
      const targetDate = cache?.frontmatter?.target_date;
      if (!targetDate) return;
      const title = cache?.frontmatter?.title || file.basename;
      const target = new Date(targetDate);
      target.setHours(0, 0, 0, 0);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1e3 * 60 * 60 * 24));
      goals.push({
        file,
        title,
        targetDate,
        content: "",
        diffDays
      });
    });
    goals.sort((a, b) => Math.abs(a.diffDays) - Math.abs(b.diffDays));
    return goals;
  }
  openContextMenu(e, targetNote, allNotes) {
    const menu = new import_obsidian.Menu();
    menu.addItem((item) => {
      item.setTitle(targetNote.name).setDisabled(true);
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle("OPEN").setIcon("go-to-file").onClick(async () => {
        await this.app.workspace.getLeaf(false).openFile(targetNote.file);
      });
    });
    menu.addItem((item) => {
      item.setTitle("CHANGE COLOR").setIcon("palette").onClick(() => {
        new ColorPickerModal(this.app, targetNote, () => this.render()).open();
      });
    });
    menu.addItem((item) => {
      item.setTitle("ADD DAY FORWARD (+1)").setIcon("calendar-plus").onClick(async () => {
        await this.extendDate(targetNote, 1);
      });
    });
    menu.addItem((item) => {
      item.setTitle("CHANGE DATE RANGE").setIcon("calendar-range").onClick(() => {
        new ChangeDateRangeModal(this.app, targetNote, (s, e2) => this.updateDateRange(targetNote, s, e2)).open();
      });
    });
    menu.addItem((item) => {
      item.setTitle("DELETE").setIcon("trash").onClick(async () => {
        await this.app.vault.trash(targetNote.file, true);
      });
      item.dom?.addClass("calendar-menu-delete");
    });
    if (allNotes.length > 1) {
      menu.addSeparator();
      allNotes.forEach((n) => {
        if (n.name !== targetNote.name) {
          menu.addItem((subItem) => {
            subItem.setTitle(`SELECT: ${n.name}`).onClick(() => {
              this.openContextMenu(e, n, allNotes);
            });
          });
        }
      });
    }
    menu.showAtPosition({ x: e.clientX, y: e.clientY });
  }
  async extendDate(note, days) {
    const end = new Date(note.endDate);
    end.setDate(end.getDate() + days);
    const newEndStr = this.formatDate(end);
    await this.updateDateRange(note, note.startDate, newEndStr);
  }
  async updateDateRange(note, newStart, newEnd) {
    const s = newStart < newEnd ? newStart : newEnd;
    const e = newStart < newEnd ? newEnd : newStart;
    const baseTitle = s === e ? s : `${s} - ${e}`;
    const suffix = note.suffix ? ` ${note.suffix}` : "";
    let newName = `${baseTitle}${suffix}.md`;
    let newPath = `${CALENDAR_FOLDER}/${newName}`;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(newPath) && newPath !== note.file.path) {
      newName = `${baseTitle} (${counter}).md`;
      newPath = `${CALENDAR_FOLDER}/${newName}`;
      counter++;
    }
    await this.app.fileManager.renameFile(note.file, newPath);
    this.render();
  }
  syncAllConnections() {
    const isDragActive = this.isSelecting && this.dragStartDate && this.dragCurrentDate;
    const dragStart = isDragActive ? this.dragStartDate < this.dragCurrentDate ? this.dragStartDate : this.dragCurrentDate : null;
    const dragEnd = isDragActive ? this.dragStartDate < this.dragCurrentDate ? this.dragCurrentDate : this.dragStartDate : null;
    this.cellMap.forEach((data, dateStr) => {
      const inDrag = !!(dragStart && dragEnd && dateStr >= dragStart && dateStr <= dragEnd);
      if (inDrag) {
        data.cell.addClass("in-drag-range");
      } else {
        data.cell.removeClass("in-drag-range");
      }
      const nextDateStr = this.getNextDayString(dateStr);
      const prevDateStr = this.getPrevDayString(dateStr);
      const nextCell = this.cellMap.get(nextDateStr);
      const prevCell = this.cellMap.get(prevDateStr);
      let connectRight = false;
      if (data.col < 6 && nextCell) {
        if (inDrag && nextDateStr <= dragEnd) {
          connectRight = true;
        } else if (!inDrag) {
          connectRight = this.haveSharedNote(dateStr, nextDateStr);
        }
      }
      let connectLeft = false;
      if (data.col > 0 && prevCell) {
        if (inDrag && prevDateStr >= dragStart) {
          connectLeft = true;
        } else if (!inDrag) {
          connectLeft = this.haveSharedNote(dateStr, prevDateStr);
        }
      }
      if (connectRight) data.cell.addClass("connect-right");
      else data.cell.removeClass("connect-right");
      if (connectLeft) data.cell.addClass("connect-left");
      else data.cell.removeClass("connect-left");
    });
  }
  haveSharedNote(d1, d2) {
    const notes1 = this.dateToNotesMap.get(d1);
    const notes2 = this.dateToNotesMap.get(d2);
    if (!notes1 || !notes2) return false;
    const set2 = new Set(notes2.map((n) => n.name));
    return notes1.some((n) => set2.has(n.name));
  }
  async createRangeNote(start, end) {
    await this.plugin.ensureFolders();
    const baseTitle = start === end ? start : `${start} - ${end}`;
    let fileName = `${baseTitle}.md`;
    let fullPath = `${CALENDAR_FOLDER}/${fileName}`;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(fullPath)) {
      fileName = `${baseTitle} (${counter}).md`;
      fullPath = `${CALENDAR_FOLDER}/${fileName}`;
      counter++;
    }
    const defaultColor = this.generateColor(fileName);
    const initialContent = `---
color: "${defaultColor}"
---
# ${counter > 1 ? `${baseTitle} #${counter}` : baseTitle}

`;
    const file = await this.app.vault.create(fullPath, initialContent);
    if (file instanceof import_obsidian.TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
    }
  }
  loadNotesData() {
    this.dateToNotesMap.clear();
    const files = this.app.vault.getFiles();
    files.forEach((file) => {
      if (!file.path.startsWith(`${CALENDAR_FOLDER}/`) || file.path.startsWith(`${GOALS_FOLDER}/`)) return;
      const baseName = file.basename;
      const rangeMatch = baseName.match(/^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})(\s*\(\d+\))?/);
      const singleMatch = baseName.match(/^(\d{4}-\d{2}-\d{2})(\s*\(\d+\))?/);
      const cache = this.app.metadataCache.getFileCache(file);
      const customColor = cache?.frontmatter?.color;
      const color = customColor || this.generateColor(baseName);
      if (rangeMatch) {
        const start = rangeMatch[1];
        const end = rangeMatch[2];
        const suffix = rangeMatch[3] ? rangeMatch[3].trim() : void 0;
        const noteInfo = { name: baseName, color, file, startDate: start, endDate: end, suffix };
        const dates = this.getDatesInRange(start, end);
        dates.forEach((d) => this.addNoteToMap(d, noteInfo));
      } else if (singleMatch) {
        const start = singleMatch[1];
        const suffix = singleMatch[2] ? singleMatch[2].trim() : void 0;
        const noteInfo = { name: baseName, color, file, startDate: start, endDate: start, suffix };
        this.addNoteToMap(start, noteInfo);
      }
    });
  }
  addNoteToMap(date, noteInfo) {
    if (!this.dateToNotesMap.has(date)) {
      this.dateToNotesMap.set(date, []);
    }
    this.dateToNotesMap.get(date).push(noteInfo);
  }
  getDatesInRange(startStr, endStr) {
    const dates = [];
    let curr = new Date(startStr);
    const end = new Date(endStr);
    while (curr <= end) {
      dates.push(this.formatDate(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }
  getHorizontalSplitGradient(colors) {
    if (colors.length === 1) return colors[0];
    const step = 100 / colors.length;
    const parts = colors.map((col, idx) => {
      const from = (idx * step).toFixed(2);
      const to = ((idx + 1) * step).toFixed(2);
      return `${col} ${from}% ${to}%`;
    });
    return `linear-gradient(to bottom, ${parts.join(", ")})`;
  }
  generateColor(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash = Math.abs(hash);
    const goldenRatio = 0.618033988749895;
    const hue = Math.floor(hash * goldenRatio % 1 * 360);
    const saturation = 60 + hash % 20;
    const lightness = 30 + (hash >> 4) % 8;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  getNextDayString(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return this.formatDate(d);
  }
  getPrevDayString(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return this.formatDate(d);
  }
};
var GoalModal = class extends import_obsidian.Modal {
  plugin;
  onSave;
  constructor(app, plugin, onSave) {
    super(app);
    this.plugin = plugin;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("calendar-modal");
    contentEl.createEl("h3", { text: "SET A NEW GOAL", cls: "calendar-modal-title" });
    const rowTitle = contentEl.createDiv({ cls: "calendar-modal-row" });
    rowTitle.createEl("label", { text: "TITLE:" });
    const titleInput = rowTitle.createEl("input", { type: "text", placeholder: "GOAL NAME..." });
    const rowDate = contentEl.createDiv({ cls: "calendar-modal-row" });
    rowDate.createEl("label", { text: "DATE:" });
    const dateInput = rowDate.createEl("input", { type: "date" });
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    dateInput.value = todayStr;
    const rowContent = contentEl.createDiv({ cls: "calendar-modal-row" });
    rowContent.createEl("label", { text: "CONTENT:" });
    const contentInput = rowContent.createEl("textarea", { placeholder: "DESCRIPTION / DETAILS..." });
    const btnRow = contentEl.createDiv({ cls: "calendar-modal-buttons" });
    const cancelBtn = btnRow.createEl("button", { text: "CANCEL" });
    cancelBtn.onclick = () => this.close();
    const saveBtn = btnRow.createEl("button", { text: "CREATE GOAL", cls: "mod-cta" });
    saveBtn.onclick = async () => {
      const rawTitle = titleInput.value.trim() || "UNTITLED GOAL";
      const targetDate = dateInput.value;
      const details = contentInput.value.trim();
      if (!targetDate) return;
      await this.plugin.ensureFolders();
      const sanitizedTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "-");
      let fileName = `GOAL - ${sanitizedTitle}.md`;
      let fullPath = `${GOALS_FOLDER}/${fileName}`;
      let counter = 1;
      while (this.app.vault.getAbstractFileByPath(fullPath)) {
        fileName = `GOAL - ${sanitizedTitle} (${counter}).md`;
        fullPath = `${GOALS_FOLDER}/${fileName}`;
        counter++;
      }
      const fileContent = `---
target_date: "${targetDate}"
title: "${rawTitle}"
---
# ${rawTitle}

**Target Date:** ${targetDate}

${details}
`;
      const createdFile = await this.app.vault.create(fullPath, fileContent);
      if (createdFile instanceof import_obsidian.TFile) {
        await this.app.workspace.getLeaf(false).openFile(createdFile);
      }
      this.onSave();
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ColorPickerModal = class extends import_obsidian.Modal {
  note;
  onUpdate;
  constructor(app, note, onUpdate) {
    super(app);
    this.note = note;
    this.onUpdate = onUpdate;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("calendar-modal");
    contentEl.createEl("h3", { text: `COLOR: ${this.note.name}`, cls: "calendar-modal-title" });
    const palette = [
      "#2d5a27",
      "#1e3f66",
      "#7c3f1d",
      "#522b5b",
      "#1f5358",
      "#632626",
      "#3f4079",
      "#665c1e",
      "#235941",
      "#6b3046",
      "#2b4754",
      "#594a2b"
    ];
    const paletteEl = contentEl.createDiv({ cls: "calendar-color-palette" });
    palette.forEach((hex) => {
      const swatch = paletteEl.createDiv({ cls: "calendar-color-swatch" });
      swatch.style.backgroundColor = hex;
      swatch.onclick = async () => {
        await this.setColor(hex);
        this.close();
      };
    });
    const customRow = contentEl.createDiv({ cls: "calendar-modal-row" });
    customRow.createEl("label", { text: "CUSTOM:" });
    const colorInput = customRow.createEl("input", { type: "color" });
    colorInput.value = "#2d5a27";
    const btnRow = contentEl.createDiv({ cls: "calendar-modal-buttons" });
    const saveBtn = btnRow.createEl("button", { text: "APPLY", cls: "mod-cta" });
    saveBtn.onclick = async () => {
      await this.setColor(colorInput.value);
      this.close();
    };
  }
  async setColor(color) {
    await this.app.fileManager.processFrontMatter(this.note.file, (fm) => {
      fm.color = color;
    });
    this.onUpdate();
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ChangeDateRangeModal = class extends import_obsidian.Modal {
  note;
  onSave;
  constructor(app, note, onSave) {
    super(app);
    this.note = note;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("calendar-modal");
    contentEl.createEl("h3", { text: `CHANGE DATES: ${this.note.name}`, cls: "calendar-modal-title" });
    const row1 = contentEl.createDiv({ cls: "calendar-modal-row" });
    row1.createEl("label", { text: "START:" });
    const startInput = row1.createEl("input", { type: "date" });
    startInput.value = this.note.startDate;
    const row2 = contentEl.createDiv({ cls: "calendar-modal-row" });
    row2.createEl("label", { text: "END:" });
    const endInput = row2.createEl("input", { type: "date" });
    endInput.value = this.note.endDate;
    const btnRow = contentEl.createDiv({ cls: "calendar-modal-buttons" });
    const cancelBtn = btnRow.createEl("button", { text: "CANCEL" });
    cancelBtn.onclick = () => this.close();
    const saveBtn = btnRow.createEl("button", { text: "SAVE", cls: "mod-cta" });
    saveBtn.onclick = () => {
      if (startInput.value && endInput.value) {
        this.onSave(startInput.value, endInput.value);
        this.close();
      }
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};
