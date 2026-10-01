/**
 * Service Management Contract Evaluation Monitor
 * Filter Engine & Table Sorting
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

  var sortState = { key: 'priorityRank', dir: 1 };

  function initOptions(allRecords, onProgressRecords) {
    // Reset options
    pillarSel.innerHTML = '<option value="">All Pillars</option>';
    hrbpSel.innerHTML = '<option value="">All HRBPs</option>';
    picSel.innerHTML = '<option value="">All PICs</option>';
    prioritySel.innerHTML = '<option value="">All Priorities</option>';

    uniqueSorted(onProgressRecords, 'pillar').forEach(function (p) {
      var o = document.createElement('option'); o.value = p; o.textContent = p; pillarSel.appendChild(o);
    });

    uniqueSorted(allRecords, 'hrbp').forEach(function (p) {
      var o = document.createElement('option'); o.value = p; o.textContent = p; hrbpSel.appendChild(o);
    });

    uniqueSorted(allRecords, 'pic').forEach(function (p) {
      var o = document.createElement('option'); o.value = p; o.textContent = p; picSel.appendChild(o);
    });

    PRIORITY_ORDER.forEach(function (p) {
      var o = document.createElement('option'); o.value = p; o.textContent = p; prioritySel.appendChild(o);
    });
  }

  function currentFilters() {
    return {
      status: statusSel.value,
      pillar: pillarSel.value,
      hrbp: hrbpSel.value,
      pic: picSel.value,
      priority: prioritySel.value,
      q: searchInput.value.trim().toLowerCase()
    };
  }

  function applyFilters(list, f, opts) {
    opts = opts || {};
    return list.filter(function (r) {
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

  function resetFilters(onResetCallback) {
    statusSel.value = '';
    pillarSel.value = '';
    hrbpSel.value = '';
    picSel.value = '';
    prioritySel.value = '';
    searchInput.value = '';
    if (typeof onResetCallback === 'function') onResetCallback();
  }

  function setupEventListeners(onChangeCallback) {
    [statusSel, pillarSel, hrbpSel, picSel, prioritySel].forEach(function (el) {
      el.addEventListener('change', onChangeCallback);
    });
    searchInput.addEventListener('input', onChangeCallback);

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
    resetFilters: resetFilters,
    setupEventListeners: setupEventListeners,
    getSortState: function () { return sortState; }
  };
})();
