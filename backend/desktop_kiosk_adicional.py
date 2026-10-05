import sys
import os

# Resolve .env path before any other imports that depend on env vars
if getattr(sys, 'frozen', False):
    _BASE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
else:
    _BASE_DIR = os.path.dirname(os.path.abspath(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(_BASE_DIR, '.env'))

import cv2
import customtkinter as ctk
from PIL import Image, ImageTk
import threading
import time
import datetime
import winsound
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from cv_engine import CVEngine

def compute_status(member) -> str:
    """Calcula el estado según los días transcurridos desde joined_at. INACTIVO se respeta siempre."""
    if member.status == "INACTIVO":
        return "INACTIVO"
    if not member.joined_at:
        return member.status
        
    plan = (member.membership_type or '').upper()
    total_days = 30
    if 'TRIMESTRAL' in plan: total_days = 90
    elif 'SEMESTRAL' in plan: total_days = 180
    elif 'ANUAL' in plan: total_days = 365
    
    today = datetime.datetime.utcnow()
    days_since = (today - member.joined_at).days
    
    if days_since >= total_days:
        return "DEUDA"
    elif days_since >= (total_days - 7):
        return "POR VENCER"
    return "ACTIVO"

# Global UI Scaling Fix for High DPI
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")
ctk.set_widget_scaling(1.0)
ctk.set_window_scaling(1.0)

class SplashScreen(ctk.CTkToplevel):
    def __init__(self):
        super().__init__()
        self.title("Fusion Fitness Adicional")
        self.geometry("450x520")
        self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.configure(fg_color="#050505")

        # Center Window
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = (sw // 2) - 225
        y = (sh // 2) - 260
        self.geometry(f"+{x}+{y}")

        # Logo
        logo_path = os.path.join(_BASE_DIR, "bunker.png")
        if not os.path.exists(logo_path):
            logo_path = os.path.join(_BASE_DIR, "bunker.png")
        if os.path.exists(logo_path):
            logo_img = ctk.CTkImage(light_image=Image.open(logo_path),
                                    dark_image=Image.open(logo_path), size=(90, 90))
            ctk.CTkLabel(self, image=logo_img, text="").pack(pady=(50, 8))

        # UI Elements
        self.label = ctk.CTkLabel(self, text="FUSION FITNESS ADICIONAL", font=ctk.CTkFont(size=24, weight="bold", family="Helvetica"), text_color="#f97316")
        self.label.pack(pady=(0, 4))
        ctk.CTkLabel(self, text="Sistema de Control de Acceso", font=ctk.CTkFont(size=11), text_color="#444").pack(pady=(0, 10))
        
        self.status = ctk.CTkLabel(self, text="Inicializando...", font=ctk.CTkFont(size=14), text_color="#666")
        self.status.pack(pady=10)
        
        self.progress = ctk.CTkProgressBar(self, width=280, height=10, corner_radius=5)
        self.progress.pack(pady=20)
        self.progress.set(0)

    def update_status(self, val, text):
        self.progress.set(val)
        self.status.configure(text=text)
        self.update()

class GymDesktopKiosk:
    def __init__(self, root):
        self.root = root
        self.root.title("Fusion Fitness | Control de Acceso")
        self.root.geometry("1280x800")
        self.root.configure(fg_color="#000000")
        self.root.withdraw()

        # Start loading sequence
        self.show_splash()

    def show_splash(self):
        self.splash = SplashScreen()
        threading.Thread(target=self._initialization_thread, daemon=True).start()

    def _initialization_thread(self):
        # Wait for network + DB — retry indefinitely until connection succeeds
        from sqlalchemy import text
        attempt = 0
        while True:
            attempt += 1
            try:
                self.splash.update_status(0.2, f"Conectando... intento {attempt}")
                db = SessionLocal()
                db.execute(text("SELECT 1"))
                db.close()
                break  # connection OK
            except Exception:
                msg = f"Sin red, reintentando ({attempt})..."
                self.splash.update_status(0.2, msg)
                time.sleep(4)

        self.splash.update_status(0.5, "Servicio iniciado")

        self.splash.update_status(0.8, "Iniciando cámara...")
        self.cv_engine = CVEngine()
        self.cv_engine.start()

        self.splash.update_status(1.0, "Listo!")
        self.root.after(0, self.launch_main_ui)

    def launch_main_ui(self):
        if self.splash:
            self.splash.destroy()
        
        self.setup_layout()
        self.root.deiconify()
        self.update_video_loop()

    def setup_layout(self):
        # 2-Column Grid: Sidebar (400px), Camera (Auto)
        self.root.grid_columnconfigure(0, weight=0, minsize=400)
        self.root.grid_columnconfigure(1, weight=1)
        self.root.grid_rowconfigure(0, weight=1)

        # SIDEBAR (LEFT)
        self.sidebar = ctk.CTkFrame(self.root, fg_color="#0a0a0a", corner_radius=0, border_width=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        
        # CAMERA (RIGHT)
        self.camera_frame = ctk.CTkFrame(self.root, fg_color="black", corner_radius=0, border_width=0)
        self.camera_frame.grid(row=0, column=1, sticky="nsew")
        
        self.video_label = ctk.CTkLabel(self.camera_frame, text="")
        self.video_label.pack(expand=True, fill="both")

        # Sidebar Elements
        # Logo en sidebar
        logo_path = os.path.join(_BASE_DIR, "bunker.png")
        if not os.path.exists(logo_path):
            logo_path = os.path.join(_BASE_DIR, "bunker.png")
        if os.path.exists(logo_path):
            logo_img = ctk.CTkImage(light_image=Image.open(logo_path),
                                    dark_image=Image.open(logo_path), size=(80, 80))
            ctk.CTkLabel(self.sidebar, image=logo_img, text="").pack(pady=(40, 8))
        ctk.CTkLabel(self.sidebar, text="FUSION FITNESS ADICIONAL", font=ctk.CTkFont(size=25, weight="bold"), text_color="#f97316").pack(pady=(0, 4))
        ctk.CTkLabel(self.sidebar, text="CONTROL DE ACCESO", font=ctk.CTkFont(size=12, weight="bold"), text_color="#333").pack(pady=(0, 30))

        # INPUT CONTAINER (To easily hide/show)
        self.input_container = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        self.input_container.pack(fill="x")

        # DNI INPUT (GLASS STYLE)
        self.input_card = ctk.CTkFrame(self.input_container, fg_color="#1a1a1a", corner_radius=20, border_width=1, border_color="#333")
        self.input_card.pack(pady=(20, 10), padx=40, fill="x")
        
        ctk.CTkLabel(self.input_card, text="INGRESE DNI", font=ctk.CTkFont(size=10, weight="bold"), text_color="#555").pack(pady=(10, 0))
        self.dni_entry = ctk.CTkEntry(self.input_card, placeholder_text="12345678", 
                                      height=50, font=ctk.CTkFont(size=30, weight="bold"),
                                      fg_color="transparent", border_width=0, justify="center")
        self.dni_entry.pack(pady=(5, 15), padx=20, fill="x")
        self.dni_entry.bind("<Return>", self.on_check_in)
        self.dni_entry.focus_set()

        # NUMERIC KEYPAD
        self.numpad_frame = ctk.CTkFrame(self.input_container, fg_color="transparent")
        self.numpad_frame.pack(pady=10, padx=40, fill="x")
        
        for i in range(3): self.numpad_frame.columnconfigure(i, weight=1)
        
        keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'DEL']
        row, col = 0, 0
        for key in keys:
            if key == 'CLR': cmd = lambda: self.dni_entry.delete(0, 'end')
            elif key == 'DEL': cmd = self.handle_backspace
            else: cmd = lambda k=key: self.dni_entry.insert('end', k)
            
            ctk.CTkButton(self.numpad_frame, text=key, height=45, width=80,
                          fg_color="#1a1a1a" if key.isdigit() else "#444",
                          hover_color="#333", font=ctk.CTkFont(size=18, weight="bold"),
                          corner_radius=12, command=cmd).grid(row=row, column=col, padx=5, pady=5, sticky="nsew")
            col += 1
            if col > 2: col, row = 0, row + 1
        
        # Action Button
        self.action_btn = ctk.CTkButton(self.input_container, text="REGISTRAR ACCESO", height=50,
                                        fg_color="#3b82f6", hover_color="#2563eb",
                                        font=ctk.CTkFont(size=16, weight="bold"),
                                        corner_radius=15, command=self.on_check_in)
        self.action_btn.pack(pady=10, padx=40, fill="x")

        # STATUS DISPLAY
        self.status_box = ctk.CTkFrame(self.sidebar, fg_color="#111", height=250, corner_radius=24, border_width=2, border_color="#1a1a1a")
        self.status_box.pack(pady=20, padx=40, fill="x")
        self.status_box.pack_propagate(False)

        self.indicator = ctk.CTkLabel(self.status_box, text="●", font=ctk.CTkFont(size=40), text_color="#222")
        self.indicator.pack(pady=(15, 0))

        self.name_label = ctk.CTkLabel(self.status_box, text="BIENVENIDO", font=ctk.CTkFont(size=20, weight="bold"), text_color="#111")
        self.name_label.pack(pady=(0, 2))

        self.dni_label = ctk.CTkLabel(self.status_box, text="DNI: ---", font=ctk.CTkFont(size=12, family="Courier"), text_color="#222")
        self.dni_label.pack(pady=(0, 10))

        self.status_label = ctk.CTkLabel(self.status_box, text="ESPERANDO", font=ctk.CTkFont(size=28, weight="bold"), text_color="#444")
        self.status_label.pack(expand=True, pady=(0, 4))

        self.plan_label = ctk.CTkLabel(self.status_box, text="", font=ctk.CTkFont(size=10), text_color="#333", justify="center")
        self.plan_label.pack(pady=(0, 16))

        # Versioning
        ctk.CTkLabel(self.sidebar, text="Fusion Fitness Adicional v3.0 | SYNC: ONLINE", font=ctk.CTkFont(size=9), text_color="#333").pack(side="bottom", pady=20)

    def handle_backspace(self):
        curr = self.dni_entry.get()
        if curr:
            self.dni_entry.delete(len(curr)-1, 'end')

    def on_check_in(self, event=None):
        dni = self.dni_entry.get().strip()
        if not dni: return
        
        self.dni_entry.delete(0, 'end')
        self.status_label.configure(text="VERIFICANDO...")
        
        threading.Thread(target=self._perform_verification, args=(dni,), daemon=True).start()

    def _perform_verification(self, dni):
        db = SessionLocal()
        try:
            member = db.query(models.Member).filter(models.Member.dni == dni).first()
            if member:
                status = compute_status(member)
                if status != member.status:
                    member.status = status
                    db.commit()

                if status == "INACTIVO":
                    self.cv_engine.set_member_status(member.name, "INACTIVO")
                    self.root.after(0, lambda: self.render_status_result(member.name, "INACTIVO", dni, "Socio Inactivo"))
                    return
                
                has_adicional = False
                add_plans = member.additional_plans or []
                for p in add_plans:
                    if "adicional" in p.lower():
                        has_adicional = True
                        break
                
                if member.membership_type and "adicional" in member.membership_type.lower():
                    has_adicional = True

                if not has_adicional:
                    self.cv_engine.set_member_status(member.name, "SIN PLAN")
                    self.root.after(0, lambda: self.render_status_result(member.name, "SIN PLAN", dni, "Sin Plan Adicional\nContratado"))
                    return

                now = datetime.datetime.utcnow()
                
                # Mes actual
                meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
                mes_str = meses[now.month]
                dia_actual = now.day
                
                start_of_today = datetime.datetime(now.year, now.month, now.day)
                
                sessions_used_totem = db.query(models.Checkin).filter(
                    models.Checkin.member_id == member.id,
                    models.Checkin.checkin_at >= start_of_today
                ).count()
                
                sessions_used_bookings = db.query(models.Booking).filter(
                    models.Booking.member_id == member.id,
                    models.Booking.status == "attended",
                    models.Booking.start_time >= start_of_today
                ).count()
                
                used_today = sessions_used_totem + sessions_used_bookings

                if status == "DEUDA":
                    plan_info = f"• Mes Trascurriendo: {mes_str} {dia_actual}\n• Ingresos Hoy: {used_today}\n• Estado Adicional: Deuda"
                    self.cv_engine.set_member_status(member.name, "DEUDA")
                    self.root.after(0, lambda: self.render_status_result(member.name, "DEUDA", dni, plan_info))
                    return

                # Registrar ingreso
                now_time = datetime.datetime.utcnow()
                start_of_today_utc = now_time.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_today_utc = start_of_today_utc + datetime.timedelta(days=1)
                
                # Try to find a confirmed/reserved booking for today
                booking = db.query(models.Booking).filter(
                    models.Booking.member_id == member.id,
                    models.Booking.status.in_(["confirmed", "reserved"]),
                    models.Booking.start_time >= start_of_today_utc,
                    models.Booking.start_time < end_of_today_utc
                ).order_by(models.Booking.start_time).first()
                
                if booking:
                    booking.status = "attended"
                    booking.attended_at = now_time
                else:
                    plan_info = f"No tienes reservaciones\nde adicional para hoy"
                    self.cv_engine.set_member_status(member.name, "SIN RESERVA")
                    self.root.after(0, lambda: self.render_status_result(member.name, "SIN RESERVA", dni, plan_info))
                    return

                member.last_checkin = now_time
                db.commit()

                used_today += 1
                
                estado_texto = "Al Dia" if status == "ACTIVO" else "Por Vencer"
                plan_info = f"• Mes Trascurriendo: {mes_str} {dia_actual}\n• Ingresos Hoy: {used_today}\n• Estado Adicional: {estado_texto}"
                
                # Display AL DIA if ACTIVO for the green success color
                display_status = "AL DIA" if status == "ACTIVO" else status
                self.cv_engine.set_member_status(member.name, status)
                self.root.after(0, lambda: self.render_status_result(member.name, display_status, dni, plan_info))
            else:
                self.root.after(0, lambda: self.render_status_result("ERROR", "NO EXISTE", dni, ""))
        except Exception as e:
            print(f"Verification error: {e}")
            self.root.after(0, lambda: self.render_status_result("ERROR", "DB ERROR", dni, ""))
        finally:
            db.close()

    def render_status_result(self, name, status, dni, plan_info=""):
        self.input_container.pack_forget()

        color = "#ff4444"
        bg = "#260000"

        if status == "ACTIVO" or status == "AL DIA":
            color = "#00ff99"
            bg = "#001a0f"
            threading.Thread(target=lambda: winsound.Beep(1000, 500)).start()
        elif status == "POR VENCER":
            color = "#ffcc00"
            bg = "#262200"
            threading.Thread(target=lambda: winsound.Beep(600, 800)).start()
        elif status == "SIN RESERVA":
            color = "#ff8800"
            bg = "#261300"
            threading.Thread(target=self.trigger_alarm_sound).start()
        else:
            # For DEUDA, SIN PASES, INACTIVO, NO EXISTE, DB ERROR
            threading.Thread(target=self.trigger_alarm_sound).start()

        self.status_box.configure(fg_color=bg, border_color=color)
        self.status_label.configure(text=status, text_color=color)
        self.indicator.configure(text_color=color)
        self.name_label.configure(text=name, text_color=color)
        self.dni_label.configure(text=f"DNI: {dni}", text_color=color)
        self.plan_label.configure(text=plan_info, text_color=color)
        
        # Reset after 7s
        self.root.after(7000, self.return_to_idle)

    def trigger_alarm_sound(self):
        for _ in range(3):
            winsound.Beep(1800, 600) # Higher frequency for more 'alert' sound
            time.sleep(0.1)

    def return_to_idle(self):
        # Restore Keypad
        self.input_container.pack(fill="x", before=self.status_box)
        self.dni_entry.focus_set()

        # Reset UI
        self.status_box.configure(fg_color="#111", border_color="#1a1a1a")
        self.status_label.configure(text="ESPERANDO", text_color="#444")
        self.indicator.configure(text_color="#222")
        self.name_label.configure(text="BIENVENIDO", text_color="#111")
        self.dni_label.configure(text="DNI: ---", text_color="#222")
        self.plan_label.configure(text="", text_color="#333")
        self.cv_engine.set_member_status("", "IDLE")

    def update_video_loop(self):
        # 1. Update UI from AI Engine
        current_ai_status = self.cv_engine.current_status
        current_ai_name = self.cv_engine.current_name
        
        # If the AI engine has a non-idle status that isn't currently displayed
        if current_ai_status != "IDLE" and self.status_label.cget("text") == "ESPERANDO":
            # Trigger the same logic as a manual DNI check
            self.root.after(0, lambda: self.render_status_result(current_ai_name, current_ai_status, "IA-CAM"))

        # 2. Update Video Frame
        frame = self.cv_engine.output_frame
        if frame is not None:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(rgb_frame)
            
            # Maintain aspect ratio to avoid 'Zoom' effect
            w_win = self.video_label.winfo_width()
            h_win = self.video_label.winfo_height()
            
            if w_win > 100 and h_win > 100:
                img_w, img_h = img.size
                aspect = img_w / img_h
                
                if w_win / h_win > aspect:
                    new_h = h_win
                    new_w = int(h_win * aspect)
                else:
                    new_w = w_win
                    new_h = int(w_win / aspect)
                
                ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=(new_w, new_h))
                self.video_label.configure(image=ctk_img)
        
        self.root.after(33, self.update_video_loop)

if __name__ == "__main__":
    root = ctk.CTk()
    app = GymDesktopKiosk(root)
    root.mainloop()
