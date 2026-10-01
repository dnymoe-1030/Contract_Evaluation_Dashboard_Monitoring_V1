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
   * Convert CSV rows to structured records
   */
  function convertCSVToRecords(rows) {
    if (rows.length < 2) return [];
    var headers = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    
    // Map standard column variations
    function findIdx(candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var idx = headers.indexOf(candidates[i]);
        if (idx !== -1) return idx;
      }
      return -1;
    }

    var col = {
      id: findIdx(['id', 'no', 'employee id', 'nik']),
      name: findIdx(['name', 'employee name', 'nama karyawan', 'nama']),
      company: findIdx(['company', 'perusahaan', 'pt']),
      pillar: findIdx(['pillar', 'pilar', 'pillar / company']),
      hrbp: findIdx(['hrbp']),
      pic: findIdx(['pic', 'hr pic']),
      smPic: findIdx(['sm pic', 'pic sm', 'smpic']),
      contractType: findIdx(['contract type', 'tipe kontrak', 'contracttype']),
      endOfContract: findIdx(['end of contract', 'end of contract date', 'akhir kontrak', 'enddate']),
      daysRemaining: findIdx(['days remaining', 'sisa hari', 'days']),
      remarks: findIdx(['remarks', 'process stage', 'status evaluasi', 'remarksraw']),
      status: findIdx(['status']),
      priority: findIdx(['priority', 'prioritas']),
      position: findIdx(['position', 'jabatan']),
      psLevel: findIdx(['ps level', 'level', 'pslevel']),
      reminder1: findIdx(['reminder 1', 'reminder1']),
      reminder2: findIdx(['reminder 2', 'reminder2']),
      reminder3: findIdx(['reminder 3', 'reminder3']),
      reminderCount: findIdx(['reminder count', 'remindercount', 'jumlah reminder']),
      wesign: findIdx(['wesign', 'status wesign', 'wesignraw']),
      slaDays: findIdx(['sla days', 'sladays']),
      sla: findIdx(['sla', 'status sla'])
    };

    var records = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var rec = {};
      Object.keys(col).forEach(function (k) {
        var idx = col[k];
        rec[k] = idx !== -1 && row[idx] !== undefined ? row[idx].trim() : null;
      });

      // Type castings
      if (rec.daysRemaining !== null) {
        rec.daysRemaining = parseInt(rec.daysRemaining, 10);
        if (isNaN(rec.daysRemaining)) rec.daysRemaining = null;
      }
      if (rec.reminderCount !== null) {
        rec.reminderCount = parseInt(rec.reminderCount, 10) || 0;
      } else {
        rec.reminderCount = 0;
        if (rec.reminder1) rec.reminderCount++;
        if (rec.reminder2) rec.reminderCount++;
        if (rec.reminder3) rec.reminderCount++;
      }

      records.push(rec);
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
