const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Read local .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const NGROK_PATH = path.join(__dirname, 'ngrok.exe');
const CLOUDFLARED_PATH = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
const PORT = process.env.PORT || 3001;
const TOKEN = process.env.WHATSAPP_API_TOKEN || 'bunker_wa_secret_2026';
const NGROK_DOMAIN = process.env.NGROK_DOMAIN || ''; // Dominio estático gratuito de ngrok

const LOG_FILE = path.join(__dirname, 'gateway.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {}
  process.stdout.write(line);
}

log('======================================================');
log('  Iniciando Pasarela de WhatsApp Bunker Gym...');
log('======================================================');

// 1. Iniciar Servidor WhatsApp (Baileys)
const serverProcess = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'pipe',
  env: { ...process.env, PORT: String(PORT), WHATSAPP_API_TOKEN: TOKEN }
});

serverProcess.stdout.on('data', (d) => {
  const text = d.toString();
  log(`[SERVER] ${text.trim()}`);
});

serverProcess.stderr.on('data', (d) => {
  const text = d.toString();
  log(`[SERVER ERROR] ${text.trim()}`);
});

serverProcess.on('error', (err) => {
  log(`[SERVER PROCESS ERROR]: ${err.message}`);
});

// 2. Iniciar Túnel (Preferir Ngrok con dominio estático, o fallback Cloudflare)
let tunnelUrl = null;
let tunnelProcess = null;

function saveTunnelInfo(publicUrl) {
  tunnelUrl = publicUrl;
  const fullGatewayUrl = `${publicUrl}/send`;

  const infoContent = [
    `# CONFIGURACION PASARELA BUNKER WHATSAPP`,
    `FECHA_ACTUALIZACION=${new Date().toISOString()}`,
    `URL_PUBLICA_PANEL=${publicUrl}`,
    `WHATSAPP_GATEWAY_URL=${fullGatewayUrl}`,
    `WHATSAPP_API_TOKEN=${TOKEN}`,
    ``,
    `# INSTRUCCIONES PARA VERCEL:`,
    `# 1. En Vercel -> Settings -> Environment Variables:`,
    `#    WHATSAPP_GATEWAY_URL = ${fullGatewayUrl}`,
    `#    WHATSAPP_API_TOKEN   = ${TOKEN}`,
    `# 2. Guardar y hacer Redeploy si es necesario.`
  ].join('\n');

  fs.writeFileSync(path.join(__dirname, '..', 'whatsapp_tunnel_url.txt'), infoContent);

  log('\n**************************************************************');
  log(`  [TUNEL ACTIVO]: ${publicUrl}`);
  log(`  Panel Local:          http://localhost:${PORT}`);
  log(`  WHATSAPP_GATEWAY_URL: ${fullGatewayUrl}`);
  log(`  WHATSAPP_API_TOKEN:   ${TOKEN}`);
  log('**************************************************************\n');
}

function getNgrokExecutable() {
  const localExe = path.join(__dirname, 'ngrok.exe');
  if (fs.existsSync(localExe)) return localExe;

  const npmExe = 'C:\\Users\\Nicolas France\\AppData\\Roaming\\npm\\node_modules\\ngrok\\bin\\ngrok.exe';
  if (fs.existsSync(npmExe)) return npmExe;

  return null;
}

// Intentar Ngrok primero
const ngrokExe = getNgrokExecutable();
if (ngrokExe) {
  log('Iniciando túnel seguro con Ngrok...');
  const ngrokArgs = ['http', String(PORT), '--log=stdout'];
  if (NGROK_DOMAIN) {
    ngrokArgs.push(`--url=${NGROK_DOMAIN}`);
    log(`Usando dominio estático Ngrok: ${NGROK_DOMAIN}`);
  }

  try {
    tunnelProcess = spawn(ngrokExe, ngrokArgs, { cwd: __dirname });

    tunnelProcess.stdout.on('data', (data) => {
      const out = data.toString();
      const match = out.match(/url=(https:\/\/[^\s\r\n]+)/i);
      if (match && !tunnelUrl) {
        saveTunnelInfo(match[1]);
      }
    });

    tunnelProcess.stderr.on('data', (data) => {
      log(`[NGROK] ${data.toString().trim()}`);
    });

    tunnelProcess.on('exit', (code) => {
      if (code !== 0 && !tunnelUrl) {
        log(`[NGROK] Cerró con código ${code}. Iniciando fallback con Cloudflare...`);
        startCloudflare();
      }
    });

    tunnelProcess.on('error', (err) => {
      log(`[NGROK ERROR]: ${err.message}. Probando fallback Cloudflare...`);
      startCloudflare();
    });
  } catch (err) {
    log(`[NGROK SPAWN EXCEPTION]: ${err.message}. Probando fallback Cloudflare...`);
    startCloudflare();
  }
} else {
  startCloudflare();
}

function startCloudflare() {
  if (!fs.existsSync(CLOUDFLARED_PATH)) {
    log('[TUNEL] Ni Ngrok ni Cloudflared se encontraron instalados.');
    return;
  }
  log('Iniciando túnel Cloudflare...');
  try {
    tunnelProcess = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', `http://localhost:${PORT}`]);

    tunnelProcess.stderr.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !tunnelUrl) {
        saveTunnelInfo(match[0]);
      }
    });

    tunnelProcess.on('error', (err) => {
      log(`[CLOUDFLARED ERROR]: ${err.message}`);
    });
  } catch (err) {
    log(`[CLOUDFLARED SPAWN EXCEPTION]: ${err.message}`);
  }
}

// Limpieza al cerrar
function cleanup() {
  log('[CERRANDO SERVICIOS]...');
  try { if (serverProcess) serverProcess.kill(); } catch (e) {}
  try { if (tunnelProcess) tunnelProcess.kill(); } catch (e) {}
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
