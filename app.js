/* MyBiz Verification Console — vanilla JS, zero build step. */

const DATA_URL = 'data.json';

let DB = null; // in-memory working copy

/* ---------------- utilities ---------------- */

const esc = (s) => String(s ?? '').replace(/[&<>"/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
}[c]));

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtWait(sinceIso) {
  const ms = Date.now() - new Date(sinceIso);
  if (isNaN(ms) || ms < 0) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ' + (m % 60) + 'm';
  return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}

function fmtAgo(iso) {
  return fmtWait(iso) + ' ago';
}

const CHECK_SVG = (color) =>
  `<svg class="fact-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">` +
  `<circle cx="10" cy="10" r="9" stroke="${color}" stroke-width="1.6"/>` +
  `<path d="M6.5 10.2l2.4 2.4 4.6-5" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
  `</svg>`;

const UNVERIFIED_SVG =
  `<svg class="fact-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">` +
  `<circle cx="10" cy="10" r="9" stroke="#e8a13c" stroke-width="1.6" stroke-dasharray="3 3"/>` +
  `<path d="M10 6.5v4.2" stroke="#e8a13c" stroke-width="1.8" stroke-linecap="round"/>` +
  `<circle cx="10" cy="13.6" r="1.1" fill="#e8a13c"/>` +
  `</svg>`;

/* ---------------- data ---------------- */

async function loadData() {
  const res = await fetch(DATA_URL + '?t=' + Date.now());
  if (!res.ok) throw new Error('HTTP ' + res.status);
  DB = await res.json();
}

function queueCount() { return (DB.queue || []).length; }

function factTotals() {
  let total = 0, verified = 0;
  (DB.properties || []).forEach((p) => {
    (p.facts || []).forEach((f) => { total += 1; if (f.verified) verified += 1; });
  });
  return { total, verified };
}

function propById(id) { return (DB.properties || []).find((p) => p.id === id); }

/* ---------------- header / nav ---------------- */

function updateHeader() {
  const n = queueCount();
  document.getElementById('verify-pill-text').textContent =
    n === 0 ? 'all verified' : n + ' need verification';
  document.getElementById('verify-pill').classList.toggle('clear', n === 0);
  const badge = document.getElementById('queue-badge');
  badge.textContent = n;
  badge.classList.toggle('zero', n === 0);
  document.getElementById('mock-note').style.display =
    DB.source === 'mock' ? '' : 'none';
}

function initNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
  });
}

function showSection(name) {
  document.querySelectorAll('.nav-item').forEach((b) =>
    b.classList.toggle('active', b.dataset.section === name));
  document.querySelectorAll('.panel').forEach((p) =>
    p.classList.toggle('active', p.id === 'section-' + name));
}

/* ---------------- section 1: fact sheets ---------------- */

function renderFacts() {
  const { total, verified } = factTotals();
  const pct = total ? Math.round((verified / total) * 100) : 0;
  let html = `<div class="section-head"><h2>Fact Sheets</h2>
    <div class="hero"><span class="hero-num ${pct === 100 ? 'green' : 'amber'}">${pct}%</span>
    <span class="hero-sub">${verified} of ${total} facts verified — the AI may only answer from checked facts</span></div></div>`;

  (DB.properties || []).forEach((p) => {
    const pv = (p.facts || []).filter((f) => f.verified).length;
    html += `<div class="card" id="card-${esc(p.id)}">
      <div class="card-head">
        <span class="card-title">${esc(p.address)}</span>
        <span class="badge ${pv === (p.facts || []).length ? 'green' : 'amber'}">${pv}/${(p.facts || []).length} verified</span>
      </div>
      <div class="card-sub">${esc(p.thread)}</div>
      <div style="height:8px"></div>`;
    (p.facts || []).forEach((f) => {
      html += `<div class="fact-row ${f.verified ? '' : 'unverified'}">
        ${f.verified ? CHECK_SVG('#34d17b') : UNVERIFIED_SVG}
        <div class="fact-body">
          <div class="fact-label">${esc(f.label)}</div>
          <div class="fact-value">${f.verified ? esc(f.value) : 'awaiting verification'}</div>
        </div>
        <div class="fact-meta">${f.verified
          ? `verified by ${esc(f.verified_by)}<br>${fmtDateTime(f.verified_at)}`
          : 'in verification queue'}</div>
      </div>`;
    });
    html += `</div>`;
  });

  document.getElementById('section-facts').innerHTML = html;
}

/* ---------------- section 2: verification queue ---------------- */

function renderQueue() {
  const q = DB.queue || [];
  const longest = q.length
    ? q.reduce((a, b) => (new Date(a.waiting_since) < new Date(b.waiting_since) ? a : b))
    : null;
  let html = `<div class="section-head"><h2>Verification Queue</h2>
    <div class="hero"><span class="hero-num ${q.length ? 'amber' : 'green'}">${q.length}</span>
    <span class="hero-sub">${q.length ? 'waiting — longest ' + fmtWait(longest.waiting_since) + '. The AI told each thread it is checking.' : 'nothing waiting — the AI has answers for everything'}</span></div></div>`;

  if (!q.length) {
    html += `<div class="empty-state">Queue is clear. New questions the AI can't verify will land here.</div>`;
  }

  q.forEach((item) => {
    const prop = propById(item.property_id);
    html += `<div class="card" data-qid="${esc(item.id)}">
      <div class="card-head">
        <span class="badge amber">unverified</span>
        <span class="card-sub">${esc(item.thread)}</span>
      </div>
      <div class="queue-question">${esc(item.question)}</div>
      <div class="queue-meta">Asked by ${esc(item.asked_by)}${prop ? ' · maps to fact "' + esc(item.fact_label) + '" on ' + esc(prop.address) : ''}</div>
      <div class="queue-wait">Waiting ${fmtWait(item.waiting_since)}</div>
      <div class="btn-row">
        <button class="btn primary" data-act="verify" data-qid="${esc(item.id)}">Verify</button>
        <button class="btn" data-act="dismiss" data-qid="${esc(item.id)}">Dismiss</button>
      </div>
      <div class="verify-slot"></div>
    </div>`;
  });

  const el = document.getElementById('section-queue');
  el.innerHTML = html;

  el.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.qid;
      if (btn.dataset.act === 'dismiss') dismissQueueItem(qid);
      else openVerifyForm(qid);
    });
  });
}

function openVerifyForm(qid) {
  const item = (DB.queue || []).find((x) => x.id === qid);
  if (!item) return;
  const prop = propById(item.property_id);
  const card = document.querySelector(`.card[data-qid="${CSS.escape(qid)}"]`);
  const slot = card.querySelector('.verify-slot');
  slot.innerHTML = `<div class="verify-form">
      <div class="form-label">Verified answer for <strong>${esc(item.fact_label)}</strong>${prop ? ' — ' + esc(prop.address) : ''}</div>
      <textarea id="vf-${esc(qid)}" placeholder="Type the verified answer…"></textarea>
      <div class="btn-row">
        <button class="btn primary" id="vf-submit-${esc(qid)}">Mark verified</button>
        <button class="btn" id="vf-cancel-${esc(qid)}">Cancel</button>
      </div>
    </div>`;
  document.getElementById('vf-submit-' + qid).addEventListener('click', () => {
    const answer = document.getElementById('vf-' + qid).value.trim();
    if (!answer) { document.getElementById('vf-' + qid).focus(); return; }
    verifyQueueItem(qid, answer);
  });
  document.getElementById('vf-cancel-' + qid).addEventListener('click', renderAll);
  document.getElementById('vf-' + qid).focus();
}

function verifyQueueItem(qid, answer) {
  const idx = (DB.queue || []).findIndex((x) => x.id === qid);
  if (idx < 0) return;
  const item = DB.queue[idx];
  const prop = propById(item.property_id);
  if (prop) {
    const fact = (prop.facts || []).find((f) => f.label === item.fact_label);
    if (fact) {
      fact.value = answer;
      fact.verified = true;
      fact.verified_by = 'Andre (console)';
      fact.verified_at = new Date().toISOString();
    }
  }
  DB.queue.splice(idx, 1);
  renderAll();
}

function dismissQueueItem(qid) {
  DB.queue = (DB.queue || []).filter((x) => x.id !== qid);
  renderAll();
}

/* ---------------- section 3: task board ---------------- */

function renderTasks() {
  const doing = (DB.tasks || []).filter((t) => t.status === 'doing');
  const waiting = (DB.tasks || []).filter((t) => t.status === 'waiting');
  const done = (DB.tasks || []).filter((t) => t.status === 'done');

  let html = `<div class="section-head"><h2>Tasks</h2>
    <div class="hero"><span class="hero-num plain">${doing.length}</span>
    <span class="hero-sub">in progress · ${waiting.length} waiting on a human · ${done.length} done</span></div></div>
    <div class="board">`;

  const col = (title, list, doneCol) => {
    let c = `<div class="board-col"><h3>${title}<span class="col-count">${list.length}</span></h3>`;
    if (!list.length) c += `<div class="task-meta">Nothing here.</div>`;
    list.forEach((t) => {
      c += `<div class="task-card ${doneCol ? 'done-card' : ''}">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">${esc(t.thread)} · updated ${fmtAgo(t.updated_at)}</div>
      </div>`;
    });
    return c + `</div>`;
  };

  html += col('Doing', doing, false) + col('Waiting on human', waiting, false) + col('Done', done, true);
  html += `</div>`;
  document.getElementById('section-tasks').innerHTML = html;
}

/* ---------------- section 4: answer log ---------------- */

function renderAnswers() {
  const a = DB.answers || [];
  let html = `<div class="section-head"><h2>Answer Log</h2>
    <div class="hero"><span class="hero-num green">${a.length}</span>
    <span class="hero-sub">answers given in group threads — every one traced to a verified fact</span></div></div>`;

  if (!a.length) html += `<div class="empty-state">No answers logged yet.</div>`;

  a.forEach((ans) => {
    html += `<div class="card">
      <div class="answer-snippet">${esc(ans.snippet)}</div>
      <div class="answer-meta">
        <span class="badge green">verified source</span>
        <span>Cited: <a class="cite-link" data-prop="${esc(ans.property_id)}" data-fact="${esc(ans.cited_fact)}">${esc(ans.cited_fact)}</a> — ${esc(ans.property)}</span>
        <span>${esc(ans.thread)}</span>
        <span>${fmtDateTime(ans.at)}</span>
      </div>
    </div>`;
  });

  const el = document.getElementById('section-answers');
  el.innerHTML = html;

  el.querySelectorAll('.cite-link').forEach((link) => {
    link.addEventListener('click', () => {
      showSection('facts');
      const card = document.getElementById('card-' + link.dataset.prop);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('flash');
        setTimeout(() => card.classList.remove('flash'), 1600);
      }
    });
  });
}

/* ---------------- boot ---------------- */

function renderAll() {
  renderFacts();
  renderQueue();
  renderTasks();
  renderAnswers();
  updateHeader();
}

function showError(msg) {
  const b = document.getElementById('error-banner');
  b.textContent = msg;
  b.classList.remove('hidden');
}

(async function boot() {
  try {
    initNav();
    await loadData();
    renderAll();
  } catch (e) {
    showError('Could not load data.json (' + e.message + '). Serve this folder over HTTP — plain file:// blocks fetch.');
  }
})();
