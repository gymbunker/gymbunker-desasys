[Setup]
AppName=Bunker Gym Adicional
AppVersion=3.0
DefaultDirName={pf}\BunkerGymAdicional
DefaultGroupName=Bunker Gym Adicional
UninstallDisplayIcon={app}\BunkerGymAdicional.exe
Compression=lzma2
SolidCompression=yes
OutputDir=.\Output
OutputBaseFilename=Instalador_BunkerGym_Adicional
PrivilegesRequired=admin

[Files]
Source: "backend\dist\BunkerGymAdicional\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Bunker Gym Adicional"; Filename: "{app}\BunkerGymAdicional.exe"
Name: "{commondesktop}\Bunker Gym Adicional"; Filename: "{app}\BunkerGymAdicional.exe"

[Run]
Filename: "{app}\BunkerGymAdicional.exe"; Description: "Lanzar Bunker Gym Adicional"; Flags: nowait postinstall skipifsilent
