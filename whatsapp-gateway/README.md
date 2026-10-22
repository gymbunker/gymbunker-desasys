# 📦 Pasarela de WhatsApp - Bunker Gym

Microservicio autónomo para envíos automáticos de WhatsApp con Node.js, Baileys, túnel permanente Ngrok y arranque silencioso en segundo plano con Windows.

---

## 🚀 Instalación Rápida en una Nueva Computadora

1. **Instalar Node.js:** Descargar e instalar versión LTS desde [nodejs.org](https://nodejs.org/).
2. **Copiar esta carpeta:** Pegar la carpeta `whatsapp-gateway` en la máquina destino.
   * *Nota:* Si vas a vincular un número nuevo, asegurate de que la carpeta `auth_info/` esté **vacía**.
3. **Ejecutar el instalador:** Dale doble clic a:
   👉 **`CONFIGURAR_ESTA_COMPUTADORA.bat`**
   * Presiona **ENTER** para usar el Authtoken pre-configurado de Ngrok.
   * El script configurará el dominio fijo `caramel-gopher-ounce.ngrok-free.dev`.
   * Creará el acceso directo invisible en el Inicio de Windows (`shell:startup`) para que arranque solo al prender la PC.
   * Abrirá el navegador en `http://localhost:3001` con el código QR para vincular el celular del gimnasio.

---

## 🛠️ Scripts Incluidos

* **`CONFIGURAR_ESTA_COMPUTADORA.bat`**: Asistente de instalación completa en 1 clic.
* **`start_silent.vbs`**: Inicia el servicio en segundo plano (completamente invisible, sin ventanas de consola).
* **`iniciar_whatsapp.bat`**: Inicia el servicio con ventana de consola visible (ideal para pruebas y ver logs en vivo).
* **`detener_whatsapp.bat`**: Detiene todos los procesos de Node y túneles en ejecución.

---

## 🌐 Configuración en Vercel / Backend

Variables de entorno a colocar en el servidor o Vercel:

```env
WHATSAPP_GATEWAY_URL=https://caramel-gopher-ounce.ngrok-free.dev/send
WHATSAPP_API_TOKEN=bunker_wa_secret_2026
WHATSAPP_PHONE=+5493516002716
VITE_WHATSAPP_PHONE=+5493516002716
```

---

## 🔌 API REST del Gateway

### `GET /status`
Devuelve el estado de la conexión con WhatsApp:
```json
{
  "connected": true,
  "phone": "5493516002716",
  "name": "Bunker Bot",
  "hasQR": false
}
```

### `POST /send`
Envía un mensaje de texto silencioso.
* **Headers:**
  * `Content-Type: application/json`
  * `Authorization: Bearer bunker_wa_secret_2026`
* **Body:**
  ```json
  {
    "phone": "5493516002716",
    "message": "Hola soy BUNKER BOT, tu cuota vence pronto."
  }
  ```
