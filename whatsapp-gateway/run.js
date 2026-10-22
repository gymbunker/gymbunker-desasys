const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CLOUDFLARED_PATH = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
const PORT = 3001;
const TOKEN = 'bunker_wa_secret_2026';

console.log('\n======================================================');
console.log('  Iniciando Pasarela de WhatsApp Bunker Gym...');
console.log('======================================================\n');

// 1. Start WhatsApp Server (Baileys)
const serverProcess = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PORT: String(PORT), WHATSAPP_API_TOKEN: TOKEN }
});

serverProcess.on('error', (err) => {
  console.error('[SERVER ERROR]:', err);
});

// 2. Start Cloudflare Tunnel
let cloudflareUrl = null;
const cloudflared = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', `http://localhost:${PORT}`]);

cloudflared.stderr.on('data', (data) => {
  const output = data.toString();
  
  // Cloudflare prints the URL in stderr
  const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !cloudflareUrl) {
    cloudflareUrl = match[0];
    const fullGatewayUrl = `${cloudflareUrl}/send`;

    // Save to file for easy copy/paste
    fs.writeFileSync(
      path.join(__dirname, '..', 'whatsapp_tunnel_url.txt'),
      `URL_PUBLICA_PANEL=${cloudflareUrl}\nWHATSAPP_GATEWAY_URL=${fullGatewayUrl}\nWHATSAPP_API_TOKEN=${TOKEN}\n`
    );

    console.log('\n**************************************************************');
    console.log('  [TUNEL CLOUDFLARE ACTIVO]');
    console.log(`  Panel Local:   http://localhost:${PORT}`);
    console.log(`  Panel Web:     ${cloudflareUrl}`);
    console.log('--------------------------------------------------------------');
    console.log('  CONFIGURACION PARA VERCEL (Environment Variables):');
    console.log(`  WHATSAPP_GATEWAY_URL = ${fullGatewayUrl}`);
    console.log(`  WHATSAPP_API_TOKEN   = ${TOKEN}`);
    console.log('**************************************************************\n');

    // Automatically open browser on local QR page
    try {
      const openCmd = process.platform === 'win32' ? 'start' : 'open';
      spawn(openCmd, [`http://localhost:${PORT}`], { shell: true });
    } catch (e) {}
  }
});

cloudflared.on('error', (err) => {
  console.error('[CLOUDFLARED ERROR]:', err);
});

// Handle graceful shutdown
function cleanup() {
  console.log('\n[CERRANDO SERVICIOS]...');
  try { serverProcess.kill(); } catch (e) {}
  try { cloudflared.kill(); } catch (e) {}
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
