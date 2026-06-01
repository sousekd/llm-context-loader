# Smoke test the Open WebUI client (POST / with {"urls":[...]}).
#
# Splits the URL list into batches (Open WebUI's ExternalWebLoader uses 20),
# fires them off in parallel, then prints per-URL output plus the standard
# footer-attribute breakdowns shared with smoke-jina.ps1.
#
# Parameters:
#   -UrlFile           path to a file containing URLs, one per line   (required unless -Urls)
#   -Urls              inline URL list (alternative to -UrlFile)
#   -BatchSize         URLs per POST body                             (default 20 - Open WebUI's batch_size)
#   -Concurrency       parallel in-flight batches                     (default 5; 1 = sequential batches)
#   -HealthTimeoutSec  seconds to wait for /health before aborting    (default 5)
#   -SkipHealthCheck   skip the pre-flight /health probe
#
# Environment:
#   LOADER_BASE   base URL of this service                       (default http://localhost:3010)
#   API_KEY       if set, sent as 'Authorization: Bearer <key>'
#
# Examples:
#   ./scripts/smoke-owui.ps1 -UrlFile scripts/out/urls.txt
#   ./scripts/smoke-owui.ps1 -UrlFile out/urls.txt -BatchSize 3 -Concurrency 5
#   ./scripts/smoke-owui.ps1 -UrlFile out/urls.txt -BatchSize 5 -Concurrency 1   # sequential batches

[CmdletBinding(DefaultParameterSetName = 'File')]
param(
    [Parameter(ParameterSetName = 'File', Mandatory)] [string]   $UrlFile,
    [Parameter(ParameterSetName = 'Inline', Mandatory)] [string[]] $Urls,
    [int]    $BatchSize = 20,
    [int]    $Concurrency = 5,
    [int]    $HealthTimeoutSec = 5,
    [switch] $SkipHealthCheck
)

. (Join-Path $PSScriptRoot 'shared-lib.ps1')

if ($PSCmdlet.ParameterSetName -eq 'File') {
    $Urls = Read-UrlFile -Path $UrlFile
}
else {
    $Urls = ConvertTo-UrlArray -Urls $Urls
}

if (-not $Urls -or $Urls.Count -eq 0) {
    Write-Host 'No URLs to test.' -ForegroundColor Red
    exit 1
}

$defaults = Get-LoaderDefaults
$loaderBase = $defaults.LoaderBase
$authHeaders = Get-BearerHeaders -ApiKey $defaults.ApiKey
$sharedLib = Join-Path $PSScriptRoot 'shared-lib.ps1'

if (-not $SkipHealthCheck) {
    if (-not (Wait-LoaderHealth -LoaderBase $loaderBase -TimeoutSec $HealthTimeoutSec)) {
        Write-Host ("Loader health check failed at {0}/health within {1}s. Aborting." -f $loaderBase, $HealthTimeoutSec) -ForegroundColor Red
        Write-Host 'Re-run with -SkipHealthCheck to bypass.' -ForegroundColor DarkGray
        exit 1
    }
}

$batches = Split-IntoBatches -Items $Urls -BatchSize $BatchSize

Write-Host ("=== POST {0}/  urls={1}  batchSize={2}  batches={3}  concurrency={4} ===" -f `
        $loaderBase, $Urls.Count, $BatchSize, $batches.Count, $Concurrency) -ForegroundColor Cyan
$swAll = [System.Diagnostics.Stopwatch]::StartNew()

$results = $batches | ForEach-Object -ThrottleLimit $Concurrency -Parallel {
    $batch = $_
    $base = $using:loaderBase
    $headers = $using:authHeaders
    . $using:sharedLib

    $body = @{ urls = @($batch) } | ConvertTo-Json -Compress
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $documents = $null
    $errorMessage = ''
    try {
        $documents = Invoke-RestMethod -Method POST -Uri "$base/" -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 600
    }
    catch {
        $errorMessage = $_.Exception.Message
    }
    $sw.Stop()
    $batchMs = [int]$sw.Elapsed.TotalMilliseconds

    if (-not $documents) {
        foreach ($u in $batch) {
            [pscustomobject]@{ url = $u; ok = $false; len = 0; ms = $batchMs; footer = ''; error = $errorMessage }
        }
    }
    else {
        for ($i = 0; $i -lt $documents.Count; $i++) {
            $content = [string]$documents[$i].page_content
            $footer = Get-LoaderFooterLine -Content $content
            [pscustomobject]@{
                url    = $batch[$i]
                ok     = $true
                len    = $content.Length
                ms     = $batchMs
                footer = $footer
                error  = ''
            }
        }
    }
}

$swAll.Stop()

Write-SmokeSummary `
    -Results $results `
    -Header  ("POST {0}/  batches: {1}" -f $loaderBase, $batches.Count) `
    -WallMs  ([int]$swAll.Elapsed.TotalMilliseconds) `
    -MsLabel 'batch_ms'
