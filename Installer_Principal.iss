[Setup]
AppName=Bunker Gym Principal
AppVersion=3.0
DefaultDirName={pf}\BunkerGymPrincipal
DefaultGroupName=Bunker Gym Principal
UninstallDisplayIcon={app}\BunkerGymPrincipal.exe
Compression=lzma2
SolidCompression=yes
OutputDir=.\Output
OutputBaseFilename=Instalador_BunkerGym_Principal
PrivilegesRequired=admin

[Files]
Source: "backend\dist\BunkerGymPrincipal\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Bunker Gym Principal"; Filename: "{app}\BunkerGymPrincipal.exe"
Name: "{commondesktop}\Bunker Gym Principal"; Filename: "{app}\BunkerGymPrincipal.exe"

[Run]
Filename: "{app}\BunkerGymPrincipal.exe"; Description: "Lanzar Bunker Gym Principal"; Flags: nowait postinstall skipifsilent
