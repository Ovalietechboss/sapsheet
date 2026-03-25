#!/usr/bin/env pwsh
# SAP Sheet Android Setup & Testing Script for Windows

$ErrorActionPreference = "Stop"

# Colors
$GREEN = "`e[32m"
$BLUE = "`e[34m"
$RED = "`e[31m"
$YELLOW = "`e[33m"
$RESET = "`e[0m"

Write-Host "${BLUE}╔════════════════════════════════════════╗${RESET}"
Write-Host "${BLUE}║  SAP Sheet - Android Setup & Testing   ║${RESET}"
Write-Host "${BLUE}╚════════════════════════════════════════╝${RESET}`n"

# Paths
$ANDROID_SDK = "$env:LOCALAPPDATA\Android\sdk"
$ADB_PATH = "$ANDROID_SDK\platform-tools\adb.exe"
$GRADLE_PATH = "$ANDROID_SDK\cmdline-tools\latest\bin\sdkmanager.bat"

# Function to check prerequisites
function Check-Prerequisites {
    Write-Host "${BLUE}[1/5] Checking prerequisites...${RESET}"
    
    if (-not (Test-Path $ADB_PATH)) {
        Write-Host "${RED}✗ ADB not found${RESET}"
        Write-Host "Expected at: $ADB_PATH"
        Write-Host "Install Android Studio or add ANDROID_SDK_ROOT to PATH"
        exit 1
    }
    Write-Host "${GREEN}✓ ADB found${RESET}"
    
    if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
        Write-Host "${RED}✗ Java not found${RESET}"
        exit 1
    }
    Write-Host "${GREEN}✓ Java found${RESET}`n"
}

# Function to list connected devices
function List-Devices {
    Write-Host "${BLUE}[2/5] Connected devices:${RESET}"
    & "$ADB_PATH" devices
    Write-Host ""
}

# Function to build web version
function Build-Web {
    Write-Host "${BLUE}[3/5] Building web version...${RESET}"
    npm run build
    Write-Host "${GREEN}✓ Web build complete${RESET}`n"
}

# Function to add Android project
function Add-Android {
    Write-Host "${BLUE}[4/5] Adding Android project...${RESET}"
    npm run cap:add:android
    Write-Host "${GREEN}✓ Android project created${RESET}`n"
}

# Function to open in Android Studio
function Open-AndroidStudio {
    Write-Host "${BLUE}[5/5] Opening Android Studio...${RESET}"
    npm run cap:open:android
}

# Function to show next steps
function Show-NextSteps {
    Write-Host "${YELLOW}╔════════════════════════════════════════╗${RESET}"
    Write-Host "${YELLOW}║           NEXT STEPS IN ANDROID        ║${RESET}"
    Write-Host "${YELLOW}╚════════════════════════════════════════╝${RESET}"
    Write-Host ""
    Write-Host "1. ${GREEN}Wait for Gradle sync${RESET} to complete (bottom right)"
    Write-Host "2. Click ${GREEN}'Run' > 'Run 'app'${RESET} (or press Shift+F10)"
    Write-Host "3. ${GREEN}Select your device${RESET} from the popup"
    Write-Host "4. App will ${GREEN}install and launch${RESET} automatically! 🎉"
    Write-Host ""
    Write-Host "${YELLOW}Troubleshooting:${RESET}"
    Write-Host "  - If devices empty: Enable USB Debugging on your phone"
    Write-Host "  - If build fails: Close Android Studio, run 'npm run cap:sync', reopen"
    Write-Host "  - Check full guide: Read ANDROID_TESTING.md"
}

# Main flow
try {
    Check-Prerequisites
    List-Devices
    Build-Web
    Add-Android
    Open-AndroidStudio
    Show-NextSteps
}
catch {
    Write-Host "${RED}Error: $_${RESET}"
    exit 1
}
