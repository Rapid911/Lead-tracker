/* ============================================================
   Pipeline — Momentum Tracker
   All data stays on-device (localStorage). No backend, no network
   required after first load — fully usable offline in the field.
   ============================================================ */

const STORAGE_KEY = 'momentum_leads_v1';

/* The cadence: five stages of the follow-up rhythm.
   `days` = how many days after the PREVIOUS touch the next one is due. */
const CADENCE = [
  { label: 'Send same-day recap',        days: 0  },
  { label: '48–72h check-in',            days: 3  },
  { label: 'Follow up with new value',   days: 7  },
  { label: 'Surface the objection',      days: 14 },
  { label: 'Monthly nurture check-in',   days: 30 },
];
const MAX_STAGE = CADENCE.length - 1;

/* ---------------- storage ---------------- */
function loadLeads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load leads', e);
    return [];
  }
}
function saveLeads(leads) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}
let leads = loadLeads();

/* ---------------- helpers ---------------- */
function uid() {
  return 'l_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function addDaysISO(baseISO, days) {
  const d = new Date(baseISO + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(aISO, bISO) {
  const a = new Date(aISO + 'T00:00:00');
  const b = new Date(bISO + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function urgency(lead) {
  if (lead.status === 'won' || lead.status === 'dead') return lead.status;
  const t = todayISO();
  const diff = daysBetween(t, lead.nextFollowUp);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}
function normalizePhone(phone) {
  let p = (phone || '').replace(/[\s-]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('254')) return p;
  return p;
}

/* ---------------- CRUD ---------------- */
function addLead(data) {
  const today = todayISO();
  const lead = {
    id: uid(),
    name: data.name,
    phone: data.phone,
    vehicle: data.vehicle,
    type: data.type,
    source: data.source,
    notes: data.notes,
    status: 'active',
    stage: 0,
    createdAt: today,
    lastContact: today,
    nextFollowUp: addDaysISO(today, CADENCE[1].days),
  };
  leads.unshift(lead);
  saveLeads(leads);
}
function updateLeadFields(id, data) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  Object.assign(lead, data);
  saveLeads(leads);
}
function markContacted(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  const today = todayISO();
  lead.stage = Math.min(lead.stage + 1, MAX_STAGE);
  lead.lastContact = today;
  lead.nextFollowUp = addDaysISO(today, CADENCE[lead.stage].days || 30);
  if (lead.status === 'dead') lead.status = 'active';
  saveLeads(leads);
  showToast(`Next: ${CADENCE[Math.min(lead.stage + 1, MAX_STAGE)].label}`);
}
function markStatus(id, status) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  lead.status = status;
  saveLeads(leads);
  showToast(status === 'won' ? 'Marked as disbursed 🎉' : 'Moved to dead leads');
}
function deleteLead(id) {
  leads = leads.filter(l => l.id !== id);
  saveLeads(leads);
}

/* ---------------- rendering ---------------- */
const listEl = document.getElementById('leadList');
const emptyEl = document.getElementById('emptyState');
let currentFilter = 'active';
let currentQuery = '';

function renderPulse() {
  const t = todayISO();
  let overdue = 0, today = 0, upcoming = 0, won = 0;
  leads.forEach(l => {
    if (l.status === 'won') { won++; return; }
    if (l.status === 'dead') return;
    const diff = daysBetween(t, l.nextFollowUp);
    if (diff < 0) overdue++;
    else if (diff === 0) today++;
    else upcoming++;
  });
  document.getElementById('countOverdue').textContent = overdue;
  document.getElementById('countToday').textContent = today;
  document.getElementById('countUpcoming').textContent = upcoming;
  document.getElementById('countWon').textContent = won;
}

function cadenceHTML(lead) {
  const u = urgency(lead);
  let segs = '';
  for (let i = 0; i <= MAX_STAGE; i++) {
    let cls = 'cadence-seg';
    if (i < lead.stage) cls += ' filled';
    else if (i === lead.stage) {
      cls += ' filled current';
      if (u === 'overdue') cls += ' overdue-seg';
    }
    segs += `<div class="${cls}"></div>`;
  }
  let nextLabel;
  if (lead.status === 'won') nextLabel = 'Disbursed';
  else if (lead.status === 'dead') nextLabel = 'Dead lead';
  else {
    const due = formatDate(lead.nextFollowUp);
    nextLabel = `${CADENCE[lead.stage].label} · ${due}`;
  }
  const nextCls = u === 'overdue' ? 'is-overdue' : (u === 'today' ? 'is-today' : '');
  return `
    <div class="cadence">
      <div class="cadence-track">${segs}</div>
      <span class="cadence-next ${nextCls}">${nextLabel}</span>
    </div>`;
}

function pillHTML(lead) {
  const u = urgency(lead);
  const map = {
    overdue: ['pill-overdue', 'Overdue'],
    today: ['pill-today', 'Due today'],
    upcoming: ['pill-upcoming', 'Upcoming'],
    won: ['pill-won', 'Disbursed'],
    dead: ['pill-dead', 'Dead'],
  };
  const [cls, txt] = map[u] || map.upcoming;
  return `<span class="lead-status-pill ${cls}">${txt}</span>`;
}

function matchesFilter(lead) {
  const u = urgency(lead);
  if (currentFilter === 'all') return true;
  if (currentFilter === 'active') return lead.status === 'active';
  if (currentFilter === 'overdue') return u === 'overdue';
  if (currentFilter === 'today') return u === 'today';
  if (currentFilter === 'won') return lead.status === 'won';
  if (currentFilter === 'dead') return lead.status === 'dead';
  return true;
}
function matchesQuery(lead) {
  if (!currentQuery) return true;
  const q = currentQuery.toLowerCase();
  return (lead.name || '').toLowerCase().includes(q) ||
         (lead.vehicle || '').toLowerCase().includes(q);
}

const URGENCY_ORDER = { overdue: 0, today: 1, upcoming: 2, won: 3, dead: 4 };

function renderList() {
  renderPulse();
  const filtered = leads
    .filter(matchesFilter)
    .filter(matchesQuery)
    .sort((a, b) => URGENCY_ORDER[urgency(a)] - URGENCY_ORDER[urgency(b)]
                    || a.nextFollowUp.localeCompare(b.nextFollowUp));

  listEl.innerHTML = '';
  emptyEl.hidden = filtered.length !== 0;

  filtered.forEach(lead => {
    const u = urgency(lead);
    const card = document.createElement('button');
    card.className = 'lead-card' + (u === 'overdue' ? ' is-overdue' : u === 'today' ? ' is-today' : '');
    card.innerHTML = `
      <div class="lead-top">
        <div>
          <div class="lead-name">${escapeHTML(lead.name)}</div>
          <div class="lead-vehicle">${escapeHTML(lead.vehicle || 'No vehicle noted')}</div>
        </div>
        ${pillHTML(lead)}
      </div>
      <div class="lead-tags">
        <span class="tag">${escapeHTML(lead.type)}</span>
        <span class="tag">${escapeHTML(lead.source)}</span>
      </div>
      ${cadenceHTML(lead)}
    `;
    card.addEventListener('click', () => openDetail(lead.id));
    listEl.appendChild(card);
  });
}
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ---------------- add/edit sheet ---------------- */
const sheetBackdrop = document.getElementById('sheetBackdrop');
const leadForm = document.getElementById('leadForm');

function openAddSheet() {
  document.getElementById('sheetTitle').textContent = 'New lead';
  leadForm.reset();
  document.getElementById('leadId').value = '';
  sheetBackdrop.classList.add('open');
}
function openEditSheet(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  document.getElementById('sheetTitle').textContent = 'Edit lead';
  document.getElementById('leadId').value = lead.id;
  document.getElementById('fName').value = lead.name || '';
  document.getElementById('fPhone').value = lead.phone || '';
  document.getElementById('fVehicle').value = lead.vehicle || '';
  document.getElementById('fType').value = lead.type || 'Logbook';
  document.getElementById('fSource').value = lead.source || 'Garage';
  document.getElementById('fNotes').value = lead.notes || '';
  closeDetail();
  sheetBackdrop.classList.add('open');
}
function closeSheet() { sheetBackdrop.classList.remove('open'); }

document.getElementById('addBtn').addEventListener('click', openAddSheet);
document.getElementById('cancelBtn').addEventListener('click', closeSheet);
sheetBackdrop.addEventListener('click', e => { if (e.target === sheetBackdrop) closeSheet(); });

leadForm.addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('leadId').value;
  const data = {
    name: document.getElementById('fName').value.trim(),
    phone: document.getElementById('fPhone').value.trim(),
    vehicle: document.getElementById('fVehicle').value.trim(),
    type: document.getElementById('fType').value,
    source: document.getElementById('fSource').value,
    notes: document.getElementById('fNotes').value.trim(),
  };
  if (!data.name) return;
  if (id) {
    updateLeadFields(id, data);
    showToast('Lead updated');
  } else {
    addLead(data);
    showToast('Lead added — recap due today');
  }
  closeSheet();
  renderList();
});

/* ---------------- detail sheet ---------------- */
const detailBackdrop = document.getElementById('detailBackdrop');
const detailContent = document.getElementById('detailContent');

function openDetail(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  const waLink = lead.phone ? `https://wa.me/${normalizePhone(lead.phone)}` : null;
  const telLink = lead.phone ? `tel:${lead.phone}` : null;

  detailContent.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-name">${escapeHTML(lead.name)}</div>
        <div class="detail-vehicle">${escapeHTML(lead.vehicle || 'No vehicle noted')}</div>
      </div>
      ${pillHTML(lead)}
    </div>

    <div class="lead-tags" style="margin-top:10px;">
      <span class="tag">${escapeHTML(lead.type)}</span>
      <span class="tag">${escapeHTML(lead.source)}</span>
    </div>

    <div class="detail-section">${cadenceHTML(lead)}</div>

    <div class="detail-section">
      <div class="detail-label">Last contact</div>
      <div class="detail-value">${formatDate(lead.lastContact)}</div>
    </div>

    ${lead.notes ? `
    <div class="detail-section">
      <div class="detail-label">Notes</div>
      <div class="detail-notes">${escapeHTML(lead.notes)}</div>
    </div>` : ''}

    <div class="detail-actions">
      ${lead.status === 'active' ? `<button class="contact-btn" id="btnContacted">Mark contacted today</button>` : ''}
      ${telLink ? `<a class="lead-action call" style="flex:1 1 auto;min-width:110px;padding:11px;border-radius:11px;background:var(--raised);border:1px solid var(--line);text-align:center;text-decoration:none;color:var(--won);font-weight:600;font-size:13px;" href="${telLink}">Call</a>` : ''}
      ${waLink ? `<a class="lead-action" style="flex:1 1 auto;min-width:110px;padding:11px;border-radius:11px;background:var(--raised);border:1px solid var(--line);text-align:center;text-decoration:none;color:var(--text);font-weight:600;font-size:13px;" href="${waLink}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      <button class="edit-btn" id="btnEdit">Edit</button>
      ${lead.status !== 'won' ? `<button class="won-btn" id="btnWon">Mark disbursed</button>` : ''}
      ${lead.status !== 'dead' ? `<button class="dead-btn" id="btnDead">Mark dead</button>` : ''}
      <button class="delete-btn" id="btnDelete">Delete lead</button>
    </div>
  `;

  const btnContacted = document.getElementById('btnContacted');
  if (btnContacted) btnContacted.addEventListener('click', () => { markContacted(id); openDetail(id); renderList(); });

  document.getElementById('btnEdit').addEventListener('click', () => openEditSheet(id));
  const btnWon = document.getElementById('btnWon');
  if (btnWon) btnWon.addEventListener('click', () => { markStatus(id, 'won'); closeDetail(); renderList(); });
  const btnDead = document.getElementById('btnDead');
  if (btnDead) btnDead.addEventListener('click', () => { markStatus(id, 'dead'); closeDetail(); renderList(); });
  document.getElementById('btnDelete').addEventListener('click', () => {
    if (confirm(`Delete ${lead.name}? This can't be undone.`)) {
      deleteLead(id);
      closeDetail();
      renderList();
    }
  });

  detailBackdrop.classList.add('open');
}
function closeDetail() { detailBackdrop.classList.remove('open'); }
detailBackdrop.addEventListener('click', e => { if (e.target === detailBackdrop) closeDetail(); });

/* ---------------- filters / search ---------------- */
document.getElementById('filterRow').addEventListener('click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  renderList();
});
document.getElementById('searchInput').addEventListener('input', e => {
  currentQuery = e.target.value;
  renderList();
});

/* ---------------- menu: backup / restore ---------------- */
const menuBackdrop = document.getElementById('menuBackdrop');
document.getElementById('menuBtn').addEventListener('click', () => menuBackdrop.classList.add('open'));
document.getElementById('closeMenuBtn').addEventListener('click', () => menuBackdrop.classList.remove('open'));
menuBackdrop.addEventListener('click', e => { if (e.target === menuBackdrop) menuBackdrop.classList.remove('open'); });

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(leads, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `momentum-leads-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('Bad format');
      const existingIds = new Set(leads.map(l => l.id));
      const merged = leads.concat(imported.filter(l => !existingIds.has(l.id)));
      leads = merged;
      saveLeads(leads);
      renderList();
      menuBackdrop.classList.remove('open');
      showToast(`Imported ${imported.length} leads`);
    } catch (err) {
      showToast('Could not read that file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ---------------- toast ---------------- */
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- service worker ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ---------------- init ---------------- */
renderList();
