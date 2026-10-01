/**
 * Service Management Contract Evaluation Monitor
 * Main Application Orchestrator & UI Bindings
 */

(function () {
  'use strict';

  var lastActive = [];
  var lastCompleted = [];
  var currentTab = 'priority';

  // DOM Elements
  var kpiRow = document.getElementById('kpiRow');
  var priorityBody = document.getElementById('priorityBody');
  var asOfLabel = document.getElementById('asOfLabel');
  var dataSourceBadge = document.getElementById('dataSourceBadge');
  
  var drillModal = document.getElementById('drillModal');
  var drillTitleEl = document.getElementById('drillTitle');
  var drillSubEl = document.getElementById('drillSub');
  var drillHead = document.getElementById('drillHead');
  var drillBody = document.getElementById('drillBody');
  var drillClose = document.getElementById('drillClose');

  // ---------------------------------------------------------------
  // Drilldown Modal
  // ---------------------------------------------------------------
  function openDrill(title, records, mode) {
    if (!drillModal) return;
    drillTitleEl.textContent = title;
    drillSubEl.textContent = records.length + ' employees match this filter & category';
    var headers = mode === 'completed' ? COMPLETED_HEADERS : ACTIVE_HEADERS;
    drillHead.innerHTML = '<tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';
    
    if (!records.length) {
      drillBody.innerHTML = '<tr><td colspan="' + headers.length + '"><div class="empty-state">' + ICON.inbox + '<div>No data for this category.</div></div></td></tr>';
    } else {
      var sorted = records.slice().sort(function (a, b) {
        return mode === 'completed' 
          ? (a.name || '').localeCompare(b.name || '') 
          : (a.daysRemaining || 0) - (b.daysRemaining || 0);
      });
      drillBody.innerHTML = sorted.map(mode === 'completed' ? completedRowHtml : activeRowHtml).join('');
    }
    drillModal.hidden = false;
  }

  function closeDrill() {
    if (drillModal) drillModal.hidden = true;
  }

  // ---------------------------------------------------------------
  // Row HTML Generators
  // ---------------------------------------------------------------
  function reminderDots(r) {
    var dots = [1, 2, 3].map(function (n) {
      var has = r['reminder' + n];
      var cls = 'rem-dot' + (has ? ' filled' : '');
      var title = has ? ('Reminder ' + n + ': ' + fmtDate(has)) : ('Reminder ' + n + ': not sent yet');
      return '<span class="' + cls + '" title="' + title + '"></span>';
    }).join('');
    return '<div class="rem-dots">' + dots + '</div>';
  }

  function activeRowHtml(r) {
    var badgeCls = PRIORITY_BADGE_CLASS[r.priority] || 'b-neutral';
    var daysLabel = r.daysRemaining < 0 
      ? (Math.abs(r.daysRemaining) + ' days overdue') 
      : (r.daysRemaining + ' days');
    var gapFlag = r.noReminderGap 
      ? '<span class="badge b-critical" title="High priority, no reminder sent yet">' + ICON.alert + ' Need Attention</span>' 
      : '';
    return '' +
      '<tr>' +
        '<td><span class="badge ' + badgeCls + '">' + (r.priority || '—') + '</span></td>' +
        '<td><div class="cell-name">' + (r.name || '—') + '</div><div class="cell-sub">' + (r.position || r.psLevel || '') + '</div></td>' +
        '<td>' + (r.pillar || '—') + '<div class="cell-sub">' + (r.company || '') + '</div></td>' +
        '<td class="mono">' + daysLabel + '</td>' +
        '<td class="mono">' + fmtDate(r.endOfContract) + '</td>' +
        '<td>' + (r.remarks || '—') + '</td>' +
        '<td><div class="rem-cell">' + reminderDots(r) + gapFlag + '</div></td>' +
        '<td>' + (r.smPic || '—') + '</td>' +
      '</tr>';
  }

  function completedRowHtml(r) {
    var slaCls = SLA_BADGE_CLASS[r.sla] || 'b-neutral';
    var slaLabel = SLA_LABEL[r.sla] || (r.sla || '—');
    return '' +
      '<tr>' +
        '<td><span class="badge b-neutral">Completed</span></td>' +
        '<td><div class="cell-name">' + (r.name || '—') + '</div><div class="cell-sub">' + (r.position || r.psLevel || '') + '</div></td>' +
        '<td>' + (r.pillar || '—') + '<div class="cell-sub">' + (r.company || '') + '</div></td>' +
        '<td class="mono">' + fmtDate(r.endOfContract) + '</td>' +
        '<td><span class="badge ' + slaCls + '">' + slaLabel + '</span></td>' +
        '<td>' + (r.remarks || '—') + '</td>' +
        '<td>' + (r.smPic || '—') + '</td>' +
      '</tr>';
  }

  // ---------------------------------------------------------------
  // KPI Cards
  // ---------------------------------------------------------------
  function kpiCard(cfg) {
    return '' +
      '<div class="kpi" data-kpi="' + cfg.key + '" style="--kpi-c:' + cfg.color + '; --kpi-bg:' + cfg.bg + '">' +
        '<div class="kpi-top">' +
          '<div class="kpi-label">' + cfg.label + '</div>' +
          '<div class="kpi-icon">' + cfg.icon + '</div>' +
        '</div>' +
        '<div class="kpi-value">' + cfg.value + '</div>' +
        '<div class="kpi-sub">' + cfg.sub + '</div>' +
        '<div class="kpi-drill">View employee list ' + ICON.arrowRight + '</div>' +
      '</div>';
  }

  function renderKpis(active, completedFiltered) {
    if (!kpiRow) return;
    var urgent = active.filter(function (r) { return r.priority === 'URGENT'; }).length;
    var high = active.filter(function (r) { return r.priority === 'HIGH'; }).length;
    var lateCount = completedFiltered.filter(function (r) { return r.sla === 'Late'; }).length;
    var slaKnown = completedFiltered.filter(function (r) { return r.sla; });
    var onTime = slaKnown.filter(function (r) { return r.sla === '0 - 7' || r.sla === '7 - 20'; }).length;
    var onTimeRate = slaKnown.length ? Math.round((onTime / slaKnown.length) * 100) : 0;

    kpiRow.innerHTML =
      kpiCard({ key: 'active', label: 'On Progress', value: active.length, sub: 'Contracts currently in evaluation process', icon: ICON.users, color: cssVar('--accent'), bg: cssVar('--accent-soft') }) +
      kpiCard({ key: 'urgent', label: 'Urgent', value: urgent, sub: 'Under 8 days remaining', icon: ICON.alert, color: cssVar('--critical'), bg: cssVar('--critical-soft') }) +
      kpiCard({ key: 'high', label: 'High', value: high, sub: '8&ndash;21 days remaining', icon: ICON.alert, color: cssVar('--serious'), bg: cssVar('--serious-soft') }) +
      kpiCard({ key: 'slaLate', label: 'SLA Late', value: lateCount, sub: 'Out of ' + completedFiltered.length + ' completed cases', icon: ICON.clockAlert, color: cssVar('--serious'), bg: cssVar('--serious-soft') }) +
      kpiCard({ key: 'onTime', label: 'On-time Rate', value: onTimeRate + '%', sub: 'Completed within 0–20 SLA days', icon: ICON.check, color: cssVar('--good'), bg: cssVar('--good-soft') });
  }

  function openKpiDrill(key) {
    switch (key) {
      case 'active':
        openDrill('On Progress', lastActive, 'active');
        break;
      case 'urgent':
        openDrill('Urgent Priority', lastActive.filter(function (r) { return r.priority === 'URGENT'; }), 'active');
        break;
      case 'high':
        openDrill('High Priority', lastActive.filter(function (r) { return r.priority === 'HIGH'; }), 'active');
        break;
      case 'slaLate':
        openDrill('SLA Late', lastCompleted.filter(function (r) { return r.sla === 'Late'; }), 'completed');
        break;
      case 'onTime':
        openDrill('On-time (SLA 0–20 days)', lastCompleted.filter(function (r) { return r.sla === '0 - 7' || r.sla === '7 - 20'; }), 'completed');
        break;
    }
  }

  // ---------------------------------------------------------------
  // Priority Table Rendering
  // ---------------------------------------------------------------
  function renderTable(active) {
    if (!priorityBody) return;
    var sortState = FilterEngine.getSortState();
    var rows = active.slice().sort(function (a, b) {
      var k = sortState.key, dir = sortState.dir;
      var av = a[k], bv = b[k];
      if (av === null || av === undefined) av = k === 'daysRemaining' ? 99999 : '';
      if (bv === null || bv === undefined) bv = k === 'daysRemaining' ? 99999 : '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return (a.daysRemaining || 0) - (b.daysRemaining || 0);
    });

    if (!rows.length) {
      priorityBody.innerHTML = '<tr><td colspan="8"><div class="empty-state">' + ICON.inbox + '<div>No cases match the current filter.</div></div></td></tr>';
      return;
    }

    priorityBody.innerHTML = rows.map(activeRowHtml).join('');
  }

  // ---------------------------------------------------------------
  // Chart Dispatcher
  // ---------------------------------------------------------------
  var CHART_RENDERERS = {
    priority: function () {
      ChartManager.renderReminderChart(lastActive, openDrill);
      ChartManager.renderTimelineChart(lastActive, openDrill);
    },
    process: function () {
      ChartManager.renderFunnelChart(lastActive, openDrill);
      ChartManager.renderSlaChart(lastCompleted, openDrill);
      ChartManager.renderWesignChart(lastActive, openDrill);
    },
    breakdown: function () {
      ChartManager.renderPillarChart(lastActive, openDrill);
      ChartManager.renderPicChart(lastActive, openDrill);
    }
  };

  // ---------------------------------------------------------------
  // Main Render Coordinator
  // ---------------------------------------------------------------
  function renderAll() {
    closeDrill();
    var state = DataManager.getState();
    var f = FilterEngine.currentFilters();

    var active = f.status === 'Completed' ? [] : FilterEngine.applyFilters(state.onProgress, f);
    var completedFiltered = f.status === 'On Progress' ? [] : FilterEngine.applyFilters(state.completed, f, { ignorePriority: true });

    lastActive = active;
    lastCompleted = completedFiltered;

    renderKpis(active, completedFiltered);
    renderTable(active);

    if (CHART_RENDERERS[currentTab]) {
      CHART_RENDERERS[currentTab]();
    }
  }

  // ---------------------------------------------------------------
  // Event Bindings
  // ---------------------------------------------------------------
  function initAppEvents() {
    // KPI click
    if (kpiRow) {
      kpiRow.addEventListener('click', function (e) {
        var el = e.target.closest('.kpi');
        if (!el) return;
        openKpiDrill(el.getAttribute('data-kpi'));
      });
    }

    // Modal close events
    if (drillClose) drillClose.addEventListener('click', closeDrill);
    if (drillModal) {
      drillModal.addEventListener('click', function (e) {
        if (e.target === drillModal) closeDrill();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drillModal && !drillModal.hidden) closeDrill();
    });

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.tabpanel').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        currentTab = btn.getAttribute('data-tab');
        var panel = document.getElementById('tab-' + currentTab);
        if (panel) panel.classList.add('active');
        if (CHART_RENDERERS[currentTab]) {
          CHART_RENDERERS[currentTab]();
        }
      });
    });

    // Default sorting class indicator on header
    var sortTh = document.querySelector('#priorityTable thead th[data-key="priorityRank"]');
    if (sortTh) sortTh.classList.add('sorted');
  }

  // ---------------------------------------------------------------
  // App Bootstrapper
  // ---------------------------------------------------------------
  function init() {
    ChartManager.initDefaults();

    DataManager.load(function (err, state) {
      if (err) {
        if (asOfLabel) asOfLabel.textContent = 'Error loading data';
        console.error('Data initialization failed:', err);
        return;
      }

      if (asOfLabel) asOfLabel.textContent = fmtAsOf(state.asOf);
      if (dataSourceBadge) {
        var isLive = state.source && state.source.indexOf('gsheet') !== -1;
        var srcText = state.source === 'gsheet-proxy' ? 'GSheet Secured' : (state.source === 'gsheet' ? 'GSheet Live' : (state.source === 'cache' ? 'Local Cache' : 'Snapshot'));
        dataSourceBadge.textContent = srcText;
        dataSourceBadge.className = 'source-badge ' + (isLive ? 'live' : 'snapshot');
      }

      FilterEngine.initOptions(state.records, state.onProgress);
      FilterEngine.setupEventListeners(renderAll);
      initAppEvents();
      renderAll();
    });
  }

  // Expose global app object if needed
  window.SMApp = {
    init: init,
    renderAll: renderAll,
    openDrill: openDrill,
    closeDrill: closeDrill
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
