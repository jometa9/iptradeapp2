!include MUI2.nsh
!include FileFunc.nsh

Name "IPTRADE"
BrandingText "IPTRADE Trading Platform"
OutFile "release\IPTRADE-Setup.exe"

# Define version info
!define VERSION "1.2.3"
!define COMPANY "IPTRADE"
!define DESCRIPTION "Professional Trading Platform"
!define COPYRIGHT "Copyright © 2024 IPTRADE"

# Define the main executable name
!define MAIN_APP_EXE "IPTRADE-win_x64.exe"

# Set compression
SetCompressor /SOLID lzma

# Default installation folder
InstallDir "$PROGRAMFILES64\IPTRADE"

# Get installation folder from registry if available
InstallDirRegKey HKLM "Software\IPTRADE" ""

# Request application privileges for Windows Vista/7/8/10
RequestExecutionLevel admin

# Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "public\iconShadow025.png"
!define MUI_UNICON "public\iconShadow025.png"

# Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

# Languages
!insertmacro MUI_LANGUAGE "English"

# Installer sections
Section "IPTRADE" SecMain
    SetOutPath "$INSTDIR"

    # Add files from dist/IPTRADE directory
    File /r "dist\IPTRADE\*.*"
    
    # Add resources directory
    SetOutPath "$INSTDIR\resources"
    File /r "resources\*.*"
    
    # Add config and data directories
    SetOutPath "$INSTDIR"
    CreateDirectory "$INSTDIR\config"
    CreateDirectory "$INSTDIR\csv_data"
    CreateDirectory "$INSTDIR\accounts"
    CreateDirectory "$INSTDIR\logs"

    # Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    # Start Menu
    CreateDirectory "$SMPROGRAMS\IPTRADE"
    CreateShortCut "$SMPROGRAMS\IPTRADE\IPTRADE.lnk" "$INSTDIR\${MAIN_APP_EXE}"
    CreateShortCut "$SMPROGRAMS\IPTRADE\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

    # Desktop shortcut
    CreateShortCut "$DESKTOP\IPTRADE.lnk" "$INSTDIR\${MAIN_APP_EXE}"

    # Registry information for Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\IPTRADE" "DisplayName" "IPTRADE"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\IPTRADE" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\IPTRADE" "QuietUninstallString" "$\"$INSTDIR\Uninstall.exe$\" /S"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\IPTRADE" "InstallLocation" "$\"$INSTDIR$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\IPTRADE" "DisplayIcon" "$\"$INSTDIR\${MAIN_APP_EXE}$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\IPTRADE" "Publisher" "${COMPANY}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\IPTRADE" "DisplayVersion" "${VERSION}"

    # Register Protocol Handler
    WriteRegStr HKCR "iptrade" "" "URL:IPTRADE Protocol"
    WriteRegStr HKCR "iptrade" "URL Protocol" ""
    WriteRegStr HKCR "iptrade\DefaultIcon" "" "$INSTDIR\${MAIN_APP_EXE},0"
    WriteRegStr HKCR "iptrade\shell\open\command" "" '"$INSTDIR\${MAIN_APP_EXE}" "%1"'

    # Estimate size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\IPTRADE" "EstimatedSize" "$0"
SectionEnd

# Uninstaller section
Section "Uninstall"
    # Remove Start Menu shortcuts
    Delete "$SMPROGRAMS\IPTRADE\IPTRADE.lnk"
    Delete "$SMPROGRAMS\IPTRADE\Uninstall.lnk"
    RMDir "$SMPROGRAMS\IPTRADE"

    # Remove Desktop shortcut
    Delete "$DESKTOP\IPTRADE.lnk"

    # Remove registry entries
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\IPTRADE"
    DeleteRegKey HKLM "Software\IPTRADE"
    DeleteRegKey HKCR "iptrade"

    # Remove files and directories
    RMDir /r "$INSTDIR\resources"
    RMDir /r "$INSTDIR\config"
    RMDir /r "$INSTDIR\csv_data"
    RMDir /r "$INSTDIR\accounts"
    RMDir /r "$INSTDIR\logs"
    Delete "$INSTDIR\${MAIN_APP_EXE}"
    Delete "$INSTDIR\resources.neu"
    Delete "$INSTDIR\Uninstall.exe"
    
    # Remove installation directory
    RMDir "$INSTDIR"
SectionEnd
