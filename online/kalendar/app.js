/* Bila UniSZA Cuti — Phase 1 viewer. Vanilla JS, no build. Reads ../data/calendar.json. */
(function () {
  'use strict';

  var TYPES = [
    { key: 'pendaftaran', label: 'Pendaftaran', css: 'var(--pendaftaran)' },
    { key: 'kuliah', label: 'Kuliah', css: 'var(--kuliah)' },
    { key: 'cuti-pertengahan', label: 'Cuti Pertengahan', css: 'var(--cuti-pertengahan)' },
    { key: 'ulangkaji', label: 'Ulangkaji', css: 'var(--ulangkaji)' },
    { key: 'peperiksaan', label: 'Peperiksaan', css: 'var(--peperiksaan)' },
    { key: 'cuti-semester', label: 'Cuti Semester', css: 'var(--cuti-semester)' }
  ];
  var TYPE_LABEL = {};
  TYPES.forEach(function (t) { TYPE_LABEL[t.key] = t.label; });
  var SEM_LABEL = { pendek: 'Semester Pendek', pertama: 'Semester Pertama', kedua: 'Semester Kedua' };
  var MONTHS_MS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW_MS = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];

  var state = { sem: 'semua', type: 'semua', events: [] };

  function parseD(s) {
    var p = s.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function fmtD(d) { return d.getDate() + ' ' + MONTHS_MS[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtRange(ev) {
    var a = parseD(ev.start);
    var b = ev.end ? parseD(ev.end) : null;
    if (!b) return fmtD(a) + ' — (tarikh tamat belum diumumkan)';
    if (ev.start === ev.end) return fmtD(a);
    return fmtD(a) + ' – ' + fmtD(b);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function covers(ev, d) {
    var a = parseD(ev.start);
    if (d < a) return false;
    if (!ev.end) return true;
    return d <= parseD(ev.end);
  }
  /* Lecture week of a kuliah event for a date. Explicit `weeks` registry is
     the truth (transcribed spans); computed math is the fallback, capped at
     week_start+6 (14-week semester rule). Returns null outside range. */
  function weekOf(ev, d) {
    if (ev.type !== 'kuliah') return null;
    if (d.getDay() === 5 || d.getDay() === 6) return null; // Fri–Sat weekend
    if (ev.weeks) {
      for (var i = 0; i < ev.weeks.length; i++) {
        var w = ev.weeks[i];
        if (d >= parseD(w.start) && (!w.end || d <= parseD(w.end))) return w.n;
      }
    }
    var start = parseD(ev.start);
    var off = ev.week_offset_days || 0;
    var w0 = new Date(start.getFullYear(), start.getMonth(), start.getDate() + off);
    if (d < w0) return null;
    if (ev.end && d > parseD(ev.end)) return null;
    var base = ev.week_start || 1;
    return Math.min(base + 6, base + Math.floor((d - w0) / (7 * 86400000)));
  }
  function filtered() {
    return state.events.filter(function (e) {
      if (state.sem !== 'semua' && e.semester !== state.sem) return false;
      if (state.type !== 'semua' && e.type !== state.type) return false;
      return true;
    });
  }

  function renderLegend() {
    var el = document.getElementById('legend');
    el.innerHTML = '';
    TYPES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', state.type === t.key ? 'true' : 'false');
      b.innerHTML = '<span class="dot" style="background:' + t.css + '"></span>' + esc(t.label);
      b.addEventListener('click', function () {
        state.type = (state.type === t.key) ? 'semua' : t.key;
        closePopup();
        renderAll();
      });
      el.appendChild(b);
    });
  }

  function renderWeekPill() {
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var pill = document.getElementById('week-pill');
    var cur = state.events.filter(function (e) { return covers(e, now); });
    var kul = cur.filter(function (e) { return weekOf(e, now) !== null; })[0];
    if (kul) {
      pill.style.display = '';
      pill.textContent = 'Week ' + weekOf(kul, now);
    } else {
      // Today card already shows the active phase — no duplicate pill.
      pill.style.display = 'none';
    }
  }

  function renderMonths() {
    var host = document.getElementById('months');
    host.innerHTML = '';
    var list = filtered();
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var y = 2026, m = 5;
    while (y < 2027 || (y === 2027 && m <= 8)) {
      host.appendChild(monthCard(y, m, list, now));
      m++;
      if (m > 11) { m = 0; y++; }
    }
  }

  function monthCard(y, m, list, now) {
    var sec = document.createElement('section');
    sec.className = 'month';
    sec.id = 'm-' + y + '-' + m;
    var h = document.createElement('h2');
    h.textContent = MONTHS_MS[m] + ' ' + y;
    sec.appendChild(h);
    var head = document.createElement('div');
    head.className = 'grid';
    ['Ah','Is','Se','Ra','Kh','Ju','Sa'].forEach(function (d) {
      var c = document.createElement('div');
      c.className = 'dow'; c.textContent = d;
      head.appendChild(c);
    });
    sec.appendChild(head);
    // Sunday-start week rows. A row holding kuliah days becomes a titled
    // container (mockup 2); other rows stay plain.
    var wrap = document.createElement('div');
    var rowCells = []; // { el, date|null }
    var weekKey = function (rc) {
      if (!rc.date) return null;
      for (var k = 0; k < list.length; k++) {
        var w = weekOf(list[k], rc.date);
        if (w !== null) return w;
      }
      return null;
    };
    // Group consecutive same-week kuliah days into a titled container sized
    // to those columns only; other days render as plain cells.
    var flushRow = function () {
      if (!rowCells.length) return;
      var row = document.createElement('div');
      row.className = 'week-row';
      var col = 1;
      var idx = 0;
      while (idx < rowCells.length) {
        var wk = weekKey(rowCells[idx]);
        if (wk === null) {
          rowCells[idx].el.style.gridColumn = col + ' / ' + (col + 1);
          row.appendChild(rowCells[idx].el);
          col++;
          idx++;
        } else {
          var run = [];
          while (idx < rowCells.length && weekKey(rowCells[idx]) === wk) {
            run.push(rowCells[idx]);
            idx++;
          }
          var g = document.createElement('div');
          g.className = 'week-group';
          g.style.gridColumn = col + ' / ' + (col + run.length);
          col += run.length;
          var t = document.createElement('div');
          t.className = 'week-title';
          t.textContent = 'Minggu Kuliah ' + wk;
          g.appendChild(t);
          var inner = document.createElement('div');
          inner.className = 'week-grid';
          inner.style.gridTemplateColumns = 'repeat(' + run.length + ', 1fr)';
          run.forEach(function (rc) { inner.appendChild(rc.el); });
          g.appendChild(inner);
          row.appendChild(g);
        }
      }
      wrap.appendChild(row);
      rowCells = [];
    };
    var lead = new Date(y, m, 1).getDay();
    for (var i = 0; i < lead; i++) {
      var e = document.createElement('div');
      e.className = 'day empty';
      rowCells.push({ el: e, date: null });
    }
    var days = new Date(y, m + 1, 0).getDate();
    for (var d = 1; d <= days; d++) {
      (function (day) {
        var date = new Date(y, m, day);
        var hits = list.filter(function (ev) { return covers(ev, date); });
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'day' + (hits.length ? ' has-event t-' + hits[0].type : '');
        var isToday = date.getTime() === now.getTime();
        cell.innerHTML = esc(String(day)) + (hits.length ? '<span class="bar"></span>' : '') +
          (isToday ? '<span class="today-tip">Today</span>' : '');
        cell.title = hits.length
          ? hits.map(function (x) { return x.title_ms; }).join('; ')
          : fmtD(date);
        cell.addEventListener('click', function () {
          var hits = state.events.filter(function (ev) { return covers(ev, date); });
          if (pinnedCell === cell) { closePopup(); return; }
          openPopup(cell, date, hits, true);
        });
        if (window.matchMedia('(hover: hover)').matches) {
          cell.addEventListener('mouseenter', function () {
            if (pinnedCell) return;
            var hits = state.events.filter(function (ev) { return covers(ev, date); });
            openPopup(cell, date, hits, false);
          });
          cell.addEventListener('mouseleave', function () {
            if (!pinnedCell) {
              cancelHide();
              hideTimer = setTimeout(closePopup, 200);
            }
          });
        }
        cell.addEventListener('focus', function () {
          if (pinnedCell) return;
          var hits = state.events.filter(function (ev) { return covers(ev, date); });
          openPopup(cell, date, hits, false);
        });
        cell.addEventListener('blur', function () {
          if (!pinnedCell) closePopup();
        });
        rowCells.push({ el: cell, date: date });
        if ((lead + day) % 7 === 0) flushRow();
      })(d);
    }
    if (rowCells.length) flushRow();
    sec.appendChild(wrap);
    return sec;
  }

  function eventItem(e) {
    var li = document.createElement('li');
    li.innerHTML =
      '<span class="sem">' + esc(SEM_LABEL[e.semester] || e.semester) + '</span><br>' +
      '<span class="badge b-' + esc(e.type) + '"></span>' +
      '<span class="range">' + esc(e.title_ms) + '</span><br>' +
      '<span>' + esc(fmtRange(e)) + (e.tempoh_ms ? ' · ' + esc(e.tempoh_ms) : '') + '</span>' +
      (e.nota_ms ? '<p class="nota">' + esc(e.nota_ms) + '</p>' : '');
    return li;
  }

  /* Floating day popup — hover preview on desktop, tap to pin (mobile + desktop). */
  var popup = null;
  var pinnedCell = null;
  var hideTimer = null;

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  function ensurePopup() {
    if (popup) return popup;
    popup = document.createElement('div');
    popup.className = 'cal-popup hidden';
    popup.setAttribute('role', 'dialog');
    popup.innerHTML = '<button class="popup-close" type="button" aria-label="Tutup">✕</button>' +
      '<h3></h3><div class="popup-body"></div>';
    popup.querySelector('.popup-close').addEventListener('click', function (ev) {
      ev.stopPropagation();
      closePopup();
    });
    popup.addEventListener('mouseenter', cancelHide);
    popup.addEventListener('mouseleave', function () {
      if (!pinnedCell) closePopup();
    });
    document.body.appendChild(popup);
    return popup;
  }

  function popupHTML(date, hits) {
    var html = '';
    if (!hits.length) {
      html = '<p class="none">Tiada acara akademik pada tarikh ini.</p>';
    } else {
      html = '<ul>' + hits.map(function (e) {
        var wk = weekOf(e, date);
        return '<li><span class="badge b-' + esc(e.type) + '"></span>' +
          '<span class="range">' + esc(e.title_ms) + '</span>' +
          (wk !== null ? '<br><span class="sem">Minggu Kuliah ' + wk + '</span>' : '') + '<br>' +
          '<span>' + esc(fmtRange(e)) + (e.tempoh_ms ? ' · ' + esc(e.tempoh_ms) : '') + '</span>' +
          (e.nota_ms ? '<p class="nota">' + esc(e.nota_ms) + '</p>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    return html;
  }

  function positionPopup(cell) {
    var r = cell.getBoundingClientRect();
    var pw = popup.offsetWidth;
    var ph = popup.offsetHeight;
    var x = r.left + r.width / 2 - pw / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - pw - 8));
    var y = r.top - ph - 10;
    if (y < 8) y = r.bottom + 10;
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
  }

  function openPopup(cell, date, hits, pin) {
    ensurePopup();
    cancelHide();
    popup.querySelector('h3').textContent = fmtD(date) + ' — ' + DOW_MS[date.getDay()];
    popup.querySelector('.popup-body').innerHTML = popupHTML(date, hits);
    popup.classList.remove('hidden');
    popup.style.transform = '';
    popup.style.visibility = 'hidden';
    positionPopup(cell);
    popup.style.visibility = '';
    if (pin) pinnedCell = cell;
  }

  function closePopup() {
    cancelHide();
    if (popup) popup.classList.add('hidden');
    pinnedCell = null;
  }

  function renderList() {    var ul = document.getElementById('event-list');
    ul.innerHTML = '';
    var list = filtered().slice().sort(function (a, b) { return parseD(a.start) - parseD(b.start); });
    if (!list.length) {
      var li = document.createElement('li');
      li.textContent = 'Tiada acara untuk tapisan ini.';
      ul.appendChild(li);
      return;
    }
    list.forEach(function (e) { ul.appendChild(eventItem(e)); });
  }

  function renderToday() {
    var now = new Date(); now.setHours(0, 0, 0, 0);
    document.getElementById('today-dow').textContent = DOW_MS[now.getDay()];
    document.getElementById('today-full').textContent = fmtD(now);
    var phaseEl = document.getElementById('today-phase');
    var nextEl = document.getElementById('today-next');
    var cur = state.events.filter(function (e) { return covers(e, now); });
    var upcoming = state.events.filter(function (e) { return parseD(e.start) > now; })
      .sort(function (a, b) { return parseD(a.start) - parseD(b.start); })[0];
    if (cur.length) {
      phaseEl.textContent = cur.map(function (e) {
        var wk = weekOf(e, now);
        return e.title_ms + (wk !== null ? ' · Minggu Kuliah ' + wk : '');
      }).join(' + ');
    } else {
      phaseEl.textContent = 'Tiada fasa aktif hari ini.';
    }
    nextEl.textContent = upcoming
      ? 'Seterusnya: ' + upcoming.title_ms + ' — ' + fmtRange(upcoming)
      : '';
  }

  function renderAll() {
    closePopup();
    document.getElementById('sem-select').value = state.sem;
    renderLegend();
    renderWeekPill();
    renderToday();
    renderMonths();
    renderList();
  }

  function initTheme() {
    var root = document.documentElement;
    try {
      var saved = localStorage.getItem('unisza-theme');
      if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
    } catch (err) { /* private mode — stay light */ }
    document.getElementById('theme-btn').addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('unisza-theme', next); } catch (err) { /* ignore */ }
    });
  }

  function init() {
    initTheme();
    ensurePopup();
    document.addEventListener('click', function (ev) {
      if (!pinnedCell) return;
      if (popup && !popup.classList.contains('hidden') &&
          !popup.contains(ev.target) && !pinnedCell.contains(ev.target)) {
        closePopup();
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closePopup();
    });
    window.addEventListener('scroll', function (ev) {
      if (popup && popup.contains(ev.target)) return; // scrolling inside popup
      closePopup();
    }, true);
    window.addEventListener('resize', function () { closePopup(); });
    document.getElementById('sem-select').addEventListener('change', function (ev) {
      state.sem = ev.target.value;
      closePopup();
      renderAll();
    });
    document.getElementById('today-btn').addEventListener('click', function () {
      var now = new Date();
      var target = document.getElementById('m-' + now.getFullYear() + '-' + now.getMonth());
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('list-btn').addEventListener('click', function () {
      document.getElementById('list-section').scrollIntoView({ behavior: 'smooth' });
    });
    fetch('../data/calendar.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        state.events = data.events || [];
        renderAll();
      })
      .catch(function (err) {
        document.getElementById('week-pill').textContent = 'Gagal memuatkan data: ' + err.message;
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
