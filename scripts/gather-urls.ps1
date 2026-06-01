# Gather URLs from SearXNG until -Count URLs are collected, or all topics are
# exhausted across -MaxPages pages. Prints URLs to stdout, one per line, and
# optionally writes them to -OutFile so the smoke scripts can consume them
# repeatedly without re-hitting SearXNG.
#
# Collection strategy: the outer loop walks SearXNG result pages 1..MaxPages.
# Inside each page we round-robin through the active topics, taking up to
# -PerTopic new URLs from each. A topic that returns no new URLs on a page
# is dropped from later pages. The loop stops as soon as -Count URLs are
# collected or no active topics remain.
#
# Parameters:
#   -Count        target number of URLs                            (default 15)
#   -OutFile      optional path to write URLs to                   (also printed to stdout)
#   -Topics       override the default topic list (string[])       (optional)
#   -PerTopic     max new URLs taken from one (topic,page) pair    (default 5)
#   -MaxPages     safety cap on SearXNG result pages per topic     (default 5)
#
# Environment:
#   SEARX_BASE    base URL of a SearXNG instance                   (default http://localhost:8080)
#
# Examples:
#   ./scripts/gather-urls.ps1 -Count 15 -OutFile scripts/out/urls.txt
#   ./scripts/gather-urls.ps1 -Topics @('webassembly runtime comparison') -Count 5

[CmdletBinding()]
param(
    [int]      $Count = 15,
    [string]   $OutFile,
    [string[]] $Topics,
    [int]      $PerTopic = 5,
    [int]      $MaxPages = 5
)

# Misconfiguration (bad SearXNG URL, network down) should fail fast — unlike
# the smoke scripts, this one is short-lived and has nothing to salvage.
$ErrorActionPreference = 'Stop'

$searxBase = if ($env:SEARX_BASE) { $env:SEARX_BASE } else { 'http://localhost:8080' }

if (-not $Topics -or $Topics.Count -eq 0) {
    $Topics = @(
        'typescript fastify tutorial',
        'python decorators explained',
        'rust ownership borrow checker',
        'kubernetes ingress vs gateway api',
        'lithium iron phosphate battery degradation',
        'postgres index types explained',
        'http3 quic protocol overview',
        'docker buildkit multi-stage best practices'
    )
}

$collected = New-Object System.Collections.Generic.List[string]
$seen = New-Object System.Collections.Generic.HashSet[string]
$active = [System.Collections.Generic.List[string]]::new()
foreach ($topic in $Topics) { $active.Add($topic) | Out-Null }

for ($page = 1; $page -le $MaxPages; $page++) {
    if ($collected.Count -ge $Count) { break }
    if ($active.Count -eq 0) { break }

    $exhausted = New-Object System.Collections.Generic.List[string]
    foreach ($topicQuery in $active) {
        if ($collected.Count -ge $Count) { break }

        Write-Host ("[searxng p{0}] {1}" -f $page, $topicQuery) -ForegroundColor DarkCyan
        try {
            $uri = "$searxBase/search?q=" + [uri]::EscapeDataString($topicQuery) + "&format=json&pageno=$page"
            $response = Invoke-RestMethod -Uri $uri -TimeoutSec 20
        }
        catch {
            Write-Host ("  ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
            $exhausted.Add($topicQuery) | Out-Null
            continue
        }

        $hits = @($response.results | Where-Object { $_.url -match '^https?://' })
        $added = 0
        foreach ($hit in $hits) {
            if ($collected.Count -ge $Count) { break }
            if ($added -ge $PerTopic) { break }
            if ($seen.Add($hit.url)) {
                $collected.Add($hit.url) | Out-Null
                $added++
            }
        }
        Write-Host ("  + {0} (total {1}/{2})" -f $added, $collected.Count, $Count) -ForegroundColor DarkGray

        # Drop topics that produced nothing new on this page; their later
        # pages are very unlikely to help and just waste round-trips.
        if ($added -eq 0) { $exhausted.Add($topicQuery) | Out-Null }
    }

    foreach ($topicQuery in $exhausted) { [void]$active.Remove($topicQuery) }
}

if ($collected.Count -lt $Count) {
    Write-Host ("WARN: only collected {0}/{1} URLs (topics exhausted or MaxPages={2} reached)" -f `
            $collected.Count, $Count, $MaxPages) -ForegroundColor Yellow
}

if ($OutFile) {
    $dir = Split-Path -Parent $OutFile
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Set-Content -Path $OutFile -Value $collected -Encoding utf8
    Write-Host ("Wrote {0} URLs to {1}" -f $collected.Count, $OutFile) -ForegroundColor Cyan
}

$collected
