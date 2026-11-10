/* Admin editor — reads live calendar.json, edits in memory, publishes via API. */
(function () {
  'use strict';

  var SEMS = { pendek: 'Pendek', pertama: 'Pertama', kedua: 'Kedua' };
  var TYPES = {
    pendaftaran: 'Pendaftaran', kuliah: 'Kuliah', 'cuti-pertengahan': 'Cuti Pertengahan',
    ulangkaji: 'Ulangkaji', peperiksaan: 'Peperiksaan', 'cuti-semester': 'Cuti Semester'
  };

  var events = [];
  var editing = -1; // index, or 'new'

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function status(msg, isErr) {
    var el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status' + (isErr ? ' err' : ' ok');
  }

  function sorted() {
    return events.map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) { return a.e.start < b.e.start ? -1 : 1; });
  }

  function render() {
    var tb = document.getElementById('rows');
    tb.innerHTML = '';
    sorted().forEach(function (row, n) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (n + 1) + '</td>' +
        '<td>' + esc(row.e.title_ms) + '<br><span class="muted">' + esc(row.e.id) + '</span></td>' +
        '<td>' + esc(SEMS[row.e.semester] || row.e.semester) + '</td>' +
        '<td>' + esc(TYPES[row.e.type] || row.e.type) + '</td>' +
        '<td>' + esc(row.e.start) + ' → ' + esc(row.e.end || '…') + '</td>';
      var td = document.createElement('td');
      var eb = document.createElement('button');
      eb.type = 'button'; eb.className = 'btn small'; eb.textContent = 'Edit';
      eb.addEventListener('click', function () { openModal(row.i); });
      var db = document.createElement('button');
      db.type = 'button'; db.className = 'btn small danger'; db.textContent = 'Padam';
      db.addEventListener('click', function () {
        if (confirm('Padam "' + row.e.title_ms + '"?')) {
          events.splice(row.i, 1);
          render();
          status('Dipadam (belum diterbitkan).', false);
        }
      });
      td.appendChild(eb); td.appendChild(db);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
  }

  function openModal(i) {
    editing = i;
    var e = i === 'new'
      ? { semester: 'pertama', type: 'kuliah', title_ms: '', title_en: '', start: '', end: '', tempoh_ms: '', nota_ms: '', nota_en: '' }
      : events[i];
    document.getElementById('modal-title').textContent = i === 'new' ? 'Tambah acara' : 'Edit acara';
    document.getElementById('f-semester').value = e.semester;
    document.getElementById('f-type').value = e.type;
    document.getElementById('f-title-ms').value = e.title_ms || '';
    document.getElementById('f-title-en').value = e.title_en || '';
    document.getElementById('f-start').value = e.start || '';
    document.getElementById('f-end').value = e.end || '';
    document.getElementById('f-tempoh').value = e.tempoh_ms || '';
    document.getElementById('f-nota-ms').value = e.nota_ms || '';
    document.getElementById('f-nota-en').value = e.nota_en || '';
    document.getElementById('form-err').textContent = '';
    document.getElementById('modal').classList.remove('hidden');
  }

  function closeModal() { document.getElementById('modal').classList.add('hidden'); }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'acara';
  }

  function saveModal() {
    var v = function (id) { return document.getElementById(id).value.trim(); };
    var err = document.getElementById('form-err');
    var start = v('f-start'), end = v('f-end') || null;
    if (!v('f-title-ms')) { err.textContent = 'Tajuk (BM) wajib.'; return; }
    if (!start) { err.textContent = 'Tarikh mula wajib.'; return; }
    if (end && end < start) { err.textContent = 'Tarikh tamat sebelum mula.'; return; }
    var obj = {
      semester: v('f-semester'), type: v('f-type'),
      title_ms: v('f-title-ms'), title_en: v('f-title-en'),
      start: start, end: end,
      tempoh_ms: v('f-tempoh'), nota_ms: v('f-nota-ms'), nota_en: v('f-nota-en'),
      program: null,
    };
    if (editing === 'new') {
      obj.id = v('f-semester') + '-' + v('f-type') + '-' + slug(obj.title_ms) + '-' + start;
      if (events.some(function (e) { return e.id === obj.id; })) {
        err.textContent = 'Acara seiras sudah wujud (id duplikat).'; return;
      }
      events.push(obj);
    } else {
      obj.id = events[editing].id; // id kekal — pautan week_start dikekalkan
      events[editing] = obj;
    }
    closeModal();
    render();
    status('Disimpan tempatan — klik Simpan & Terbitkan untuk siarkan.', false);
  }

  async function publish() {
    var btn = document.getElementById('publish-btn');
    btn.disabled = true;
    btn.textContent = 'Menerbitkan…';
    status('', false);
    try {
      const res = await fetch('/api/publish-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: events }),
      });
      const out = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error((out && (out.error + (out.detail ? ': ' + JSON.stringify(out.detail) : ''))) || ('HTTP ' + res.status));
      status('Berjaya diterbitkan. Komit: ' + (out.commit || '').slice(0, 7), false);
    } catch (e) {
      status('Gagal: ' + e.message, true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Simpan &amp; Terbitkan';
    }
  }

  async function init() {
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', saveModal);
    document.getElementById('add-btn').addEventListener('click', function () { openModal('new'); });
    document.getElementById('publish-btn').addEventListener('click', publish);
    try {
      const me = await fetch('/api/auth?action=me', { cache: 'no-store' });
      if (!me.ok) throw new Error('auth');
      const who = await me.json();
      document.getElementById('who').textContent = 'Masuk sebagai ' + who.email;
      document.getElementById('app').classList.remove('hidden');
      const r = await fetch('../data/calendar.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('data');
      const data = await r.json();
      events = data.events || [];
      render();
    } catch (e) {
      document.getElementById('login-card').classList.remove('hidden');
      const q = new URLSearchParams(window.location.search);
      if (q.get('denied')) document.getElementById('login-err').textContent = 'Akaun ini tiada dalam senarai admin.';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
