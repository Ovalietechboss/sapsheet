#!/bin/bash
# SAP Sheet Android Helper Script

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Android SDK Path
ANDROID_SDK="$LOCALAPPDATA\Android\sdk"
ADB_PATH="$ANDROID_SDK\platform-tools\adb.exe"

echo -e "${BLUE}=== SAP Sheet Android Helper ===${NC}\n"

# Check prerequisites
echo "Checking prerequisites..."

if [ ! -f "$ADB_PATH" ]; then
    echo -e "${RED}✗ ADB not found at $ADB_PATH${NC}"
    echo "Please set ANDROID_SDK_ROOT and ANDROID_HOME in your environment variables"
    exit 1
fi
echo -e "${GREEN}✓ ADB found${NC}"

if ! command -v java &> /dev/null; then
    echo -e "${RED}✗ Java not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Java found${NC}"

# List devices
echo -e "\n${BLUE}Connected devices:${NC}"
"$ADB_PATH" devices

echo -e "\n${BLUE}Build web version...${NC}"
npm run build

echo -e "\n${BLUE}Adding Android project...${NC}"
npm run cap:add:android

echo -e "\n${BLUE}Opening in Android Studio...${NC}"
npm run cap:open:android

echo -e "\n${GREEN}Done! Follow these steps in Android Studio:${NC}"
echo "1. Wait for Gradle sync to complete"
echo "2. Click 'Run > Run app' (or press Shift+F10)"
echo "3. Select your device"
echo "4. App will install and launch!"
