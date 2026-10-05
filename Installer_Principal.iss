[Setup]
AppName=Fusion Fitness Principal
AppVersion=3.0
DefaultDirName={pf}\FusionFitnessPrincipal
DefaultGroupName=Fusion Fitness Principal
UninstallDisplayIcon={app}\FusionFitnessPrincipal.exe
Compression=lzma2
SolidCompression=yes
OutputDir=.\Output
OutputBaseFilename=Instalador_FusionFitness_Principal
PrivilegesRequired=admin

[Files]
Source: "backend\dist\FusionFitnessPrincipal\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Fusion Fitness Principal"; Filename: "{app}\FusionFitnessPrincipal.exe"
Name: "{commondesktop}\Fusion Fitness Principal"; Filename: "{app}\FusionFitnessPrincipal.exe"

[Run]
Filename: "{app}\FusionFitnessPrincipal.exe"; Description: "Lanzar Fusion Fitness Principal"; Flags: nowait postinstall skipifsilent
