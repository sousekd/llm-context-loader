# Compare raw Firecrawl output with the loader's cleaned output for a list
# of suspect URLs. Useful when diagnosing why a specific page produces a
# poor cleanup result.
#
# For each URL three artifacts are written to scripts/out/:
#   <slug>.source.md   - raw Firecrawl markdown
#   <slug>.clean.md    - loader's /r/<url> body (including footer)
#   <slug>.footer.txt  - extracted <loader_info .../> line (or empty)
#
# Console output: source/clean char counts, head/tail previews, and the
# parsed footer attributes so you can spot the regression without opening
# the files.
#
# Parameters:
#   -UrlFile           path to a file containing URLs, one per line   (optional)
#   -Urls              inline URL list                                (optional)
#   -HeadBytes         bytes shown from the start of each document    (default 600)
#   -TailBytes         bytes shown from the end of each document      (default 400)
#   -HealthTimeoutSec  seconds to wait for /health before aborting    (default 5)
#   -SkipHealthCheck   skip the pre-flight /health probe
#
# When neither -UrlFile nor -Urls is provided, a small built-in suspect
# list is used so the script is useful zero-arg.
#
# Environment (all optional):
#   LOADER_BASE         base URL of this service        (default http://localhost:3010)
#   FIRECRAWL_BASE_URL  base URL of a Firecrawl host    (default http://localhost:3002)
#   API_KEY             bearer for this service         (sent on /r/* if set)
#   FIRECRAWL_API_KEY   bearer for Firecrawl            (sent on /v2/scrape if set)
#
# Examples:
#   ./scripts/inspect-suspects.ps1
#   ./scripts/inspect-suspects.ps1 -Urls 'https://example.com/article'
#   ./scripts/inspect-suspects.ps1 -UrlFile scripts/out/urls.txt -HeadBytes 1000

[CmdletBinding()]
param(
    [string]   $UrlFile,
    [string[]] $Urls,
    [int]      $HeadBytes = 600,
    [int]      $TailBytes = 400,
    [int]      $HealthTimeoutSec = 5,
    [switch]   $SkipHealthCheck
)

. (Join-Path $PSScriptRoot 'shared-lib.ps1')

$defaultSuspects = @(
    'https://www.w3schools.com/python/python_decorators.asp',
    'https://gateway-api.sigs.k8s.io/guides/getting-started/migrating-from-ingress/',
    'https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html'
)

if ($UrlFile) {
    $Urls = Read-UrlFile -Path $UrlFile
}
elseif ($Urls -and $Urls.Count -gt 0) {
    $Urls = ConvertTo-UrlArray -Urls $Urls
}
else {
    $Urls = $defaultSuspects
}

if (-not $Urls -or $Urls.Count -eq 0) {
    Write-Host 'No URLs to inspect.' -ForegroundColor Red
    exit 1
}

$loader = Get-LoaderDefaults
$firecrawl = Get-FirecrawlDefaults
$loaderHeaders = Get-BearerHeaders -ApiKey $loader.ApiKey
$firecrawlHeaders = Get-BearerHeaders -ApiKey $firecrawl.ApiKey

if (-not $SkipHealthCheck) {
    if (-not (Wait-LoaderHealth -LoaderBase $loader.LoaderBase -TimeoutSec $HealthTimeoutSec)) {
        Write-Host ("Loader health check failed at {0}/health within {1}s. Aborting." -f $loader.LoaderBase, $HealthTimeoutSec) -ForegroundColor Red
        Write-Host 'Re-run with -SkipHealthCheck to bypass.' -ForegroundColor DarkGray
        exit 1
    }
}

$outDir = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Footer attributes worth surfacing in the console preview.
$footerHighlights = @(
    'returned', 'final_length',
    'fetch_status', 'fetch_length',
    'clean_status', 'clean_ratio', 'clean_reason',
    'summarize_status', 'summarize_ratio', 'summarize_reason',
    'truncate_status'
)

Write-Host ("=== inspect {0} URLs ===" -f $Urls.Count) -ForegroundColor Cyan
Write-Host ("loader   : {0}" -f $loader.LoaderBase) -ForegroundColor DarkGray
Write-Host ("firecrawl: {0}" -f $firecrawl.BaseUrl)  -ForegroundColor DarkGray

$ok = 0; $fail = 0

foreach ($url in $Urls) {
    $slug = ConvertTo-UrlSlug -Url $url
    Write-Host "`n=== $slug ===" -ForegroundColor Cyan
    Write-Host "  $url" -ForegroundColor DarkGray

    $body = @{ url = $url; formats = @('markdown'); onlyMainContent = $true } | ConvertTo-Json -Compress

    $src = ''
    try {
        $firecrawlResponse = Invoke-RestMethod -Method POST `
            -Uri "$($firecrawl.BaseUrl)/v2/scrape" `
            -Headers $firecrawlHeaders -ContentType 'application/json' `
            -Body $body -TimeoutSec 120
        $src = $firecrawlResponse.data.markdown
        if (-not $src) { $src = $firecrawlResponse.data.content }
    }
    catch {
        Write-Host ("  firecrawl ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
        $fail++
        continue
    }
    Set-Content -LiteralPath (Join-Path $outDir "$slug.source.md") -Value $src -Encoding utf8

    $clean = ''
    try {
        $loaderResponse = Invoke-WebRequest -Uri ("$($loader.LoaderBase)/r/" + $url) `
            -Headers $loaderHeaders -UseBasicParsing -TimeoutSec 240
        $clean = $loaderResponse.Content
    }
    catch {
        Write-Host ("  loader ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
        $fail++
        continue
    }
    Set-Content -LiteralPath (Join-Path $outDir "$slug.clean.md") -Value $clean -Encoding utf8

    $footerLine = Get-LoaderFooterLine -Content $clean
    Set-Content -LiteralPath (Join-Path $outDir "$slug.footer.txt") -Value $footerLine -Encoding utf8

    Write-Host ("  source_chars={0}  clean_chars={1}" -f $src.Length, $clean.Length)

    if ($footerLine) {
        $attrs = Get-LoaderFooterAttrMap -Footer $footerLine
        Write-Host '  --- FOOTER ---'
        foreach ($name in $footerHighlights) {
            if ($attrs.ContainsKey($name)) {
                Write-Host ("    {0,-18} {1}" -f $name, $attrs[$name])
            }
        }
    }
    else {
        Write-Host '  --- FOOTER --- <none>'
    }

    Write-Host '  --- SOURCE head ---'
    Write-Host ($src.Substring(0, [Math]::Min($HeadBytes, $src.Length)))
    Write-Host '  --- SOURCE tail ---'
    Write-Host ($src.Substring([Math]::Max(0, $src.Length - $TailBytes)))
    Write-Host '  --- CLEAN head ---'
    Write-Host ($clean.Substring(0, [Math]::Min($HeadBytes, $clean.Length)))
    Write-Host '  --- CLEAN tail ---'
    Write-Host ($clean.Substring([Math]::Max(0, $clean.Length - $TailBytes)))

    $ok++
}

Write-Host ''
Write-Host ("=== Done: {0} ok, {1} failed.  Artifacts in {2} ===" -f $ok, $fail, $outDir) -ForegroundColor Cyan
