const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3001;
const AUTH_DIR = path.join(__dirname, 'auth_info');
const API_TOKEN = process.env.WHATSAPP_API_TOKEN || 'bunker_wa_secret_2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


let sock = null;
let isConnected = false;
let currentQR = null;
let currentQRDataUrl = null;
let connectedUser = null;
let isConnecting = false;
const messageStore = new Map();

async function startWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.windows('Desktop'),
      syncFullHistory: false,
      getMessage: async (key) => {
        if (messageStore.has(key.id)) {
          return messageStore.get(key.id);
        }
        return { conversation: '' };
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        try {
          currentQRDataUrl = await qrcode.toDataURL(qr, { scale: 8, margin: 2 });
          console.log('\n[WHATSAPP] >> Nuevo código QR generado. Escanéalo en: http://localhost:' + PORT + ' o en la terminal.\n');
        } catch (e) {
          console.error('[WHATSAPP] Error generando QR DataURL:', e);
        }
      }

      if (connection === 'open') {
        isConnected = true;
        currentQR = null;
        currentQRDataUrl = null;
        connectedUser = sock.user;
        const phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Desconocido';
        console.log(`\n======================================================`);
        console.log(`  [WHATSAPP CONECTADO CON ÉXITO]`);
        console.log(`  Número vinculado: +${phone}`);
        console.log(`  Nombre: ${sock.user?.name || 'Bunker Gym'}`);
        console.log(`  Listo para despachar mensajes en segundo plano!`);
        console.log(`======================================================\n`);
      }

      if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[WHATSAPP] Conexión cerrada (Código: ${statusCode}). Reconectar: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('[WHATSAPP] Sesión cerrada desde el celular. Limpiando credenciales para nuevo QR...');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {}
        }

        isConnecting = false;
        setTimeout(() => {
          startWhatsApp();
        }, 3000);
      }
    });
  } catch (error) {
    console.error('[WHATSAPP] Error inicializando socket:', error);
    isConnecting = false;
    setTimeout(startWhatsApp, 5000);
  }
}

// Check authorization middleware (optional for local, protects public tunnel)
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const queryToken = req.query.token;
  const bodyToken = req.body.token;

  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : (queryToken || bodyToken);

  // If token is provided, validate it. If not configured or matched, allow.
  if (API_TOKEN && token && token !== API_TOKEN) {
    return res.status(401).json({ error: 'Token no autorizado' });
  }
  next();
}

// Cache in-memory para evitar mensajes duplicados (debounce de 8 segundos)
const recentDispatches = new Map();

function isDuplicate(key) {
  const now = Date.now();
  if (recentDispatches.has(key)) {
    const lastTime = recentDispatches.get(key);
    if (now - lastTime < 8000) {
      return true;
    }
  }
  recentDispatches.set(key, now);
  // Limpieza periódica de memoria
  if (recentDispatches.size > 300) {
    for (const [k, t] of recentDispatches.entries()) {
      if (now - t > 30000) recentDispatches.delete(k);
    }
  }
  return false;
}

// -------------------- HTTP ENDPOINTS --------------------

// Status JSON
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    phone: connectedUser?.id ? connectedUser.id.split(':')[0] : null,
    name: connectedUser?.name || null,
    hasQR: !!currentQR
  });
});

// Send Message Endpoint (Compatible with backend/admin_routes.py)
app.post('/send', authenticate, async (req, res) => {
  try {
    const rawTo = req.body.to || req.body.phone || req.body.recipient;
    const message = req.body.message || req.body.body || req.body.text;
    const pdfBase64 = req.body.pdf_base64 || req.body.document || req.body.file;
    const fileName = req.body.filename || req.body.fileName || 'Comprobante_Pago_BunkerGym.pdf';

    if (!rawTo) {
      return res.status(400).json({ error: 'Campo "to" o "phone" es obligatorio.' });
    }
    if (!message && !pdfBase64) {
      return res.status(400).json({ error: 'Campo "message" o "pdf_base64" es obligatorio.' });
    }

    if (!isConnected || !sock) {
      return res.status(503).json({
        error: 'WhatsApp no está vinculado todavía. Por favor escanear el código QR primero.',
        hasQR: !!currentQR
      });
    }

    // Sanitize phone number digits
    let cleanPhone = String(rawTo).replace(/[^0-9]/g, '');

    // Normalize Argentina format: 54 + 9 + area + number
    if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549') && cleanPhone.length === 12) {
      cleanPhone = '549' + cleanPhone.slice(2);
    } else if (cleanPhone.startsWith('351') && cleanPhone.length === 10) {
      cleanPhone = '549' + cleanPhone;
    }

    // Anti-duplicados: verificar si se envió el mismo mensaje a este número hace menos de 8 segundos
    const dedupeKey = `${cleanPhone}:${String(message || '').trim()}:${pdfBase64 ? 'pdf' : 'txt'}`;
    if (isDuplicate(dedupeKey)) {
      console.log(`[WHATSAPP DEBOUNCE] Mensaje duplicado omitido para ${cleanPhone} (evitado envío doble).`);
      return res.json({
        success: true,
        status: 'debounced',
        to: cleanPhone,
        message: 'Mensaje duplicado evitado exitosamente'
      });
    }

    // Resolve canonical JID with WhatsApp server to prevent "Esperando el mensaje"
    let targetJid = `${cleanPhone}@s.whatsapp.net`;
    try {
      const check1 = await sock.onWhatsApp(cleanPhone);
      if (check1 && check1[0]?.exists) {
        targetJid = check1[0].jid;
      } else if (cleanPhone.startsWith('549')) {
        const altPhone = '54' + cleanPhone.slice(3);
        const check2 = await sock.onWhatsApp(altPhone);
        if (check2 && check2[0]?.exists) {
          targetJid = check2[0].jid;
        }
      } else if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549')) {
        const altPhone = '549' + cleanPhone.slice(2);
        const check3 = await sock.onWhatsApp(altPhone);
        if (check3 && check3[0]?.exists) {
          targetJid = check3[0].jid;
        }
      }
    } catch (checkErr) {
      console.warn('[WHATSAPP] onWhatsApp verification skipped:', checkErr.message);
    }

    let sent;
    if (pdfBase64) {
      try {
        const cleanBase64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, '').replace(/^data:.*;base64,/, '');
        const docBuffer = Buffer.from(cleanBase64, 'base64');
        console.log(`[WHATSAPP DISPATCH] Enviando documento PDF (${docBuffer.length} bytes) a: ${targetJid}...`);
        sent = await sock.sendMessage(targetJid, {
          document: docBuffer,
          mimetype: 'application/pdf',
          fileName: fileName,
          caption: String(message || '')
        });
      } catch (pdfErr) {
        console.error('[WHATSAPP PDF ERROR] Falló envío de PDF adjunto, enviando como texto:', pdfErr);
        sent = await sock.sendMessage(targetJid, { text: String(message || '') });
      }
    } else {
      console.log(`[WHATSAPP DISPATCH] Enviando texto a JID: ${targetJid}...`);
      sent = await sock.sendMessage(targetJid, { text: String(message) });
    }

    if (sent?.key?.id && sent?.message) {
      messageStore.set(sent.key.id, sent.message);
      if (messageStore.size > 500) {
        const firstKey = messageStore.keys().next().value;
        messageStore.delete(firstKey);
      }
    }

    console.log(`[WHATSAPP SENT] Mensaje entregado con ID: ${sent.key.id}`);

    return res.json({
      success: true,
      status: 'sent',
      messageId: sent.key.id,
      to: targetJid.replace('@s.whatsapp.net', ''),
      has_pdf: !!pdfBase64,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[WHATSAPP SEND ERROR]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error interno al enviar mensaje de WhatsApp'
    });
  }
});

// Serve logo
app.get('/bunker.png', (req, res) => {
  const logoPath = path.join(__dirname, 'bunker.png');
  if (fs.existsSync(logoPath)) {
    return res.sendFile(logoPath);
  }
  const rootLogo = path.join(__dirname, '..', 'bunker.png');
  if (fs.existsSync(rootLogo)) {
    return res.sendFile(rootLogo);
  }
  res.status(404).end();
});

// UI: Web View with Live QR Code or Connected Status
app.get(['/', '/qr'], (req, res) => {
  const phone = connectedUser?.id ? connectedUser.id.split(':')[0] : null;

  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BUNKER GYM - Pasarela WhatsApp</title>
  <style>
    body {
      margin: 0;
      background: #0d0f14;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #151922;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 28px;
      max-width: 440px;
      width: 100%;
      padding: 36px 30px;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6);
    }
    .brand-logo {
      width: 80px;
      height: 80px;
      object-fit: contain;
      margin: 0 auto 14px auto;
      display: block;
      filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6));
    }
    .logo {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 3px;
      color: #f38e26;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: rgba(255, 255, 255, 0.4);
      margin-bottom: 24px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 24px;
    }
    .badge.connected {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #4ade80;
    }
    .badge.disconnected {
      background: rgba(243, 142, 38, 0.15);
      border: 1px solid rgba(243, 142, 38, 0.4);
      color: #f38e26;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 10px currentColor;
    }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border-radius: 20px;
      display: inline-block;
      margin: 10px 0 20px 0;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .qr-container img {
      display: block;
      width: 240px;
      height: 240px;
    }
    .instructions {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .instructions b {
      color: #ffffff;
    }
    .token-box {
      background: rgba(0,0,0,0.3);
      border: 1px dashed rgba(255,255,255,0.15);
      border-radius: 12px;
      padding: 10px;
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      word-break: break-all;
      margin-top: 20px;
      font-family: monospace;
    }
    .footer {
      font-size: 10px;
      color: rgba(255,255,255,0.25);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="/bunker.png" alt="Bunker Gym" class="brand-logo" onerror="this.style.display='none'" />
    <div class="logo">BUNKER GYM</div>
    <div class="subtitle">Pasarela de WhatsApp 2026</div>

    ${isConnected ? `
      <div class="badge connected">
        <span class="badge-dot"></span>
        Conectado y Activo
      </div>
      <div style="font-size: 18px; font-weight: 900; margin: 15px 0 5px 0;">+${phone}</div>
      <p style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 20px;">
        La pasarela está lista para despachar recordatorios y notificaciones de forma silenciosa.
      </p>
      <form action="/reset" method="POST" style="margin-top: 15px;" onsubmit="return confirm('¿Deseas desvincular y escanear un nuevo código QR para renovar las claves de cifrado?');">
        <button type="submit" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; padding: 8px 16px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer; text-transform: uppercase;">
          Re-vincular / Renovar Sesión
        </button>
      </form>
    ` : `
      <div class="badge disconnected">
        <span class="badge-dot"></span>
        Escanea el Código QR
      </div>

      ${currentQRDataUrl ? `
        <div class="qr-container">
          <img src="${currentQRDataUrl}" alt="WhatsApp QR Code" />
        </div>
        <div class="instructions">
          Abrí <b>WhatsApp</b> en tu celular &rarr; <b>Dispositivos vinculados</b> &rarr; <b>Vincular un dispositivo</b> y apuntá la cámara hacia este código QR.
        </div>
      ` : `
        <div style="padding: 40px 20px; color: rgba(255,255,255,0.4); font-size: 13px;">
          Iniciando sesión y generando código QR... Por favor aguarda unos segundos.
        </div>
      `}
    `}

    <div class="token-box">
      <b>Token de API:</b> ${API_TOKEN}
    </div>

    <div class="footer">Bunker Gym OS • Baileys + Cloudflare Engine</div>
  </div>

  <script>
    // Auto-reload every 15s if waiting for QR or scan
    ${!isConnected ? `
      setTimeout(() => {
        window.location.reload();
      }, 15000);
    ` : ''}
  </script>
</body>
</html>
  `);
});

// Endpoint para reiniciar y limpiar sesión corrupta
app.post('/reset', (req, res) => {
  console.log('\n[WHATSAPP] Reseteando sesión y claves de cifrado a pedido del usuario...');
  try {
    if (sock) {
      sock.end();
      sock = null;
    }
  } catch (e) {}
  isConnected = false;
  isConnecting = false;
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log('[WHATSAPP] auth_info limpiado.');
  } catch (e) {}
  setTimeout(() => {
    startWhatsApp();
  }, 1000);
  res.redirect('/');
});

// Start listening and launch WhatsApp client
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  Bunker Gym WhatsApp Gateway corriendo en:`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`======================================================\n`);
  startWhatsApp();
});
