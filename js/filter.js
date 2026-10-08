/**
 * Service Management Contract Evaluation Monitor
 * Filter Engine & Table Sorting (Supports Dynamic Year & Per-Tab Month Filters)
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

  // Year Selectors
  var yearSel = document.getElementById('fYear');
  var yearTab1Sel = document.getElementById('fYearTab1');
  var yearTab2Sel = document.getElementById('fYearTab2');
  var yearTab3Sel = document.getElementById('fYearTab3');

  // Month Selectors
  var monthSel = document.getElementById('fMonth');
  var monthTab1Sel = document.getElementById('fMonthTab1');
  var monthTab2Sel = document.getElementById('fMonthTab2');
  var monthTab3Sel = document.getElementById('fMonthTab3');

  var sortState = { key: 'priorityRank', dir: 1 };
  var currentTab = 'priority';

  var tabYears = {
    priority: '',
    process: '',
    breakdown: ''
  };

  var tabMonths = {
    priority: '',
    process: '',
    breakdown: ''
  };

  var dataCache = {
    allRecords: [],
    onProgressRecords: [],
    sortedYears: [],
    allYearMap: {},
    opYearMap: {},
    compYearMap: {},
    allMonthMap: {},
    opMonthMap: {},
    compMonthMap: {}
  };

  function refreshMonthDropdown(tabKey) {
    var yr = tabYears[tabKey] || '';
    var targetMonthSel = tabKey === 'priority' ? monthTab1Sel : (tabKey === 'process' ? monthTab2Sel : monthTab3Sel);
    if (!targetMonthSel) return;

    var currentChosenMonth = tabMonths[tabKey] || '';
    if (yr && currentChosenMonth && currentChosenMonth.slice(0, 4) !== yr) {
      currentChosenMonth = '';
      tabMonths[tabKey] = '';
    }

    var allMonths = Object.keys(dataCache.allMonthMap).sort().reverse();
    var filteredMonths = yr ? allMonths.filter(function (m) { return m.slice(0, 4) === yr; }) : allMonths;

    targetMonthSel.innerHTML = '<option value="">All Months' + (yr ? ' (' + yr + ')' : '') + '</option>';
    filteredMonths.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m;
      if (tabKey === 'process') {
        var tot = dataCache.allMonthMap[m] || 0;
        var op = dataCache.opMonthMap[m] || 0;
        var comp = dataCache.compMonthMap[m] || 0;
        var lbl = fmtMonth(m) + ' (' + tot + ' total';
        if (op > 0 && comp > 0) lbl += ': ' + op + ' act, ' + comp + ' comp';
        lbl += ')';
        o.textContent = lbl;
      } else {
        var opCnt = dataCache.opMonthMap[m] || 0;
        o.textContent = fmtMonth(m) + ' (' + opCnt + (opCnt === 1 ? ' case)' : ' cases)');
      }
      targetMonthSel.appendChild(o);
    });

    targetMonthSel.value = currentChosenMonth;

    if (currentTab === tabKey) {
      syncTopMonthOptions(yr, currentChosenMonth);
    }
  }

  function syncTopMonthOptions(yr, currentChosenMonth) {
    if (!monthSel) return;
    var allMonths = Object.keys(dataCache.allMonthMap).sort().reverse();
    var filteredMonths = yr ? allMonths.filter(function (m) { return m.slice(0, 4) === yr; }) : allMonths;
    monthSel.innerHTML = '<option value="">All Months' + (yr ? ' (' + yr + ')' : '') + '</option>';
    filteredMonths.forEach(function (m) {
      var tot = dataCache.allMonthMap[m] || 0;
      var o = document.createElement('option');
      o.value = m;
      o.textContent = fmtMonth(m) + ' (' + tot + ' cases)';
      monthSel.appendChild(o);
    });
    monthSel.value = currentChosenMonth || '';
  }

  function initOptions(allRecords, onProgressRecords) {
    dataCache.allRecords = allRecords || [];
    dataCache.onProgressRecords = onProgressRecords || [];

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

    // Dynamic Year & Month calculation
    var allYearMap = {}, opYearMap = {}, compYearMap = {};
    var allMonthMap = {}, opMonthMap = {}, compMonthMap = {};

    (allRecords || []).forEach(function (r) {
      if (r.endOfContract && /^\d{4}/.test(r.endOfContract)) {
        var y = r.endOfContract.slice(0, 4);
        allYearMap[y] = (allYearMap[y] || 0) + 1;
        if ((r.status || '').trim() === 'On Progress') {
          opYearMap[y] = (opYearMap[y] || 0) + 1;
        } else if ((r.status || '').trim() === 'Completed') {
          compYearMap[y] = (compYearMap[y] || 0) + 1;
        }

        if (/^\d{4}-\d{2}/.test(r.endOfContract)) {
          var m = r.endOfContract.slice(0, 7);
          allMonthMap[m] = (allMonthMap[m] || 0) + 1;
          if ((r.status || '').trim() === 'On Progress') {
            opMonthMap[m] = (opMonthMap[m] || 0) + 1;
          } else if ((r.status || '').trim() === 'Completed') {
            compMonthMap[m] = (compMonthMap[m] || 0) + 1;
          }
        }
      }
    });

    var sortedYears = Object.keys(allYearMap).sort().reverse();
    dataCache.sortedYears = sortedYears;
    dataCache.allYearMap = allYearMap;
    dataCache.opYearMap = opYearMap;
    dataCache.compYearMap = compYearMap;
    dataCache.allMonthMap = allMonthMap;
    dataCache.opMonthMap = opMonthMap;
    dataCache.compMonthMap = compMonthMap;

    // Populate Year dropdowns
    function populateYearSelect(selectEl, countMap) {
      if (!selectEl) return;
      selectEl.innerHTML = '<option value="">All Years</option>';
      sortedYears.forEach(function (y) {
        var cnt = countMap[y] || 0;
        var o = document.createElement('option');
        o.value = y;
        o.textContent = y + ' (' + cnt + (cnt === 1 ? ' case)' : ' cases)');
        selectEl.appendChild(o);
      });
    }

    populateYearSelect(yearTab1Sel, opYearMap);
    populateYearSelect(yearTab2Sel, allYearMap);
    populateYearSelect(yearTab3Sel, opYearMap);
    populateYearSelect(yearSel, allYearMap);

    // Initial month population
    refreshMonthDropdown('priority');
    refreshMonthDropdown('process');
    refreshMonthDropdown('breakdown');
  }

  function currentFilters() {
    return {
      year: yearSel ? yearSel.value : '',
      month: monthSel ? monthSel.value : '',
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
    var yearFilter = (opts.year !== undefined) ? opts.year : f.year;
    var monthFilter = (opts.month !== undefined) ? opts.month : f.month;
    return (list || []).filter(function (r) {
      if (yearFilter) {
        if (!r.endOfContract || r.endOfContract.slice(0, 4) !== yearFilter) return false;
      }
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

  function getTabYear(tabKey) {
    return tabYears[tabKey] || '';
  }

  function getTabMonth(tabKey) {
    return tabMonths[tabKey] || '';
  }

  function setTabYear(tabKey, val) {
    tabYears[tabKey] = val || '';
    if (tabKey === 'priority' && yearTab1Sel) yearTab1Sel.value = tabYears[tabKey];
    if (tabKey === 'process' && yearTab2Sel) yearTab2Sel.value = tabYears[tabKey];
    if (tabKey === 'breakdown' && yearTab3Sel) yearTab3Sel.value = tabYears[tabKey];
    if (tabKey === currentTab && yearSel) yearSel.value = tabYears[tabKey];
    refreshMonthDropdown(tabKey);
  }

  function setTabMonth(tabKey, val) {
    tabMonths[tabKey] = val || '';
    if (tabKey === 'priority' && monthTab1Sel) monthTab1Sel.value = tabMonths[tabKey];
    if (tabKey === 'process' && monthTab2Sel) monthTab2Sel.value = tabMonths[tabKey];
    if (tabKey === 'breakdown' && monthTab3Sel) monthTab3Sel.value = tabMonths[tabKey];
    if (tabKey === currentTab && monthSel) monthSel.value = tabMonths[tabKey];
  }

  function syncTopFilters(activeTab) {
    currentTab = activeTab;
    if (yearSel) {
      yearSel.value = tabYears[activeTab] || '';
    }
    syncTopMonthOptions(tabYears[activeTab] || '', tabMonths[activeTab] || '');
  }

  function resetFilters(onResetCallback) {
    if (statusSel) statusSel.value = '';
    if (pillarSel) pillarSel.value = '';
    if (hrbpSel) hrbpSel.value = '';
    if (picSel) picSel.value = '';
    if (prioritySel) prioritySel.value = '';
    if (searchInput) searchInput.value = '';
    
    // Reset Year & Month filters
    tabYears.priority = '';
    tabYears.process = '';
    tabYears.breakdown = '';

    tabMonths.priority = '';
    tabMonths.process = '';
    tabMonths.breakdown = '';

    if (yearSel) yearSel.value = '';
    if (yearTab1Sel) yearTab1Sel.value = '';
    if (yearTab2Sel) yearTab2Sel.value = '';
    if (yearTab3Sel) yearTab3Sel.value = '';

    refreshMonthDropdown('priority');
    refreshMonthDropdown('process');
    refreshMonthDropdown('breakdown');
    syncTopMonthOptions('', '');

    if (typeof onResetCallback === 'function') onResetCallback();
  }

  function setupEventListeners(onChangeCallback) {
    [statusSel, pillarSel, hrbpSel, picSel, prioritySel].forEach(function (el) {
      if (el) el.addEventListener('change', onChangeCallback);
    });
    if (searchInput) searchInput.addEventListener('input', onChangeCallback);

    // Global Year changed
    if (yearSel) {
      yearSel.addEventListener('change', function () {
        var yVal = yearSel.value;
        tabYears[currentTab] = yVal;
        if (currentTab === 'priority' && yearTab1Sel) yearTab1Sel.value = yVal;
        if (currentTab === 'process' && yearTab2Sel) yearTab2Sel.value = yVal;
        if (currentTab === 'breakdown' && yearTab3Sel) yearTab3Sel.value = yVal;
        refreshMonthDropdown(currentTab);
        onChangeCallback();
      });
    }

    // Global Month changed
    if (monthSel) {
      monthSel.addEventListener('change', function () {
        var mVal = monthSel.value;
        tabMonths[currentTab] = mVal;
        if (currentTab === 'priority' && monthTab1Sel) monthTab1Sel.value = mVal;
        if (currentTab === 'process' && monthTab2Sel) monthTab2Sel.value = mVal;
        if (currentTab === 'breakdown' && monthTab3Sel) monthTab3Sel.value = mVal;
        onChangeCallback();
      });
    }

    // Per-tab Year dropdowns changed
    if (yearTab1Sel) {
      yearTab1Sel.addEventListener('change', function () {
        tabYears.priority = yearTab1Sel.value;
        if (currentTab === 'priority' && yearSel) yearSel.value = yearTab1Sel.value;
        refreshMonthDropdown('priority');
        onChangeCallback();
      });
    }

    if (yearTab2Sel) {
      yearTab2Sel.addEventListener('change', function () {
        tabYears.process = yearTab2Sel.value;
        if (currentTab === 'process' && yearSel) yearSel.value = yearTab2Sel.value;
        refreshMonthDropdown('process');
        onChangeCallback();
      });
    }

    if (yearTab3Sel) {
      yearTab3Sel.addEventListener('change', function () {
        tabYears.breakdown = yearTab3Sel.value;
        if (currentTab === 'breakdown' && yearSel) yearSel.value = yearTab3Sel.value;
        refreshMonthDropdown('breakdown');
        onChangeCallback();
      });
    }

    // Per-tab Month dropdowns changed
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
    getTabYear: getTabYear,
    setTabYear: setTabYear,
    getTabMonth: getTabMonth,
    setTabMonth: setTabMonth,
    syncTopFilters: syncTopFilters,
    resetFilters: resetFilters,
    setupEventListeners: setupEventListeners,
    getSortState: function () { return sortState; }
  };
})();
