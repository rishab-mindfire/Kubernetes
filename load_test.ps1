# 1. Read and parse the JSON configuration file
if (-not (Test-Path "config.json")) {
    Write-Error "Could not find config.json in the current directory!"
    return
}
$config = Get-Content "config.json" -Raw | ConvertFrom-Json

# 2. Extract ApacheBench settings
$totalRequests = $config.benchmarking.totalRequests
$concurrency   = $config.benchmarking.concurrency
$targetUrl     = $config.benchmarking.targetUrl
$hostHeader    = $config.benchmarking.hostHeader

# 3. Extract and save the application payload part into a temporary file for 'ab'
$config.payload | ConvertTo-Json -Depth 10 | Out-File -FilePath "temp_payload.json" -Encoding utf8

# 4. Announce and execute the test
Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "Launching Automated Configuration Test" -ForegroundColor Green
Write-Host "Target URL:  $targetUrl" -ForegroundColor Cyan
Write-Host "Requests:    $totalRequests" -ForegroundColor Cyan
Write-Host "Concurrency: $concurrency" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Green

ab -n $totalRequests -c $concurrency -p temp_payload.json -T "application/json" -H "Host: $hostHeader" $targetUrl

# 5. Clean up the temporary payload file
if (Test-Path "temp_payload.json") {
    Remove-Item "temp_payload.json"
}
