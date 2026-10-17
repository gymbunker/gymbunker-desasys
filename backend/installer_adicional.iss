; installer.iss — Inno Setup script para GYM-ATLAS
; Requiere: Inno Setup 6+ (https://jrsoftware.org/isinfo.php)
; Compilar: abrir este archivo en Inno Setup y presionar F9
; Resultado: Output\GymAtlas_Setup.exe

#define MyAppName "Bunker Gym Adicional Kiosk"
#define MyAppVersion "3.0"
#define MyAppPublisher "Bunker Gym"
#define MyAppExeName "BunkerGymAdicional.exe"
#define MyAppDir "dist\BunkerGymAdicional"

[Setup]
AppId={{B4F2A3D1-7C8E-4F1A-9B2D-3E5F6A7C8D9E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://gymbunker.vercel.app
DefaultDirName={autopf}\BunkerGymAdicional
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=BunkerGymAdicional_Setup
SetupIconFile=bunker.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardResizable=no
; Mostrar un fondo de color oscuro en el instalador
;WizardImageFile=compiler:WizModernImage-IS.bmp
;WizardSmallImageFile=compiler:WizModernSmallImage-IS.bmp
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
    Description: "Iniciar GYM-ATLAS automáticamente con Windows"; \
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
// ── Pantalla de configuración de base de datos ──────────────────────────────
var
  DbPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  DbPage := CreateInputQueryPage(
    wpSelectDir,
    'Configuración de Base de Datos',
    'Conexión a Neon PostgreSQL',
    'Ingresá la URL de conexión a tu base de datos Neon.tech.' + #13#10 +
    'Formato: postgresql://usuario:clave@host/db?sslmode=require' + #13#10 +
    '(Podés dejarlo vacío y configurarlo manualmente después en el archivo .env)'
  );
  DbPage.Add('DATABASE_URL:', False);
  DbPage.Values[0] := '';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvFile: string;
  DbUrl: string;
  FileContent: TStringList;
begin
  if CurStep = ssPostInstall then
  begin
    DbUrl := DbPage.Values[0];
    EnvFile := ExpandConstant('{app}\.env');
    FileContent := TStringList.Create;
    try
      // Si el usuario ingresó una URL o el archivo .env no existe, lo escribimos/sobreescribimos
      if (DbUrl <> '') or (not FileExists(EnvFile)) then
      begin
        if DbUrl <> '' then
          FileContent.Add('DATABASE_URL=' + DbUrl)
        else
        begin
          FileContent.Add('# Configurá tu base de datos aqui:');
          FileContent.Add('# DATABASE_URL=postgresql://usuario:clave@host/db?sslmode=require');
        end;
        FileContent.SaveToFile(EnvFile);
      end;
    finally
      FileContent.Free;
    end;
  end;
end;
