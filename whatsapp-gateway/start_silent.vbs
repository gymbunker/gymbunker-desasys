Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\Users\Nicolas France\BUNKER-GYM\whatsapp-gateway"
WshShell.Run "node run.js", 0, False
