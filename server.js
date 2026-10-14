/**
 * Contract Evaluation Monitoring Platform
 * Cloud Run Backend Proxy with Google Cloud IAM Service Account
 */

const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1OuXq9g48pthKwplwGe96QMc3Ol_coa0yrzE_Se-R4hk';
const SHEET_NAME = process.env.SHEET_NAME || 'Contract & Probation Evaluation';

// In-memory cache (TTL: 60 seconds)
let cache = {
  data: null,
  timestamp: 0,
  ttlMs: 60 * 1000
};

// -------------------------------------------------------------
// Data Normalization & Business Rules
// -------------------------------------------------------------
function parseDateToIso(str) {
  if (!str) return null;
  str = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const m = str.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const monNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const monIdx = monNames.indexOf(m[2].toLowerCase().slice(0, 3));
    if (monIdx !== -1) {
      const y = parseInt(m[3], 10);
      const mm = String(monIdx + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return str;
}

function calcDaysRemaining(endOfContractIso) {
  if (!endOfContractIso) return null;
  const d = new Date(endOfContractIso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function priorityForDays(days) {
  if (days === null || days === undefined) return null;
  if (days < 8) return 'URGENT';
  if (days < 22) return 'HIGH';
  if (days < 46) return 'MEDIUM';
  return 'LOW';
}

function normalizeRemarks(val) {
  if (!val) return '—';
  const s = String(val).trim().toLowerCase();
  if (s.includes('permanent')) return 'Permanent Employee Assignment';
  if (s.includes('extend')) return 'Contract Extend';
  if (s.includes('end of contract')) return 'End of Contract';
  if (s.includes('end of probation')) return 'End of Probation';
  return String(val).trim();
}

function normalizeWesign(val) {
  if (!val) return 'Not Started';
  const s = String(val).trim().toLowerCase();
  if (s.includes('sent') || s.includes('awaiting')) return 'Sent / Awaiting Signature';
  if (s.includes('pending')) return 'Pending Approval';
  if (s.includes('signed') || /\d{4}/.test(s)) return 'Signed (Dated)';
  if (s === '-' || s === 'not started' || s === '') return 'Not Started';
  return String(val).trim();
}

/**
 * Detect column indexes dynamically from the header row (row 0),
 * falling back to canonical index positions if headers are not found.
 */
function resolveColumnMap(headerRow) {
  const map = {
    id: 0,
    name: 1,
    company: 2,
    supervisor: 3,
    hrbp: 4,
    pic: 5,
    contractType: 6,
    endOfContract: 7,
    smPic: 8,
    remarks: 9,
    status: 10,
    priority: 11,
    pillar: 12,
    position: 13,
    psLevel: 14,
    actionDate: 15,
    reminder1: 16,
    reminder2: 17,
    reminder3: 18,
    wesign: 20,
    slaDays: 21,
    sla: 22
  };

  if (!headerRow || !Array.isArray(headerRow)) return map;

  headerRow.forEach((col, idx) => {
    const h = String(col || '').trim().toLowerCase();
    if (!h) return;

    if (h === 'id' || h === 'no' || h === 'no.' || h.includes('employee id') || h.includes('id contract')) map.id = idx;
    else if (h.includes('employee name') || h === 'name' || h === 'nama') map.name = idx;
    else if (h.includes('company') || h === 'pt') map.company = idx;
    else if (h.includes('supervisor') || h.includes('atasan')) map.supervisor = idx;
    else if (h.includes('hrbp')) map.hrbp = idx;
    else if (h.includes('pic') && !h.includes('sm pic')) map.pic = idx;
    else if (h.includes('contract type') || h.includes('tipe')) map.contractType = idx;
    else if (h.includes('end of contract') || h.includes('contract end') || h.includes('eoc')) map.endOfContract = idx;
    else if (h.includes('sm pic') || h === 'sm_pic') map.smPic = idx;
    else if (h.includes('remarks') || h.includes('stage') || h.includes('process stage')) map.remarks = idx;
    else if (h === 'status' || h.includes('status evaluasi')) map.status = idx;
    else if (h.includes('priority') || h === 'prioritas') map.priority = idx;
    else if (h.includes('pillar') || h.includes('pilar')) map.pillar = idx;
    else if (h.includes('position') || h.includes('jabatan')) map.position = idx;
    else if (h.includes('ps level') || h.includes('level')) map.psLevel = idx;
    else if (h.includes('action date') || h.includes('sap date')) map.actionDate = idx;
    else if (h.includes('reminder 1') || h === 'rem 1') map.reminder1 = idx;
    else if (h.includes('reminder 2') || h === 'rem 2') map.reminder2 = idx;
    else if (h.includes('reminder 3') || h === 'rem 3') map.reminder3 = idx;
    else if (h.includes('wesign') || h.includes('we sign')) map.wesign = idx;
    else if (h.includes('sla days') || h.includes('days sla')) map.slaDays = idx;
    else if (h === 'sla') map.sla = idx;
  });

  return map;
}

function convertRowsToRecords(rows) {
  if (!rows || rows.length < 2) return [];

  const colMap = resolveColumnMap(rows[0]);
  const records = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[colMap.name] || !String(row[colMap.name]).trim()) continue;

    const endOfContract = parseDateToIso(row[colMap.endOfContract]);
    const status = (row[colMap.status] || '').trim();
    const daysRemaining = calcDaysRemaining(endOfContract);

    const rem1 = parseDateToIso(row[colMap.reminder1]);
    const rem2 = parseDateToIso(row[colMap.reminder2]);
    const rem3 = parseDateToIso(row[colMap.reminder3]);
    let remCount = 0;
    if (rem1) remCount++;
    if (rem2) remCount++;
    if (rem3) remCount++;

    let priority = (row[colMap.priority] || '').trim().toUpperCase() || null;
    if (!priority && status === 'On Progress' && daysRemaining !== null) {
      priority = priorityForDays(daysRemaining);
    }

    records.push({
      id: row[colMap.id] ? (parseInt(row[colMap.id], 10) || row[colMap.id]) : null,
      name: row[colMap.name] ? String(row[colMap.name]).trim() : '',
      company: row[colMap.company] ? String(row[colMap.company]).trim() : '',
      supervisor: row[colMap.supervisor] ? String(row[colMap.supervisor]).trim() : null,
      hrbp: row[colMap.hrbp] ? String(row[colMap.hrbp]).trim() : null,
      pic: row[colMap.pic] ? String(row[colMap.pic]).trim() : null,
      contractType: row[colMap.contractType] ? String(row[colMap.contractType]).trim() : 'Contract',
      endOfContract: endOfContract,
      daysRemaining: daysRemaining,
      smPic: row[colMap.smPic] ? String(row[colMap.smPic]).trim() : null,
      remarks: normalizeRemarks(row[colMap.remarks]),
      status: status,
      priority: priority,
      pillar: row[colMap.pillar] ? String(row[colMap.pillar]).trim() : 'Unassigned',
      position: row[colMap.position] ? String(row[colMap.position]).trim() : null,
      psLevel: row[colMap.psLevel] ? String(row[colMap.psLevel]).trim() : null,
      actionDate: parseDateToIso(row[colMap.actionDate]),
      reminder1: rem1,
      reminder2: rem2,
      reminder3: rem3,
      reminderCount: remCount,
      wesign: normalizeWesign(row[colMap.wesign]),
      slaDays: row[colMap.slaDays] ? parseInt(row[colMap.slaDays], 10) : null,
      sla: row[colMap.sla] ? String(row[colMap.sla]).trim() : null
    });
  }

  return records;
}

// -------------------------------------------------------------
// Hiring Module Parser
// Headers: NIK | Name | Effective Date | Month | Action Type | Reason for Action | Company Code | Company Name | Position Code | Position Name | Request Date | Changed On | Changed by | SLA | Employee Group | Global ID | Manage By | CV | KTP | KK | NPWP | IJAZAH | BUKU REKENING | Notes
// -------------------------------------------------------------
function convertHiringRows(rows) {
  if (!rows || rows.length < 2) return [];

  const header = rows[0].map(h => String(h || '').replace(/[\r\n]+/g, ' ').trim().toLowerCase());
  const idx = {
    nik: header.findIndex(h => h === 'nik'),
    name: header.findIndex(h => h === 'name' || h.includes('nama')),
    effectiveDate: header.findIndex(h => h.includes('effective date')),
    month: header.findIndex(h => h === 'month' || h.includes('bulan')),
    actionType: header.findIndex(h => h.includes('action type')),
    reason: header.findIndex(h => h.includes('reason')),
    companyCode: header.findIndex(h => h.includes('company code') || (h.includes('company') && h.includes('code'))),
    companyName: header.findIndex(h => h.includes('company name') || (h.includes('company') && !h.includes('code'))),
    positionCode: header.findIndex(h => h.includes('position code') || (h.includes('position') && h.includes('code'))),
    positionName: header.findIndex(h => h.includes('position name') || (h.includes('position') && !h.includes('code'))),
    requestDate: header.findIndex(h => h.includes('request date')),
    changedOn: header.findIndex(h => h.includes('changed on')),
    changedBy: header.findIndex(h => h.includes('changed by')),
    sla: header.findIndex(h => h === 'sla'),
    employeeGroup: header.findIndex(h => h.includes('employee group')),
    globalId: header.findIndex(h => h.includes('global id')),
    manageBy: header.findIndex(h => h.includes('manage by')),
    cv: header.findIndex(h => h === 'cv'),
    ktp: header.findIndex(h => h === 'ktp'),
    kk: header.findIndex(h => h === 'kk'),
    npwp: header.findIndex(h => h === 'npwp'),
    ijazah: header.findIndex(h => h === 'ijazah'),
    bukuRekening: header.findIndex(h => h.includes('buku rekening') || h.includes('rekening')),
    notes: header.findIndex(h => h === 'notes' || h.includes('keterangan'))
  };

  // Fallbacks if not found by name
  if (idx.nik === -1) idx.nik = 0;
  if (idx.name === -1) idx.name = 1;
  if (idx.effectiveDate === -1) idx.effectiveDate = 2;
  if (idx.month === -1) idx.month = 3;
  if (idx.actionType === -1) idx.actionType = 4;
  if (idx.reason === -1) idx.reason = 5;
  if (idx.companyCode === -1) idx.companyCode = 6;
  if (idx.companyName === -1) idx.companyName = 7;
  if (idx.positionCode === -1) idx.positionCode = 8;
  if (idx.positionName === -1) idx.positionName = 9;
  if (idx.requestDate === -1) idx.requestDate = 10;
  if (idx.changedOn === -1) idx.changedOn = 11;
  if (idx.changedBy === -1) idx.changedBy = 12;
  if (idx.sla === -1) idx.sla = 13;
  if (idx.employeeGroup === -1) idx.employeeGroup = 14;
  if (idx.manageBy === -1) idx.manageBy = 16;
  if (idx.cv === -1) idx.cv = 17;
  if (idx.ktp === -1) idx.ktp = 18;
  if (idx.kk === -1) idx.kk = 19;
  if (idx.npwp === -1) idx.npwp = 20;
  if (idx.ijazah === -1) idx.ijazah = 21;
  if (idx.bukuRekening === -1) idx.bukuRekening = 22;
  if (idx.notes === -1) idx.notes = 23;

  function isDocYes(val) {
    if (!val) return false;
    const s = String(val).trim().toLowerCase();
    return s === 'yes' || s === 'y' || s === 'v' || s === 'ok' || s === 'ada' || s === 'complete' || s === '1';
  }

  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[idx.name] || !String(row[idx.name]).trim()) continue;

    const cvOk = isDocYes(row[idx.cv]);
    const ktpOk = isDocYes(row[idx.ktp]);
    const kkOk = isDocYes(row[idx.kk]);
    const npwpOk = isDocYes(row[idx.npwp]);
    const ijazahOk = isDocYes(row[idx.ijazah]);
    const rekOk = isDocYes(row[idx.bukuRekening]);
    const docsComplete = [cvOk, ktpOk, kkOk, npwpOk, ijazahOk, rekOk].filter(Boolean).length;

    records.push({
      id: row[idx.nik] ? String(row[idx.nik]).trim() : `H-${r}`,
      name: String(row[idx.name]).trim(),
      effectiveDate: parseDateToIso(row[idx.effectiveDate]),
      month: row[idx.month] ? String(row[idx.month]).trim() : '',
      actionType: row[idx.actionType] ? String(row[idx.actionType]).trim() : 'Hiring',
      reason: row[idx.reason] ? String(row[idx.reason]).trim() : '—',
      companyCode: row[idx.companyCode] ? String(row[idx.companyCode]).trim() : '',
      companyName: row[idx.companyName] ? String(row[idx.companyName]).trim() : 'Unassigned',
      positionCode: row[idx.positionCode] ? String(row[idx.positionCode]).trim() : '',
      positionName: row[idx.positionName] ? String(row[idx.positionName]).trim() : '—',
      requestDate: parseDateToIso(row[idx.requestDate]),
      changedOn: parseDateToIso(row[idx.changedOn]),
      changedBy: row[idx.changedBy] ? String(row[idx.changedBy]).trim() : '',
      sla: (row[idx.sla] || '').trim().toLowerCase().includes('over') ? 'Over SLA' : 'Within SLA',
      employeeGroup: row[idx.employeeGroup] ? String(row[idx.employeeGroup]).trim() : 'Regular',
      manageBy: (row[idx.manageBy] || '').trim().toLowerCase().includes('non') ? 'Non SM' : 'SM',
      docs: {
        cv: cvOk,
        ktp: ktpOk,
        kk: kkOk,
        npwp: npwpOk,
        ijazah: ijazahOk,
        bukuRekening: rekOk,
        count: docsComplete,
        percent: Math.round((docsComplete / 6) * 100),
        isComplete: docsComplete === 6
      },
      notes: row[idx.notes] ? String(row[idx.notes]).trim() : ''
    });
  }
  return records;
}

// -------------------------------------------------------------
// Separation Module Parser
// Headers: Personnel Number | Full Name | Company Code | Company Name | Last Working Date | Month | HR BU | SM PIC | Channel | Offboarding Status | Exit Clearance Status | Document Status | Document Receiver | Document Date Send | Deadline | Priority | SLA | Notes | Auto completed exit clearance
// -------------------------------------------------------------
function convertSeparationRows(rows) {
  if (!rows || rows.length < 2) return [];

  const header = rows[0].map(h => String(h || '').replace(/[\r\n]+/g, ' ').trim().toLowerCase());
  const idx = {
    personnelNumber: header.findIndex(h => h.includes('personnel') || h.includes('number') || h === 'nik'),
    name: header.findIndex(h => h.includes('full name') || h === 'name' || h.includes('nama')),
    companyCode: header.findIndex(h => h.includes('company code') || (h.includes('company') && h.includes('code'))),
    companyName: header.findIndex(h => h.includes('company name') || (h.includes('company') && !h.includes('code'))),
    lastWorkingDate: header.findIndex(h => h.includes('last working') || h.includes('lwd')),
    month: header.findIndex(h => h === 'month' || h.includes('bulan')),
    hrBu: header.findIndex(h => h.includes('hr bu') || h.includes('hrbp')),
    smPic: header.findIndex(h => h.includes('sm pic') || (h.includes('pic') && !h.includes('sm')) || h === 'pic'),
    channel: header.findIndex(h => h.includes('channel')),
    offboardingStatus: header.findIndex(h => h.includes('offboarding status')),
    exitClearanceStatus: header.findIndex(h => h.includes('exit clearance status') || h.includes('clearance status')),
    documentStatus: header.findIndex(h => h.includes('document status')),
    documentReceiver: header.findIndex(h => h.includes('document receiver')),
    documentDateSend: header.findIndex(h => h.includes('date send') || h.includes('document date')),
    deadline: header.findIndex(h => h.includes('deadline')),
    priority: header.findIndex(h => h.includes('priority') || h.includes('prioritas')),
    sla: header.findIndex(h => h === 'sla'),
    notes: header.findIndex(h => h === 'notes' || h.includes('catatan')),
    autoComplete: header.findIndex(h => h.includes('auto complete'))
  };

  // Fallbacks if not found by name
  if (idx.personnelNumber === -1) idx.personnelNumber = 0;
  if (idx.name === -1) idx.name = 1;
  if (idx.companyCode === -1) idx.companyCode = 2;
  if (idx.companyName === -1) idx.companyName = 3;
  if (idx.lastWorkingDate === -1) idx.lastWorkingDate = 4;
  if (idx.month === -1) idx.month = 5;
  if (idx.hrBu === -1) idx.hrBu = 6;
  if (idx.smPic === -1) idx.smPic = 7;
  if (idx.channel === -1) idx.channel = 8;
  if (idx.offboardingStatus === -1) idx.offboardingStatus = 9;
  if (idx.exitClearanceStatus === -1) idx.exitClearanceStatus = 10;
  if (idx.documentStatus === -1) idx.documentStatus = 11;
  if (idx.documentReceiver === -1) idx.documentReceiver = 12;
  if (idx.documentDateSend === -1) idx.documentDateSend = 13;
  if (idx.deadline === -1) idx.deadline = 14;
  if (idx.priority === -1) idx.priority = 15;
  if (idx.sla === -1) idx.sla = 16;
  if (idx.notes === -1) idx.notes = 18;

  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[idx.name] || !String(row[idx.name]).trim()) continue;

    const lwd = parseDateToIso(row[idx.lastWorkingDate]);
    const deadline = parseDateToIso(row[idx.deadline]);
    const daysToDeadline = deadline ? calcDaysRemaining(deadline) : (lwd ? calcDaysRemaining(lwd) : null);

    let priority = (row[idx.priority] || '').trim().toUpperCase();
    if (!priority && daysToDeadline !== null) {
      priority = priorityForDays(daysToDeadline);
    }

    records.push({
      id: row[idx.personnelNumber] ? String(row[idx.personnelNumber]).trim() : `S-${r}`,
      name: String(row[idx.name]).trim(),
      companyCode: row[idx.companyCode] ? String(row[idx.companyCode]).trim() : '',
      companyName: row[idx.companyName] ? String(row[idx.companyName]).trim() : 'Unassigned',
      lastWorkingDate: lwd,
      month: row[idx.month] ? String(row[idx.month]).trim() : '',
      hrBu: row[idx.hrBu] ? String(row[idx.hrBu]).trim() : '—',
      smPic: row[idx.smPic] ? String(row[idx.smPic]).trim() : 'Unassigned',
      channel: row[idx.channel] ? String(row[idx.channel]).trim() : '—',
      offboardingStatus: row[idx.offboardingStatus] ? String(row[idx.offboardingStatus]).trim() : 'In Progress',
      exitClearanceStatus: row[idx.exitClearanceStatus] ? String(row[idx.exitClearanceStatus]).trim() : 'Pending',
      documentStatus: row[idx.documentStatus] ? String(row[idx.documentStatus]).trim() : 'Not Sent',
      documentReceiver: row[idx.documentReceiver] ? String(row[idx.documentReceiver]).trim() : '',
      documentDateSend: parseDateToIso(row[idx.documentDateSend]),
      deadline: deadline,
      daysToDeadline: daysToDeadline,
      priority: priority || 'MEDIUM',
      sla: row[idx.sla] ? String(row[idx.sla]).trim() : 'Within SLA',
      notes: row[idx.notes] ? String(row[idx.notes]).trim() : ''
    });
  }
  return records;
}

// -------------------------------------------------------------
// Google Sheets API Service
// -------------------------------------------------------------
async function fetchSheetData(targetSheetName) {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const sheetToFetch = targetSheetName || SHEET_NAME;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetToFetch}'!A1:Z`
    });
    return { rows: res.data.values || [], sheetName: sheetToFetch };
  } catch (err) {
    console.warn(`Fetch range '${sheetToFetch}' failed, querying sheet metadata...`, err.message);
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const allSheets = (meta.data && meta.data.sheets) ? meta.data.sheets.map(s => s.properties.title) : [];
    console.log(`Available sheet tabs in document: ${allSheets.join(', ')}`);

    // Cari sheet yang mengandung kata target
    const targetLower = sheetToFetch.toLowerCase();
    const matchedSheet = allSheets.find(t => t.toLowerCase().includes(targetLower)) ||
                         allSheets.find(t => t.toLowerCase().includes('contract') || t.toLowerCase().includes('probation')) ||
                         allSheets[0];
    console.log(`Smart matched sheet: '${matchedSheet}'`);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${matchedSheet}'!A1:Z`
    });
    return { rows: res.data.values || [], sheetName: matchedSheet };
  }
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'contract-evaluation-monitoring',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/sheets', async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const tabs = (meta.data && meta.data.sheets) ? meta.data.sheets.map(s => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
      rowCount: s.properties.gridProperties ? s.properties.gridProperties.rowCount : null,
      colCount: s.properties.gridProperties ? s.properties.gridProperties.columnCount : null
    })) : [];

    // Jika diminta sample header untuk tab tertentu
    const tabName = req.query.tab;
    if (tabName) {
      const dataRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tabName}'!A1:Z5`
      });
      return res.json({ tabs, requestedTab: tabName, sampleRows: dataRes.data.values || [] });
    }

    res.json({ spreadsheetId: SPREADSHEET_ID, tabs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const requestedModule = (req.query.module || '').toLowerCase();
    let requestedSheet = req.query.sheet || null;

    if (requestedModule === 'hiring') {
      requestedSheet = 'Hiring';
    } else if (requestedModule === 'separation') {
      requestedSheet = 'Separation';
    } else if (requestedModule === 'contract') {
      requestedSheet = 'Contract & Probation Evaluation';
    }

    const now = Date.now();
    const cacheKey = requestedSheet || 'default';
    if (!cache[cacheKey]) cache[cacheKey] = { data: null, timestamp: 0 };

    if (cache[cacheKey].data && (now - cache[cacheKey].timestamp < cache.ttlMs) && !req.query.force) {
      return res.json(cache[cacheKey].data);
    }

    console.log(`[Proxy] Fetching live sheet data via Service Account (${SPREADSHEET_ID}) for '${requestedSheet || SHEET_NAME}'...`);
    const { rows, sheetName: actualSheet } = await fetchSheetData(requestedSheet);

    let records = [];
    const actualLower = actualSheet.toLowerCase();
    if (actualLower.includes('hiring')) {
      records = convertHiringRows(rows);
    } else if (actualLower.includes('separation')) {
      records = convertSeparationRows(rows);
    } else {
      records = convertRowsToRecords(rows);
    }

    const today = new Date().toISOString().slice(0, 10);

    const result = {
      asOf: today,
      module: actualLower.includes('hiring') ? 'hiring' : (actualLower.includes('separation') ? 'separation' : 'contract'),
      sheetName: actualSheet,
      headers: rows.length > 0 ? rows[0] : [],
      records: records,
      source: 'gsheet-proxy',
      total: records.length,
      cachedAt: new Date(now).toISOString()
    };

    cache[cacheKey].data = result;
    cache[cacheKey].timestamp = now;

    console.log(`[Proxy] Success! Returning ${records.length} records from sheet '${actualSheet}' for module '${result.module}'.`);
    res.json(result);
  } catch (err) {
    console.error('[Proxy Error] Failed to fetch from Google Sheets:', err.message);

    // Fallback to local snapshot
    let snapFile = 'snapshot.json';
    if (requestedModule === 'hiring') snapFile = 'snapshot_hiring.json';
    else if (requestedModule === 'separation') snapFile = 'snapshot_separation.json';

    const snapPath = path.join(__dirname, 'data', snapFile);
    if (fs.existsSync(snapPath)) {
      console.log(`[Proxy] Serving fallback ${snapFile}...`);
      let snapRaw = fs.readFileSync(snapPath, 'utf8');
      if (snapRaw.charCodeAt(0) === 0xFEFF) snapRaw = snapRaw.slice(1);
      const snap = JSON.parse(snapRaw);
      return res.json({
        asOf: snap.asOf,
        module: requestedModule || 'contract',
        records: snap.records,
        source: 'snapshot-fallback',
        error: err.message
      });
    }

    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Serve Static Frontend Assets
// -------------------------------------------------------------
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Contract Evaluation Monitor Server listening on ${PORT}`);
  console.log(` Target Spreadsheet: ${SPREADSHEET_ID}`);
  console.log(`====================================================`);
});
