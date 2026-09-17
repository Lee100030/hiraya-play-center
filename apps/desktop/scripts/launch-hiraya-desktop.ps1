$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms | Out-Null

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path $ScriptDir -Parent
$Repo = Split-Path (Split-Path $AppDir -Parent)

function Test-Port([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Show-Error([string]$Message) {
  [System.Windows.Forms.MessageBox]::Show($Message, 'HIRAYA Desktop', 'OK', 'Warning') | Out-Null
}

if (-not (Test-Port 3306)) {
  $mysqlBat = 'C:\xampp\mysql_start.bat'
  $mysqlExe = 'C:\xampp\mysql\bin\mysqld.exe'
  if (Test-Path $mysqlBat) {
    Start-Process -FilePath $mysqlBat -WindowStyle Hidden
  } elseif (Test-Path $mysqlExe) {
    Start-Process -FilePath $mysqlExe -WindowStyle Hidden
  }
  $waitMysql = 0
  while (-not (Test-Port 3306) -and $waitMysql -lt 20) {
    Start-Sleep -Seconds 1
    $waitMysql++
  }
  if (-not (Test-Port 3306)) {
    Show-Error 'Start XAMPP MySQL first, then click HIRAYA Desktop again.'
    exit 1
  }
}

if (-not (Test-Port 5188)) {
  $apiProject = Join-Path $Repo 'backend\Hiraya.Api\Hiraya.Api.csproj'
  if (-not (Test-Path $apiProject)) {
    Show-Error 'Could not find the HIRAYA API project.'
    exit 1
  }
  Start-Process -FilePath 'dotnet' -ArgumentList @('run', '--project', $apiProject, '--urls', 'http://0.0.0.0:5188') -WorkingDirectory (Join-Path $Repo 'backend\Hiraya.Api') -WindowStyle Hidden
  $waitApi = 0
  while (-not (Test-Port 5188) -and $waitApi -lt 90) {
    Start-Sleep -Seconds 1
    $waitApi++
  }
  if (-not (Test-Port 5188)) {
    Show-Error 'The HIRAYA API did not start on port 5188. Open XAMPP MySQL and try again.'
    exit 1
  }
}

$electron = Join-Path $AppDir 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) {
  Show-Error 'Electron is not installed. Open a terminal in apps\desktop and run npm install.'
  exit 1
}

# Never auto-load apps/desktop/dist — that snapshot is stale the moment source changes.
# Packaged installers still use dist via Electron's app.isPackaged flag.
Remove-Item Env:HIRAYA_USE_DIST -ErrorAction SilentlyContinue
$env:VITE_DEV_SERVER_URL = 'http://127.0.0.1:5173'

if (-not (Test-Port 5173)) {
  $npx = Get-Command npx -ErrorAction SilentlyContinue
  if (-not $npx) {
    Show-Error 'Install Node.js so HIRAYA Desktop can start the current UI.'
    exit 1
  }
  Start-Process -FilePath $npx.Source -ArgumentList @('vite', '--host', '127.0.0.1', '--port', '5173') -WorkingDirectory $AppDir -WindowStyle Hidden
  $waitVite = 0
  while (-not (Test-Port 5173) -and $waitVite -lt 60) {
    Start-Sleep -Seconds 1
    $waitVite++
  }
  if (-not (Test-Port 5173)) {
    Show-Error 'The desktop UI did not start on port 5173.'
    exit 1
  }
}

Start-Process -FilePath $electron -ArgumentList '.' -WorkingDirectory $AppDir
