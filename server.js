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
const SHEET_NAME = process.env.SHEET_NAME || 'Contract Evaluation';

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

function convertRowsToRecords(rows) {
  if (!rows || rows.length < 2) return [];

  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[1] || !String(row[1]).trim()) continue;

    const endOfContract = parseDateToIso(row[7]);
    const status = (row[10] || '').trim();
    const daysRemaining = calcDaysRemaining(endOfContract);

    const rem1 = parseDateToIso(row[16]);
    const rem2 = parseDateToIso(row[17]);
    const rem3 = parseDateToIso(row[18]);
    let remCount = 0;
    if (rem1) remCount++;
    if (rem2) remCount++;
    if (rem3) remCount++;

    let priority = (row[11] || '').trim().toUpperCase() || null;
    if (!priority && status === 'On Progress' && daysRemaining !== null) {
      priority = priorityForDays(daysRemaining);
    }

    records.push({
      id: row[0] ? (parseInt(row[0], 10) || row[0]) : null,
      name: row[1] ? String(row[1]).trim() : '',
      company: row[2] ? String(row[2]).trim() : '',
      supervisor: row[3] ? String(row[3]).trim() : null,
      hrbp: row[4] ? String(row[4]).trim() : null,
      pic: row[5] ? String(row[5]).trim() : null,
      contractType: row[6] ? String(row[6]).trim() : 'Contract',
      endOfContract: endOfContract,
      daysRemaining: daysRemaining,
      smPic: row[8] ? String(row[8]).trim() : null,
      remarks: normalizeRemarks(row[9]),
      status: status,
      priority: priority,
      pillar: row[12] ? String(row[12]).trim() : 'Unassigned',
      position: row[13] ? String(row[13]).trim() : null,
      psLevel: row[14] ? String(row[14]).trim() : null,
      actionDate: parseDateToIso(row[15]),
      reminder1: rem1,
      reminder2: rem2,
      reminder3: rem3,
      reminderCount: remCount,
      wesign: normalizeWesign(row[20]),
      slaDays: row[21] ? parseInt(row[21], 10) : null,
      sla: row[22] ? String(row[22]).trim() : null
    });
  }

  return records;
}

// -------------------------------------------------------------
// Google Sheets API Service
// -------------------------------------------------------------
async function fetchSheetData() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A1:Z`
    });
    return res.data.values || [];
  } catch (err) {
    console.warn(`Fetch range '${SHEET_NAME}' failed, querying sheet metadata...`, err.message);
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const firstSheetName = meta.data.sheets[0].properties.title;
    console.log(`Fallback fetching from first sheet: '${firstSheetName}'`);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${firstSheetName}'!A1:Z`
    });
    return res.data.values || [];
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

app.get('/api/data', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && (now - cache.timestamp < cache.ttlMs) && !req.query.force) {
      return res.json(cache.data);
    }

    console.log(`[Proxy] Fetching live sheet data via Service Account (${SPREADSHEET_ID})...`);
    const rows = await fetchSheetData();
    const records = convertRowsToRecords(rows);
    const today = new Date().toISOString().slice(0, 10);

    const result = {
      asOf: today,
      records: records,
      source: 'gsheet-proxy',
      total: records.length,
      cachedAt: new Date(now).toISOString()
    };

    cache.data = result;
    cache.timestamp = now;

    console.log(`[Proxy] Success! Returning ${records.length} records.`);
    res.json(result);
  } catch (err) {
    console.error('[Proxy Error] Failed to fetch from Google Sheets:', err.message);

    // Fallback to local snapshot
    const snapPath = path.join(__dirname, 'data', 'snapshot.json');
    if (fs.existsSync(snapPath)) {
      console.log('[Proxy] Serving fallback snapshot.json...');
      const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
      return res.json({
        asOf: snap.asOf,
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
