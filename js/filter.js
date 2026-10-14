/**
 * Service Management Contract Evaluation Monitor
 * Filter Engine: 2-Column Date Picker (From & To) with Instant Auto-Apply & Reset
 */

var FilterEngine = (function () {
  'use strict';

  // Standard Filters
  var statusSel = document.getElementById('fStatus');
  var pillarSel = document.getElementById('fPillar');
  var hrbpSel = document.getElementById('fHrbp');
  var picSel = document.getElementById('fPic');
  var prioritySel = document.getElementById('fPriority');
  var searchInput = document.getElementById('fSearch');
  var resetBtn = document.getElementById('fReset');

  // Date Picker Selectors (From & To)
  var dateFromSel = document.getElementById('fDateFrom');
  var dateToSel = document.getElementById('fDateTo');

  var sortState = { key: 'priorityRank', dir: 1 };
  var currentTab = 'priority';

  // Unified Contract End Date Filter State (From & To)
  var filterState = {
    dateFrom: '',
    dateTo: ''
  };

  var dataCache = {
    allRecords: [],
    onProgressRecords: [],
    minDate: '',
    maxDate: ''
  };

  /**
   * Synchronize From & To Date Picker inputs and min/max constraints
   */
  function syncAllDateControls() {
    if (dateFromSel) dateFromSel.value = filterState.dateFrom || '';
    if (dateToSel) dateToSel.value = filterState.dateTo || '';

    // Update dynamic min/max constraints
    if (dateToSel) {
      dateToSel.min = filterState.dateFrom || dataCache.minDate || '';
    }
    if (dateFromSel) {
      dateFromSel.max = filterState.dateTo || dataCache.maxDate || '';
    }
  }

  /**
   * Initialize filter dropdown options and calculate bounds
   */
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

    // Calculate dataset min & max End of Contract dates
    var minDate = '', maxDate = '';
    (allRecords || []).forEach(function (r) {
      var eoc = r.endOfContract;
      if (eoc && /^\d{4}-\d{2}-\d{2}/.test(eoc)) {
        if (!minDate || eoc < minDate) minDate = eoc;
        if (!maxDate || eoc > maxDate) maxDate = eoc;
      }
    });

    dataCache.minDate = minDate;
    dataCache.maxDate = maxDate;

    // Set min & max attributes on date inputs for calendar bounds
    [dateFromSel, dateToSel].forEach(function (inp) {
      if (inp) {
        if (minDate) inp.min = minDate;
        if (maxDate) inp.max = maxDate;
      }
    });

    syncAllDateControls();
  }

  /**
   * Get currently active filters object
   */
  function currentFilters() {
    return {
      dateFrom: filterState.dateFrom || '',
      dateTo: filterState.dateTo || '',
      status: statusSel ? statusSel.value : '',
      pillar: pillarSel ? pillarSel.value : '',
      hrbp: hrbpSel ? hrbpSel.value : '',
      pic: picSel ? picSel.value : '',
      priority: prioritySel ? prioritySel.value : '',
      q: searchInput ? searchInput.value.trim().toLowerCase() : ''
    };
  }

  /**
   * Filter record dataset based on active filter criteria
   */
  function applyFilters(list, f, opts) {
    opts = opts || {};
    var dateFromFilter = (opts.dateFrom !== undefined) ? opts.dateFrom : (f.dateFrom || '');
    var dateToFilter = (opts.dateTo !== undefined) ? opts.dateTo : (f.dateTo || '');

    return (list || []).filter(function (r) {
      if (!r) return false;
      var eoc = r.endOfContract;

      // 1. Date Range filters (Exact Start & End Date filtering)
      if (dateFromFilter) {
        if (!eoc || eoc < dateFromFilter) return false;
      }
      if (dateToFilter) {
        if (!eoc || eoc > dateToFilter) return false;
      }

      // 2. Categorical filters
      if (f.status && r.status !== f.status) return false;
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

  function getDateFrom() {
    return filterState.dateFrom || '';
  }

  function getDateTo() {
    return filterState.dateTo || '';
  }

  function setDateRange(fromVal, toVal, onChangeCallback) {
    filterState.dateFrom = fromVal || '';
    filterState.dateTo = toVal || '';
    syncAllDateControls();
    if (typeof onChangeCallback === 'function') onChangeCallback();
  }

  function syncTopFilters(activeTab) {
    currentTab = activeTab;
    syncAllDateControls();
  }

  /**
   * Reset all filters to default state (clears date range, search, categories)
   */
  function resetFilters(onResetCallback) {
    if (statusSel) statusSel.value = '';
    if (pillarSel) pillarSel.value = '';
    if (hrbpSel) hrbpSel.value = '';
    if (picSel) picSel.value = '';
    if (prioritySel) prioritySel.value = '';
    if (searchInput) searchInput.value = '';

    filterState.dateFrom = '';
    filterState.dateTo = '';

    // Reset calendar min/max bounds
    [dateFromSel, dateToSel].forEach(function (inp) {
      if (inp) {
        inp.value = '';
        if (dataCache.minDate) inp.min = dataCache.minDate;
        if (dataCache.maxDate) inp.max = dataCache.maxDate;
      }
    });

    syncAllDateControls();

    if (typeof onResetCallback === 'function') onResetCallback();
  }

  /**
   * Event Listeners Registration (Auto-apply on date input/change)
   */
  function setupEventListeners(onChangeCallback) {
    // Categorical selects (Auto-apply on change)
    [statusSel, pillarSel, hrbpSel, picSel, prioritySel].forEach(function (el) {
      if (el) el.addEventListener('change', onChangeCallback);
    });
    if (searchInput) searchInput.addEventListener('input', onChangeCallback);

    // Date From input change / input handler (Auto-Apply)
    if (dateFromSel) {
      var handleFromChange = function () {
        var val = this.value || '';
        filterState.dateFrom = val;

        // Auto-adjust dateTo if dateFrom is greater than dateTo
        if (filterState.dateFrom && filterState.dateTo && filterState.dateFrom > filterState.dateTo) {
          filterState.dateTo = filterState.dateFrom;
        }

        syncAllDateControls();
        onChangeCallback(); // Auto-apply immediately!
      };

      dateFromSel.addEventListener('change', handleFromChange);
      dateFromSel.addEventListener('input', handleFromChange);
    }

    // Date To input change / input handler (Auto-Apply)
    if (dateToSel) {
      var handleToChange = function () {
        var val = this.value || '';
        filterState.dateTo = val;

        // Auto-adjust dateFrom if dateTo is less than dateFrom
        if (filterState.dateFrom && filterState.dateTo && filterState.dateTo < filterState.dateFrom) {
          filterState.dateFrom = filterState.dateTo;
        }

        syncAllDateControls();
        onChangeCallback(); // Auto-apply immediately!
      };

      dateToSel.addEventListener('change', handleToChange);
      dateToSel.addEventListener('input', handleToChange);
    }

    // Reset Button
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetFilters(onChangeCallback);
      });
    }

    // Header sorting in Priority Table
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
    getDateFrom: getDateFrom,
    getDateTo: getDateTo,
    getTabYear: function () { return filterState.dateFrom ? filterState.dateFrom.slice(0, 4) : ''; },
    getTabMonth: function () { return filterState.dateFrom ? filterState.dateFrom.slice(0, 7) : ''; },
    setDateRange: setDateRange,
    syncTopFilters: syncTopFilters,
    resetFilters: resetFilters,
    setupEventListeners: setupEventListeners,
    getSortState: function () { return sortState; }
  };
})();
