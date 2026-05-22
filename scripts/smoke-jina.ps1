# Smoke test the Jina-style client (GET /r/<url>).
#
# Fires one request per URL in parallel and prints per-URL output plus the
# standard footer-attribute breakdowns shared with smoke-owui.ps1.
#
# Uses Invoke-WebRequest (not Invoke-RestMethod) because the response body is
# raw markdown, not JSON, and we want the unparsed text to extract the footer.
#
# Parameters:
#   -UrlFile           path to a file containing URLs, one per line   (required unless -Urls)
#   -Urls              inline URL list (alternative to -UrlFile)
#   -Concurrency       parallel in-flight requests                    (default 5; 1 = sequential)
#   -HealthTimeoutSec  seconds to wait for /health before aborting    (default 5)
#   -SkipHealthCheck   skip the pre-flight /health probe
#
# Environment:
#   LOADER_BASE   base URL of this service                       (default http://localhost:3010)
#   API_KEY       if set, sent as 'Authorization: Bearer <key>'
#
# Examples:
#   ./scripts/smoke-jina.ps1 -UrlFile scripts/out/urls.txt
#   ./scripts/smoke-jina.ps1 -UrlFile out/urls.txt -Concurrency 1   # sequential
#   ./scripts/smoke-jina.ps1 -Urls @('https://example.com/a','https://example.com/b')

[CmdletBinding(DefaultParameterSetName = 'File')]
param(
  [Parameter(ParameterSetName = 'File',   Mandatory)] [string]   $UrlFile,
  [Parameter(ParameterSetName = 'Inline', Mandatory)] [string[]] $Urls,
  [int]    $Concurrency      = 5,
  [int]    $HealthTimeoutSec = 5,
  [switch] $SkipHealthCheck
)

. (Join-Path $PSScriptRoot 'shared-lib.ps1')

if ($PSCmdlet.ParameterSetName -eq 'File') {
  $Urls = Read-UrlFile -Path $UrlFile
} else {
  $Urls = ConvertTo-UrlArray -Urls $Urls
}

if (-not $Urls -or $Urls.Count -eq 0) {
  Write-Host 'No URLs to test.' -ForegroundColor Red
  exit 1
}

$defaults    = Get-LoaderDefaults
$loaderBase  = $defaults.LoaderBase
$authHeaders = Get-BearerHeaders -ApiKey $defaults.ApiKey

if (-not $SkipHealthCheck) {
  if (-not (Wait-LoaderHealth -LoaderBase $loaderBase -TimeoutSec $HealthTimeoutSec)) {
    Write-Host ("Loader health check failed at {0}/health within {1}s. Aborting." -f $loaderBase, $HealthTimeoutSec) -ForegroundColor Red
    Write-Host 'Re-run with -SkipHealthCheck to bypass.' -ForegroundColor DarkGray
    exit 1
  }
}

Write-Host ("=== GET {0}/r/<url>  urls={1}  concurrency={2} ===" -f $loaderBase, $Urls.Count, $Concurrency) -ForegroundColor Cyan
$swAll = [System.Diagnostics.Stopwatch]::StartNew()

# Note: functions dot-sourced into the parent runspace are not visible inside
# ForEach-Object -Parallel, so the footer line extractor is inlined below.
$results = $Urls | ForEach-Object -ThrottleLimit $Concurrency -Parallel {
  $url     = $_
  $base    = $using:loaderBase
  $headers = $using:authHeaders

  $sw           = [System.Diagnostics.Stopwatch]::StartNew()
  $ok           = $false
  $len          = 0
  $footer       = ''
  $errorMessage = ''
  try {
    $response = Invoke-WebRequest -Uri ("$base/r/" + $url) -Headers $headers -UseBasicParsing -TimeoutSec 240
    $sw.Stop()
    $ok     = $true
    $len    = $response.Content.Length
    $footer = ($response.Content -split "`n" | Where-Object { $_ -match '<context_loader_info' } | Select-Object -Last 1)
  } catch {
    $sw.Stop()
    $errorMessage = $_.Exception.Message
  }
  [pscustomobject]@{
    url    = $url
    ok     = $ok
    len    = $len
    ms     = [int]$sw.Elapsed.TotalMilliseconds
    footer = $footer
    error  = $errorMessage
  }
}

$swAll.Stop()

Write-SmokeSummary `
  -Results $results `
  -Header  ("GET {0}/r/<url>" -f $loaderBase) `
  -WallMs  ([int]$swAll.Elapsed.TotalMilliseconds)

