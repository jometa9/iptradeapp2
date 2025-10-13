!macro customInstall
  WriteRegStr HKCR "iptrade" "" "URL:IPTRADE Protocol"
  WriteRegStr HKCR "iptrade" "URL Protocol" ""
  WriteRegStr HKCR "iptrade\DefaultIcon" "" "$INSTDIR\IPTRADE.exe,0"
  WriteRegStr HKCR "iptrade\shell" "" ""
  WriteRegStr HKCR "iptrade\shell\open" "" ""
  WriteRegStr HKCR "iptrade\shell\open\command" "" '"$INSTDIR\IPTRADE.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCR "iptrade"
!macroend
