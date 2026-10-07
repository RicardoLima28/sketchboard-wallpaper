; Remove a entrada "Iniciar com o Windows" que o app cria ao rodar
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Sketchboard Wallpaper"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "electron.app.Sketchboard Wallpaper"
!macroend
