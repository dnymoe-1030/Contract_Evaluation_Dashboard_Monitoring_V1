/**
 * Service Management Contract Evaluation Monitor
 * Configuration, Constants & Helper Functions
 */

// Google Sheets Integration Configuration
// (Bisa diisi ID GSheet tim Service Management untuk auto-sync data live)
var GSHEET_CONFIG = {
  // ID Spreadsheet Google Sheet tim Service Management:
  spreadsheetId: '1OuXq9g48pthKwplwGe96QMc3Ol_coa0yrzE_Se-R4hk', 
  // ID Tab / Lembar kerja spesifik (gid dari URL):
  gid: '2113128387',
  // Nama Sheet / Tab (opsional jika gid sudah ditentukan):
  sheetName: '',
  // URL Custom CSV atau Apps Script jika ada:
  customEndpoint: '',
  // Status sinkronisasi live
  useLive: true
};

// Priority Configuration
var PRIORITY_ORDER = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
var PRIORITY_RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
var PRIORITY_COLOR_VAR = { 
  URGENT: '--critical', 
  HIGH: '--serious', 
  MEDIUM: '--warning', 
  LOW: '--good' 
};
var PRIORITY_BADGE_CLASS = { 
  URGENT: 'b-critical', 
  HIGH: 'b-serious', 
  MEDIUM: 'b-warning', 
  LOW: 'b-good' 
};

// SLA Configuration
var SLA_ORDER = ['Late', '21 Up', '7 - 20', '0 - 7'];
var SLA_COLOR_VAR = { 
  'Late': '--critical', 
  '21 Up': '--serious', 
  '7 - 20': '--warning', 
  '0 - 7': '--good' 
};
var SLA_LABEL = { 
  'Late': 'Late', 
  '21 Up': '21+ days', 
  '7 - 20': '7–20 days', 
  '0 - 7': '0–7 days' 
};
var SLA_BADGE_CLASS = { 
  'Late': 'b-critical', 
  '21 Up': 'b-serious', 
  '7 - 20': 'b-warning', 
  '0 - 7': 'b-good' 
};

// Modal Table Headers
var ACTIVE_HEADERS = ['Priority', 'Employee Name', 'Pillar / Company', 'Days Remaining', 'End of Contract', 'Process Stage', 'SM Reminders', 'SM PIC'];
var COMPLETED_HEADERS = ['Status', 'Employee Name', 'Pillar / Company', 'End of Contract', 'SLA', 'Process Stage', 'SM PIC'];

// Utility Helpers
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgba(hex, alpha) {
  hex = (hex || '').replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
  var r = parseInt(hex.substring(0, 2), 16),
      g = parseInt(hex.substring(2, 4), 16),
      b = parseInt(hex.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function priorityForDays(days) {
  if (days < 8) return 'URGENT';
  if (days < 22) return 'HIGH';
  if (days < 46) return 'MEDIUM';
  return 'LOW';
}

function fmtDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAsOf(iso) {
  if (!iso) return '—';
  var d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtMonth(yyyy_mm) {
  if (!yyyy_mm) return '';
  var parts = String(yyyy_mm).split('-');
  if (parts.length !== 2) return yyyy_mm;
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  if (m >= 1 && m <= 12) {
    return monthNames[m - 1] + ' ' + y;
  }
  return yyyy_mm;
}

function weekBucketLabel(days) {
  var idx = Math.max(0, Math.floor(days / 7));
  var startD = idx * 7, endD = idx * 7 + 6;
  return { idx: idx, label: 'D+' + startD + '–' + endD };
}

function uniqueSorted(list, key) {
  var s = {};
  list.forEach(function (r) { if (r[key]) s[r[key]] = true; });
  return Object.keys(s).sort();
}

// Icon Set (Inline SVG, lightweight & zero dependency)
var ICON = {
  users: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20"/><circle cx="9.7" cy="7.5" r="3.3"/><path d="M21 20v-1.6a3.4 3.4 0 0 0-2.6-3.3"/><path d="M15.2 4.3a3.3 3.3 0 0 1 0 6.4"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.7 4.8A5.5 5.5 0 0 1 18 8.5c0 3.1.8 4.9 1.5 5.8"/><path d="M6.3 6.3C5.5 7.3 5 8.7 5 10.5c0 4-1.5 5.5-1.5 5.5h13"/><path d="M10.3 20a1.7 1.7 0 0 0 3.3 0"/><path d="M3 3l18 18"/></svg>',
  clockAlert: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="12.5" r="8"/><path d="M11 8v4.5l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.5 2.5 5-5.2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2 4.5 6v5.6C4.5 16.3 7.7 20 12 21.5c4.3-1.5 7.5-5.2 7.5-9.9V6L12 3.2Z"/><path d="M9 12.2l2.1 2.1 4-4.3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  funnel: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6 7.3V18l-4 2v-7.7L4 5Z"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 4 8l8 4.5 8-4.5-8-4.5Z"/><path d="M4 12l8 4.5 8-4.5"/><path d="M4 16l8 4.5 8-4.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5 5 19"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.3" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="4.3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.3" cy="17.5" r="1" fill="currentColor" stroke="none"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><circle cx="12" cy="8.2" r="0.9" fill="currentColor" stroke="none"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5h4.3l1.4 2.3h4.6l1.4-2.3H20"/><path d="M5.5 6h13l1.5 6.5v6a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5v-6L5.5 6Z"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13.5"/><path d="M13 6.5 18.5 12 13 17.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"/></svg>'
};
