# 📊 Service Management — Contract Evaluation Monitor Dashboard

Dashboard analitik dan monitoring evaluasi masa kontrak karyawan untuk tim **Service Management (SM)**.

---

## 📁 Struktur Project Modular

```text
07_SM Dashboard 2026 Contract Eval/
├── index.html                 # Halaman utama aplikasi (modular, lightweight)
├── css/
│   └── dashboard.css          # Styling terpadu (Theme variables, Dark/Light mode, Responsive)
├── js/
│   ├── config.js              # Konfigurasi aplikasi, GSheet ID, mapping prioritas & helper
│   ├── data-manager.js        # Data engine: Live Google Sheets fetch + local fallback
│   ├── filter.js              # Filter engine (Status, Pillar, HRBP, PIC, Priority, Search, Sort)
│   ├── charts.js              # Visualisasi Chart.js (Reminder, Timeline, Funnel, SLA, dll.)
│   ├── app.js                 # App lifecycle, KPI cards, table rendering, drilldown modal
│   └── _chartjs_cache.min.js  # Offline cache Chart.js untuk bundling
├── data/
│   └── snapshot.json          # Snapshot data kontrak (~1.056 records)
├── bundle.ps1                 # Script PowerShell untuk build standalone single HTML
├── SM_Dashboard_Standalone.html # Build single file (zero server required)
├── .gitignore                 # Git ignore file
└── README_DEPLOYMENT.md       # Panduan deployment & integrasi
```

---

## ⚡ 1. Cara Menjalankan Secara Lokal (Development)

Karena dashboard membaca file `data/snapshot.json` melalui JavaScript `fetch()`, browser memerlukan local web server agar tidak terbentur aturan CORS file lokal:

### Menggunakan Python (Disarankan):
```powershell
python -m http.server 8000
```
Lalu buka: `http://localhost:8000` di browser.

### Menggunakan VS Code Live Server:
Klik kanan pada file `index.html` dan pilih **"Open with Live Server"**.

### Tanpa Web Server (Mode Standalone Langsung):
Cukup klik ganda (double click) file **`SM_Dashboard_Standalone.html`**. File ini sudah menggabungkan seluruh HTML, CSS, JavaScript, dan data secara mandiri sehingga bisa langsung dibuka di browser apa pun tanpa web server.

---

## 🔗 2. Cara Menghubungkan Google Sheets Tim SM (Live Sync)

Ketika ID Google Sheet tim SM sudah tersedia:

1. Buka file [`js/config.js`](file:///d:/Macbook/Cowork/24_Antigravity%20Google/07_SM%20Dashboard%202026%20Contract%20Eval/js/config.js).
2. Isi nilai `spreadsheetId`:
   ```javascript
   var GSHEET_CONFIG = {
     spreadsheetId: 'MASUKKAN_ID_SPREADSHEET_DI_SINI',
     sheetName: 'Contract Evaluation', // opsional: nama tab
     useLive: true
   };
   ```
3. **Pastikan pengaturan akses Google Sheet:**
   * Di Google Sheets, klik **Share (Bagikan)** > ubah General Access menjadi **"Anyone with the link can view"** (Siapa saja yang memiliki link dapat melihat).
4. Selesai! Dashboard akan otomatis membaca data live dari Google Sheet setiap kali dibuka. Jika pengguna sedang offline, dashboard akan otomatis fallback ke snapshot lokal.

---

## 🚀 3. Status & Opsi Deployment

### 🌟 Produksi Live (Google Cloud Run — Region Singapore)
Dashboard ini telah ter-deploy aktif di **Google Cloud Run**:
* **URL Produksi:** **https://contract-evaluation-monitoring-645716388397.asia-southeast1.run.app**
* **Project ID:** `hris-292403`
* **Region:** `asia-southeast1` (Singapore)
* **Service Name:** `contract-evaluation-monitoring`
* **Container Image:** `gcr.io/hris-292403/contract-evaluation-monitoring:latest`

#### Perintah Re-Deploy ke GCP Cloud Run:
```powershell
# 1. Build container image
gcloud builds submit --tag gcr.io/hris-292403/contract-evaluation-monitoring:latest .

# 2. Deploy ke Cloud Run
gcloud run deploy contract-evaluation-monitoring `
  --image gcr.io/hris-292403/contract-evaluation-monitoring:latest `
  --region asia-southeast1 `
  --platform managed `
  --allow-unauthenticated
```

### Opsi Lain: Git & Static Cloud (GitHub Pages / Vercel / Netlify)
1. Repository GitHub: [Contract_Evaluation_Dashboard_Monitoring_V1](https://github.com/dnymoe-1030/Contract_Evaluation_Dashboard_Monitoring_V1)

### Opsi B: Web Server Internal (Nginx / Apache / IIS)
* Copy seluruh folder project (atau file `index.html`, folder `css/`, `js/`, dan `data/`) ke direktori root web server (misal `/var/www/html/` atau `C:\inetpub\wwwroot\`).

### Opsi C: Distribusi File Standalone
* Jalankan script PowerShell bundling:
  ```powershell
  .\bundle.ps1
  ```
* Bagikan file `SM_Dashboard_Standalone.html` ke tim atau stakeholders melalui email, chat, atau shared network drive.

---

## 🛠️ Pemeliharaan & Build Standalone

Setiap kali Anda mengubah kode di `css/`, `js/`, atau memperbarui `data/snapshot.json`, jalankan perintah berikut untuk memperbarui versi standalone:
```powershell
.\bundle.ps1
```
Hasil kompilasi akan otomatis disimpan ke `SM_Dashboard_Standalone.html`.
