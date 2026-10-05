/**
 * Service Management Contract Evaluation Monitor
 * Filter Engine & Table Sorting (Supports Per-Tab Month Filters)
 */

var FilterEngine = (function () {
  'use strict';

  var statusSel = document.getElementById('fStatus');
  var pillarSel = document.getElementById('fPillar');
  var hrbpSel = document.getElementById('fHrbp');
  var picSel = document.getElementById('fPic');
  var prioritySel = document.getElementById('fPriority');
  var searchInput = document.getElementById('fSearch');
  var resetBtn = document.getElementById('fReset');

  // Month Selectors
  var monthSel = document.getElementById('fMonth');
  var monthTab1Sel = document.getElementById('fMonthTab1');
  var monthTab2Sel = document.getElementById('fMonthTab2');
  var monthTab3Sel = document.getElementById('fMonthTab3');

  var sortState = { key: 'priorityRank', dir: 1 };
  var currentTab = 'priority';
  var tabMonths = {
    priority: '',
    process: '',
    breakdown: ''
  };

  function initOptions(allRecords, onProgressRecords) {
    // Reset standard dropdown options
    if (pillarSel) pillarSel.innerHTML = '<option value="">All Pillars</option>';
    if (hrbpSel) hrbpSel.innerHTML = '<option value="">All HRBPs</option>';
    if (picSel) picSel.innerHTML = '<option value="">All PICs</option>';
    if (prioritySel) prioritySel.innerHTML = '<option value="">All Priorities</option>';

    if (pillarSel) {
      uniqueSorted(onProgressRecords, 'pillar').forEach(function (p) {
        var o = document.createElement('option'); o.value = p; o.textContent = p; pillarSel.appendChild(o);
      });
    }

    if (hrbpSel) {
      uniqueSorted(allRecords, 'hrbp').forEach(function (p) {
        var o = document.createElement('option'); o.value = p; o.textContent = p; hrbpSel.appendChild(o);
      });
    }

    if (picSel) {
      uniqueSorted(allRecords, 'pic').forEach(function (p) {
        var o = document.createElement('option'); o.value = p; o.textContent = p; picSel.appendChild(o);
      });
    }

    if (prioritySel) {
      PRIORITY_ORDER.forEach(function (p) {
        var o = document.createElement('option'); o.value = p; o.textContent = p; prioritySel.appendChild(o);
      });
    }

    // Calculate month frequencies
    var allMonthMap = {}, opMonthMap = {}, compMonthMap = {};
    (allRecords || []).forEach(function (r) {
      if (r.endOfContract && /^\d{4}-\d{2}/.test(r.endOfContract)) {
        var m = r.endOfContract.slice(0, 7);
        allMonthMap[m] = (allMonthMap[m] || 0) + 1;
        if ((r.status || '').trim() === 'On Progress') {
          opMonthMap[m] = (opMonthMap[m] || 0) + 1;
        } else if ((r.status || '').trim() === 'Completed') {
          compMonthMap[m] = (compMonthMap[m] || 0) + 1;
        }
      }
    });

    var sortedMonths = Object.keys(allMonthMap).sort().reverse();

    // Populate Tab 1 (Priority) Month Options
    if (monthTab1Sel) {
      monthTab1Sel.innerHTML = '<option value="">All Months (Semua Bulan)</option>';
      sortedMonths.forEach(function (m) {
        var op = opMonthMap[m] || 0;
        var o = document.createElement('option');
        o.value = m;
        o.textContent = fmtMonth(m) + ' (' + op + (op === 1 ? ' case)' : ' cases)');
        monthTab1Sel.appendChild(o);
      });
    }

    // Populate Tab 2 (Process & SLA) Month Options
    if (monthTab2Sel) {
      monthTab2Sel.innerHTML = '<option value="">All Months (Semua Bulan)</option>';
      sortedMonths.forEach(function (m) {
        var tot = allMonthMap[m] || 0;
        var op = opMonthMap[m] || 0;
        var comp = compMonthMap[m] || 0;
        var o = document.createElement('option');
        o.value = m;
        var label = fmtMonth(m) + ' (' + tot + ' total';
        if (op > 0 && comp > 0) label += ': ' + op + ' act, ' + comp + ' comp';
        label += ')';
        o.textContent = label;
        monthTab2Sel.appendChild(o);
      });
    }

    // Populate Tab 3 (Team Breakdown) Month Options
    if (monthTab3Sel) {
      monthTab3Sel.innerHTML = '<option value="">All Months (Semua Bulan)</option>';
      sortedMonths.forEach(function (m) {
        var op = opMonthMap[m] || 0;
        var o = document.createElement('option');
        o.value = m;
        o.textContent = fmtMonth(m) + ' (' + op + (op === 1 ? ' case)' : ' cases)');
        monthTab3Sel.appendChild(o);
      });
    }

    // Populate Top Bar Month Select
    if (monthSel) {
      monthSel.innerHTML = '<option value="">All Months</option>';
      sortedMonths.forEach(function (m) {
        var tot = allMonthMap[m] || 0;
        var o = document.createElement('option');
        o.value = m;
        o.textContent = fmtMonth(m) + ' (' + tot + ' cases)';
        monthSel.appendChild(o);
      });
    }
  }

  function currentFilters() {
    return {
      status: statusSel ? statusSel.value : '',
      pillar: pillarSel ? pillarSel.value : '',
      hrbp: hrbpSel ? hrbpSel.value : '',
      pic: picSel ? picSel.value : '',
      priority: prioritySel ? prioritySel.value : '',
      q: searchInput ? searchInput.value.trim().toLowerCase() : ''
    };
  }

  function applyFilters(list, f, opts) {
    opts = opts || {};
    var monthFilter = (opts.month !== undefined) ? opts.month : f.month;
    return (list || []).filter(function (r) {
      if (monthFilter) {
        if (!r.endOfContract || r.endOfContract.slice(0, 7) !== monthFilter) return false;
      }
      if (f.pillar && r.pillar !== f.pillar) return false;
      if (f.hrbp && r.hrbp !== f.hrbp) return false;
      if (f.pic && r.pic !== f.pic) return false;
      if (!opts.ignorePriority && f.priority && r.priority !== f.priority) return false;
      if (f.q) {
        var hay = ((r.name || '') + ' ' + (r.company || '')).toLowerCase();
        if (hay.indexOf(f.q) === -1) return false;
      }
      return true;
    });
  }

  function getTabMonth(tabKey) {
    return tabMonths[tabKey] || '';
  }

  function setTabMonth(tabKey, val) {
    tabMonths[tabKey] = val || '';
    if (tabKey === 'priority' && monthTab1Sel) monthTab1Sel.value = tabMonths[tabKey];
    if (tabKey === 'process' && monthTab2Sel) monthTab2Sel.value = tabMonths[tabKey];
    if (tabKey === 'breakdown' && monthTab3Sel) monthTab3Sel.value = tabMonths[tabKey];
    if (tabKey === currentTab && monthSel) monthSel.value = tabMonths[tabKey];
  }

  function syncTopMonth(activeTab) {
    currentTab = activeTab;
    if (monthSel) {
      monthSel.value = tabMonths[activeTab] || '';
    }
  }

  function resetFilters(onResetCallback) {
    if (statusSel) statusSel.value = '';
    if (pillarSel) pillarSel.value = '';
    if (hrbpSel) hrbpSel.value = '';
    if (picSel) picSel.value = '';
    if (prioritySel) prioritySel.value = '';
    if (searchInput) searchInput.value = '';
    
    // Reset month filters
    tabMonths.priority = '';
    tabMonths.process = '';
    tabMonths.breakdown = '';
    if (monthSel) monthSel.value = '';
    if (monthTab1Sel) monthTab1Sel.value = '';
    if (monthTab2Sel) monthTab2Sel.value = '';
    if (monthTab3Sel) monthTab3Sel.value = '';

    if (typeof onResetCallback === 'function') onResetCallback();
  }

  function setupEventListeners(onChangeCallback) {
    [statusSel, pillarSel, hrbpSel, picSel, prioritySel].forEach(function (el) {
      if (el) el.addEventListener('change', onChangeCallback);
    });
    if (searchInput) searchInput.addEventListener('input', onChangeCallback);

    // Global Month dropdown changed
    if (monthSel) {
      monthSel.addEventListener('change', function () {
        var val = monthSel.value;
        tabMonths[currentTab] = val;
        if (currentTab === 'priority' && monthTab1Sel) monthTab1Sel.value = val;
        if (currentTab === 'process' && monthTab2Sel) monthTab2Sel.value = val;
        if (currentTab === 'breakdown' && monthTab3Sel) monthTab3Sel.value = val;
        onChangeCallback();
      });
    }

    // Per-tab month dropdowns changed
    if (monthTab1Sel) {
      monthTab1Sel.addEventListener('change', function () {
        tabMonths.priority = monthTab1Sel.value;
        if (currentTab === 'priority' && monthSel) monthSel.value = monthTab1Sel.value;
        onChangeCallback();
      });
    }

    if (monthTab2Sel) {
      monthTab2Sel.addEventListener('change', function () {
        tabMonths.process = monthTab2Sel.value;
        if (currentTab === 'process' && monthSel) monthSel.value = monthTab2Sel.value;
        onChangeCallback();
      });
    }

    if (monthTab3Sel) {
      monthTab3Sel.addEventListener('change', function () {
        tabMonths.breakdown = monthTab3Sel.value;
        if (currentTab === 'breakdown' && monthSel) monthSel.value = monthTab3Sel.value;
        onChangeCallback();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetFilters(onChangeCallback);
      });
    }

    // Header sorting
    document.querySelectorAll('#priorityTable thead th').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-key');
        if (!key) return;
        if (sortState.key === key) {
          sortState.dir *= -1;
        } else {
          sortState.key = key;
          sortState.dir = 1;
        }
        document.querySelectorAll('#priorityTable thead th').forEach(function (t) { t.classList.remove('sorted'); });
        th.classList.add('sorted');
        onChangeCallback();
      });
    });
  }

  return {
    initOptions: initOptions,
    currentFilters: currentFilters,
    applyFilters: applyFilters,
    getTabMonth: getTabMonth,
    setTabMonth: setTabMonth,
    syncTopMonth: syncTopMonth,
    resetFilters: resetFilters,
    setupEventListeners: setupEventListeners,
    getSortState: function () { return sortState; }
  };
})();
