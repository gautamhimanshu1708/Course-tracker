/* ════════════════════════════════════════════════════════════════
   Study Tracker — script.js
   Data Structures: Array, Tree, Stack, HashMap (Object)
   ════════════════════════════════════════════════════════════════ */

// ─── DATA STRUCTURE: Stack (for Undo) ───
class UndoStack {
    constructor() { this.items = []; }
    push(snapshot) { this.items.push(snapshot); if (this.items.length > 50) this.items.shift(); }
    pop() { return this.items.length ? this.items.pop() : null; }
    isEmpty() { return this.items.length === 0; }
    clear() { this.items = []; }
}

// ─── DATA STRUCTURE: Tree Node (Chapter = parent, Topics = children) ───
class ChapterNode {
    constructor(id, title, priority = 'medium') {
        this.id = id;
        this.title = title;
        this.priority = priority;
        this.children = []; // Array of TopicNode (tree children)
    }
}

class TopicNode {
    constructor(id, title, completed = false) {
        this.id = id;
        this.title = title;
        this.completed = completed;
    }
}

// ─── APP STATE ───
const State = {
    chapters: [],        // DATA STRUCTURE: Array — ordered list of chapter IDs
    chapterMap: {},      // DATA STRUCTURE: HashMap — O(1) lookup by ID
    undoStack: new UndoStack(),
    currentFilter: 'all',
    searchQuery: '',
    editingChapterId: null,
};

// ─── HELPERS ───
const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function snapshot() {
    State.undoStack.push(JSON.stringify({ chapters: State.chapters, chapterMap: State.chapterMap }));
    DOM.undoBtn.disabled = false;
}

function save() {
    localStorage.setItem('st_data', JSON.stringify({ chapters: State.chapters, chapterMap: State.chapterMap }));
}

function load() {
    try {
        const d = JSON.parse(localStorage.getItem('st_data'));
        if (d) { State.chapters = d.chapters || []; State.chapterMap = d.chapterMap || {}; }
    } catch(e) { console.error(e); }
}

// ─── DOM REFS ───
const DOM = {};
function cacheDom() {
    ['chapter-list','empty-state','search-input','undo-btn','add-chapter-btn',
     'modal-overlay','modal-heading','modal-form','modal-input-name','modal-input-priority','modal-cancel',
     'overall-pct','progress-ring-circle','dash-chapter-bars',
     'stat-total-chapters','stat-completed-chapters','stat-remaining-chapters',
     'stat-total-topics','stat-completed-topics','stat-remaining-topics',
     'workspace-title','workspace-subtitle',
     'nav-count-all','nav-count-high','nav-count-medium','nav-count-low','nav-count-completed'
    ].forEach(id => { DOM[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id); });
    DOM.undoBtn = document.getElementById('undo-btn');
    DOM.navItems = document.querySelectorAll('.nav-item');
}

// ─── CHAPTER STATS ───
function chapterStats(ch) {
    const total = ch.children.length;
    const done = ch.children.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, pct };
}

function isChapterComplete(ch) {
    return ch.children.length > 0 && ch.children.every(t => t.completed);
}

// ─── FILTERING ───
function getVisibleChapters() {
    let ids = State.chapters;
    const f = State.currentFilter;
    if (f === 'high' || f === 'medium' || f === 'low') {
        ids = ids.filter(id => State.chapterMap[id] && State.chapterMap[id].priority === f);
    } else if (f === 'completed') {
        ids = ids.filter(id => { const ch = State.chapterMap[id]; return ch && isChapterComplete(ch); });
    }
    const q = State.searchQuery.toLowerCase();
    if (q) {
        ids = ids.filter(id => {
            const ch = State.chapterMap[id]; if (!ch) return false;
            if (ch.title.toLowerCase().includes(q)) return true;
            return ch.children.some(t => t.title.toLowerCase().includes(q));
        });
    }
    return ids;
}

// ─── Expanded state helpers ───
function getExpandedIds() {
    return Array.from(document.querySelectorAll('.chapter-card.expanded')).map(el => el.dataset.id);
}
function restoreExpanded(ids) {
    ids.forEach(id => {
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) card.classList.add('expanded');
    });
}

// ─── RENDER CHAPTERS ───
function renderChapters() {
    const expandedIds = getExpandedIds();
    const list = DOM.chapterList;
    list.innerHTML = '';
    const visible = getVisibleChapters();

    if (visible.length === 0) {
        DOM.emptyState.classList.remove('hidden');
        updateDashboard();
        return;
    }
    DOM.emptyState.classList.add('hidden');

    visible.forEach((chId, idx) => {
        const ch = State.chapterMap[chId];
        if (!ch) return;
        const s = chapterStats(ch);
        const li = document.createElement('li');
        li.className = 'chapter-card';
        li.dataset.id = chId;
        li.setAttribute('draggable', 'true');

        li.innerHTML = `
<div class="ch-header">
  <span class="ch-drag" title="Drag to reorder"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg></span>
  <span class="ch-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></span>
  <span class="ch-name">${esc(ch.title)}</span>
  <span class="priority-badge ${ch.priority}">${ch.priority}</span>
  <span class="ch-pct">${s.pct}%</span>
  <span class="ch-count">${s.done}/${s.total}</span>
  <span class="ch-actions">
    <button class="ch-icon-btn" data-act="edit" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
    <button class="ch-icon-btn danger" data-act="delete" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
    <button class="ch-icon-btn" data-act="up" title="Move Up"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg></button>
    <button class="ch-icon-btn" data-act="down" title="Move Down"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>
  </span>
</div>
<div class="ch-body"><div class="ch-body-inner">
  <div class="ch-progress-bar"><div class="ch-progress-fill" style="width:${s.pct}%"></div></div>
  <ul class="topic-list">${ch.children.map(t => `
    <li class="topic-item${t.completed ? ' completed' : ''}" data-tid="${t.id}">
      <div class="topic-checkbox">${t.completed ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      <span class="topic-name">${esc(t.title)}</span>
      <span class="topic-actions">
        <button class="ch-icon-btn" data-tact="tedit" title="Edit topic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="ch-icon-btn danger" data-tact="tdelete" title="Delete topic"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </span>
    </li>`).join('')}
  </ul>
  <form class="add-topic-row" data-chid="${chId}">
    <input type="text" placeholder="Add new topic…" required autocomplete="off">
    <button type="submit">Add</button>
  </form>
</div></div>`;
        list.appendChild(li);
    });

    bindChapterEvents();
    restoreExpanded(expandedIds);
    updateDashboard();
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ─── CHAPTER EVENTS ───
function bindChapterEvents() {
    // Expand / Collapse
    document.querySelectorAll('.ch-header').forEach(hdr => {
        hdr.addEventListener('click', e => {
            if (e.target.closest('.ch-actions') || e.target.closest('.ch-drag')) return;
            hdr.closest('.chapter-card').classList.toggle('expanded');
        });
    });

    // Chapter action buttons
    document.querySelectorAll('.ch-actions .ch-icon-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const card = btn.closest('.chapter-card');
            const id = card.dataset.id;
            const act = btn.dataset.act;
            if (act === 'edit') editChapter(id);
            else if (act === 'delete') deleteChapter(id);
            else if (act === 'up') moveChapter(id, -1);
            else if (act === 'down') moveChapter(id, 1);
        });
    });

    // Topic checkbox toggle
    document.querySelectorAll('.topic-checkbox').forEach(cb => {
        cb.addEventListener('click', e => {
            const item = cb.closest('.topic-item');
            const card = cb.closest('.chapter-card');
            const ch = State.chapterMap[card.dataset.id];
            const topic = ch.children.find(t => t.id === item.dataset.tid);
            if (topic) {
                snapshot();
                topic.completed = !topic.completed;
                save();
                renderChapters();
            }
        });
    });

    // Topic edit/delete
    document.querySelectorAll('[data-tact]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const item = btn.closest('.topic-item');
            const card = btn.closest('.chapter-card');
            const ch = State.chapterMap[card.dataset.id];
            const tid = item.dataset.tid;
            if (btn.dataset.tact === 'tdelete') {
                snapshot();
                ch.children = ch.children.filter(t => t.id !== tid);
                save(); renderChapters();
            } else if (btn.dataset.tact === 'tedit') {
                const topic = ch.children.find(t => t.id === tid);
                if (!topic) return;
                const newName = prompt('Edit topic name:', topic.title);
                if (newName !== null && newName.trim()) {
                    snapshot(); topic.title = newName.trim(); save(); renderChapters();
                }
            }
        });
    });

    // Add topic form
    document.querySelectorAll('.add-topic-row').forEach(form => {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const input = form.querySelector('input');
            const val = input.value.trim();
            if (!val) return;
            const chId = form.dataset.chid;
            const ch = State.chapterMap[chId];
            if (!ch) return;
            snapshot();
            ch.children.push(new TopicNode(uid(), val));
            save();
            renderChapters();
        });
    });

    // Drag and drop
    document.querySelectorAll('.chapter-card').forEach(card => {
        card.addEventListener('dragstart', e => {
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.dataset.id);
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('dragover', e => {
            e.preventDefault();
            card.classList.add('drag-over');
        });
        card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
        card.addEventListener('drop', e => {
            e.preventDefault();
            card.classList.remove('drag-over');
            const dragId = e.dataTransfer.getData('text/plain');
            const dropId = card.dataset.id;
            if (dragId === dropId) return;
            snapshot();
            const fromIdx = State.chapters.indexOf(dragId);
            const toIdx = State.chapters.indexOf(dropId);
            State.chapters.splice(fromIdx, 1);
            State.chapters.splice(toIdx, 0, dragId);
            save(); renderChapters();
        });
    });
}

// ─── CHAPTER CRUD ───
function addChapter(title, priority) {
    snapshot();
    const id = uid();
    State.chapterMap[id] = new ChapterNode(id, title, priority);
    State.chapters.push(id);
    save(); renderChapters();
}

function editChapter(id) {
    State.editingChapterId = id;
    const ch = State.chapterMap[id];
    DOM.modalHeading.textContent = 'Edit Chapter';
    DOM.modalInputName.value = ch.title;
    DOM.modalInputPriority.value = ch.priority;
    DOM.modalOverlay.classList.remove('hidden');
    DOM.modalInputName.focus();
}

function deleteChapter(id) {
    snapshot();
    delete State.chapterMap[id];
    State.chapters = State.chapters.filter(c => c !== id);
    save(); renderChapters();
}

function moveChapter(id, dir) {
    const idx = State.chapters.indexOf(id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= State.chapters.length) return;
    snapshot();
    [State.chapters[idx], State.chapters[newIdx]] = [State.chapters[newIdx], State.chapters[idx]];
    save(); renderChapters();
}

// ─── DASHBOARD ───
function updateDashboard() {
    let totalTopics = 0, doneTopics = 0, completedChapters = 0;
    const allChapters = State.chapters.map(id => State.chapterMap[id]).filter(Boolean);
    const totalChapters = allChapters.length;

    allChapters.forEach(ch => {
        const s = chapterStats(ch);
        totalTopics += s.total;
        doneTopics += s.done;
        if (isChapterComplete(ch)) completedChapters++;
    });

    const overallPct = totalTopics === 0 ? 0 : Math.round((doneTopics / totalTopics) * 100);

    // Progress ring
    DOM.overallPct.textContent = overallPct + '%';
    const circumference = 2 * Math.PI * 52; // r=52
    DOM.progressRingCircle.style.strokeDashoffset = circumference - (circumference * overallPct / 100);

    // Stats
    DOM.statTotalChapters.textContent = totalChapters;
    DOM.statCompletedChapters.textContent = completedChapters;
    DOM.statRemainingChapters.textContent = totalChapters - completedChapters;
    DOM.statTotalTopics.textContent = totalTopics;
    DOM.statCompletedTopics.textContent = doneTopics;
    DOM.statRemainingTopics.textContent = totalTopics - doneTopics;

    // Chapter progress bars
    DOM.dashChapterBars.innerHTML = '';
    allChapters.forEach(ch => {
        const s = chapterStats(ch);
        const div = document.createElement('div');
        div.className = 'dash-ch-bar';
        div.innerHTML = `<div class="bar-label"><span>${esc(ch.title)}</span><span>${s.done}/${s.total}</span></div>
            <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${s.pct}%"></div></div>`;
        DOM.dashChapterBars.appendChild(div);
    });



    // Nav counts
    DOM.navCountAll.textContent = totalChapters;
    DOM.navCountHigh.textContent = allChapters.filter(c => c.priority === 'high').length;
    DOM.navCountMedium.textContent = allChapters.filter(c => c.priority === 'medium').length;
    DOM.navCountLow.textContent = allChapters.filter(c => c.priority === 'low').length;
    DOM.navCountCompleted.textContent = completedChapters;
}

// ─── MODAL ───
function openAddModal() {
    State.editingChapterId = null;
    DOM.modalHeading.textContent = 'Add Chapter';
    DOM.modalInputName.value = '';
    DOM.modalInputPriority.value = 'medium';
    DOM.modalOverlay.classList.remove('hidden');
    setTimeout(() => DOM.modalInputName.focus(), 50);
}

function closeModal() { DOM.modalOverlay.classList.add('hidden'); }

// ─── NAV FILTER ───
function setFilter(filter) {
    State.currentFilter = filter;
    DOM.navItems.forEach(n => n.classList.toggle('active', n.dataset.filter === filter));
    const titles = { all: 'Dashboard', chapters: 'All Chapters', high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority', completed: 'Completed' };
    DOM.workspaceTitle.textContent = titles[filter] || 'All Chapters';
    DOM.workspaceSubtitle.textContent = filter === 'all' ? 'Manage your study materials' : `Filtered by ${titles[filter]}`;
    renderChapters();
}

// ─── INIT ───
function init() {
    cacheDom();
    load();

    DOM.addChapterBtn = document.getElementById('add-chapter-btn');
    DOM.addChapterBtn.addEventListener('click', openAddModal);
    DOM.modalCancel.addEventListener('click', closeModal);
    DOM.modalOverlay.addEventListener('click', e => { if (e.target === DOM.modalOverlay) closeModal(); });

    DOM.modalForm.addEventListener('submit', e => {
        e.preventDefault();
        const name = DOM.modalInputName.value.trim();
        const priority = DOM.modalInputPriority.value;
        if (!name) return;
        if (State.editingChapterId) {
            snapshot();
            const ch = State.chapterMap[State.editingChapterId];
            ch.title = name; ch.priority = priority;
            save(); renderChapters();
        } else {
            addChapter(name, priority);
        }
        closeModal();
    });

    DOM.undoBtn.addEventListener('click', () => {
        const snap = State.undoStack.pop();
        if (snap) {
            const d = JSON.parse(snap);
            State.chapters = d.chapters; State.chapterMap = d.chapterMap;
            save(); renderChapters();
        }
        DOM.undoBtn.disabled = State.undoStack.isEmpty();
    });

    DOM.searchInput.addEventListener('input', e => { State.searchQuery = e.target.value; renderChapters(); });

    DOM.navItems.forEach(n => n.addEventListener('click', () => setFilter(n.dataset.filter)));

    renderChapters();
}

document.addEventListener('DOMContentLoaded', init);
