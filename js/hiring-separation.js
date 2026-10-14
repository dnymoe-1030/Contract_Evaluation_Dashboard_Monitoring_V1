/**
 * Service Management Portal — Hiring & Separation Sub-Modules
 * Orchestrates rendering, chart updates, and interactive filters for Hiring & Separation
 */

// -------------------------------------------------------------
// Hiring Monitoring Application Engine
// -------------------------------------------------------------
window.HiringApp = (function () {
  'use strict';

  var hiringData = [];
  var filteredData = [];
  var charts = {};

  var kpiRow = null;
  var tableBody = null;
  var statsEl = null;

  var fSearch = null;
  var fDateFrom = null;
  var fDateTo = null;
  var fMonth = null;
  var fCompany = null;
  var fActionType = null;
  var fSla = null;
  var fManage = null;
  var fReset = null;

  function getEl(id) {
    return document.getElementById(id);
  }

  function init() {
    kpiRow = getEl('hiringKpiRow');
    tableBody = getEl('hiringBody');
    statsEl = getEl('hiringStats');

    fSearch = getEl('hSearch');
    fDateFrom = getEl('hDateFrom');
    fDateTo = getEl('hDateTo');
    fMonth = getEl('hMonth');
    fCompany = getEl('hCompany');
    fActionType = getEl('hActionType');
    fSla = getEl('hSla');
    fManage = getEl('hManage');
    fReset = getEl('hReset');

    if (kpiRow && !kpiRow._drillBound) {
      kpiRow.addEventListener('click', function (e) {
        var card = e.target.closest('.kpi');
        if (!card) return;
        var kpi = card.getAttribute('data-kpi');
        openKpiDrill(kpi);
      });
      kpiRow._drillBound = true;
    }

    if (hiringData.length > 0) {
      applyFilters();
      return;
    }

    if (statsEl) statsEl.innerHTML = '<span style="color:var(--accent);">⏳ Loading live hiring data...</span>';

    fetch('/api/data?module=hiring')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        hiringData = data.records || [];
        populateDropdowns();
        setupListeners();
        applyFilters();
      })
      .catch(function (err) {
        console.warn('API fetch failed, checking snapshot fallback:', err.message);
        if (window.SNAPSHOT_HIRING && Array.isArray(window.SNAPSHOT_HIRING.records)) {
          hiringData = window.SNAPSHOT_HIRING.records;
          populateDropdowns();
          setupListeners();
          applyFilters();
        } else {
          console.error('Failed to load hiring records:', err);
          if (statsEl) statsEl.innerHTML = '<span style="color:var(--critical);">❌ Failed to load hiring data: ' + err.message + '</span>';
        }
      });
  }

  function populateDropdowns() {
    function unique(arr, prop) {
      var s = {};
      arr.forEach(function (r) { if (r[prop]) s[r[prop]] = true; });
      return Object.keys(s).sort();
    }

    if (fMonth) {
      fMonth.innerHTML = '<option value="">All Months</option>';
      unique(hiringData, 'month').forEach(function (m) {
        var opt = document.createElement('option'); opt.value = m; opt.textContent = m; fMonth.appendChild(opt);
      });
    }

    if (fCompany) {
      fCompany.innerHTML = '<option value="">All Companies</option>';
      unique(hiringData, 'companyName').forEach(function (c) {
        var opt = document.createElement('option'); opt.value = c; opt.textContent = c; fCompany.appendChild(opt);
      });
    }

    if (fActionType) {
      fActionType.innerHTML = '<option value="">All Action Types</option>';
      unique(hiringData, 'actionType').forEach(function (a) {
        var opt = document.createElement('option'); opt.value = a; opt.textContent = a; fActionType.appendChild(opt);
      });
    }
  }

  function setupListeners() {
    [fMonth, fCompany, fActionType, fSla, fManage, fDateFrom, fDateTo].forEach(function (el) {
      if (el) el.addEventListener('change', applyFilters);
    });
    if (fSearch) fSearch.addEventListener('input', applyFilters);
    if (fReset) {
      fReset.addEventListener('click', function () {
        if (fSearch) fSearch.value = '';
        if (fDateFrom) fDateFrom.value = '';
        if (fDateTo) fDateTo.value = '';
        if (fMonth) fMonth.value = '';
        if (fCompany) fCompany.value = '';
        if (fActionType) fActionType.value = '';
        if (fSla) fSla.value = '';
        if (fManage) fManage.value = '';
        applyFilters();
      });
    }
  }

  function applyFilters() {
    var q = fSearch ? fSearch.value.trim().toLowerCase() : '';
    var dFrom = fDateFrom ? fDateFrom.value : '';
    var dTo = fDateTo ? fDateTo.value : '';
    var m = fMonth ? fMonth.value : '';
    var c = fCompany ? fCompany.value : '';
    var a = fActionType ? fActionType.value : '';
    var s = fSla ? fSla.value : '';
    var mg = fManage ? fManage.value : '';

    filteredData = hiringData.filter(function (r) {
      if (dFrom && (!r.effectiveDate || r.effectiveDate < dFrom)) return false;
      if (dTo && (!r.effectiveDate || r.effectiveDate > dTo)) return false;
      if (q && (r.name.toLowerCase().indexOf(q) === -1 && String(r.id).toLowerCase().indexOf(q) === -1 && r.positionName.toLowerCase().indexOf(q) === -1)) return false;
      if (m && r.month !== m) return false;
      if (c && r.companyName !== c) return false;
      if (a && r.actionType !== a) return false;
      if (s && r.sla !== s) return false;
      if (mg && r.manageBy !== mg) return false;
      return true;
    });

    if (statsEl) statsEl.innerHTML = 'Showing <b>' + filteredData.length + '</b> of ' + hiringData.length + ' new hires';

    renderKpis();
    renderCharts();
    renderTable();
  }

  function openKpiDrill(kpi) {
    var title = '';
    var recs = [];
    if (kpi === 'all') {
      title = 'All New Hires (Filtered)';
      recs = filteredData;
    } else if (kpi === 'withinSla') {
      title = 'Hiring Cases — Within SLA';
      recs = filteredData.filter(function (r) { return r.sla === 'Within SLA'; });
    } else if (kpi === 'completeDocs') {
      title = 'Hiring Cases — 100% Complete Documents (6/6)';
      recs = filteredData.filter(function (r) { return r.docs && r.docs.isComplete; });
    } else if (kpi === 'smDirect') {
      title = 'Hiring Cases — Managed Directly by SM';
      recs = filteredData.filter(function (r) { return r.manageBy === 'SM'; });
    }
    if (window.SMApp && typeof window.SMApp.openDrill === 'function') {
      window.SMApp.openDrill(title, recs, 'hiring');
    }
  }

  function renderKpis() {
    if (!kpiRow) return;
    var total = filteredData.length;
    var withinSla = filteredData.filter(function (r) { return r.sla === 'Within SLA'; }).length;
    var slaRate = total > 0 ? Math.round((withinSla / total) * 100) : 0;
    var completeDocs = filteredData.filter(function (r) { return r.docs && r.docs.isComplete; }).length;
    var docRate = total > 0 ? Math.round((completeDocs / total) * 100) : 0;
    var smHandled = filteredData.filter(function (r) { return r.manageBy === 'SM'; }).length;

    kpiRow.innerHTML = '' +
      '<div class="kpi" data-kpi="all" title="Click to view all new hires" style="--kpi-c:var(--accent); --kpi-bg:var(--accent-soft);">' +
        '<div class="kpi-top"><div class="kpi-label">Total New Hires</div><div class="kpi-icon">👥</div></div>' +
        '<div class="kpi-value">' + total + '</div>' +
        '<div class="kpi-sub">Total onboarding records &middot; <span style="text-decoration:underline;">Click to view</span></div>' +
      '</div>' +
      '<div class="kpi" data-kpi="withinSla" title="Click to view Within SLA cases" style="--kpi-c:var(--good); --kpi-bg:var(--good-soft);">' +
        '<div class="kpi-top"><div class="kpi-label">SLA Compliance</div><div class="kpi-icon">⚡</div></div>' +
        '<div class="kpi-value">' + slaRate + '%</div>' +
        '<div class="kpi-sub">' + withinSla + ' within SLA &middot; <span style="text-decoration:underline;">Click to view</span></div>' +
      '</div>' +
      '<div class="kpi" data-kpi="completeDocs" title="Click to view complete documentation" style="--kpi-c:var(--warning); --kpi-bg:var(--warning-soft);">' +
        '<div class="kpi-top"><div class="kpi-label">Doc Completeness</div><div class="kpi-icon">📁</div></div>' +
        '<div class="kpi-value">' + docRate + '%</div>' +
        '<div class="kpi-sub">' + completeDocs + ' have all 6 docs &middot; <span style="text-decoration:underline;">Click to view</span></div>' +
      '</div>' +
      '<div class="kpi" data-kpi="smDirect" title="Click to view SM-managed cases" style="--kpi-c:var(--seq-2); --kpi-bg:var(--accent-soft);">' +
        '<div class="kpi-top"><div class="kpi-label">Managed by SM</div><div class="kpi-icon">🛡️</div></div>' +
        '<div class="kpi-value">' + smHandled + '</div>' +
        '<div class="kpi-sub">Service Management direct &middot; <span style="text-decoration:underline;">Click to view</span></div>' +
      '</div>';
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return;

    // 1. Month Chart
    var monthCounts = {};
    filteredData.forEach(function (r) {
      var m = r.month || 'Other';
      monthCounts[m] = (monthCounts[m] || 0) + 1;
    });
    var mLabels = Object.keys(monthCounts);
    var mValues = mLabels.map(function (k) { return monthCounts[k]; });

    var ctxM = document.getElementById('chartHiringMonth');
    if (ctxM) {
      if (charts.month) charts.month.destroy();
      charts.month = new Chart(ctxM, {
        type: 'bar',
        data: {
          labels: mLabels,
          datasets: [{
            label: 'New Hires',
            data: mValues,
            backgroundColor: '#3b82f6',
            borderRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // 2. SLA Chart
    var withinCount = filteredData.filter(function (r) { return r.sla === 'Within SLA'; }).length;
    var overCount = filteredData.length - withinCount;
    var ctxS = document.getElementById('chartHiringSla');
    if (ctxS) {
      if (charts.sla) charts.sla.destroy();
      charts.sla = new Chart(ctxS, {
        type: 'doughnut',
        data: {
          labels: ['Within SLA', 'Over SLA'],
          datasets: [{
            data: [withinCount, overCount],
            backgroundColor: ['#22c55e', '#ef4444']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // 3. Reason Chart
    var reasonCounts = {};
    filteredData.forEach(function (r) {
      var re = r.reason || 'Unspecified';
      reasonCounts[re] = (reasonCounts[re] || 0) + 1;
    });
    var rLabels = Object.keys(reasonCounts).slice(0, 6);
    var rValues = rLabels.map(function (k) { return reasonCounts[k]; });

    var ctxR = document.getElementById('chartHiringReason');
    if (ctxR) {
      if (charts.reason) charts.reason.destroy();
      charts.reason = new Chart(ctxR, {
        type: 'bar',
        data: {
          labels: rLabels,
          datasets: [{
            label: 'Count',
            data: rValues,
            backgroundColor: '#8b5cf6',
            borderRadius: 6
          }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
      });
    }

    // 4. Docs Chart
    var docCounts = { CV: 0, KTP: 0, KK: 0, NPWP: 0, Ijazah: 0, Rekening: 0 };
    filteredData.forEach(function (r) {
      if (r.docs) {
        if (r.docs.cv) docCounts.CV++;
        if (r.docs.ktp) docCounts.KTP++;
        if (r.docs.kk) docCounts.KK++;
        if (r.docs.npwp) docCounts.NPWP++;
        if (r.docs.ijazah) docCounts.Ijazah++;
        if (r.docs.bukuRekening) docCounts.Rekening++;
      }
    });

    var ctxD = document.getElementById('chartHiringDocs');
    if (ctxD) {
      if (charts.docs) charts.docs.destroy();
      charts.docs = new Chart(ctxD, {
        type: 'bar',
        data: {
          labels: Object.keys(docCounts),
          datasets: [{
            label: 'Ready Documents',
            data: Object.values(docCounts),
            backgroundColor: '#06b6d4',
            borderRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  }

  function renderTable() {
    if (!tableBody) return;
    if (filteredData.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">No hiring records match active filters</td></tr>';
      return;
    }

    var html = '';
    filteredData.slice(0, 100).forEach(function (r) {
      var slaBadge = r.sla === 'Within SLA' ? '<span class="badge b-good">Within SLA</span>' : '<span class="badge b-critical">Over SLA</span>';
      var docPct = r.docs ? r.docs.percent : 0;
      var docColor = docPct === 100 ? 'var(--good)' : (docPct >= 50 ? 'var(--warning)' : 'var(--critical)');

      html += '<tr>' +
        '<td>' + slaBadge + '</td>' +
        '<td><div class="cell-name">' + r.name + '</div><div class="cell-sub">NIK: ' + (r.id || '—') + '</div></td>' +
        '<td>' + r.companyName + '<div class="cell-sub">' + (r.companyCode || '') + '</div></td>' +
        '<td>' + r.positionName + '</td>' +
        '<td class="mono">' + (r.effectiveDate || '—') + '</td>' +
        '<td>' + r.actionType + '<div class="cell-sub">' + r.reason + '</div></td>' +
        '<td><div style="font-weight:700;color:' + docColor + ';">' + docPct + '% (' + (r.docs ? r.docs.count : 0) + '/6)</div></td>' +
        '<td><span class="badge ' + (r.manageBy === 'SM' ? 'b-serious' : 'b-neutral') + '">' + r.manageBy + '</span></td>' +
      '</tr>';
    });

    tableBody.innerHTML = html;
  }

  return { init: init };
})();

// -------------------------------------------------------------
// Separation Monitoring Application Engine
// -------------------------------------------------------------
window.SeparationApp = (function () {
  'use strict';

  var separationData = [];
  var filteredData = [];
  var charts = {};

  var kpiRow = null;
  var tableBody = null;
  var statsEl = null;

  var fSearch = null;
  var fDateFrom = null;
  var fDateTo = null;
  var fMonth = null;
  var fCompany = null;
  var fOffboarding = null;
  var fClearance = null;
  var fDoc = null;
  var fPic = null;
  var fReset = null;

  function getEl(id) {
    return document.getElementById(id);
  }

  function init() {
    kpiRow = getEl('separationKpiRow');
    tableBody = getEl('separationBody');
    statsEl = getEl('separationStats');

    fSearch = getEl('sSearch');
    fDateFrom = getEl('sDateFrom');
    fDateTo = getEl('sDateTo');
    fMonth = getEl('sMonth');
    fCompany = getEl('sCompany');
    fOffboarding = getEl('sOffboardingStatus');
    fClearance = getEl('sClearanceStatus');
    fDoc = getEl('sDocStatus');
    fPic = getEl('sPic');
    fReset = getEl('sReset');

    if (kpiRow && !kpiRow._drillBound) {
      kpiRow.addEventListener('click', function (e) {
        var card = e.target.closest('.kpi');
        if (!card) return;
        var kpi = card.getAttribute('data-kpi');
        openKpiDrill(kpi);
      });
      kpiRow._drillBound = true;
    }

    if (separationData.length > 0) {
      applyFilters();
      return;
    }

    if (statsEl) statsEl.innerHTML = '<span style="color:var(--accent);">⏳ Loading live separation data...</span>';

    fetch('/api/data?module=separation')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        separationData = data.records || [];
        populateDropdowns();
        setupListeners();
        applyFilters();
      })
      .catch(function (err) {
        console.warn('API fetch failed, checking snapshot fallback:', err.message);
        if (window.SNAPSHOT_SEPARATION && Array.isArray(window.SNAPSHOT_SEPARATION.records)) {
          separationData = window.SNAPSHOT_SEPARATION.records;
          populateDropdowns();
          setupListeners();
          applyFilters();
        } else {
          console.error('Failed to load separation records:', err);
          if (statsEl) statsEl.innerHTML = '<span style="color:var(--critical);">❌ Failed to load separation data: ' + err.message + '</span>';
        }
      });
  }

  function populateDropdowns() {
    function unique(arr, prop) {
      var s = {};
      arr.forEach(function (r) { if (r[prop]) s[r[prop]] = true; });
      return Object.keys(s).sort();
    }

    if (fMonth) {
      fMonth.innerHTML = '<option value="">All Months</option>';
      unique(separationData, 'month').forEach(function (m) {
        var opt = document.createElement('option'); opt.value = m; opt.textContent = m; fMonth.appendChild(opt);
      });
    }

    if (fCompany) {
      fCompany.innerHTML = '<option value="">All Companies</option>';
      unique(separationData, 'companyName').forEach(function (c) {
        var opt = document.createElement('option'); opt.value = c; opt.textContent = c; fCompany.appendChild(opt);
      });
    }

    if (fOffboarding) {
      fOffboarding.innerHTML = '<option value="">All Offboarding Status</option>';
      unique(separationData, 'offboardingStatus').forEach(function (o) {
        var opt = document.createElement('option'); opt.value = o; opt.textContent = o; fOffboarding.appendChild(opt);
      });
    }

    if (fClearance) {
      fClearance.innerHTML = '<option value="">All Clearance Status</option>';
      unique(separationData, 'exitClearanceStatus').forEach(function (cl) {
        var opt = document.createElement('option'); opt.value = cl; opt.textContent = cl; fClearance.appendChild(opt);
      });
    }

    if (fDoc) {
      fDoc.innerHTML = '<option value="">All Document Status</option>';
      unique(separationData, 'documentStatus').forEach(function (d) {
        var opt = document.createElement('option'); opt.value = d; opt.textContent = d; fDoc.appendChild(opt);
      });
    }

    if (fPic) {
      fPic.innerHTML = '<option value="">All SM PIC</option>';
      unique(separationData, 'smPic').forEach(function (p) {
        var opt = document.createElement('option'); opt.value = p; opt.textContent = p; fPic.appendChild(opt);
      });
    }
  }

  function setupListeners() {
    [fMonth, fCompany, fOffboarding, fClearance, fDoc, fPic, fDateFrom, fDateTo].forEach(function (el) {
      if (el) el.addEventListener('change', applyFilters);
    });
    if (fSearch) fSearch.addEventListener('input', applyFilters);
    if (fReset) {
      fReset.addEventListener('click', function () {
        if (fSearch) fSearch.value = '';
        if (fDateFrom) fDateFrom.value = '';
        if (fDateTo) fDateTo.value = '';
        if (fMonth) fMonth.value = '';
        if (fCompany) fCompany.value = '';
        if (fOffboarding) fOffboarding.value = '';
        if (fClearance) fClearance.value = '';
        if (fDoc) fDoc.value = '';
        if (fPic) fPic.value = '';
        applyFilters();
      });
    }
  }

  function applyFilters() {
    var q = fSearch ? fSearch.value.trim().toLowerCase() : '';
    var dFrom = fDateFrom ? fDateFrom.value : '';
    var dTo = fDateTo ? fDateTo.value : '';
    var m = fMonth ? fMonth.value : '';
    var c = fCompany ? fCompany.value : '';
    var off = fOffboarding ? fOffboarding.value : '';
    var cl = fClearance ? fClearance.value : '';
    var doc = fDoc ? fDoc.value : '';
    var pic = fPic ? fPic.value : '';

    filteredData = separationData.filter(function (r) {
      if (dFrom && (!r.lastWorkingDate || r.lastWorkingDate < dFrom)) return false;
      if (dTo && (!r.lastWorkingDate || r.lastWorkingDate > dTo)) return false;
      if (q && (r.name.toLowerCase().indexOf(q) === -1 && String(r.id).toLowerCase().indexOf(q) === -1 && r.companyName.toLowerCase().indexOf(q) === -1)) return false;
      if (m && r.month !== m) return false;
      if (c && r.companyName !== c) return false;
      if (off && r.offboardingStatus !== off) return false;
      if (cl && r.exitClearanceStatus !== cl) return false;
      if (doc && r.documentStatus !== doc) return false;
      if (pic && r.smPic !== pic) return false;
      return true;
    });

    if (statsEl) statsEl.innerHTML = 'Showing <b>' + filteredData.length + '</b> of ' + separationData.length + ' offboardings';

    renderKpis();
    renderCharts();
    renderTable();
  }

  function openKpiDrill(kpi) {
    var title = '';
    var recs = [];
    if (kpi === 'all') {
      title = 'All Separations (Filtered)';
      recs = filteredData;
    } else if (kpi === 'urgent') {
      title = 'Separation Cases — URGENT Action';
      recs = filteredData.filter(function (r) { return r.priority === 'URGENT'; });
    } else if (kpi === 'pendingClearance') {
      title = 'Separation Cases — Pending Exit Clearance';
      recs = filteredData.filter(function (r) { return r.exitClearanceStatus && r.exitClearanceStatus.toLowerCase().indexOf('complete') === -1; });
    } else if (kpi === 'pendingDocs') {
      title = 'Separation Cases — Pending Documents (Paklaring Not Sent)';
      recs = filteredData.filter(function (r) { return r.documentStatus && (r.documentStatus.toLowerCase().indexOf('sent') === -1 && r.documentStatus.toLowerCase().indexOf('done') === -1); });
    }
    if (window.SMApp && typeof window.SMApp.openDrill === 'function') {
      window.SMApp.openDrill(title, recs, 'separation');
    }
  }

  function renderKpis() {
    if (!kpiRow) return;
    var total = filteredData.length;
    var pendingClearance = filteredData.filter(function (r) { return r.exitClearanceStatus && r.exitClearanceStatus.toLowerCase().indexOf('complete') === -1; }).length;
    var pendingDocs = filteredData.filter(function (r) { return r.documentStatus && (r.documentStatus.toLowerCase().indexOf('sent') === -1 && r.documentStatus.toLowerCase().indexOf('done') === -1); }).length;
    var urgentCount = filteredData.filter(function (r) { return r.priority === 'URGENT'; }).length;

    kpiRow.innerHTML = '' +
      '<div class="kpi" data-kpi="all" title="Click to view all separations" style="--kpi-c:var(--accent); --kpi-bg:var(--accent-soft);">' +
        '<div class="kpi-top"><div class="kpi-label">Total Separations</div><div class="kpi-icon">🚪</div></div>' +
        '<div class="kpi-value">' + total + '</div>' +
        '<div class="kpi-sub">Total offboarding cases &middot; <span style="text-decoration:underline;">Click to view</span></div>' +
      '</div>' +
      '<div class="kpi" data-kpi="urgent" title="Click to view urgent cases" style="--kpi-c:var(--critical); --kpi-bg:var(--critical-soft);">' +
        '<div class="kpi-top"><div class="kpi-label">Urgent Action</div><div class="kpi-icon">⚠️</div></div>' +
        '<div class="kpi-value">' + urgentCount + '</div>' +
        '<div class="kpi-sub">Approaching deadline &middot; <span style="text-decoration:underline;">Click to view</span></div>' +
      '</div>' +
      '<div class="kpi" data-kpi="pendingClearance" title="Click to view pending clearances" style="--kpi-c:var(--warning); --kpi-bg:var(--warning-soft);">' +
        '<div class="kpi-top"><div class="kpi-label">Pending Clearance</div><div class="kpi-icon">⏳</div></div>' +
        '<div class="kpi-value">' + pendingClearance + '</div>' +
        '<div class="kpi-sub">Handover in progress &middot; <span style="text-decoration:underline;">Click to view</span></div>' +
      '</div>' +
      '<div class="kpi" data-kpi="pendingDocs" title="Click to view pending documents" style="--kpi-c:var(--serious); --kpi-bg:var(--serious-soft);">' +
        '<div class="kpi-top"><div class="kpi-label">Pending Documents</div><div class="kpi-icon">📑</div></div>' +
        '<div class="kpi-value">' + pendingDocs + '</div>' +
        '<div class="kpi-sub">Paklaring not sent &middot; <span style="text-decoration:underline;">Click to view</span></div>' +
      '</div>';
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return;

    // 1. Offboarding Status Funnel
    var statusCounts = {};
    filteredData.forEach(function (r) {
      var s = r.offboardingStatus || 'Other';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    var ctxS = document.getElementById('chartSepStatus');
    if (ctxS) {
      if (charts.status) charts.status.destroy();
      charts.status = new Chart(ctxS, {
        type: 'bar',
        data: {
          labels: Object.keys(statusCounts),
          datasets: [{
            label: 'Cases',
            data: Object.values(statusCounts),
            backgroundColor: '#f97316',
            borderRadius: 6
          }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
      });
    }

    // 2. Exit Clearance & Doc Delivery
    var clCounts = {};
    filteredData.forEach(function (r) {
      var cl = r.exitClearanceStatus || 'Pending';
      clCounts[cl] = (clCounts[cl] || 0) + 1;
    });

    var ctxCl = document.getElementById('chartSepClearance');
    if (ctxCl) {
      if (charts.clearance) charts.clearance.destroy();
      charts.clearance = new Chart(ctxCl, {
        type: 'doughnut',
        data: {
          labels: Object.keys(clCounts),
          datasets: [{
            data: Object.values(clCounts),
            backgroundColor: ['#22c55e', '#eab308', '#ef4444', '#3b82f6']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // 3. Month Chart
    var monthCounts = {};
    filteredData.forEach(function (r) {
      var m = r.month || 'Other';
      monthCounts[m] = (monthCounts[m] || 0) + 1;
    });

    var ctxM = document.getElementById('chartSepMonth');
    if (ctxM) {
      if (charts.month) charts.month.destroy();
      charts.month = new Chart(ctxM, {
        type: 'bar',
        data: {
          labels: Object.keys(monthCounts),
          datasets: [{
            label: 'Offboarding Count',
            data: Object.values(monthCounts),
            backgroundColor: '#e11d48',
            borderRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // 4. SM PIC Workload
    var picCounts = {};
    filteredData.forEach(function (r) {
      var p = r.smPic || 'Unassigned';
      picCounts[p] = (picCounts[p] || 0) + 1;
    });

    var ctxP = document.getElementById('chartSepPic');
    if (ctxP) {
      if (charts.pic) charts.pic.destroy();
      charts.pic = new Chart(ctxP, {
        type: 'bar',
        data: {
          labels: Object.keys(picCounts),
          datasets: [{
            label: 'Handled Cases',
            data: Object.values(picCounts),
            backgroundColor: '#0ea5e9',
            borderRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  }

  function renderTable() {
    if (!tableBody) return;
    if (filteredData.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No separation records match active filters</td></tr>';
      return;
    }

    var html = '';
    filteredData.slice(0, 100).forEach(function (r) {
      var priBadge = r.priority === 'URGENT' ? '<span class="badge b-critical">URGENT</span>' :
                    (r.priority === 'HIGH' ? '<span class="badge b-serious">HIGH</span>' : '<span class="badge b-warning">' + (r.priority || 'MEDIUM') + '</span>');

      html += '<tr>' +
        '<td>' + priBadge + '</td>' +
        '<td><div class="cell-name">' + r.name + '</div><div class="cell-sub">No: ' + (r.id || '—') + '</div></td>' +
        '<td>' + r.companyName + '</td>' +
        '<td class="mono">' + (r.lastWorkingDate || '—') + '</td>' +
        '<td class="mono">' + (r.deadline || '—') + '</td>' +
        '<td><span class="badge b-neutral">' + r.offboardingStatus + '</span></td>' +
        '<td>' + r.exitClearanceStatus + '</td>' +
        '<td>' + r.documentStatus + '</td>' +
        '<td><b>' + r.smPic + '</b></td>' +
      '</tr>';
    });

    tableBody.innerHTML = html;
  }

  return { init: init };
})();
