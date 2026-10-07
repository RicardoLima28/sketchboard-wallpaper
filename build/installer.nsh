; Remove the "Start with Windows" entry that the app creates when it runs
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Sketchboard Wallpaper"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "electron.app.Sketchboard Wallpaper"
!macroend
