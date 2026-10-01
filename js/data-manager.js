/**
 * Service Management Contract Evaluation Monitor
 * Data Manager: Google Sheets Fetcher + Fallback Snapshot Loader
 */

var DataManager = (function () {
  'use strict';

  var state = {
    asOf: null,
    records: [],
    onProgress: [],
    completed: [],
    source: 'snapshot', // 'gsheet' | 'snapshot' | 'embedded' | 'cache'
    isLoading: false,
    error: null
  };

  /**
   * Parse simple CSV with RFC4180-compliant quoted field support
   */
  function parseCSV(text) {
    var p = '', row = [''], rows = [row], inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i], next = text[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        row = [''];
        rows.push(row);
      } else {
        row[row.length - 1] += c;
      }
    }
    // Trim empty trailing rows
    return rows.filter(function (r) {
      return r.length > 1 || (r.length === 1 && r[0].trim() !== '');
    });
  }

  /**
   * Helper to parse dates like "30-Sep-2025" or "2025-09-30" to ISO YYYY-MM-DD
   */
  function parseDateToIso(str) {
    if (!str) return null;
    str = str.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    var m = str.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{4})$/);
    if (m) {
      var day = parseInt(m[1], 10);
      var monNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      var monIdx = monNames.indexOf(m[2].toLowerCase().slice(0, 3));
      if (monIdx !== -1) {
        var y = parseInt(m[3], 10);
        var mm = String(monIdx + 1).padStart(2, '0');
        var dd = String(day).padStart(2, '0');
        return y + '-' + mm + '-' + dd;
      }
    }
    var d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return str;
  }

  function calcDaysRemaining(endOfContractIso) {
    if (!endOfContractIso) return null;
    var d = new Date(endOfContractIso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diffMs = d.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  function normalizeRemarks(val) {
    if (!val) return '—';
    var s = val.trim().toLowerCase();
    if (s.indexOf('permanent') !== -1) return 'Permanent Employee Assignment';
    if (s.indexOf('extend') !== -1) return 'Contract Extend';
    if (s.indexOf('end of contract') !== -1) return 'End of Contract';
    if (s.indexOf('end of probation') !== -1) return 'End of Probation';
    return val.trim();
  }

  function normalizeWesign(val) {
    if (!val) return 'Not Started';
    var s = val.trim().toLowerCase();
    if (s.indexOf('sent') !== -1 || s.indexOf('awaiting') !== -1) return 'Sent / Awaiting Signature';
    if (s.indexOf('pending') !== -1) return 'Pending Approval';
    if (s.indexOf('signed') !== -1 || /\d{4}/.test(s)) return 'Signed (Dated)';
    if (s === '-' || s === 'not started' || s === '') return 'Not Started';
    return val.trim();
  }

  /**
   * Convert CSV rows to structured records
   */
  function convertCSVToRecords(rows) {
    if (rows.length < 2) return [];

    var records = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      // Jika baris kosong atau tidak memiliki nama, lewati
      if (!row || !row[1] || !row[1].trim()) continue;

      var endOfContract = parseDateToIso(row[7]);
      var status = (row[10] || '').trim();
      var daysRemaining = calcDaysRemaining(endOfContract);

      // Reminder dates
      var rem1 = parseDateToIso(row[16]);
      var rem2 = parseDateToIso(row[17]);
      var rem3 = parseDateToIso(row[18]);
      var remCount = 0;
      if (rem1) remCount++;
      if (rem2) remCount++;
      if (rem3) remCount++;

      // Priority
      var priority = (row[11] || '').trim().toUpperCase() || null;
      if (!priority && status === 'On Progress' && daysRemaining !== null) {
        priority = priorityForDays(daysRemaining);
      }

      records.push({
        id: row[0] ? (parseInt(row[0], 10) || row[0]) : null,
        name: row[1] ? row[1].trim() : '',
        company: row[2] ? row[2].trim() : '',
        supervisor: row[3] ? row[3].trim() : null,
        hrbp: row[4] ? row[4].trim() : null,
        pic: row[5] ? row[5].trim() : null,
        contractType: row[6] ? row[6].trim() : 'Contract',
        endOfContract: endOfContract,
        daysRemaining: daysRemaining,
        smPic: row[8] ? row[8].trim() : null,
        remarks: normalizeRemarks(row[9]),
        status: status,
        priority: priority,
        pillar: row[12] ? row[12].trim() : 'Unassigned',
        position: row[13] ? row[13].trim() : null,
        psLevel: row[14] ? row[14].trim() : null,
        actionDate: parseDateToIso(row[15]),
        reminder1: rem1,
        reminder2: rem2,
        reminder3: rem3,
        reminderCount: remCount,
        wesign: normalizeWesign(row[20]),
        slaDays: row[21] ? parseInt(row[21], 10) : null,
        sla: row[22] ? row[22].trim() : null
      });
    }
    return records;
  }

  /**
   * Process derived calculated fields & priorities
   */
  function processRecords(rawRecords) {
    rawRecords.forEach(function (r) {
      if (r.daysRemaining !== null && typeof r.daysRemaining !== 'number') {
        r.daysRemaining = parseInt(r.daysRemaining, 10);
        if (isNaN(r.daysRemaining)) r.daysRemaining = null;
      }
      if (r.reminderCount !== null && typeof r.reminderCount !== 'number') {
        r.reminderCount = parseInt(r.reminderCount, 10) || 0;
      }

      // Auto derive priority if null but on progress and has daysRemaining
      if (!r.priority && r.status === 'On Progress' && r.daysRemaining !== null) {
        r.priority = priorityForDays(r.daysRemaining);
      }

      r.priorityRank = r.priority ? (PRIORITY_RANK[r.priority] !== undefined ? PRIORITY_RANK[r.priority] : 99) : 99;
      r.noReminderGap = r.status === 'On Progress' && (r.priority === 'URGENT' || r.priority === 'HIGH') && (r.reminderCount === 0);
    });

    return rawRecords;
  }

  /**
   * Fetch data from Google Sheets live
   */
  function fetchFromGSheet(cfg, onSuccess, onError) {
    var sheetId = cfg.spreadsheetId;
    if (!sheetId) return onError(new Error('No Spreadsheet ID specified'));

    var gidParam = cfg.gid ? '&gid=' + encodeURIComponent(cfg.gid) : '';
    var sheetParam = cfg.sheetName ? '&sheet=' + encodeURIComponent(cfg.sheetName) : '';
    var url = cfg.customEndpoint || ('https://docs.google.com/spreadsheets/d/' + sheetId + '/gviz/tq?tqx=out:csv' + gidParam + sheetParam);

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
        return res.text();
      })
      .then(function (csvText) {
        var rows = parseCSV(csvText);
        var records = convertCSVToRecords(rows);
        var today = new Date().toISOString().slice(0, 10);
        onSuccess({ asOf: today, records: records, source: 'gsheet' });
      })
      .catch(onError);
  }

  /**
   * Fetch from local snapshot JSON file or embedded element
   */
  function fetchSnapshot(onSuccess, onError) {
    // 1. Cek apakah ada inline raw-data script (misalnya mode standalone bundle)
    var rawEl = document.getElementById('raw-data');
    if (rawEl && rawEl.textContent.trim()) {
      try {
        var data = JSON.parse(rawEl.textContent);
        return onSuccess({ asOf: data.asOf, records: data.records, source: 'embedded' });
      } catch (e) {
        console.warn('Gagal parse embedded raw-data, mencoba fetch data/snapshot.json...', e);
      }
    }

    // 2. Fetch data/snapshot.json via HTTP / file
    fetch('data/snapshot.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load data/snapshot.json: HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        onSuccess({ asOf: data.asOf, records: data.records, source: 'snapshot' });
      })
      .catch(function (err) {
        // 3. Fallback ke window.__SNAPSHOT_DATA__ jika ada
        if (window.__SNAPSHOT_DATA__) {
          return onSuccess({ asOf: window.__SNAPSHOT_DATA__.asOf, records: window.__SNAPSHOT_DATA__.records, source: 'window' });
        }
        onError(err);
      });
  }

  /**
   * Update internal state once records are ready
   */
  function commitData(data) {
    state.asOf = data.asOf;
    state.records = processRecords(data.records);
    state.onProgress = state.records.filter(function (r) { return r.status === 'On Progress'; });
    state.completed = state.records.filter(function (r) { return r.status === 'Completed'; });
    state.source = data.source;
    state.isLoading = false;
    state.error = null;

    // Dispatch custom event for reactive updates
    var event = new CustomEvent('sm:data-loaded', { detail: state });
    window.dispatchEvent(event);
  }

  /**
   * Main load method
   */
  function load(onComplete) {
    state.isLoading = true;

    function handleSuccess(res) {
      commitData(res);
      if (typeof onComplete === 'function') onComplete(null, state);
    }

    function handleFallback(err) {
      console.warn('Fallback ke snapshot lokal karena:', err.message);
      fetchSnapshot(
        function (snapRes) {
          handleSuccess(snapRes);
        },
        function (snapErr) {
          state.isLoading = false;
          state.error = snapErr.message;
          console.error('Fatal: Gagal memuat data!', snapErr);
          if (typeof onComplete === 'function') onComplete(snapErr, null);
        }
      );
    }

    // Jika spreadsheetId tersedia, coba ambil live data dari GSheet
    if (GSHEET_CONFIG && GSHEET_CONFIG.spreadsheetId) {
      fetchFromGSheet(GSHEET_CONFIG, handleSuccess, handleFallback);
    } else {
      fetchSnapshot(handleSuccess, handleFallback);
    }
  }

  return {
    getState: function () { return state; },
    load: load,
    reload: load
  };
})();
