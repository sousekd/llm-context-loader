# Shared helpers for the smoke / inspection scripts. Dot-source via:
#   . (Join-Path $PSScriptRoot 'shared-lib.ps1')
#
# Scope: defaults, bearer headers, batching, URL-file reading, footer parsing,
# slug generation, and the shared reporting block printed by every smoke
# script. Anything URL-discovery related (e.g. SearXNG) lives in
# gather-urls.ps1; anything provider-specific lives in its caller.

# Smoke scripts are best-effort: a single bad URL must not abort the run.
$ErrorActionPreference = 'Continue'

# Standard set of footer attributes printed by Write-SmokeSummary. Kept here
# so smoke-owui and smoke-jina produce byte-identical breakdown sections.
$script:SmokeFooterAttrs = @(
  @{ Attr = 'returned';         Label = 'Returned breakdown' },
  @{ Attr = 'fetch_status';     Label = 'Fetch status breakdown' },
  @{ Attr = 'clean_status';     Label = 'Clean status breakdown' },
  @{ Attr = 'summarize_status'; Label = 'Summarize status breakdown' },
  @{ Attr = 'truncate_status';  Label = 'Truncate status breakdown' }
)

# Read the loader base URL + optional bearer from the environment.
function Get-LoaderDefaults {
  [pscustomobject]@{
    LoaderBase = if ($env:LOADER_BASE) { $env:LOADER_BASE } else { 'http://localhost:3010' }
    ApiKey     = $env:API_KEY
  }
}

# Read the Firecrawl base URL + optional bearer from the environment. Used
# by inspect-suspects.ps1 to fetch raw markdown for side-by-side comparison.
function Get-FirecrawlDefaults {
  [pscustomobject]@{
    BaseUrl = if ($env:FIRECRAWL_BASE_URL) { $env:FIRECRAWL_BASE_URL } else { 'http://localhost:3002' }
    ApiKey  = $env:FIRECRAWL_API_KEY
  }
}

# Build an Authorization header dictionary, or an empty one when no key is set.
function Get-BearerHeaders {
  param([string] $ApiKey)
  if ([string]::IsNullOrWhiteSpace($ApiKey)) { return @{} }
  return @{ Authorization = "Bearer $ApiKey" }
}

# Slice a flat list into fixed-size chunks. Returns a list of arrays.
# Uses Write-Output -NoEnumerate so PowerShell does not unroll the outer
# List<object> into individual batches at the call site (which would make a
# single-batch result look like N loose items to ForEach-Object).
function Split-IntoBatches {
  param(
    [Parameter(Mandatory)] [object[]] $Items,
    [Parameter(Mandatory)] [int]      $BatchSize
  )
  $batches = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -lt $Items.Count; $i += $BatchSize) {
    $endIdx = [Math]::Min($i + $BatchSize, $Items.Count) - 1
    $batches.Add(@($Items[$i..$endIdx]))
  }
  Write-Output -NoEnumerate $batches
}

# Normalize a -Urls parameter. `pwsh -File script.ps1 -Urls 'a','b'` collapses
# the array into one comma-joined string before the script runs; detect that
# shape and split it back so callers do not have to dot-source the script.
function ConvertTo-UrlArray {
  param([string[]] $Urls)
  if (-not $Urls -or $Urls.Count -eq 0) { return @() }
  if ($Urls.Count -eq 1 -and $Urls[0] -match ',') {
    return @(
      $Urls[0] -split ',' |
        ForEach-Object { $_.Trim().Trim("'").Trim('"') } |
        Where-Object   { $_ }
    )
  }
  return $Urls
}

# Probe GET /health until it returns HTTP 200, or the deadline passes. Returns
# $true on success, $false on timeout. Designed as a pre-flight for smoke
# scripts so missing servers fail fast with a clear message instead of an
# avalanche of per-URL transport errors.
function Wait-LoaderHealth {
  param(
    [Parameter(Mandatory)] [string] $LoaderBase,
    [int] $TimeoutSec = 5,
    [int] $IntervalMs = 500
  )
  $url      = "$LoaderBase/health"
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -le $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ([int]$r.StatusCode -eq 200) { return $true }
    } catch {}
    Start-Sleep -Milliseconds $IntervalMs
  }
  return $false
}

# Read URLs from a file: one URL per line, trims whitespace, skips blanks and
# '#' comments. Throws when the file does not exist. Returns string[].
function Read-UrlFile {
  param([Parameter(Mandatory)] [string] $Path)
  if (-not (Test-Path $Path)) { throw "URL file not found: $Path" }
  return Get-Content -Path $Path -Encoding utf8 |
    ForEach-Object { $_.Trim() } |
    Where-Object   { $_ -and -not $_.StartsWith('#') }
}

# Extract the last `<context_loader_info ... />` line from a response body.
# Returns '' when no footer is present.
function Get-LoaderFooterLine {
  param([string] $Content)
  if (-not $Content) { return '' }
  ($Content -split "`n" | Where-Object { $_ -match '<context_loader_info' } | Select-Object -Last 1)
}

# Read a single attribute value from a `<context_loader_info ... />` line.
function Get-LoaderFooterAttr {
  param(
    [string] $Footer,
    [string] $AttrName
  )
  if (-not $Footer -or -not $AttrName) { return '' }
  $pattern = '{0}="([^"]+)"' -f [regex]::Escape($AttrName)
  $match = [regex]::Match($Footer, $pattern)
  if (-not $match.Success) { return '' }
  return $match.Groups[1].Value
}

# Parse every attribute from a `<context_loader_info ... />` line into a
# hashtable. Returns an empty hashtable when the footer is missing.
function Get-LoaderFooterAttrMap {
  param([string] $Footer)
  $map = @{}
  if (-not $Footer) { return $map }
  foreach ($m in [regex]::Matches($Footer, '(\w+)="([^"]*)"')) {
    $map[$m.Groups[1].Value] = $m.Groups[2].Value
  }
  return $map
}

# Build a filesystem-safe, deterministic slug from a URL. Uses host + path,
# lowercased, with non-alphanumeric runs collapsed to '-'. Capped at 80 chars.
function ConvertTo-UrlSlug {
  param([Parameter(Mandatory)] [string] $Url)
  try {
    $uri = [Uri]$Url
    $raw = ($uri.Host + $uri.AbsolutePath).ToLowerInvariant()
  } catch {
    $raw = $Url.ToLowerInvariant()
  }
  $slug = [regex]::Replace($raw, '[^a-z0-9]+', '-').Trim('-')
  if ($slug.Length -gt 80) { $slug = $slug.Substring(0, 80).TrimEnd('-') }
  if (-not $slug) { $slug = 'url' }
  return $slug
}

# Tally one footer attribute across rows and print a sorted breakdown block.
# `$Rows` items must expose a `.footer` string property.
function Write-FooterBreakdown {
  param(
    [object[]] $Rows,
    [string]   $AttrName,
    [string]   $Label
  )
  $byAttr = @{}
  foreach ($row in $Rows) {
    $value = Get-LoaderFooterAttr -Footer $row.footer -AttrName $AttrName
    if (-not $value) { continue }
    if (-not $byAttr.ContainsKey($value)) { $byAttr[$value] = 0 }
    $byAttr[$value]++
  }
  if ($byAttr.Count -eq 0) { return }
  Write-Output ("{0}:" -f $Label)
  $byAttr.GetEnumerator() | Sort-Object Key | ForEach-Object {
    Write-Output ("  {0,-22} {1}" -f $_.Key, $_.Value)
  }
}

# Print the standard per-URL block, an aggregate summary line, and the five
# footer attribute breakdowns. Used by every smoke script so their output is
# identical down to the wording. `$Results` items must expose:
#   .url, .ok, .len, .ms, .footer, .error
function Write-SmokeSummary {
  param(
    [Parameter(Mandatory)] [object[]] $Results,
    [Parameter(Mandatory)] [string]   $Header,
    [Parameter(Mandatory)] [int]      $WallMs,
    [string] $MsLabel = 'ms'
  )

  Write-Host "`n=== Per-URL results ===" -ForegroundColor Cyan
  $idx = 0
  foreach ($row in $Results) {
    $idx++
    Write-Host ''
    Write-Output ("[{0:D2}] {1}" -f $idx, $row.url)
    if ($row.ok) {
      Write-Output ("     len   = {0}   {1} = {2}" -f $row.len, $MsLabel, $row.ms)
      if ($row.footer) {
        Write-Output ("     footer= {0}" -f $row.footer)
      } else {
        Write-Output '     footer= <none>'
      }
    } else {
      Write-Output ("     FAIL  {0} = {1}   error = {2}" -f $MsLabel, $row.ms, $row.error)
    }
  }

  Write-Host "`n=== Summary ===" -ForegroundColor Cyan
  $ok   = ($Results | Where-Object { $_.ok }).Count
  $fail = ($Results | Where-Object { -not $_.ok }).Count
  Write-Output ("{0}  urls: {1}  ok: {2}  fail: {3}  wall: {4}ms" -f $Header, $Results.Count, $ok, $fail, $WallMs)

  $footerRows = $Results | Where-Object { $_.footer }
  foreach ($entry in $script:SmokeFooterAttrs) {
    Write-FooterBreakdown -Rows $footerRows -AttrName $entry.Attr -Label $entry.Label
  }
}

