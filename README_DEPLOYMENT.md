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

## 🚀 3. Opsi Deployment

### Opsi A: Git & Static Cloud (GitHub Pages / Vercel / Netlify / Cloudflare Pages)
1. Push project ini ke repository GitHub.
2. Untuk **GitHub Pages**:
   * Masuk ke *Settings* repository > *Pages*.
   * Pilih branch `main` dan folder `/ (root)` > Save.
   * Dashboard akan langsung online dan beralamat `https://<username>.github.io/<repo-name>/`.
3. Untuk **Vercel / Netlify**:
   * Hubungkan repository GitHub dan klik Deploy (tidak butuh build step khusus).

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
