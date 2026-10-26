const STORAGE_KEY = 'want-to-eat-list.v1';
const priorityOrder = { high: 0, medium: 1, low: 2 };
const priorityLabels = { high: '很想吃', medium: '想吃', low: '有空再去' };

const grid = document.querySelector('#entries-grid');
const emptyState = document.querySelector('#empty-state');
const dialog = document.querySelector('#entry-dialog');
const form = document.querySelector('#entry-form');
const toast = document.querySelector('#toast');

let entries = loadEntries();
let activeFilter = 'all';
let searchTerm = '';
let sortBy = 'priority';
let editingId = null;
let toastTimeout;

function loadEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    render();
    return true;
  } catch {
    showToast('浏览器无法保存清单，请导出备份后释放一些存储空间。');
    return false;
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekBounds() {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  const day = monday.getDay();
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return [localDateString(monday), localDateString(nextMonday)];
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(date);
}

function dateIcon() {
  return '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="3.4" width="11.2" height="10" rx="1.3"/><path d="M5 2v3M11 2v3M2.5 6.3h11"/></svg>';
}

function locationIcon() {
  return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.7 6.6c0 3.4-4.7 7.1-4.7 7.1S3.3 10 3.3 6.6a4.7 4.7 0 1 1 9.4 0Z"/><circle cx="8" cy="6.5" r="1.5"/></svg>';
}

function sortedEntries(items) {
  const copy = [...items];
  if (sortBy === 'date') {
    return copy.sort((a, b) => (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31') || (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
  }
  if (sortBy === 'recent') return copy.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return copy.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1) || (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31') || (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function entryCard(item) {
  const eaten = Boolean(item.eatenAt);
  const dateText = eaten ? `吃于 ${formatDate(item.eatenAt)}` : item.date ? formatDate(item.date) : '还没安排日期';
  return `
    <article class="entry-card${eaten ? ' is-eaten' : ''}" data-id="${escapeHtml(item.id)}">
      <div class="entry-top">
        <span class="priority-pill priority-${escapeHtml(item.priority)}">${escapeHtml(priorityLabels[item.priority] || priorityLabels.medium)}</span>
        <div class="entry-actions">
          <button class="icon-button edit-entry" type="button" aria-label="编辑 ${escapeHtml(item.name)}" title="编辑">↗</button>
          <button class="icon-button delete-entry" type="button" aria-label="删除 ${escapeHtml(item.name)}" title="删除">×</button>
        </div>
      </div>
      <h3 class="entry-title">${escapeHtml(item.name)}</h3>
      ${item.venue ? `<p class="entry-venue">${locationIcon()}<span>${escapeHtml(item.venue)}</span></p>` : ''}
      ${item.note ? `<p class="entry-note">${escapeHtml(item.note)}</p>` : ''}
      <div class="entry-bottom">
        <span class="entry-date${!eaten && !item.date ? ' is-unscheduled' : ''}">${dateIcon()}<span>${escapeHtml(dateText)}</span></span>
        <button class="done-button toggle-eaten" type="button">${eaten ? '改回待吃' : '吃过啦 ✓'}</button>
      </div>
    </article>`;
}

function render() {
  const pending = entries.filter((item) => !item.eatenAt);
  const eaten = entries.filter((item) => Boolean(item.eatenAt));
  const [weekStart, weekEnd] = weekBounds();
  const thisWeek = pending.filter((item) => item.date && item.date >= weekStart && item.date < weekEnd).length;

  document.querySelector('#stat-pending').textContent = pending.length;
  document.querySelector('#stat-week').textContent = thisWeek;
  document.querySelector('#stat-eaten').textContent = eaten.length;
  document.querySelector('#count-all').textContent = entries.length;
  document.querySelector('#count-pending').textContent = pending.length;
  document.querySelector('#count-eaten').textContent = eaten.length;
  document.querySelector('#heading-count').textContent = entries.length;

  const filtered = entries.filter((item) => {
    if (activeFilter === 'pending' && item.eatenAt) return false;
    if (activeFilter === 'eaten' && !item.eatenAt) return false;
    const searchable = `${item.name} ${item.venue || ''} ${item.note || ''}`.toLocaleLowerCase();
    return searchable.includes(searchTerm.toLocaleLowerCase());
  });
  const visible = sortedEntries(filtered);
  grid.innerHTML = visible.map(entryCard).join('');

  if (visible.length) {
    emptyState.hidden = true;
    grid.hidden = false;
  } else {
    grid.hidden = true;
    emptyState.hidden = false;
    const hasEntries = entries.length > 0;
    document.querySelector('#empty-title').textContent = searchTerm ? '没有找到这件美食' : activeFilter === 'eaten' ? '还没有吃过的记录' : activeFilter === 'pending' && hasEntries ? '待吃清单已经清空' : '清单还空着呢';
    document.querySelector('#empty-copy').textContent = searchTerm ? '换个菜名或店名试试看。' : activeFilter === 'eaten' ? '吃过喜欢的东西后，可以记在这里。' : activeFilter === 'pending' && hasEntries ? '想再加点什么，随时记下来。' : '想到什么好吃的，就把它记下来吧。';
    document.querySelector('#empty-add-button').hidden = searchTerm.length > 0 || activeFilter === 'eaten';
  }
}

function openForm(item = null) {
  editingId = item?.id || null;
  form.reset();
  document.querySelector('#dialog-title').textContent = editingId ? '编辑这件想吃的' : '记下一件想吃的';
  document.querySelector('#dialog-eyebrow').textContent = editingId ? 'MAKE IT JUST RIGHT' : 'A LITTLE NOTE TO YOURSELF';
  document.querySelector('#save-button').innerHTML = editingId ? '保存修改 <span aria-hidden="true">→</span>' : '存进清单 <span aria-hidden="true">→</span>';
  if (item) {
    form.elements.name.value = item.name || '';
    form.elements.venue.value = item.venue || '';
    form.elements.date.value = item.date || '';
    form.elements.priority.value = item.priority || 'medium';
    form.elements.note.value = item.note || '';
  } else {
    form.elements.priority.value = 'medium';
  }
  dialog.showModal();
  requestAnimationFrame(() => form.elements.name.focus());
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.filter === filter;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  render();
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => setFilter(tab.dataset.filter)));
document.querySelectorAll('#add-button, #add-first-button, #empty-add-button').forEach((button) => button.addEventListener('click', () => openForm()));
document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', () => dialog.close()));
document.querySelector('#search-input').addEventListener('input', (event) => { searchTerm = event.target.value.trim(); render(); });
document.querySelector('#sort-select').addEventListener('change', (event) => { sortBy = event.target.value; render(); });

form.addEventListener('submit', (event) => {
  event.preventDefault();
  form.elements.name.setCustomValidity(form.elements.name.value.trim() ? '' : '请填写想吃的内容。');
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const existing = entries.find((item) => item.id === editingId);
  const record = {
    id: existing?.id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name: String(values.get('name') || '').trim(),
    venue: String(values.get('venue') || '').trim(),
    date: String(values.get('date') || ''),
    priority: ['high', 'medium', 'low'].includes(values.get('priority')) ? values.get('priority') : 'medium',
    note: String(values.get('note') || '').trim(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(existing?.eatenAt ? { eatenAt: existing.eatenAt } : {}),
  };
  if (existing) entries = entries.map((item) => item.id === existing.id ? record : item);
  else entries.unshift(record);
  if (saveEntries()) {
    dialog.close();
    showToast(existing ? '修改已保存。' : '已经记进清单啦。');
  }
});
form.elements.name.addEventListener('input', () => form.elements.name.setCustomValidity(''));

grid.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  const card = event.target.closest('.entry-card');
  if (!button || !card) return;
  const item = entries.find((entry) => entry.id === card.dataset.id);
  if (!item) return;
  if (button.classList.contains('edit-entry')) openForm(item);
  if (button.classList.contains('delete-entry')) {
    if (!window.confirm(`确定从清单中删除「${item.name}」吗？`)) return;
    entries = entries.filter((entry) => entry.id !== item.id);
    if (saveEntries()) showToast('已从清单中删除。');
  }
  if (button.classList.contains('toggle-eaten')) {
    entries = entries.map((entry) => entry.id === item.id ? { ...entry, eatenAt: entry.eatenAt ? '' : localDateString(), updatedAt: new Date().toISOString() } : entry);
    if (saveEntries()) showToast(item.eatenAt ? '已放回待吃清单。' : '记下啦，吃过的美味也值得回味。');
  }
});

document.querySelector('#export-button').addEventListener('click', () => {
  const content = JSON.stringify({ exportedAt: new Date().toISOString(), items: entries }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `想吃清单-${localDateString().replaceAll('-', '')}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('备份文件已准备好。');
});

const importFile = document.querySelector('#import-file');
document.querySelector('#import-button').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(incoming)) throw new Error('missing items');
    const normalized = incoming.filter((item) => item && typeof item.name === 'string').map((item) => ({
      id: typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: item.name.trim().slice(0, 80),
      venue: typeof item.venue === 'string' ? item.venue.slice(0, 100) : '',
      date: typeof item.date === 'string' ? item.date : '',
      priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
      note: typeof item.note === 'string' ? item.note.slice(0, 280) : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
      ...(typeof item.eatenAt === 'string' && item.eatenAt ? { eatenAt: item.eatenAt } : {}),
    }));
    if (!normalized.length && incoming.length) throw new Error('no valid items');
    const merged = new Map(entries.map((item) => [item.id, item]));
    normalized.forEach((item) => merged.set(item.id, item));
    entries = [...merged.values()];
    if (saveEntries()) showToast(`已导入 ${normalized.length} 条记录。`);
  } catch {
    showToast('文件格式不正确，无法导入。');
  } finally {
    importFile.value = '';
  }
});

render();
