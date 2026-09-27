<#
.SYNOPSIS
  從 Mini-PLM 的 docs/promo 產生 GitHub Pages 用的靜態網站（輸出到本 repo 根目錄）。

.DESCRIPTION
  docs/promo/index.html 是給 Claude Artifact 用的「頁面片段」：沒有 doctype、head、body，
  由 Artifact 發布時自動包上。GitHub Pages 需要完整的 HTML 文件，所以這支腳本：
    1. 把片段拆成 head 區（title、meta、字型、函式庫）與 body 區（header 之後的內容），
       包成完整文件，並補上 charset、viewport、theme-color、favicon 與 Open Graph 分享資訊；
    2. 複製 promo.css、promo.js、sound.js 與 assets/（assets/ 會先清空再複製，避免殘留舊檔）；
    3. 檢查頁面與 promo.js 引用到的 assets 檔案都存在；
    4. 指定 -Push 時 commit 並 push（以 -GitHubUser 帳號的 gh token 推送，不切換 gh 的預設帳號）。
  本 repo 自有的檔案（README.md、favicon.svg、og.jpg、.nojekyll、scripts/）不會被覆寫。

.EXAMPLE
  pwsh scripts/sync-from-mini-plm.ps1
  只重新產生網站檔案，不 commit。

.EXAMPLE
  pwsh scripts/sync-from-mini-plm.ps1 -Push -Message "更新宣傳頁文案"
  產生後 commit 並 push，GitHub Pages 約一分鐘內更新。
#>
param(
  # Mini-PLM repo 內宣傳頁原始檔的位置
  [string]$Source = 'D:\GitHub\Mini-PLM\docs\promo',
  # 網站正式網址（Open Graph 的 og:url 與 og:image 需要絕對網址）
  [string]$SiteUrl = 'https://kevintsai1202.github.io/mini-plm-promo/',
  # 產生後是否 commit 並 push
  [switch]$Push,
  # commit 訊息
  [string]$Message = '同步 Mini-PLM docs/promo',
  # push 時使用哪個已登入 gh 的 GitHub 帳號
  [string]$GitHubUser = 'kevintsai1202'
)

$ErrorActionPreference = 'Stop'
# 本 repo 根目錄（腳本放在 scripts/ 底下）
$repo = Split-Path -Parent $PSScriptRoot
$utf8 = [System.Text.UTF8Encoding]::new($false)

if (-not (Test-Path (Join-Path $Source 'index.html'))) { throw "找不到原始檔：$Source\index.html" }

# ---- 1. 片段 → 完整 HTML 文件 ----
$fragment = [System.IO.File]::ReadAllText((Join-Path $Source 'index.html'), $utf8)
$split = $fragment.IndexOf('<header class="topbar">')
if ($split -lt 0) { throw 'index.html 裡找不到 <header class="topbar">，片段結構可能改了，請調整本腳本的切割點' }
# head 區：title、meta description、字型、CDN 函式庫與 promo.css
$headPart = $fragment.Substring(0, $split).Trim()
# body 區：頂部列、主內容、footer、燈箱與頁面腳本
$bodyPart = $fragment.Substring($split).Trim()
$title = [regex]::Match($headPart, '<title>(.*?)</title>').Groups[1].Value
$desc = [regex]::Match($headPart, '<meta name="description" content="(.*?)">').Groups[1].Value
if (-not $title) { throw 'index.html 缺少 <title>' }

$html = @"
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#050A14">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:title" content="$title">
<meta property="og:description" content="$desc">
<meta property="og:url" content="$SiteUrl">
<meta property="og:image" content="${SiteUrl}og.jpg">
<meta name="twitter:card" content="summary_large_image">
$headPart
</head>
<body>
$bodyPart
</body>
</html>
"@
# 統一成 LF 換行再寫出
[System.IO.File]::WriteAllText((Join-Path $repo 'index.html'), (($html -replace "`r`n", "`n") + "`n"), $utf8)

# ---- 2. 複製樣式、腳本與素材 ----
foreach ($f in 'promo.css', 'promo.js', 'sound.js') {
  Copy-Item -LiteralPath (Join-Path $Source $f) -Destination (Join-Path $repo $f) -Force
}
$assetsOut = Join-Path $repo 'assets'
if (Test-Path $assetsOut) { Remove-Item -LiteralPath $assetsOut -Recurse -Force }
Copy-Item -LiteralPath (Join-Path $Source 'assets') -Destination $assetsOut -Recurse

# ---- 3. 檢查引用到的素材都存在 ----
# index.html 直接寫出的 assets/xxx，加上 promo.js 畫面環用 ["檔名", "說明"] 組出來的 assets/檔名.webp
$js = [System.IO.File]::ReadAllText((Join-Path $repo 'promo.js'), $utf8)
$refs = [regex]::Matches($html, 'assets/[\w.-]+\.(?:webp|mp4)') | ForEach-Object { $_.Value }
$wallBlock = [regex]::Match($js, 'const SHOTS = \[(.*?)\];', 'Singleline').Groups[1].Value
$refs += [regex]::Matches($wallBlock, '\["([\w-]+)",') | ForEach-Object { "assets/$($_.Groups[1].Value).webp" }
$missing = $refs | Sort-Object -Unique | Where-Object { -not (Test-Path (Join-Path $repo $_)) }
if ($missing) { throw "以下素材被引用但不存在：`n$($missing -join "`n")" }
$assetCount = (Get-ChildItem $assetsOut -File).Count
$sizeMB = [math]::Round(((Get-ChildItem $repo -Recurse -File | Where-Object FullName -notmatch '\\\.git\\' | Measure-Object Length -Sum).Sum / 1MB), 2)
Write-Host "已產生網站：index.html、promo.css、promo.js、sound.js、assets/（$assetCount 個檔案），共 $sizeMB MB；引用檢查通過（$(@($refs | Sort-Object -Unique).Count) 個）"

# ---- 4. 選擇性 commit 與 push ----
if ($Push) {
  git -C $repo add -A
  git -C $repo diff --cached --quiet
  if ($LASTEXITCODE -eq 0) { Write-Host '沒有變更，不需要 commit'; return }
  git -C $repo commit -m $Message
  if ($LASTEXITCODE -ne 0) { throw 'git commit 失敗' }
  # 用指定帳號的 token 推送；gh 的 git credential helper 會優先讀 GH_TOKEN
  $prevToken = $env:GH_TOKEN
  try {
    $token = gh auth token --user $GitHubUser 2>$null
    if ($LASTEXITCODE -eq 0 -and $token) { $env:GH_TOKEN = $token }
    git -C $repo push
    if ($LASTEXITCODE -ne 0) { throw 'git push 失敗' }
  }
  finally { $env:GH_TOKEN = $prevToken }
  Write-Host "已推送，GitHub Pages 更新後可在 $SiteUrl 看到"
}
