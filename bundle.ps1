# ============================================================
# SM Dashboard Bundler — Buat 1 file HTML standalone offline
# Jalankan dari folder: 07_SM Dashboard 2026 Contract Eval
# Output: SM_Dashboard_Standalone.html
# ============================================================

param(
    [string]$OutputFile = "SM_Dashboard_Standalone.html"
)

$baseDir = $PSScriptRoot
if (-not $baseDir) { $baseDir = Get-Location }

Write-Host "=== SM Dashboard Bundler ===" -ForegroundColor Cyan
Write-Host "Base dir: $baseDir" -ForegroundColor Gray

# ── 1. Chart.js (Cache / CDN) ───────────────────────────────
$chartJsUrl   = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.1/chart.umd.min.js"
$chartJsCache = Join-Path $baseDir "js\_chartjs_cache.min.js"

if (Test-Path $chartJsCache) {
    Write-Host "[OK] Chart.js cache found" -ForegroundColor Green
    $chartJsContent = [System.IO.File]::ReadAllText($chartJsCache, [System.Text.Encoding]::UTF8)
} else {
    Write-Host "[DL] Downloading Chart.js..." -ForegroundColor Yellow
    try {
        $wc = New-Object System.Net.WebClient
        $chartJsContent = $wc.DownloadString($chartJsUrl)
        [System.IO.File]::WriteAllText($chartJsCache, $chartJsContent, [System.Text.Encoding]::UTF8)
        Write-Host "[OK] Chart.js downloaded & cached" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Gagal download Chart.js, akan menggunakan link CDN" -ForegroundColor Red
        $chartJsContent = $null
    }
}

# ── 2. Baca file lokal ──────────────────────────────────────
function ReadFile($rel) {
    $path = Join-Path $baseDir $rel
    if (Test-Path $path) {
        return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    }
    Write-Host "[MISS] $rel" -ForegroundColor Red
    return "/* FILE NOT FOUND: $rel */"
}

$cssContent     = ReadFile "css\dashboard.css"
$snapshotJson   = ReadFile "data\snapshot.json"
$jsConfig       = ReadFile "js\config.js"
$jsDataManager  = ReadFile "js\data-manager.js"
$jsFilter       = ReadFile "js\filter.js"
$jsCharts       = ReadFile "js\charts.js"
$jsApp          = ReadFile "js\app.js"
$indexHtml      = ReadFile "index.html"

Write-Host "[OK] All source files loaded" -ForegroundColor Green

# ── 3. Rakit Standalone HTML ────────────────────────────────
# Ganti <link rel="stylesheet" href="css/dashboard.css"> dengan <style>...</style>
$styleTag = "<style>`n" + $cssContent + "`n</style>"
$bundleHtml = $indexHtml -replace '<link rel="stylesheet" href="css/dashboard.css">', $styleTag

# Ganti script Chart.js external dengan inline script jika ada cache
if ($chartJsContent) {
    $chartJsInline = "<script>`n" + $chartJsContent + "`n</script>"
    $bundleHtml = $bundleHtml -replace '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/[^"]+"></script>', $chartJsInline
}

# Ganti script-script modular di bawah dengan embedded raw-data & combined JS
$combinedJs = @"
<script id="raw-data" type="application/json">
$snapshotJson
</script>
<script>
// --- js/config.js ---
$jsConfig

// --- js/data-manager.js ---
$jsDataManager

// --- js/filter.js ---
$jsFilter

// --- js/charts.js ---
$jsCharts

// --- js/app.js ---
$jsApp
</script>
"@

$bundleHtml = $bundleHtml -replace '<!-- Scripts -->[\s\S]*?</body>', "$combinedJs`n</body>"

# Simpan hasil bundle
$outputPath = Join-Path $baseDir $OutputFile
[System.IO.File]::WriteAllText($outputPath, $bundleHtml, [System.Text.Encoding]::UTF8)

$sizeKb = [Math]::Round((Get-Item $outputPath).Length / 1KB, 1)
Write-Host "[SUCCESS] Bundle selesai: $OutputFile ($sizeKb KB)" -ForegroundColor Green
