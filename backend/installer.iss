; installer.iss — Inno Setup script para GYM-ATLAS
; Requiere: Inno Setup 6+ (https://jrsoftware.org/isinfo.php)
; Compilar: abrir este archivo en Inno Setup y presionar F9
; Resultado: Output\GymAtlas_Setup.exe

#define MyAppName "Fusion Fitness"
#define MyAppVersion "2.6"
#define MyAppPublisher "Fusion Fitness Cruz del Eje"
#define MyAppExeName "FusionFitness.exe"
#define MyAppDir "dist\FusionFitness"

[Setup]
AppId={{B4F2A3D1-7C8E-4F1A-9B2D-3E5F6A7C8D9E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://fusionfitnesscruzdeleje.vercel.app
DefaultDirName={autopf}\GymAtlas
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=FusionFitness_Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardResizable=no
; Requiere Windows 10+
MinVersion=10.0
PrivilegesRequired=admin
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
; Mensajes en español
WelcomeLabel1=Bienvenido al instalador de [name]
WelcomeLabel2=Este asistente instalará [name/ver] en tu computadora.%n%nSe recomienda cerrar todas las aplicaciones antes de continuar.

[Tasks]
Name: "desktopicon"; \
    Description: "Crear acceso directo en el Escritorio"; \
    GroupDescription: "Íconos adicionales:"; \
    Flags: checkedonce

Name: "autostart"; \
    Description: "Iniciar Fusion Fitness automáticamente con Windows"; \
    GroupDescription: "Opciones de inicio:"; \
    Flags: unchecked

[Files]
; Copiar toda la carpeta generada por PyInstaller
Source: "{#MyAppDir}\*"; \
    DestDir: "{app}"; \
    Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
; Asegurarse de que el directorio de la app existe con permisos de escritura
Name: "{app}"; Permissions: everyone-full

[Icons]
; Acceso directo en menú inicio
Name: "{group}\{#MyAppName}"; \
    Filename: "{app}\{#MyAppExeName}"; \
    WorkingDir: "{app}"; \
    Comment: "Sistema de control de acceso GYM-ATLAS"

; Acceso directo en escritorio (si se eligió la tarea)
Name: "{autodesktop}\{#MyAppName}"; \
    Filename: "{app}\{#MyAppExeName}"; \
    WorkingDir: "{app}"; \
    Tasks: desktopicon

; Entrada de desinstalación en menú inicio
Name: "{group}\Desinstalar {#MyAppName}"; \
    Filename: "{uninstallexe}"

[Registry]
; Inicio automático con Windows (si se eligió la tarea)
Root: HKCU; \
    Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
    ValueType: string; \
    ValueName: "GymAtlas"; \
    ValueData: """{app}\{#MyAppExeName}"""; \
    Flags: uninsdeletevalue; \
    Tasks: autostart

[Run]
; Ofrecer ejecutar la app al terminar el instalador
Filename: "{app}\{#MyAppExeName}"; \
    Description: "Iniciar {#MyAppName} ahora"; \
    Flags: nowait postinstall skipifsilent; \
    WorkingDir: "{app}"

[UninstallRun]
; Matar el proceso si está corriendo antes de desinstalar
Filename: "taskkill"; \
    Parameters: "/F /IM {#MyAppExeName}"; \
    Flags: runhidden

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvFile: string;
begin
  if CurStep = ssPostInstall then
  begin
    EnvFile := ExpandConstant('{app}\.env');
    if not FileExists(EnvFile) then
      SaveStringToFile(EnvFile, 'DATABASE_URL=postgresql://neondb_owner:npg_x2MYst8Ibckd@ep-dry-term-b5hg2ejm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require' + #13#10, False);
  end;
end;
