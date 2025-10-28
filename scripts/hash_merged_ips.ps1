# scripts\hash_merged_ips.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SRC = Join-Path -Path (Get-Location) -ChildPath "data\merged_ips.csv"
$DST = Join-Path -Path (Get-Location) -ChildPath "data\merged_ips_hashed.csv"
$BAK = Join-Path -Path (Get-Location) -ChildPath "data\merged_ips.csv.bak"

if (-not (Test-Path $SRC)) {
    Write-Host "Source merged_ips.csv not found at $SRC — the script will still run if you have a backup or original elsewhere."
}

# Load IP_HMAC_KEY from env or .env
$envKey = $env:IP_HMAC_KEY
if ([string]::IsNullOrWhiteSpace($envKey)) {
    $envFile = Join-Path -Path (Get-Location) -ChildPath ".env"
    if (Test-Path $envFile) {
        $lines = Get-Content $envFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not ($_.StartsWith("#")) }
        foreach ($ln in $lines) {
            if ($ln -like "IP_HMAC_KEY=*") {
                $parts = $ln -split "=", 2
                if ($parts.Length -ge 2) {
                    $envKey = $parts[1].Trim()
                    if ($envKey.Length -ge 2 -and ($envKey.StartsWith('"') -or $envKey.StartsWith("'"))) {
                        $envKey = $envKey.Substring(1, $envKey.Length - 2)
                    }
                    break
                }
            }
        }
    }
}

if ([string]::IsNullOrWhiteSpace($envKey)) {
    Write-Error "IP_HMAC_KEY not set. Put IP_HMAC_KEY=... in your .env or set environment variable."
    exit 1
}

# backup if source exists
if (Test-Path $SRC) { Copy-Item -Path $SRC -Destination $BAK -Force; Write-Host "Backup created:" $BAK }

# Import CSV (if present)
if (Test-Path $SRC) {
    Write-Host "Reading CSV..."
    $data = Import-Csv -Path $SRC -ErrorAction Stop
} else {
    Write-Error "No merged_ips.csv found in data/. If you have the original file elsewhere, copy it to data/merged_ips.csv and re-run."
    exit 1
}

# verify column
$first = $data | Select-Object -First 1
$cols = $first.PSObject.Properties | ForEach-Object { $_.Name }
if (-not ($cols -contains "ipAddress")) {
    Write-Error ("Expected column 'ipAddress' not found. Columns: {0}" -f ($cols -join ', '))
    exit 1
}

# HMAC setup
$keyBytes = [System.Text.Encoding]::UTF8.GetBytes($envKey)
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = $keyBytes

function Compute-HmacHex([string] $s) {
    if ($null -eq $s) { $s = "" }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($s)
    $hash = $hmac.ComputeHash($bytes)
    return -join ($hash | ForEach-Object { $_.ToString("x2") })
}

$out = New-Object System.Collections.Generic.List[PSObject]
$outCols = @("ipHash") + ($cols | Where-Object { $_ -ne "ipAddress" })

$rowCount = @($data).Count`r`nWrite-Host "Hashing $rowCount rows..."
foreach ($row in $data) {
    $rawIp = $row.ipAddress
    $ipHash = ""
    if (-not [string]::IsNullOrWhiteSpace($rawIp)) { $ipHash = Compute-HmacHex $rawIp }
    $ht = @{}
    $ht["ipHash"] = $ipHash
    foreach ($c in $cols) {
        if ($c -eq "ipAddress") { continue }
        $ht[$c] = $row.$c
    }
    $ps = New-Object PSObject -Property $ht
    $out.Add($ps)
}

Write-Host "Writing hashed CSV to $DST ..."
$out | Select-Object $outCols | Export-Csv -Path $DST -NoTypeInformation -Encoding UTF8

$origCount = (Get-Content $BAK -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
$newCount = (Get-Content $DST | Measure-Object -Line).Lines
Write-Host "Done. Lines: original =" $origCount ", hashed =" $newCount
