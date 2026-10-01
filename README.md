# 📊 Contract Evaluation Monitoring Platform
### Enterprise Workforce Contract Lifecycle & SLA Governance Dashboard
**Service Management BAU Operations**

---

## 🌟 Executive Overview

**Contract Evaluation Monitoring Platform** adalah sistem analitik terpusat yang dirancang khusus untuk tim **Service Management (SM)** guna memantau, mengelola, dan mengotomasi tata kelola evaluasi masa berlaku kontrak kerja (*Fixed-Term Employment Contract & Probation Period*) di seluruh pilar dan entitas bisnis.

Platform ini mentransformasi spreadsheet operasional menjadi antarmuka eksekutif interaktif berkecepatan tinggi, memberikan visibilitas menyeluruh terhadap tanggal jatuh tempo kontrak, kepatuhan pengiriman reminder evaluasi, performa Service Level Agreement (SLA) SAP Action, hingga status penandatanganan dokumen digital WeSign.

```
+-----------------------------------------------------------------------------------+
|                            PRODUCTION ENVIRONMENT                                 |
|  Google Cloud Run (Singapore / asia-southeast1)                                   |
|  Live Endpoint: https://contract-evaluation-monitoring-645716388397.asia-southeast1.run.app |
+-----------------------------------------------------------------------------------+
```

---

## 🎯 Key Capabilities & Analytic Modules

Platform ini terbagi ke dalam **tiga modul analitik utama** dengan dukungan pencarian *real-time*, *multi-filter*, dan *drilldown modal* interaktif:

### 1. 🚨 Priority & Reminder Compliance Module (Tab 1)
* **Real-time KPI Scorecard**:
  * **On Progress**: Jumlah total kontrak aktif dalam proses evaluasi.
  * **Urgent (< 8 hari)**: Kasus kritis yang membutuhkan tindakan eskalasi segera.
  * **High (8–21 hari)**: Kasus prioritas tinggi yang mendekati batas waktu evaluasi.
  * **SLA Late**: Evaluasi yang melampaui batas waktu penyelesaian SAP.
  * **On-time Completion Rate %**: Rasio efisiensi penyelesaian evaluasi tepat waktu.
* **Reminder Compliance Matrix**: Visualisasi kepatuhan pengiriman pengingat evaluasi (Reminder 1, 2, dan 3) yang dipetakan terhadap tingkat urgensi kasus.
* **Contract Due Date Timeline**: Distribusi beban kerja jatuh tempo kontrak yang dikelompokkan per minggu (D+0–6, D+7–13, dst.).
* **Priority Action Table**: Daftar urut tindakan otomatis berdasarkan sisa hari (*days remaining*) dengan indikator peringatan "*Need Attention*" jika kasus berprioritas tinggi belum menerima reminder.

### 2. ⏱️ Process Stage & SLA Performance Module (Tab 2)
* **Evaluation Stage Funnel**: Visualisasi jumlah kasus aktif berdasarkan tahapan proses (*Assignment*, *Contract Extend*, *End of Contract*, *Follow Up HRBP*, dll.).
* **Completion SLA Distribution**: Metrik kinerja durasi dari tanggal akhir kontrak hingga eksekusi SAP Action (`0–7 Hari`, `7–20 Hari`, `21+ Hari`, dan `Late`).
* **WeSign Digital Signature Tracker**: Monitoring status sirkulasi dokumen digital WeSign (*Not Started*, *Sent / Awaiting Signature*, *Pending Approval*, *Signed*).

### 3. 👥 Team Breakdown & Workload Distribution Module (Tab 3)
* **Backlog by Pillar & Business Unit**: Peta sebaran kasus terbuka per pilar industri yang distack berdasarkan tingkat prioritas (*Urgent*, *High*, *Medium*, *Low*).
* **Workload by SM PIC**: Distribusi beban penanganan kasus per Person-in-Charge (PIC) di tim Service Management untuk memastikan alokasi kerja yang seimbang.

### 4. 🔍 Interactive Drilldown Modal
* Seluruh grafik dan kartu KPI dapat diklik langsung untuk membuka daftar nama karyawan yang relevan, lengkap dengan detail NIK, jabatan, level, HRBP, PIC, dan sisa hari kontrak.

---

## 🏗️ System Architecture & Tech Stack

Platform ini mengusung arsitektur **Zero-Build Static Web Container**, menghasilkan latensi minimal (<100ms), skalabilitas instan (*scale-to-zero* saat idle), dan bebas *dependency vulnerability*:

```
   +-------------------------------------------------------------+
   |                     DATA LAYER                              |
   |   Google Sheets Master (Service Management Database)        |
   |              ▲                               ▲              |
   |       (Online Live Fetch)          (Offline Fallback)       |
   |              │                               │              |
   |              ▼                               ▼              |
   |    [js/data-manager.js]             [data/snapshot.json]    |
   +-------------------------------------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |                  FRONTEND PROCESSING ENGINE                 |
   |   • js/config.js       : Business constants & formula rules |
   |   • js/filter.js       : Multi-criteria filtering & sorting |
   |   • js/charts.js       : Chart.js rendering & drilldown     |
   |   • js/app.js          : Lifecycle orchestrator & KPI logic |
   +-------------------------------------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |                     HOSTING & DELIVERY                      |
   |   • Production : Google Cloud Run (Nginx-Alpine Container)  |
   |   • Standalone : SM_Dashboard_Standalone.html (Single File) |
   +-------------------------------------------------------------+
```

| Layer | Komponen / Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Frontend Framework** | Vanilla JavaScript (ES6+), Semantic HTML5 | Zero npm dependencies, native DOM execution |
| **Styling Engine** | Custom Modern CSS (CSS Variables) | Native Dark & Light theme support |
| **Charting Engine** | Chart.js v4.5.1 | Canvas hardware acceleration, responsive vector charts |
| **Web Server / Proxy** | Nginx Alpine (Lightweight Linux) | Footprint ~15MB, start time ~10ms |
| **Cloud Infrastructure**| Google Cloud Run (`asia-southeast1`) | Serverless container, high availability, zero idle cost |
| **Primary Data Source** | Service Management Master Google Sheet | Auto-calculated live data pipeline |
| **Resilience Layer**   | Local Snapshot JSON Cache | Otomatis aktif saat koneksi offline / failover |

---

## 📁 Struktur Direktori Project

```text
Contract_Evaluation_Dashboard_Monitoring_V1/
├── index.html                     # Halaman antarmuka utama (modular)
├── Dockerfile                     # Blueprint Nginx container untuk Cloud Run
├── .dockerignore                  # Filter asset build container
├── .gitignore                     # Aturan eksklusi Git
├── bundle.ps1                     # Utilitas kompilasi ke 1 file standalone offline
├── SM_Dashboard_Standalone.html   # Bundle mandiri (bisa dibuka langsung tanpa server)
├── README.md                      # Dokumentasi master teknis & serah terima
├── css/
│   └── dashboard.css              # Seluruh aturan desain, tipografi, tema, & layout
├── js/
│   ├── config.js                  # Konfigurasi GSheet, aturan prioritas, & SLA
│   ├── data-manager.js            # Engine fetch GSheet, parser CSV, & derived logic
│   ├── filter.js                  # Engine multi-filter, search, dan sorting tabel
│   ├── charts.js                  # Seluruh konfigurasi dan renderer grafik Chart.js
│   ├── app.js                     # Orkestrasi inisialisasi, KPI cards, & modal
│   └── _chartjs_cache.min.js      # Pustaka Chart.js lokal untuk bundling mandiri
└── data/
    └── snapshot.json              # Cadangan snapshot data evaluasi kontrak
```

---

## 🚀 Panduan Deployment & Operasional

### 1. Menjalankan di Lingkungan Lokal (Development)

Jalankan local web server dari direktori utama project:

```powershell
# Menggunakan Python:
python -m http.server 8000

# Atau menggunakan Node.js (npx serve):
npx serve .
```
Akses melalui peramban: `http://localhost:8000`

### 2. Membuka Mode Standalone (Offline / Tanpa Server)
Cukup klik ganda file **`SM_Dashboard_Standalone.html`**. Seluruh kode HTML, CSS, JavaScript, visualisasi Chart.js, dan data telah di-bundle menjadi 1 file tunggal yang dapat dibuka di browser mana pun tanpa memerlukan internet maupun server.

### 3. Re-Deploy ke Google Cloud Run (Production)

Pastikan Google Cloud SDK (`gcloud`) terpasang dan terhubung dengan project `hris-292403`:

```powershell
# 1. Pastikan project aktif sudah sesuai
gcloud config set project hris-292403

# 2. Build container image ke Container Registry
gcloud builds submit --tag gcr.io/hris-292403/contract-evaluation-monitoring:latest .

# 3. Deploy container ke Cloud Run di region Singapore
gcloud run deploy contract-evaluation-monitoring `
  --image gcr.io/hris-292403/contract-evaluation-monitoring:latest `
  --region asia-southeast1 `
  --platform managed `
  --allow-unauthenticated
```

---

## 🔄 Re-Bundling File Standalone

Setiap kali tim melakukan perubahan pada logika di `js/`, styling di `css/`, atau memperbarui `data/snapshot.json`, jalankan script bundling untuk memperbarui versi single-file:

```powershell
.\bundle.ps1
```
Output terkompilasi akan langsung diperbarui ke `SM_Dashboard_Standalone.html`.

---

## 🔒 Tata Kelola Data & Keamanan (Data Governance)

1. **Prinsip Client-Side Rendering**:
   Data yang ditarik dari Google Sheets diproses langsung di memori browser pengguna. Tidak ada data pribadi karyawan yang disimpan pada basis data perantara publik.
2. **Graceful Failover**:
   Dashboard secara cerdas memantau ketersediaan jaringan. Jika Google Sheets API tidak dapat dijangkau, sistem beralih otomatis ke *local snapshot* dan menampilkan status badge di top bar.
3. **Pemberian Hak Akses Terkontrol**:
   Untuk lingkungan produksi internal berskala enterprise, koneksi data dapat dialihkan menggunakan Google Cloud IAM Service Account atau Google Apps Script Gateway agar dokumen master tetap berstatus *Private/Restricted*.

---

*Disiapkan untuk Handover Operasional Tim Service Management.*
