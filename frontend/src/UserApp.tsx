import ProgressChart from './components/ProgressChart';
import { Zap, Dumbbell, Clock, Check, Play, LayoutDashboard, User, TrendingUp, ArrowUpRight, X, Lock, CheckCircle2, AlertTriangle, Info, Receipt, History, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


export default function UserApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [activeTab, setActiveTab] = useState('Home');
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3500);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [chartFilter, setChartFilter] = useState<'7d'|'30d'|'all'>('all');
  const [showMorning, setShowMorning] = useState(false);
  const [showEvening, setShowEvening] = useState(false);
  const [dbActivities, setDbActivities] = useState<any[]>([]);


  const [checkinStats, setCheckinStats] = useState<{ total: number; used: number; remaining: number } | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/activities`);
      if (res.ok) {
        const data = await res.json();
        setDbActivities(data);
      }
    } catch (e) {
      console.error(e);
    }
  };
  
  useEffect(() => {
    fetchActivities();
  }, []);


  const [globalExercises, setGlobalExercises] = useState<any[]>([]);
  const [selectedExerciseInfo, setSelectedExerciseInfo] = useState<any | null>(null);
  const [isExerciseInfoOpen, setIsExerciseInfoOpen] = useState(false);

  const API_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? "http://localhost:8000" 
    : "/api";

  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [uncompletedExercises, setUncompletedExercises] = useState<any[]>([]);
  const [checklistResponses, setChecklistResponses] = useState<any>({});


  // User Data State
  const [userData, setUserData] = useState({
    name: "", dni: "", plan: "Miembro", additional_plans: [] as string[], maxDaysPerWeek: 7, streak: 0, streakMessage: "",
    routine: [] as any[], evolution: [] as any[], attendanceHistory: [] as any[]
  });


  const [bookings, setBookings] = useState<any[]>([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [daySchedules, setDaySchedules] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekSchedulesMap, setWeekSchedulesMap] = useState<Record<string, any[]>>({});

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setTimeout(() => onConfirm(), 150);
      }
    });
  };

  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekDates = (offsetWeeks: number) => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.getFullYear(), today.getMonth(), diff + offsetWeeks * 7);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const fetchWeekSchedules = async (dates: Date[]) => {
    try {
      const promises = dates.map(d => {
        const dateStr = getLocalDateStr(d);
        return fetch(`${API_URL}/user/class_schedules?date=${dateStr}`)
          .then(r => r.json())
          .then(data => ({ dateStr, schedules: data }));
      });
      const results = await Promise.all(promises);
      const map: Record<string, any[]> = {};
      results.forEach(res => {
        map[res.dateStr] = Array.isArray(res.schedules) ? res.schedules : [];
      });
      setWeekSchedulesMap(map);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (viewMode === 'week') {
      const dates = getWeekDates(weekOffset);
      fetchWeekSchedules(dates);
    }
  }, [weekOffset, viewMode]);

  useEffect(() => {
    if (isAuthenticated && userData.dni) {
      fetchUserFullInfo(userData.dni);
    }
  }, [isAuthenticated, userData.dni, activeTab]);



  
  const fetchUserProgress = async (dni: string) => {
    try {
      const res = await fetch(`${API_URL}/user/${dni}/progress`);
      if (res.ok) {
        const data = await res.json();
        setUserData(prev => ({ ...prev, evolution: data.chart_data || [], last_weights: data.last_weights || {} }));
      }
    } catch (e) {
      console.error("Error fetching progress", e);
    }
  };
const fetchUserBookings = async (memberDni: string) => {
    try {
      const res = await fetch(`${API_URL}/user/${memberDni}/bookings`);
      if (res.ok) setBookings(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchHolidays = async () => {
    try {
      const res = await fetch(`${API_URL}/user/holidays`);
      if (res.ok) setHolidays(await res.json());
    } catch (e) { console.error(e); }
  };

  const [plansBreakdown, setPlansBreakdown] = useState<any[]>([]);

  const fetchUserFullInfo = async (memberDni: string) => {
    try {
      const res = await fetch(`${API_URL}/user/${memberDni}/full_info`);
      if (res.ok) {
        const data = await res.json();
        if (data.checkin_stats) setCheckinStats(data.checkin_stats);
        if (data.plans_breakdown) setPlansBreakdown(data.plans_breakdown);
        if (data.attendance_history) setAttendanceHistory(data.attendance_history);
        if (data.billing_history) setBillingHistory(data.billing_history);
        setUserData(prev => ({
          ...prev,
          name: data.member.name,
          dni: data.member.dni,
          plan: data.member.membership_type,
          routine: Array.isArray(data.member.routine) ? data.member.routine : [],
          streak: data.member.streak || 0,
          streakMessage: data.member.streak_message || "",
          additional_plans: data.member.additional_plans || []
        }));
      }
    } catch (e) {
      console.error("Error fetching full user info", e);
    }
  };

  const generatePaymentPDF = async (payment: any) => {
    const doc = new jsPDF();

    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
    });

    try {
      const bgImg = await loadImage('/bunker.png');
      const gState = new (doc as any).GState({opacity: 0.08});
      doc.setGState(gState);
      doc.addImage(bgImg, 'PNG', 45, 80, 120, 120);
      doc.setGState(new (doc as any).GState({opacity: 1.0}));
    } catch (e) {}

    doc.setFontSize(22);
    doc.setTextColor(249, 115, 22);
    doc.text('FUSION FITNESS GYM', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('COMPROBANTE DE PAGO', 105, 30, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Fecha: ${payment.date}`, 14, 45);

    const planDesglose = payment.plan_details && payment.plan_details.length > 0 
      ? payment.plan_details.map((p: any) => `${p.name} ($${p.price?.toLocaleString()})`).join(', ')
      : (payment.additional_plans && payment.additional_plans.length > 0
          ? `${payment.plan || userData.plan} + ${payment.additional_plans.join(' + ')}`
          : (payment.plan || userData.plan || '-'));

    autoTable(doc, {
      startY: 55,
      head: [['Detalle', 'Información']],
      body: [
        ['Nombre Completo', userData.name || '-'],
        ['DNI', userData.dni || '-'],
        ['Planes Contratados', planDesglose],
        ['Monto Total Abonado', `$${payment.amount?.toLocaleString()}`],
        ['Medio de Pago Utilizado', payment.method || 'Efectivo'],
        ['Usuario del Sistema', payment.processed_by || 'Administración'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] },
    });

    const tableEndY = (doc as any).lastAutoTable?.finalY || 136;
    const tableCenterY = (55 + tableEndY) / 2;

    doc.setFontSize(80);
    const textW = doc.getTextWidth('PAGADO');
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);
    const stampStartX = 105 - (textW / 2) * cos45;
    const stampStartY = tableCenterY + (textW / 2) * sin45;

    doc.setGState(new (doc as any).GState({opacity: 0.13}));
    doc.setTextColor(249, 115, 22);
    doc.text('PAGADO', stampStartX, stampStartY, { angle: 45 });
    doc.setGState(new (doc as any).GState({opacity: 1.0}));
    doc.setTextColor(0, 0, 0);

    const finalY = tableEndY;
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('---------------------------------------------------------', 105, finalY + 20, { align: 'center' });
    doc.text('Sello Institucional - Fusion Fitness', 105, finalY + 26, { align: 'center' });

    try {
      const logo = await loadImage('/bunker.png');
      doc.addImage(logo, 'PNG', 85, finalY + 35, 40, 40);
    } catch (e) {}

    doc.setFontSize(7);
    doc.setTextColor(190, 190, 190);
    doc.text('ESTE COMPROBANTE ES VÁLIDO COMO CONSTANCIA DE PAGO', 105, finalY + 82, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.save(`Comprobante_Pago_${(userData.name || 'Socio').replace(/\s+/g, '_')}.pdf`);
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, password })
      });
      
      const data = await res.json();
      if (res.ok) {
        const loadedRoutine = Array.isArray(data.member.routine) ? data.member.routine : [];

        setUserData(prev => ({
          ...prev,
          name: data.member.name,
          dni: data.member.dni,
          plan: data.member.membership_type,
          routine: loadedRoutine,
          streak: data.member.streak || 0,
          streakMessage: data.member.streak_message || "",
          additional_plans: data.member.additional_plans || []
        }));
        setIsAuthenticated(true);

        try {
          const exRes = await fetch(`${API_URL}/admin/exercises`);
          if (exRes.ok) {
            setGlobalExercises(await exRes.json());
          }
        } catch (e) { console.error("Error fetching exercises", e); }
        fetchUserBookings(data.member.dni);
        fetchHolidays();
        fetchUserProgress(data.member.dni);
        fetchUserFullInfo(data.member.dni);
      } else {
        showToast(data.detail || "Error al ingresar", "error");
      }
    } catch (err) {
      showToast("Error de conexión con el servidor", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/${userData.dni}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword })
      });
      if (res.ok) {
        showToast("Contraseña actualizada con éxito", "success");
        setNewPassword('');
      } else {
        showToast("Error al actualizar contraseña", "error");
      }
    } catch (err) {
      showToast("Error de conexión", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExercise = (cIdx: number, eIdx: number) => {
    setUserData(prev => {
      const updated = [...(prev.routine || [])];
      if (updated[cIdx] && updated[cIdx].exercises[eIdx]) {
        updated[cIdx].exercises[eIdx].completed = !updated[cIdx].exercises[eIdx].completed;
      }
      return { ...prev, routine: updated };
    });
  };

  const updateWeight = (cIdx: number, eIdx: number, newWeight: number) => {
    setUserData(prev => {
      const updated = [...(prev.routine || [])];
      if (updated[cIdx] && updated[cIdx].exercises[eIdx]) {
        updated[cIdx].exercises[eIdx].kg = newWeight;
      }
      return { ...prev, routine: updated };
    });
  };

  const handleDayClick = async (dayNum: number) => {
    const now = new Date();
    now.setMonth(now.getMonth() + monthOffset);
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    
    const clickDate = new Date(dateStr + "T00:00:00");
    const todayDate = new Date();
    clickDate.setHours(0,0,0,0);
    todayDate.setHours(0,0,0,0);
    
    if (clickDate < todayDate) {
      return;
    }

    const holiday = holidays.find(h => h.date === dateStr);
    if (holiday) {
      showConfirm(
        "Día No Laborable",
        `El día seleccionado es un feriado registrado: ${holiday.description}. El gimnasio no ofrecerá actividades este día.`,
        () => {}
      );
      return;
    }
    setSelectedDay(dayNum);
    try {
      const res = await fetch(`${API_URL}/user/class_schedules?date=${dateStr}`);
      if (res.ok) {
        setDaySchedules(await res.json());
        setIsBookingModalOpen(true);
      }
    } catch (e) { console.error(e); }
  };


  const handleBookClass = async (scheduleId: number, className: string, classTime: string) => {
    const hasAdicional = (userData.plan?.toLowerCase().includes('adicional')) || 
                         (userData.plan?.toLowerCase().includes('unificado')) ||
                         (userData.additional_plans && userData.additional_plans.some((p: string) => p.toLowerCase().includes('adicional') || p.toLowerCase().includes('unificado')));
    if (!hasAdicional) {
      showConfirm(
        "Plan Requerido",
        "Para poder reservar debe solicitar el plan Adicional a su plan actual o mejorarlo.",
        () => {}
      );
      return;
    }
    showConfirm(
      "Confirmar Reserva",
      `¿Deseas reservar la clase de ${className} para el día ${selectedDay} a las ${classTime} HS?`,
      async () => {
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        try {
          const res = await fetch(`${API_URL}/user/${userData.dni}/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ class_schedule_id: scheduleId, date: dateStr })
          });
          const data = await res.json();
          if (res.ok) {
            showToast("Reserva realizada con éxito", "success");
            fetchUserBookings(userData.dni);
            setIsBookingModalOpen(false);
          } else {
            alert(data.detail || "Error al reservar");
          }
        } catch (e) {
          console.error(e);
          showToast("Error al conectar con el servidor", "success");
        }
      }
    );
  };

  const handleBookClassFromWeek = async (scheduleId: number, dateStr: string, className: string, classTime: string) => {
    const hasAdicional = (userData.plan?.toLowerCase().includes('adicional')) || 
                         (userData.plan?.toLowerCase().includes('unificado')) ||
                         (userData.additional_plans && userData.additional_plans.some((p: string) => p.toLowerCase().includes('adicional') || p.toLowerCase().includes('unificado')));
    if (!hasAdicional) {
      showConfirm(
        "Plan Requerido",
        "Para poder reservar debe solicitar el plan Adicional a su plan actual o mejorarlo.",
        () => {}
      );
      return;
    }
    const parts = dateStr.split('-');
    const displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    showConfirm(
      "Confirmar Reserva",
      `¿Reservar clase de ${className} para el ${displayDate} a las ${classTime} HS?`,
      async () => {
        try {
          const res = await fetch(`${API_URL}/user/${userData.dni}/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ class_schedule_id: scheduleId, date: dateStr })
          });
          const data = await res.json();
          if (res.ok) {
            showToast("Reserva realizada con éxito", "success");
            fetchUserBookings(userData.dni);
            fetchWeekSchedules(getWeekDates(weekOffset));
          } else {
            alert(data.detail || "Error al reservar");
          }
        } catch (e) {
          console.error(e);
          showToast("Error al conectar con el servidor", "success");
        }
      }
    );
  };

  const handleCancelBooking = (bookingId: number) => {
    showConfirm(
      "¿Cancelar Reserva?",
      "¿Estás seguro de que deseas cancelar esta reserva de clase?",
      async () => {
        try {
          const res = await fetch(`${API_URL}/user/${userData.dni}/bookings/${bookingId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            showToast("Reserva cancelada", "success");
            fetchUserBookings(userData.dni);
            if (viewMode === 'week') {
              fetchWeekSchedules(getWeekDates(weekOffset));
            }
          } else {
            const data = await res.json();
            alert(data.detail || "Error al cancelar");
          }
        } catch (e) {
          console.error(e);
          showToast("Error de conexión", "success");
        }
      }
    );
  };

  const todayBooking = bookings.find(b => {
    const dt = new Date(b.start_time);
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() && 
           dt.getMonth() === now.getMonth() && 
           dt.getDate() === now.getDate() &&
           b.status !== "cancelled";
  });

  const handleSaveWorkout = async () => {
    if (!todayBooking) {
      showToast("Debes tener una reserva confirmada para hoy para registrar tus ejercicios.", "success");
      return;
    }
    
    // Check for uncompleted exercises
    let uncompleted: any[] = [];
    if (userData.routine && userData.routine.length > 0) {
      userData.routine.forEach((day: any, dIdx: number) => {
        day.exercises.forEach((ex: any, eIdx: number) => {
          if (!ex.completed) {
            uncompleted.push({ ...ex, dIdx, eIdx });
          }
        });
      });
    }

    if (uncompleted.length > 0) {
      setUncompletedExercises(uncompleted);
      setShowChecklistModal(true);
      return;
    }

    submitWorkout(userData.routine);
  };

  const submitWorkout = async (routineToSave: any) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/bookings/${todayBooking?.id}/workout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercises: routineToSave })
      });
      if (res.ok) {
        showToast("Entrenamiento registrado en tu historial.", "success");
        fetchUserBookings(userData.dni);
      } else {
        showToast("Error al guardar entrenamiento", "success");
      }
    } catch (e) {
      console.error(e);
      showToast("Error de conexión", "success");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChecklistSubmit = () => {
    const routineCopy = JSON.parse(JSON.stringify(userData.routine));
    uncompletedExercises.forEach(ue => {
      const response = checklistResponses[`${ue.dIdx}-${ue.eIdx}`] || {};
      routineCopy[ue.dIdx].exercises[ue.eIdx].uncompleted_reason = response.reason || 'Sin especificar';
      if (response.reason === 'Otro' && response.customReason) {
        routineCopy[ue.dIdx].exercises[ue.eIdx].uncompleted_reason = response.customReason;
      }
    });
    setShowChecklistModal(false);
    submitWorkout(routineCopy);
  };


  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center p-4 font-sans overflow-hidden select-none">
        <div className="w-full max-w-sm bg-black/30 border border-white/10 p-5 sm:p-10 rounded-3xl backdrop-blur-2xl shadow-2xl space-y-4 sm:space-y-8">
          <div className="text-center">
            <img src="/bunker.png" alt="Bunker Gym Logo" className="h-20 sm:h-32 w-auto mx-auto object-contain mb-3 sm:mb-6 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]" />
            <p className="text-white/20 text-[9px] sm:text-xs font-black uppercase tracking-[0.4em]">Personal Fitness OS</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-5">
             <div className="space-y-1">
               <label className="text-[9px] sm:text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">Documento</label>
               <input type="text" className="w-full bg-white/5 border border-[#F38E26]/40 focus:border-[#F38E26] rounded-2xl py-2.5 sm:py-4 px-5 text-white outline-none transition-all text-center font-black text-xs sm:text-sm" value={dni} onChange={e=>setDni(e.target.value)} required />
             </div>
             <div className="space-y-1">
               <label className="text-[9px] sm:text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">Contraseña</label>
               <input type="password" placeholder="••••••••" className="w-full bg-white/5 border border-[#F38E26]/40 focus:border-[#F38E26] rounded-2xl py-2.5 sm:py-4 px-5 text-white outline-none transition-all text-center font-black text-xs sm:text-sm" value={password} onChange={e=>setPassword(e.target.value)} required />
             </div>
             <button type="submit" disabled={isLoading} className="w-full py-2.5 sm:py-4 text-white bg-[#F38E26] border border-[#F38E26]/50 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all text-xs disabled:opacity-50 shadow-md">
               {isLoading ? "Ingresando..." : "Entrar"}
             </button>
          </form>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Training':
        return (
          <div className="flex flex-col min-h-0 h-full max-h-[75vh] space-y-4 animate-in slide-in-from-bottom-8 duration-500 overflow-hidden">
             <div className="flex-shrink-0 bg-white/[0.08] backdrop-blur-2xl p-5 sm:p-6 rounded-[30px] border border-orange-500/20 border-t-orange-500/40 border-l-orange-500/40 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(243,142,38,0.15),transparent_70%)] pointer-events-none" />
                <div className="absolute -top-6 -right-6 p-6 opacity-10 rotate-12 text-[#F38E26] pointer-events-none"><Dumbbell size={100}/></div>
                <div className="relative z-10">
                  <h3 className="text-xl sm:text-2xl font-black mb-1 tracking-tighter text-white uppercase flex items-center gap-2">
                    <Dumbbell className="text-[#F38E26]" size={24} /> Plan del Día
                  </h3>
                  <p className="text-[#F38E26]/80 text-[9px] font-black uppercase tracking-[0.2em]">Sigue tu progreso y sube cargas</p>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-0">
                {(!userData.routine || userData.routine.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white/5 rounded-3xl border border-white/5">
                    <Dumbbell size={32} className="text-white/20 mb-4" />
                    <p className="text-sm font-black text-white/50 uppercase">Tu entrenador aún no te ha asignado una rutina.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {userData.routine.map((c: any, idx: number) => (
                        <button key={idx} onClick={() => setSelectedClassIndex(idx)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${selectedClassIndex === idx ? 'bg-[#F38E26]/20 border border-[#F38E26]/40 text-[#F38E26] shadow-md' : 'bg-white/5 border border-white/5 text-white/40 hover:bg-white/10'}`}>
                          {c.class_name}
                        </button>
                      ))}
                    </div>
                    
                    {userData.routine[selectedClassIndex]?.exercises.length === 0 ? (
                      <p className="text-xs text-white/30 italic text-center mt-4">No hay ejercicios para este día.</p>
                    ) : (
                      userData.routine[selectedClassIndex]?.exercises.map((ex: any, eIdx: number) => (
                        <div key={eIdx} className={`p-4 rounded-3xl border transition-all ${ex.completed ? 'bg-green-500/10 border-green-500/20 shadow-lg shadow-green-500/5' : 'bg-[#141b29] border-white/5'} space-y-3`}>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <div onClick={()=>toggleExercise(selectedClassIndex, eIdx)} className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all ${ex.completed ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-lg shadow-green-500/10' : 'bg-white/5 text-white/20 hover:text-white hover:bg-white/10'}`}>
                                    {ex.completed ? <Check size={16} strokeWidth={4}/> : <Play size={16}/>}
                                 </div>
                                 <div>
                                   <div className="flex items-center gap-2 mb-1">
                                     <p className="font-black text-sm text-white uppercase leading-none">{ex.name}</p>
                                     <button onClick={() => {
                                       const fullEx = globalExercises.find(ge => ge.id === ex.exercise_id || ge.name === ex.name);
                                       setSelectedExerciseInfo(fullEx || ex);
                                       setIsExerciseInfoOpen(true);
                                     }} className="ml-2 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-md flex items-center gap-1 text-[8px] uppercase tracking-widest text-white/50 transition-colors">
                                       <Info size={10} /> Más Info
                                     </button>
                                   </div>
                                   <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">{ex.sets} Sets × {ex.reps} Reps</p>
                                 </div>
                              </div>
                              <button onClick={()=>toggleExercise(selectedClassIndex, eIdx)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${ex.completed ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'bg-white/5 border border-white/5 text-white/40'}`}>{ex.completed ? 'Hecho' : 'Completar'}</button>
                           </div>
                           {ex.coach_notes && (
                             <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-2">
                               <p className="text-[8px] font-black text-orange-500/70 uppercase tracking-widest mb-1">Nota del Entrenador:</p>
                               <p className="text-xs text-white/80 italic">{ex.coach_notes}</p>
                             </div>
                           )}
                           <div className="flex items-center gap-3 bg-black/40 rounded-2xl p-3 border border-white/5">
                              <TrendingUp size={14} className="text-orange-500" />
                              <span className="text-[9px] font-black text-white/20 uppercase mr-auto">Carga Actual:</span>
                              <input type="number" className="bg-transparent text-white font-black text-lg w-12 outline-none text-right" value={ex.kg || 0} onChange={e=>updateWeight(selectedClassIndex, eIdx, parseInt(e.target.value) || 0)} />
                              <span className="text-xs font-black text-white/40">KG</span>
                            </div>
                        </div>
                      ))
                    )}
                  </>
                )}
             </div>
             <div className="flex-shrink-0 pt-2 pb-6">
               <button onClick={handleSaveWorkout} disabled={isLoading} className="w-full py-4 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 border-t-green-500/50 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all text-xs disabled:opacity-50 shadow-[0_10px_30px_rgba(34,197,94,0.15)] backdrop-blur-2xl">
                 {isLoading ? "Guardando..." : "Finalizar y Guardar Entrenamiento"}
               </button>
             </div>
          </div>
        );
      case 'Evolution': {
        let filteredEvolution: any[] = userData.evolution || [];
        if (chartFilter === '7d') {
          const limitDate = new Date();
          limitDate.setDate(limitDate.getDate() - 7);
          filteredEvolution = filteredEvolution.filter((e: any) => new Date(e.date) >= limitDate);
        } else if (chartFilter === '30d') {
          const limitDate = new Date();
          limitDate.setDate(limitDate.getDate() - 30);
          filteredEvolution = filteredEvolution.filter((e: any) => new Date(e.date) >= limitDate);
        }

        let totalImprovement = 0;
        if (filteredEvolution && filteredEvolution.length > 1) {
          const first = filteredEvolution[0];
          const last = filteredEvolution[filteredEvolution.length - 1];
          const keys = Object.keys(last).filter(k => k !== 'date' && k !== 'name');
          keys.forEach(k => {
            const firstVal = first[k] || 0;
            const lastVal = last[k] || 0;
            if (lastVal > firstVal) totalImprovement += (lastVal - firstVal);
          });
        }
        const daysTrained = filteredEvolution.length;

        return (
          <div className="h-full flex flex-col min-h-0 justify-center animate-in slide-in-from-bottom-8 overflow-hidden max-h-[75vh]">
             <div className="bg-white/[0.08] backdrop-blur-2xl border border-white/20 border-t-white/35 border-l-white/35 p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col justify-between h-full min-h-0">
                <div className="flex justify-between items-center flex-shrink-0">
                  <h3 className="text-xl font-black flex items-center gap-3 uppercase tracking-tighter"><TrendingUp className="text-orange-500" size={22}/> Mi Progreso</h3>
                  <div className="flex gap-2">
                     <button onClick={() => setChartFilter('7d')} className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-colors ${chartFilter === '7d' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/40'}`}>7 Días</button>
                     <button onClick={() => setChartFilter('30d')} className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-colors ${chartFilter === '30d' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/40'}`}>30 Días</button>
                     <button onClick={() => setChartFilter('all')} className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-colors ${chartFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/40'}`}>Histórico</button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 my-4">
                   <ProgressChart data={filteredEvolution} />
                </div>
                {plansBreakdown && plansBreakdown.length > 0 && (
                  <div className="w-full space-y-2 my-3 flex-shrink-0">
                    <p className="text-[9px] font-black uppercase text-white/40 tracking-wider">Pases Disponibles por Plan:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {plansBreakdown.map((pb: any, idx: number) => (
                        <div key={idx} className="bg-white/5 p-3 rounded-2xl border border-white/10">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black uppercase text-orange-400">{pb.name}</span>
                            <span className="text-[8px] font-black uppercase text-white/30">{pb.type}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-white mt-1">
                            <span>Usados: {pb.used} / {pb.total}</span>
                            <span className="text-green-400 font-black">{pb.remaining} restantes</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                   <div className="bg-white/5 p-3 rounded-2xl border border-white/5"><p className="text-[8px] text-white/20 font-black uppercase mb-1">Mejoría Total</p><p className="text-xl font-black text-white">+{totalImprovement}kg</p><p className="text-[9px] text-green-500 font-black mt-1 uppercase">Imparable</p></div>
                   <div className="bg-white/5 p-3 rounded-2xl border border-white/5"><p className="text-[8px] text-white/20 font-black uppercase mb-1">Días Entrenados</p><p className="text-xl font-black text-white">{daysTrained}</p><p className="text-[9px] text-orange-500 font-black mt-1 uppercase">Consistencia</p></div>
                </div>
             </div>
          </div>
        );
      }
      case 'Calendar':
        const allWeekSchedules = Object.values(weekSchedulesMap).flat();
        const getUniqueSlots = (allSchedules: any[]) => {
          const slotsMap = new Map<string, { start: string, end: string }>();
          // Removed default slots so the calendar only shows times with actual classes
          allSchedules.forEach(s => {
            if (s && s.start_time && s.end_time) {
              const key = `${s.start_time}-${s.end_time}`;
              slotsMap.set(key, { start: s.start_time, end: s.end_time });
            }
          });
          const sortedSlots = Array.from(slotsMap.values()).sort((a, b) => a.start.localeCompare(b.start));
          const morning = sortedSlots.filter(s => parseInt(s.start.split(":")[0]) < 12);
          const evening = sortedSlots.filter(s => parseInt(s.start.split(":")[0]) >= 12);
          return { morning, evening };
        };

        const { morning: morningSlots, evening: eveningSlots } = getUniqueSlots(allWeekSchedules);
        const weekdayShortNames = ["L", "M", "MI", "J", "V", "S", "D"];
        const weekDates = getWeekDates(weekOffset);

        return (
          <div className="h-full flex flex-col min-h-0 animate-in slide-in-from-bottom-8 overflow-hidden">
             <div className="bg-white/[0.08] backdrop-blur-2xl border border-white/20 border-t-white/35 border-l-white/35 p-4 sm:p-6 rounded-[35px] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col min-h-0 h-full max-h-[75vh]">
                <div className="flex justify-between items-center flex-shrink-0 mb-4">
                   <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><Clock className="text-blue-500" size={22}/> Agenda</h3>
                   <div onClick={()=>setActiveTab('Calendar')} className="px-3 py-1 text-[8px] font-black rounded-xl uppercase shadow-lg bg-blue-500/20 text-[#F38E26]">{bookings.filter(b=>b.status !== "cancelled").length} Reservas</div>
                </div>

                {/* Vista Toggle Slider */}
                <div className="flex bg-black/40 p-1 border border-white/5 rounded-xl max-w-xs mx-auto w-full flex-shrink-0 mb-4">
                   <button 
                      onClick={() => setViewMode('month')} 
                      className={`flex-1 py-2 px-4 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${viewMode === 'month' ? 'bg-[#F38E26] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>
                      Mes
                   </button>
                   <button 
                      onClick={() => setViewMode('week')} 
                      className={`flex-1 py-2 px-4 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${viewMode === 'week' ? 'bg-[#F38E26] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>
                      Semana
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0 space-y-6">
                  {viewMode === 'month' ? (
                    <>
                       <div className="flex justify-between items-center gap-3 mb-4">
                          <button 
                             onClick={() => setMonthOffset(prev => prev - 1)} 
                             className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase hover:bg-white/10 text-white transition-all">
                             Anterior
                          </button>
                          <span className="text-[10px] font-black uppercase text-white/60 text-center tracking-widest">
                             {(() => {
                               const d = new Date();
                               d.setMonth(d.getMonth() + monthOffset);
                               return d.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
                             })()}
                          </span>
                          <button 
                             onClick={() => setMonthOffset(prev => prev + 1)} 
                             className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase hover:bg-white/10 text-white transition-all">
                             Siguiente
                          </button>
                       </div>
                       <div className="grid grid-cols-7 gap-2 mb-10 text-center font-black text-[10px] uppercase">
                           {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d,i)=>(<div key={i} className="text-white/10">{d}</div>))}
                           {(() => {
                             const now = new Date();
                             now.setMonth(now.getMonth() + monthOffset);
                             const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
                             const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                             const padding = firstDay === 0 ? 6 : firstDay - 1;
                             
                             const days = [];
                             for (let i = 0; i < padding; i++) {
                               days.push(<div key={`pad-${i}`} />);
                             }
                             for (let i = 1; i <= daysInMonth; i++) {
                               const bookingDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                               
                               const currentCellDate = new Date(bookingDateStr + "T00:00:00");
                               const todayDate = new Date();
                               currentCellDate.setHours(0,0,0,0);
                               todayDate.setHours(0,0,0,0);
                               const isPast = currentCellDate < todayDate;
                               const isToday = currentCellDate.getTime() === todayDate.getTime();
                               
                               const isBookedReal = bookings.some(b => {
                                 const dt = new Date(b.start_time);
                                 return dt.getFullYear() === now.getFullYear() && 
                                        (dt.getMonth() + 1) === (now.getMonth() + 1) && 
                                        dt.getDate() === i &&
                                        b.status !== "cancelled";
                               });
                               const isHoliday = holidays.some(h => h.date === bookingDateStr);
                               
                               let dayClass = 'bg-white/5 border-white/5 text-white/20 hover:border-white/20 hover:text-white cursor-pointer';
                               if (isPast) {
                                 dayClass = 'bg-[#141b29]/40 border-transparent text-white/10 cursor-not-allowed opacity-50';
                               } else if (isHoliday) {
                                 dayClass = 'bg-red-500/10 border-red-500/30 text-red-500 cursor-pointer';
                               } else if (isBookedReal) {
                                 dayClass = 'bg-blue-600 border-blue-500 text-white shadow-md cursor-pointer';
                               }
                               
                               if (isToday && !isPast) {
                                 dayClass += ' ring-2 ring-orange-500 border-orange-500';
                               }

                               days.push(
                                 <div key={i} 
                                   onClick={() => !isPast && handleDayClick(i)} 
                                   className={`h-12 flex items-center justify-center rounded-2xl text-sm font-black transition-all border ${dayClass}`}>
                                   {i}
                                 </div>
                               );
                             }
                             return days;
                           })()}
                       </div>
                    </>
                  ) : (
                    <div className="space-y-6 pb-6">
                       {/* Controles de Semana */}
                       <div className="flex justify-between items-center gap-3">
                          <button 
                             onClick={() => setWeekOffset(prev => prev - 1)} 
                             className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase hover:bg-white/10 text-white transition-all">
                             Anterior
                          </button>
                          <span className="text-[10px] font-black uppercase text-white/60 text-center tracking-wider">
                             {weekDates[0].toLocaleDateString('es-AR', {day: '2-digit', month: '2-digit'})} AL {weekDates[6].toLocaleDateString('es-AR', {day: '2-digit', month: '2-digit'})}
                          </span>
                          <button 
                             onClick={() => setWeekOffset(prev => prev + 1)} 
                             className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase hover:bg-white/10 text-white transition-all">
                                     Siguiente
                          </button>
                       </div>

                       {/* Grilla Semanal */}
                       <div className="space-y-6">
                           
                           {/* Clases por la Mañana */}
                           <div className="rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md">
                             <div 
                               className={`py-3 px-4 uppercase tracking-widest text-[9px] font-black cursor-pointer flex items-center justify-between transition-all ${showMorning ? 'bg-[#F38E26]/20 text-[#F38E26] border-b border-white/10' : 'bg-white/5 hover:bg-white/10 text-white/80'}`}
                               onClick={() => setShowMorning(!showMorning)}
                             >
                               <span className="flex items-center gap-2">☀️ Clases por la Mañana</span>
                               <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-white/70">
                                 {showMorning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                               </div>
                             </div>
                             {showMorning && <div className="overflow-x-auto scrollbar-thin">
                               <table className="w-full border-collapse text-left table-fixed">
                                 <thead>
                                   <tr className="bg-[#F38E26]/5 text-white/20 border-b border-white/5 text-[7px] uppercase tracking-wider font-black">
                                     <th className="p-1 sm:p-3 text-center w-14 sm:w-20 text-[7px]">Hora</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">L</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">M</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">MI</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">J</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">V</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">S</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">D</th>
                                   </tr>
                                 </thead>
                                 <tbody>
                                   {morningSlots.map((slot, rowIndex) => (
                                     <tr key={rowIndex} className="border-b border-white/5">
                                       <td className="p-1 text-center">
                                         <span className="inline-block px-1 sm:px-2 py-0.5 sm:py-1 bg-white/5 text-white/50 font-black rounded-lg border border-white/5 text-[6.5px] sm:text-[8px] tracking-tight">
                                           {slot.start} - {slot.end}
                                         </span>
                                       </td>
                                       {weekdayShortNames.map((_, dayIndex) => {
                                         const date = weekDates[dayIndex];
                                         const dateStr = getLocalDateStr(date);
                                         const holiday = holidays.find(h => h.date === dateStr);
                                         const daySchedulesList = weekSchedulesMap[dateStr] || [];
                                         const cellSchedules = daySchedulesList.filter((s: any) => s.start_time === slot.start && s.end_time === slot.end);

                                         return (
                                           <td key={dayIndex} className="p-0.5 sm:p-1.5 text-center min-w-[38px] sm:min-w-[55px]">
                                             <div className="flex flex-col gap-1 items-center justify-center">
                                               {holiday ? (
                                                 <span className="text-[6px] sm:text-[7px] font-black text-red-500/30 uppercase">Feriado</span>
                                               ) : cellSchedules.length > 0 ? cellSchedules.map((s: any) => {
                                                 const isAlreadyBooked = bookings.some(b => b.class_schedule_id === s.id && b.start_time.split('T')[0] === dateStr && b.status !== "cancelled");
                                                 const userBooking = bookings.find(b => b.class_schedule_id === s.id && b.start_time.split('T')[0] === dateStr && b.status !== "cancelled");
                                                 
                                                 return (
                                                   <button
                                                     key={s.id}
                                                     onClick={async () => {
                                                       if (isAlreadyBooked) {
                                                         handleCancelBooking(userBooking.id);
                                                       } else {
                                                         showConfirm(
                                                           "Confirmar Reserva",
                                                           `¿Reservar clase de ${s.name} para el ${date.toLocaleDateString('es-AR')} a las ${s.start_time} HS?`,
                                                           () => handleBookClassFromWeek(s.id, dateStr, s.name, s.start_time)
                                                         );
                                                       }
                                                     }}
                                                     style={{ backgroundColor: s.color, textShadow: '0px 1px 3px rgba(0,0,0,0.9)' }}
                                                     className={`w-9 sm:w-12 h-7 sm:h-8 rounded-lg sm:rounded-xl text-white font-black text-[7.5px] sm:text-[9px] uppercase flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md relative ${isAlreadyBooked ? 'ring-2 ring-white scale-105' : 'opacity-90'}`}>
                                                     <span className="leading-none text-[7.5px] sm:text-[9px]">{s.code}</span>
                                                     <span className="text-[5px] sm:text-[6px] opacity-75 leading-none mt-0.5">{s.bookings_count}/{s.capacity}</span>
                                                     {isAlreadyBooked && (
                                                       <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 rounded-full flex items-center justify-center text-[6px] sm:text-[7px] text-white border border-[#141b29] font-black">✓</span>
                                                     )}
                                                   </button>
                                                 );
                                               }) : (
                                                 <div className="w-9 sm:w-12 h-7 sm:h-8 rounded-lg sm:rounded-xl border border-white/5 bg-transparent flex items-center justify-center opacity-10 text-[7px] sm:text-[9px] font-black text-white">
                                                   -
                                                 </div>
                                               )}
                                             </div>
                                           </td>
                                         );
                                       })}
                                     </tr>
                                   ))}
                                 </tbody>
                               </table>
                             </div>}
                           </div>

                           {/* Clases por la Tarde / Noche */}
                           <div className="rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md">
                             <div 
                               className={`py-3 px-4 uppercase tracking-widest text-[9px] font-black cursor-pointer flex items-center justify-between transition-all ${showEvening ? 'bg-blue-500/20 text-blue-400 border-b border-white/10' : 'bg-white/5 hover:bg-white/10 text-white/80'}`}
                               onClick={() => setShowEvening(!showEvening)}
                             >
                               <span className="flex items-center gap-2">🌙 Clases por la Tarde/Noche</span>
                               <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-white/70">
                                 {showEvening ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                               </div>
                             </div>
                             {showEvening && <div className="overflow-x-auto scrollbar-thin">
                               <table className="w-full border-collapse text-left table-fixed">
                                 <thead>
                                   <tr className="bg-[#F38E26]/5 text-white/20 border-b border-white/5 text-[7px] uppercase tracking-wider font-black">
                                     <th className="p-1 sm:p-3 text-center w-14 sm:w-20 text-[7px]">Hora</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">L</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">M</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">MI</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">J</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">V</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">S</th>
                                     <th className="p-1 sm:p-3 text-center text-[7px]">D</th>
                                   </tr>
                                 </thead>
                                 <tbody>
                                   {eveningSlots.map((slot, rowIndex) => (
                                     <tr key={rowIndex} className="border-b border-white/5">
                                       <td className="p-1 text-center">
                                         <span className="inline-block px-1 sm:px-2 py-0.5 sm:py-1 bg-white/5 text-white/50 font-black rounded-lg border border-white/5 text-[6.5px] sm:text-[8px] tracking-tight">
                                           {slot.start} - {slot.end}
                                         </span>
                                       </td>
                                       {weekdayShortNames.map((_, dayIndex) => {
                                         const date = weekDates[dayIndex];
                                         const dateStr = getLocalDateStr(date);
                                         const holiday = holidays.find(h => h.date === dateStr);
                                         const daySchedulesList = weekSchedulesMap[dateStr] || [];
                                         const cellSchedules = daySchedulesList.filter((s: any) => s.start_time === slot.start && s.end_time === slot.end);

                                         return (
                                           <td key={dayIndex} className="p-0.5 sm:p-1.5 text-center min-w-[38px] sm:min-w-[55px]">
                                             <div className="flex flex-col gap-1 items-center justify-center">
                                               {holiday ? (
                                                 <span className="text-[6px] sm:text-[7px] font-black text-red-500/30 uppercase">Feriado</span>
                                               ) : cellSchedules.length > 0 ? cellSchedules.map((s: any) => {
                                                 const isAlreadyBooked = bookings.some(b => b.class_schedule_id === s.id && b.start_time.split('T')[0] === dateStr && b.status !== "cancelled");
                                                 const userBooking = bookings.find(b => b.class_schedule_id === s.id && b.start_time.split('T')[0] === dateStr && b.status !== "cancelled");
                                                 
                                                 return (
                                                   <button
                                                     key={s.id}
                                                     onClick={async () => {
                                                       if (isAlreadyBooked) {
                                                         handleCancelBooking(userBooking.id);
                                                       } else {
                                                         showConfirm(
                                                           "Confirmar Reserva",
                                                           `¿Reservar clase de ${s.name} para el ${date.toLocaleDateString('es-AR')} a las ${s.start_time} HS?`,
                                                           () => handleBookClassFromWeek(s.id, dateStr, s.name, s.start_time)
                                                         );
                                                       }
                                                     }}
                                                     style={{ backgroundColor: s.color, textShadow: '0px 1px 3px rgba(0,0,0,0.9)' }}
                                                     className={`w-9 sm:w-12 h-7 sm:h-8 rounded-lg sm:rounded-xl text-white font-black text-[7.5px] sm:text-[9px] uppercase flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md relative ${isAlreadyBooked ? 'ring-2 ring-white scale-105' : 'opacity-90'}`}>
                                                     <span className="leading-none text-[7.5px] sm:text-[9px]">{s.code}</span>
                                                     <span className="text-[5px] sm:text-[6px] opacity-75 leading-none mt-0.5">{s.bookings_count}/{s.capacity}</span>
                                                     {isAlreadyBooked && (
                                                       <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 rounded-full flex items-center justify-center text-[6px] sm:text-[7px] text-white border border-[#141b29] font-black">✓</span>
                                                     )}
                                                   </button>
                                                 );
                                               }) : (
                                                 <div className="w-9 sm:w-12 h-7 sm:h-8 rounded-lg sm:rounded-xl border border-white/5 bg-transparent flex items-center justify-center opacity-10 text-[7px] sm:text-[9px] font-black text-white">
                                                   -
                                                 </div>
                                               )}
                                             </div>
                                           </td>
                                         );
                                       })}
                                     </tr>
                                   ))}
                                 </tbody>
                               </table>
                             </div>}
                           </div>

                            {/* Actividades Leyenda */}
                            <div className="pt-4 border-t border-white/10 text-center mt-4">
                              <span className="text-[9px] font-black uppercase tracking-wider text-white/20 block mb-3">Actividades</span>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center items-center text-[8px] font-black uppercase">
                                {dbActivities.map((act, i) => (
                                  <span key={i} className="flex items-center gap-1 group relative" style={{ color: act.color }}>
                                    ● {act.name} ({act.code})
                                  </span>
                                ))}
                              </div>
                            </div>
                       </div>
                    </div>
                  )}
                  
                  {/* Próximas Sesiones */}
                  <div className="space-y-4 border-t border-white/5 pt-6">
                     <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">Próximas Sesiones</p>
                     {bookings.filter(b=>b.status !== "cancelled").slice(0, 10).map((b,i)=>{
                       const dt = new Date(b.start_time);
                       const dateStr = dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                       const timeStr = b.start_time.split('T')[1]?.substring(0, 5) || '';
                       return (
                        <div key={i} className="p-6 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between group">
                           <div>
                             <p className="font-black text-white uppercase">{b.class_name}</p>
                             <p className="text-[10px] text-white/25 font-black uppercase mt-1">Día {dateStr} • {timeStr} HS • Estado: {b.status === 'attended' ? 'ASISTIDO' : 'CONFIRMADO'}</p>
                           </div>
                           {b.status === "reserved" && (
                             <div className="flex flex-col items-end gap-2">
                               <button onClick={()=>handleCancelBooking(b.id)} className="text-red-500/20 group-hover:text-red-500 transition-colors"><X size={20}/></button>
                               <div className="mt-2 bg-black/40 rounded-xl p-2 border border-orange-500/20">
                                   <p className="text-[8px] font-black uppercase text-orange-400">Tolerancia de ingreso: -15 mins a +10 mins del inicio.</p>
                               </div>
                             </div>
                           )}
                        </div>
                       );
                     })}
                     {bookings.filter(b=>b.status !== "cancelled").length === 0 && <p className="text-center text-white/10 italic text-[10px] font-black uppercase py-10">No tienes reservas aún</p>}
                  </div>
                </div>
             </div>
          </div>
        );
      case 'Profile':
        return (
          <div className="h-full flex flex-col min-h-0 animate-in slide-in-from-bottom-8 overflow-hidden max-h-[75vh]">
             <div className="bg-white/[0.08] backdrop-blur-2xl border border-white/20 border-t-white/35 border-l-white/35 p-5 sm:p-10 rounded-[35px] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col min-h-0 h-full">
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0 space-y-6 flex flex-col items-center justify-center">
                   <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-tr from-[#F38E26] to-orange-400 rounded-full flex items-center justify-center text-4xl font-black shadow-[0_0_30px_rgba(243,142,38,0.3)] mb-2 ring-4 ring-white/10 text-white">{userData.name[0]}</div>
                   <h2 className="text-2xl sm:text-3xl font-black text-white mb-1 text-center">{userData.name}</h2>
                   <span className="px-4 py-1.5 bg-[#F38E26]/10 border border-[#F38E26]/30 text-[#F38E26] text-[10px] font-black rounded-full uppercase tracking-[0.2em] mb-4">{userData.plan}</span>
                   
                   <div className="w-full max-w-sm space-y-4 pt-6 border-t border-white/10">
                      <h4 className="text-xs font-black uppercase text-white/50 tracking-widest flex items-center justify-center gap-2"><Lock size={14}/> Cambiar Contraseña</h4>
                      <div className="space-y-3">
                         <input type="password" placeholder="Nueva Contraseña" className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-white text-xs outline-none focus:border-[#F38E26] transition-all text-center" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
                         <button onClick={handleChangePassword} disabled={isLoading || !newPassword} className="w-full py-3.5 bg-[#F38E26]/20 hover:bg-[#F38E26] text-[#F38E26] hover:text-white border border-[#F38E26]/40 backdrop-blur-md rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md disabled:opacity-50 hover:scale-[1.01] active:scale-95 transition-all">Actualizar Contraseña</button>
                      </div>
                   </div>
                </div>
                
                <div className="flex-shrink-0 pt-4 pb-2 w-full max-w-sm mx-auto">
                  <button onClick={()=>setIsAuthenticated(false)} className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 backdrop-blur-md rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all shadow-md">Cerrar Sesión</button>
                </div>
             </div>
          </div>
        );
      case 'History':
        return (
          <div className="h-full flex flex-col min-h-0 animate-in slide-in-from-bottom-8 overflow-hidden max-h-[75vh]">
             <div className="bg-white/[0.08] backdrop-blur-2xl border border-white/20 border-t-white/35 border-l-white/35 p-5 sm:p-8 rounded-[35px] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col min-h-0 h-full">
                <div className="flex justify-between items-center flex-shrink-0 mb-4">
                   <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><History className="text-blue-400" size={22}/> Historial de Ingresos</h3>
                   <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-[9px] font-black rounded-xl uppercase">{attendanceHistory.length} Registros</span>
                </div>

                {checkinStats && (
                   <div className="grid grid-cols-3 gap-2 mb-4 flex-shrink-0">
                     <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                       <p className="text-sm font-black text-white">{checkinStats.total}</p>
                       <p className="text-[7px] text-white/30 uppercase font-black">Total Plan</p>
                     </div>
                     <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                       <p className="text-sm font-black text-orange-400">{checkinStats.used}</p>
                       <p className="text-[7px] text-white/30 uppercase font-black">Usadas</p>
                     </div>
                     <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                       <p className="text-sm font-black text-blue-400">{checkinStats.remaining}</p>
                       <p className="text-[7px] text-white/30 uppercase font-black">Restantes</p>
                     </div>
                   </div>
                )}

                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2 min-h-0">
                   {attendanceHistory.length > 0 ? attendanceHistory.map((item, i) => {
                     const dt = new Date(item.checkin_at.replace(/\.\d+Z$/, 'Z'));
                     const fecha = dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                     const hora = dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: true });
                     return (
                       <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 font-black text-xs">
                             {attendanceHistory.length - i}
                           </div>
                           <div>
                             <p className="font-black text-white text-xs uppercase">{item.type || 'Ingreso'}</p>
                             <p className="text-[9px] text-white/30 font-black">{fecha} · {hora} HS</p>
                           </div>
                         </div>
                         <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-[8px] font-black uppercase rounded-lg">REGISTRADO</span>
                       </div>
                     );
                   }) : (
                     <p className="text-center text-white/20 italic text-[10px] font-black uppercase py-10">Sin ingresos registrados aún</p>
                   )}
                </div>
             </div>
          </div>
        );
      case 'Payments':
        return (
          <div className="h-full flex flex-col min-h-0 animate-in slide-in-from-bottom-8 overflow-hidden max-h-[75vh]">
             <div className="bg-white/[0.08] backdrop-blur-2xl border border-white/20 border-t-white/35 border-l-white/35 p-5 sm:p-8 rounded-[35px] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col min-h-0 h-full">
                <div className="flex justify-between items-center flex-shrink-0 mb-4">
                   <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><Receipt className="text-orange-500" size={22}/> Pagos y Planes</h3>
                   <span className="px-3 py-1 bg-orange-500/20 text-[#F38E26] text-[9px] font-black rounded-xl uppercase">{billingHistory.length} Pagos</span>
                </div>

                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-4 flex justify-between items-center flex-shrink-0">
                  <div>
                    <p className="text-[8px] text-white/40 font-black uppercase">Plan Actual del Socio</p>
                    <p className="text-base font-black text-white uppercase">{userData.plan}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-[9px] font-black uppercase rounded-full">AL DÍA</span>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 min-h-0">
                   {billingHistory.length > 0 ? billingHistory.map((item, i) => (
                     <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between gap-3">
                       <div>
                         <p className="font-black text-white text-xs uppercase">{item.plan}</p>
                         <p className="text-[9px] text-white/30 font-black mt-0.5">{item.date} · Método: {item.method}</p>
                         <p className="text-sm font-black text-green-400 mt-1">${item.amount?.toLocaleString()}</p>
                       </div>
                       <button
                         onClick={() => generatePaymentPDF(item)}
                         className="px-3 py-2 bg-[#F38E26] hover:bg-orange-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all whitespace-nowrap"
                       >
                         <FileText size={12} /> Ver PDF
                       </button>
                     </div>
                   )) : (
                     <p className="text-center text-white/20 italic text-[10px] font-black uppercase py-10">Sin pagos registrados en el sistema</p>
                   )}
                </div>
             </div>
          </div>
        );
      default:
        return (
          <div className="h-full flex flex-col min-h-0 justify-between space-y-3 sm:space-y-4 animate-in fade-in duration-500 overflow-hidden max-h-[75vh]">
             <header className="flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">¡Hola, {userData.name.split(' ')[0]}! 👋</h2>
                  <p className="text-white/30 text-[9px] font-black uppercase tracking-[0.25em] mt-0.5">Estatus: Bestia en Entrenamiento</p>
                </div>
                <div onClick={()=>setActiveTab('Profile')} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 active:scale-90 transition-all flex-shrink-0">
                  <User size={18} className="text-blue-500" />
                </div>
             </header>

             <section className="bg-white/[0.08] backdrop-blur-2xl p-4 sm:p-5 rounded-[28px] border border-white/20 border-t-white/35 border-l-white/35 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] text-center relative overflow-hidden group flex-shrink-0">
                  <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(243,142,38,0.15),transparent_70%)]" />
                  <p className="text-[9px] uppercase tracking-[0.3em] font-black mb-2 relative z-10 animate-pulse text-[#F38E26]">Racha de Fuego</p>
                  <div className="relative z-10 flex items-center justify-center gap-3 mb-1">
                    <div className="p-2.5 bg-orange-500/10 rounded-full text-orange-500"><Zap size={24} strokeWidth={3} /></div>
                    <span className="text-5xl font-black tracking-tighter text-white">{userData.streak}</span>
                  </div>
                  <p className="relative z-10 text-[9px] font-black uppercase tracking-wider text-white/70 mb-3 max-w-[260px] mx-auto leading-tight truncate">
                    {userData.streakMessage || "¡Vamos por un nuevo comienzo con todo! ⚡"}
                  </p>
                  <div onClick={()=>setActiveTab('Evolution')} className="py-2 px-4 rounded-xl border text-[8px] uppercase font-black tracking-widest hover:text-white transition-all cursor-pointer relative z-10 mx-auto flex items-center justify-center gap-1.5 w-fit bg-[#F38E26]/10 border-[#F38E26]/30 text-[#F38E26] hover:bg-[#F38E26]">
                    Explorar Evolución <ArrowUpRight size={12}/>
                  </div>
             </section>

             {/* Recordatorios Section */}
             <section className="bg-white/[0.08] backdrop-blur-2xl p-4 sm:p-5 rounded-[28px] border border-white/20 border-t-white/35 border-l-white/35 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-3 flex-shrink-0">
               <div className="flex justify-between items-center">
                 <div>
                   <h3 className="text-[11px] font-black uppercase tracking-widest text-[#F38E26] flex items-center gap-1.5">
                     <Clock size={14} /> Recordatorios de Plan
                   </h3>
                   <p className="text-[8px] text-white/40 font-black uppercase tracking-wider mt-0.5">Plan Activo: {userData.plan}</p>
                 </div>
               </div>

               <div className="bg-black/30 p-3 rounded-2xl border border-white/5 space-y-2">
                 <p className="text-[8px] font-black uppercase text-blue-400 tracking-widest">
                   Asistencia · {attendanceHistory.length} ingresos
                 </p>
                 <div className="flex gap-2">
                   {[
                     { label: 'Total', value: checkinStats?.total || 12, color: 'text-white/50' },
                     { label: 'Usadas', value: checkinStats?.used || 0, color: 'text-orange-400' },
                     { label: 'Restantes', value: checkinStats?.remaining || 0, color: 'text-blue-400' }
                   ].map(s => (
                     <div key={s.label} className="flex-1 bg-white/5 border border-white/5 rounded-xl p-1.5 text-center">
                       <p className={`text-sm sm:text-base font-black ${s.color}`}>{s.value}</p>
                       <p className="text-[7px] text-white/40 font-black uppercase tracking-wider">{s.label}</p>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="flex gap-2">
                 <button onClick={() => setActiveTab('History')} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-wider text-white transition-all">
                   Ver Historial Completo
                 </button>
                 <button onClick={() => setActiveTab('Payments')} className="flex-1 py-2.5 bg-[#F38E26]/10 hover:bg-[#F38E26] border border-[#F38E26]/30 text-[#F38E26] hover:text-white rounded-xl text-[8px] font-black uppercase tracking-wider transition-all">
                   Pagos y Planes
                 </button>
               </div>
             </section>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white font-sans flex flex-col overflow-hidden p-4 pb-24 select-none">
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8 animate-in fade-in duration-300">
           <div className="bg-[#1b2435] border border-white/10 p-6 sm:p-10 rounded-[35px] sm:rounded-[50px] w-full max-w-sm max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-6 sm:mb-10 flex-shrink-0">
                <h3 className="text-2xl font-black uppercase tracking-tighter">Día {selectedDay}</h3>
                <button onClick={()=>setIsBookingModalOpen(false)}><X size={24} className="text-white/20 hover:text-white"/></button>
              </div>
              <div className="space-y-6 flex-1 flex flex-col min-h-0">
                 <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 mb-2 text-center">
                    <p className="text-[10px] font-black uppercase text-orange-400">
                        Nota: La tolerancia de ingreso al salón es de 15 mins antes y hasta 10 mins después del horario de inicio.
                    </p>
                 </div>
                 <p className="text-[10px] font-black text-white/20 uppercase tracking-widest flex-shrink-0">Clases Disponibles</p>
                 <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar min-h-0">
                    {daySchedules.length > 0 ? daySchedules.map((s) => {
                      const isAlreadyBooked = bookings.some(b => b.class_schedule_id === s.id && new Date(b.start_time).getDate() === selectedDay && b.status !== "cancelled");
                      const userBooking = bookings.find(b => b.class_schedule_id === s.id && new Date(b.start_time).getDate() === selectedDay && b.status !== "cancelled");
                      return (
                        <div key={s.id} className="p-4 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="px-2 py-0.5 rounded text-[8px] font-black text-white mt-0.5 flex-shrink-0" style={{backgroundColor: s.color}}>{s.code}</span>
                              <span className="font-black text-white uppercase text-[10px] sm:text-[11px] leading-tight break-words flex-1 min-w-0">{s.name}</span>
                            </div>
                            <p className="text-[9px] text-white/30 font-black uppercase tracking-wider">⏰ {s.start_time} A {s.end_time}</p>
                            <p className="text-[9px] text-[#F38E26] font-black uppercase tracking-wider">👥 Confirmados: {s.bookings_count} / {s.capacity}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {isAlreadyBooked ? (
                              <button onClick={() => handleCancelBooking(userBooking.id)} className="px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[8px] font-black uppercase whitespace-nowrap">Cancelar</button>
                            ) : (
                              <button 
                                onClick={() => showConfirm(
                                  "Confirmar Reserva",
                                  `¿Deseas reservar la clase de ${s.name} para el día ${selectedDay} a las ${s.start_time} HS?`,
                                  () => handleBookClass(s.id, s.name, s.start_time)
                                )}
                                disabled={s.bookings_count >= s.capacity}
                                className="px-3 py-2 bg-green-500 text-white rounded-xl text-[8px] font-black uppercase disabled:opacity-50 whitespace-nowrap">
                                Reservar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-center text-white/20 italic text-[10px] font-black uppercase py-4">No hay clases programadas para este día.</p>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
      <main className="flex-1 w-full max-w-lg mx-auto min-h-0 overflow-hidden">{renderTabContent()}</main>
      
      {/* Brighter Liquid Glass Bottom Navigation Dock */}
      <nav className="fixed bottom-4 left-4 right-4 h-16 bg-white/[0.1] backdrop-blur-2xl border border-white/20 border-t-white/35 border-l-white/35 rounded-2xl z-50 flex items-center justify-around px-2 shadow-lg shadow-black/40 animate-in slide-in-from-bottom-10 duration-1000">
         <NavBtn active={activeTab === 'Home'} onClick={()=>setActiveTab('Home')} icon={<LayoutDashboard size={20}/>} />
         <NavBtn active={activeTab === 'Training'} onClick={()=>setActiveTab('Training')} icon={<Dumbbell size={20}/>} />
         <NavBtn active={activeTab === 'Calendar'} onClick={()=>setActiveTab('Calendar')} icon={<Clock size={20}/>} />
         <NavBtn active={activeTab === 'Evolution'} onClick={()=>setActiveTab('Evolution')} icon={<TrendingUp size={20}/>} />
         <NavBtn active={activeTab === 'History'} onClick={()=>setActiveTab('History')} icon={<History size={20}/>} />
         <NavBtn active={activeTab === 'Payments'} onClick={()=>setActiveTab('Payments')} icon={<Receipt size={20}/>} />
      </nav>


      {/* Premium custom confirm dialog with opaque backdrop blur and bright glass styling */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xs bg-[#1f293d]/90 border border-white/20 border-t-white/35 border-l-white/35 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)] overflow-hidden">
            {/* Top orange glow tint */}
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-[#F38E26]/20 rounded-full blur-2xl pointer-events-none" />
            
            {/* Icon */}
            {confirmModal.title.includes("Cancelar") ? (
              <div className="mx-auto w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-4 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-bounce">
                <AlertTriangle size={24} strokeWidth={2.5} />
              </div>
            ) : confirmModal.title.includes("Requerido") ? (
              <div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center mb-4 border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse">
                <AlertTriangle size={24} strokeWidth={2.5} />
              </div>
            ) : (
              <div className="mx-auto w-12 h-12 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mb-4 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)] animate-pulse">
                <Check size={24} strokeWidth={3} />
              </div>
            )}

            {/* Content */}
            <h4 className="text-base font-black text-white text-center uppercase tracking-tight mb-2">{confirmModal.title}</h4>
            <p className="text-[10px] text-white/70 text-center leading-relaxed mb-6 font-bold">{confirmModal.message}</p>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                className="flex-1 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 rounded-xl text-[9px] font-black uppercase text-white transition-all">
                Cerrar
              </button>
              {!confirmModal.title.includes("Requerido") && (
                <button 
                  onClick={confirmModal.onConfirm} 
                  className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase text-white shadow-lg active:scale-95 transition-all ${confirmModal.title.includes("Cancelar") ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25' : 'bg-green-500 hover:bg-green-600 shadow-green-500/25'}`}>
                  Confirmar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exercise Info Modal */}
      {isExerciseInfoOpen && selectedExerciseInfo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141b29] border border-white/10 p-6 rounded-[30px] w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsExerciseInfoOpen(false)} className="absolute top-4 right-4 text-white/30 hover:text-white">
              <X size={20} />
            </button>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4 pr-6">{selectedExerciseInfo.name}</h3>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {selectedExerciseInfo.video_url && (
                <div className="rounded-2xl overflow-hidden border border-white/5 bg-black/40 mb-4 aspect-video">
                  {selectedExerciseInfo.video_url.includes("youtube.com") || selectedExerciseInfo.video_url.includes("youtu.be") ? (
                    <iframe 
                      className="w-full h-full" 
                      src={selectedExerciseInfo.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")} 
                      title="YouTube video player" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen>
                    </iframe>
                  ) : (
                    <a href={selectedExerciseInfo.video_url} target="_blank" rel="noreferrer" className="w-full h-full flex flex-col items-center justify-center text-orange-500 hover:text-orange-400 transition-colors p-4 text-center">
                      <Play size={32} className="mb-2" />
                      <span className="text-xs font-black uppercase tracking-widest">Ver Video Tutorial</span>
                    </a>
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">Segmento Corporal</p>
                  <p className="text-xs text-white font-bold">{selectedExerciseInfo.segment || '-'}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">Zona Corporal</p>
                  <p className="text-xs text-white font-bold">{selectedExerciseInfo.zone || '-'}</p>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">Grupo Muscular</p>
                <p className="text-xs text-white font-bold">{selectedExerciseInfo.muscle_group || '-'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">Mecánica</p>
                  <p className="text-xs text-white font-bold">{selectedExerciseInfo.mechanics || '-'}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">Equipamiento</p>
                  <p className="text-xs text-white font-bold">{selectedExerciseInfo.equipment || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">RIR Sugerido</p>
                  <p className="text-xs text-white font-bold">{selectedExerciseInfo.rir || '-'}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">RPE Sugerido</p>
                  <p className="text-xs text-white font-bold">{selectedExerciseInfo.rpe || '-'}</p>
                </div>
              </div>

              {selectedExerciseInfo.instructions && (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-2">Instrucciones y Técnica</p>
                  <p className="text-xs text-white/80 whitespace-pre-wrap">{selectedExerciseInfo.instructions}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checklist Modal */}
      {showChecklistModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141b29] border border-white/10 p-6 rounded-[30px] w-full max-w-md shadow-2xl relative max-h-[80vh] flex flex-col">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 text-orange-500">¡Espera!</h3>
            <p className="text-sm text-white/70 mb-4">Te faltó hacer {uncompletedExercises.length} ejercicio(s). Puedes continuar sin guardar ese progreso o volver para marcarlos.</p>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 mb-4">
              {uncompletedExercises.map((ue, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <p className="text-xs font-bold text-white mb-2">{ue.name}</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-widest mb-2">¿Por qué no pudiste hacerlo? (Opcional)</p>
                  <div className="space-y-2">
                    {['No tuve tiempo', 'Muchas personas en la máquina', 'Otro'].map(reason => (
                      <label key={reason} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" 
                          name={`reason-${ue.dIdx}-${ue.eIdx}`} 
                          value={reason} 
                          checked={checklistResponses[`${ue.dIdx}-${ue.eIdx}`]?.reason === reason}
                          onChange={() => setChecklistResponses((prev: any) => ({
                            ...prev, 
                            [`${ue.dIdx}-${ue.eIdx}`]: { ...prev[`${ue.dIdx}-${ue.eIdx}`], reason }
                          }))}
                          className="accent-orange-500"
                        />
                        <span className="text-xs text-white/80">{reason}</span>
                      </label>
                    ))}
                    {checklistResponses[`${ue.dIdx}-${ue.eIdx}`]?.reason === 'Otro' && (
                      <input 
                        type="text" 
                        placeholder="Especificar..." 
                        value={checklistResponses[`${ue.dIdx}-${ue.eIdx}`]?.customReason || ''}
                        onChange={(e) => setChecklistResponses((prev: any) => ({
                          ...prev, 
                          [`${ue.dIdx}-${ue.eIdx}`]: { ...prev[`${ue.dIdx}-${ue.eIdx}`], customReason: e.target.value }
                        }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white mt-2 outline-none focus:border-orange-500/50"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={handleChecklistSubmit} className="w-full bg-orange-500 hover:bg-orange-400 text-black font-black uppercase tracking-widest text-xs py-3 rounded-2xl transition-colors">
                Continuar y Guardar
              </button>
              <button onClick={() => setShowChecklistModal(false)} className="w-full bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs py-3 rounded-2xl transition-colors">
                Volver para Marcar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toast && (
        <div id="toast-container" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-xl border shadow-[0_0_20px_rgba(0,0,0,0.5)] ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
            <span className="text-[11px] font-black uppercase tracking-wider">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

 
 function NavBtn({ active, onClick, icon }: any) {
   return (
     <button onClick={onClick} className={`p-3 rounded-xl transition-all relative flex items-center justify-center`} style={{color: active ? '#F38E26' : 'rgba(255,255,255,0.2)'}} onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLButtonElement).style.color='rgba(255,255,255,0.5)'}} onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLButtonElement).style.color='rgba(255,255,255,0.2)'}}>
        {icon}
        {active && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{backgroundColor:'#F38E26', boxShadow:'0 0 4px rgba(243,142,38,0.8)'}} />}
     </button>
   );
 }

