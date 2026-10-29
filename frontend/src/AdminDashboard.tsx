import { LayoutDashboard, Users, User, Brain, DollarSign, Lock, ShieldCheck, Briefcase, Download, CheckCircle, XCircle, Trash2, X, Settings, Receipt, CreditCard, Smartphone, Banknote, Search, Moon, Sun, AlertTriangle , Calendar, Clock, Info, Mail, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import SystemNoticeModal from './components/SystemNoticeModal';
import SystemModule from './components/SystemModule';
import MemberModal from "./components/MemberModal";
import EntrenamientosModule from './components/EntrenamientosModule';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function AgendaModule({ members, API_URL }: any) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeSchedule, setActiveSchedule] = useState<any | null>(null);
  const [classBookings, setClassBookings] = useState<any[]>([]);
  const [walkInQuery, setWalkInQuery] = useState('');
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false);
  const [newMemberData, setNewMemberData] = useState({ name: '', dni: '', phone: '', email: '', membership_type: 'Basic' });
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayDesc, setHolidayDesc] = useState('');
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classDayMode, setClassDayMode] = useState<'recurrent' | 'specific'>('recurrent');
  const [newClassData, setNewClassData] = useState<{ id?: number, name: string, code: string, day_of_week: number | null, specific_date: string | null, start_time: string, end_time: string, color: string, capacity: number }>({ name: 'Entrenamiento Funcional', code: 'EF', day_of_week: 0, specific_date: null, start_time: '08:30', end_time: '09:30', color: '#3b82f6', capacity: 15 });
  const [isEditingClass, setIsEditingClass] = useState(false);

  const [dbActivities, setDbActivities] = useState<any[]>([]);
  const [deletedSlotKeys, setDeletedSlotKeys] = useState<Set<string>>(new Set());
  const [showMorning, setShowMorning] = useState(false);
  const [showEvening, setShowEvening] = useState(false);
  const [isMassClassModalOpen, setIsMassClassModalOpen] = useState(false);
  const [massClassData, setMassClassData] = useState({
    days: [] as number[],
    start_time: '07:00',
    end_time: '23:00',
    interval_minutes: 60,
    capacity: 20,
    activity_name: '',
    mode: 'global' as 'global' | 'per_day',
    perDayConfigs: {} as Record<number, Array<{start_time: string, end_time: string, interval_minutes: number}>>
  });
  const [isNewActivityModalOpen, setIsNewActivityModalOpen] = useState(false);
  const [newActivityData, setNewActivityData] = useState({ name: '', code: '', color: '#ffffff' });
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);

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
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

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

  const fetchHiddenSlots = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/configs/hidden_slots`);
      if (res.ok) {
        const data = await res.json();
        if (data.value && Array.isArray(data.value)) {
          setDeletedSlotKeys(new Set(data.value));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchHolidays();
    fetchActivities();
    fetchHiddenSlots();
  }, []);

  useEffect(() => {
    if (isClassModalOpen) {
      fetchActivities();
    }
  }, [isClassModalOpen]);

  const allActivities = dbActivities;


  const weekdayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  const getDayOfWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    let day = d.getDay();
    return day === 0 ? 6 : day - 1;
  };

  const getWeekDatesForDate = (dateStr: string) => {
    const baseDate = new Date(dateStr + 'T00:00:00');
    const day = baseDate.getDay();
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(baseDate.setDate(diff));
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const getUniqueSlots = (allSchedules: any[]) => {
    const slotsMap = new Map<string, { start: string, end: string }>();
    
    const defaultSlots = [
      { start: "08:30", end: "09:30" },
      { start: "08:50", end: "09:50" },
      { start: "10:00", end: "11:00" },
      { start: "17:30", end: "18:30" },
      { start: "18:15", end: "19:15" },
      { start: "18:30", end: "19:30" },
      { start: "19:30", end: "20:30" }
    ];
    defaultSlots.forEach(s => {
      const key = `${s.start}-${s.end}`;
      if (!deletedSlotKeys.has(key)) {
        slotsMap.set(key, s);
      }
    });

    allSchedules.forEach(s => {
      const key = `${s.start_time}-${s.end_time}`;
      slotsMap.set(key, { start: s.start_time, end: s.end_time });
    });

    const sortedSlots = Array.from(slotsMap.values()).sort((a, b) => a.start.localeCompare(b.start));
    
    const morning = sortedSlots.filter(s => {
      const hour = parseInt(s.start.split(":")[0]);
      return hour < 12;
    });
    
    const evening = sortedSlots.filter(s => {
      const hour = parseInt(s.start.split(":")[0]);
      return hour >= 12;
    });

    return { morning, evening };
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/class_schedules`);
      if (res.ok) setSchedules(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchHolidays = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/holidays`);
      if (res.ok) setHolidays(await res.json());
    } catch (e) { console.error(e); }
  };


  const selectedWeekday = getDayOfWeek(selectedDate);


  const fetchClassBookings = async (scheduleId: number, fetchDateStr?: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/class_schedules/${scheduleId}/bookings?date=${fetchDateStr || selectedDate}&t=${Date.now()}`);
      if (res.ok) setClassBookings(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleToggleAttendance = async (bookingId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'attended' ? 'reserved' : 'attended';
    try {
      const res = await fetch(`${API_URL}/admin/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchClassBookings(activeSchedule.id);
        fetchSchedules();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteBooking = async (bookingId: number) => {
    showConfirm(
      'Eliminar Persona de la Clase',
      '¿Estás seguro de que deseas eliminar a esta persona de la clase?',
      async () => {
        try {
          const res = await fetch(`${API_URL}/admin/bookings/${bookingId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            fetchClassBookings(activeSchedule.id);
            fetchSchedules();
          }
        } catch (e) { console.error(e); }
      }
    );
  };

  const handleAddWalkIn = async (member: any) => {
    const isHoliday = holidays.find(h => h.date === selectedDate);
    if (isHoliday) {
      showConfirm("Día Feriado", "No se puede registrar asistencia en un día marcado como feriado.", () => {});
      return;
    }
    if (activeSchedule && classBookings.length >= activeSchedule.capacity) {
      alert("La clase ha alcanzado su capacidad máxima.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/admin/bookings/walk-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: member.dni,
          class_schedule_id: activeSchedule.id,
          date: selectedDate
        })
      });
      if (res.ok) {
        setWalkInQuery('');
        fetchClassBookings(activeSchedule.id);
        fetchSchedules();
      } else {
        const err = await res.json();
        alert(err.detail || "Error al agregar socio espontáneo");
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberData.name || !newMemberData.dni) return;
    try {
      const res = await fetch(`${API_URL}/admin/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMemberData,
          password: '123',
          photo_url: `https://i.pravatar.cc/300?u=${newMemberData.dni}`
        })
      });
      if (res.ok) {
        const createdMember = await res.json();
        await handleAddWalkIn(createdMember);
        setIsNewMemberOpen(false);
        setNewMemberData({ name: '', dni: '', phone: '', email: '', membership_type: 'Basic' });
      } else {
        const err = await res.json();
        alert(err.detail || "Error al crear socio");
      }
    } catch (e) { console.error(e); }
  };


  const handleDeleteRow = async (start: string, end: string) => {
    showConfirm("Eliminar Fila Completa", `¿Seguro que deseas eliminar TODAS las clases del horario ${start} - ${end} de esta semana?`, async () => {
      const rowSchedules = schedules.filter(s => s.start_time === start && s.end_time === end);
      try {
        for (const s of rowSchedules) {
          await fetch(`${API_URL}/admin/class_schedules/${s.id}`, { method: 'DELETE' });
        }
        setDeletedSlotKeys(prev => {
          const next = new Set(prev);
          next.add(`${start}-${end}`);
          fetch(`${API_URL}/admin/configs/hidden_slots`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: Array.from(next) }) }).catch(console.error);
            return next;
        });
        fetchSchedules();
      } catch (e) {
        console.error(e);
      }
    });
  };

  const handleMassClassSubmit = async () => {
    try {
      const actName = massClassData.activity_name || (allActivities.length > 0 ? allActivities[0].name : "");
      const activity = allActivities.find(a => a.name === actName);
      if (!activity) return;
      
      const configs: any[] = [];
      if (massClassData.mode === 'global') {
        massClassData.days.forEach(d => {
          configs.push({
            day: d,
            start_time: massClassData.start_time,
            end_time: massClassData.end_time,
            interval_minutes: massClassData.interval_minutes
          });
        });
      } else {
        massClassData.days.forEach(d => {
          const blocks = massClassData.perDayConfigs[d] || [{ start_time: '07:00', end_time: '23:00', interval_minutes: 60 }];
          blocks.forEach(b => {
            configs.push({
              day: d,
              start_time: b.start_time,
              end_time: b.end_time,
              interval_minutes: b.interval_minutes
            });
          });
        });
      }

      const payload = {
        configs,
        capacity: massClassData.capacity,
        name: activity.name,
        code: activity.code,
        color: activity.color
      };
      
      const res = await fetch(`${API_URL}/admin/class_schedules/mass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsMassClassModalOpen(false);
        fetchSchedules();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleNewActivitySubmit = async () => {
    try {
      const method = editingActivityId ? 'PUT' : 'POST';
      const url = editingActivityId 
        ? `${API_URL}/admin/activities/${editingActivityId}` 
        : `${API_URL}/admin/activities`;
        
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newActivityData)
      });
      if (res.ok) {
        setIsNewActivityModalOpen(false);
        fetchActivities();
        fetchSchedules();
        setNewActivityData({ name: '', code: '', color: '#ffffff' });
        setEditingActivityId(null);
      } else {
        const text = await res.text();
        alert(`Error al guardar: HTTP ${res.status} - ${text}`);
      }
    } catch (e) {
      console.error(e);
      alert(`Error de red: ${e}`);
    }
  };
  
  const handleDeleteActivity = async (id: number) => {
    showConfirm("Eliminar Actividad", "¿Estás seguro de eliminar esta actividad personalizada?", async () => {
      await fetch(`${API_URL}/admin/activities/${id}`, { method: 'DELETE' });
      fetchActivities();
    });
  };

  const handleSaveClass = async () => {
    if (classDayMode === 'specific' && newClassData.specific_date) {
      const isHoliday = holidays.find(h => h.date === newClassData.specific_date);
      if (isHoliday) {
        showConfirm("Día Feriado", "No se puede guardar una clase en una fecha marcada como feriado.", () => {});
        return;
      }
    }
    try {
      const method = isEditingClass ? 'PUT' : 'POST';
      const url = isEditingClass 
        ? `${API_URL}/admin/class_schedules/${newClassData.id}` 
        : `${API_URL}/admin/class_schedules`;
        
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClassData)
      });
      if (res.ok) {
        fetchSchedules();
        setIsClassModalOpen(false);
        setIsEditingClass(false);
      } else {
        const err = await res.json();
        alert(err.detail || "Error al guardar la clase");
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteClass = (id: number) => {
    showConfirm(
      "¿Eliminar Horario de Clase?",
      "¿Estás seguro de que deseas eliminar este horario de clase de la grilla permanente?",
      async () => {
        try {
          const res = await fetch(`${API_URL}/admin/class_schedules/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchSchedules();
            if (activeSchedule?.id === id) setActiveSchedule(null);
          }
        } catch (e) { console.error(e); }
      }
    );
  };

  const handleSaveHoliday = async () => {
    if (!holidayDate || !holidayDesc) return;
    try {
      const res = await fetch(`${API_URL}/admin/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: holidayDate, description: holidayDesc })
      });
      if (res.ok) {
        fetchHolidays();
        setHolidayDate('');
        setHolidayDesc('');
        setIsHolidayModalOpen(false);
      } else {
        const err = await res.json();
        alert(err.detail || "Error al registrar feriado");
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteHoliday = async (id: number) => {
    showConfirm("¿Eliminar este feriado?", "¿Estás seguro de que deseas eliminar este feriado del sistema?", async () => {
      try {
        const res = await fetch(`${API_URL}/admin/holidays/${id}`, { method: 'DELETE' });
        if (res.ok) fetchHolidays();
      } catch (e) { console.error(e); }
    });
  };


  const filteredMembersSearch = walkInQuery.trim() === '' ? [] : members.filter((m: any) => {
    const query = walkInQuery.toLowerCase();
    const matchesDni = m.dni.includes(query);
    const matchesName = m.name.toLowerCase().includes(query);
    const alreadyBooked = classBookings.some(b => b.member.id === m.id);
    return (matchesDni || matchesName) && !alreadyBooked;
  }).slice(0, 5);

  const { morning: morningSlots, evening: eveningSlots } = getUniqueSlots(schedules);
  const weekDates = getWeekDatesForDate(selectedDate);
  const weekdayShortNames = ["L", "M", "MI", "J", "V", "S", "D"];

  const renderSlotRows = (slots: typeof morningSlots) => {
    return slots.map((slot, rowIndex) => {
      return (
        <tr key={rowIndex} className="border-b border-gray-200 dark:border-white/5">
          <td className="p-1 sm:p-3 text-center w-14 sm:w-24 relative group">
            <span className="inline-block px-1.5 sm:px-3 py-1 sm:py-1.5 bg-[#F38E26]/10 text-gray-700 dark:text-gray-300 font-black rounded-lg sm:rounded-xl border border-gray-200 dark:border-white/10 text-[7px] sm:text-[9px] uppercase tracking-tight">
              {slot.start} - {slot.end}
            </span>
            <button onClick={() => handleDeleteRow(slot.start, slot.end)} className="absolute top-1 left-1 sm:top-2 sm:left-2 text-red-500 opacity-0 group-hover:opacity-100 hover:scale-110 transition-all bg-white dark:bg-[#1b2435] border border-red-500/30 rounded-full p-0.5 shadow-md z-10" title="Eliminar fila completa">
              <X size={10} strokeWidth={4} />
            </button>
          </td>
          {weekdayShortNames.map((_, dayIndex) => {
            const targetDateStr = weekDates[dayIndex].toISOString().split('T')[0];
            const cellSchedules = schedules.filter(s => (s.day_of_week === dayIndex || s.specific_date === targetDateStr) && s.start_time === slot.start && s.end_time === slot.end);
            return (
              <td 
                key={dayIndex} 
                className="p-1 sm:p-2 text-center min-w-[38px] sm:min-w-[70px] cursor-pointer hover:bg-gray-100/50 dark:hover:bg-white/5 transition-all rounded-xl"
                title="Doble click para agregar clase en este horario"
                onDoubleClick={() => {
                  setNewClassData({
                    name: 'Entrenamiento Funcional',
                    code: 'EF',
                    day_of_week: dayIndex,
                    specific_date: null,
                    start_time: slot.start,
                    end_time: slot.end,
                    color: '#3b82f6',
                    capacity: 15
                  });
                  setClassDayMode('recurrent');
                  setIsEditingClass(false);
                  setIsClassModalOpen(true);
                }}
              >
                <div className="flex flex-col gap-1 items-center justify-center">
                  {cellSchedules.length > 0 ? cellSchedules.map(s => {
                    const isSelected = activeSchedule?.id === s.id && getDayOfWeek(selectedDate) === dayIndex;
                    return (
                      <button
                        key={s.id}
                        onDoubleClick={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetDate = weekDates[dayIndex];
                          const targetDateStr = targetDate.toISOString().split('T')[0];
                          setSelectedDate(targetDateStr);
                          setActiveSchedule(s);
                          fetchClassBookings(s.id, targetDateStr);
                        }}
                        style={{ backgroundColor: s.color, textShadow: '0px 1px 3px rgba(0,0,0,0.9)' }}
                        className={`w-9 sm:w-14 h-7 sm:h-9 rounded-lg sm:rounded-xl text-white font-black text-[7px] sm:text-[9px] uppercase flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md ${isSelected ? 'ring-2 ring-orange-500 scale-105' : 'opacity-90'}`}>
                        <span>{s.code}</span>
                      </button>
                    );
                  }) : (
                    <div className="w-9 sm:w-14 h-7 sm:h-9 rounded-lg sm:rounded-xl border border-gray-300 dark:border-white/10 bg-transparent flex items-center justify-center opacity-30 text-[7px] sm:text-[9px] font-black text-gray-400">
                      -
                    </div>
                  )}
                </div>
              </td>
            );
          })}
        </tr>
      );
    });
  };

  return (
    <div className="space-y-6 text-black dark:text-[#e0e0e0]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="font-black text-lg uppercase text-black dark:text-white">Agenda y Horarios de Clases</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-black dark:text-white text-[10px] outline-none" value={selectedDate} onChange={e=>{ setSelectedDate(e.target.value); setActiveSchedule(null); }} />
          <button onClick={() => { 
            setNewClassData({ name: 'Entrenamiento Funcional', code: 'EF', day_of_week: selectedWeekday, specific_date: null, start_time: '08:30', end_time: '09:30', color: '#3b82f6', capacity: 15 });
            setClassDayMode('recurrent');
            setIsEditingClass(false);
            setIsClassModalOpen(true);
          }} className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#0a0a0a] text-white dark:bg-[#F38E26] dark:text-[#0a0a0a] border border-[#F38E26] whitespace-nowrap">+ Agregar Clase Fija</button>
          <button onClick={() => setIsHolidayModalOpen(true)} className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">+ Configurar Feriado</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Grilla Semanal */}
          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-6 rounded-[35px] space-y-6">
            
            {/* Clases por la Mañana */}
            <div>
              <div className="bg-[#F38E26] text-white font-black text-center py-2.5 uppercase tracking-widest text-[9px] rounded-t-2xl flex items-center justify-center cursor-pointer relative" onClick={() => setShowMorning(!showMorning)}>
                <span>Clases por la Mañana</span>
                <span className="absolute right-4">{showMorning ? "▲" : "▼"}</span>
              </div>
              {showMorning && <div className="overflow-x-auto border-x border-b border-gray-200 dark:border-white/5 rounded-b-2xl">
                <table className="w-full border-collapse text-left table-fixed">
                  <thead>
                    <tr className="bg-[#F38E26]/5 text-gray-400 dark:text-white/20 border-b border-gray-200 dark:border-white/5 text-[7px] sm:text-[8px] uppercase tracking-wider font-black">
                      <th className="p-1 sm:p-3 text-center w-14 sm:w-24 text-[7px] sm:text-[8px]">Hora</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">L</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">M</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">MI</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">J</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">V</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">S</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderSlotRows(morningSlots)}
                  </tbody>
                </table>
              </div>}
            </div>

            {/* Clases por la Tarde / Noche */}
            <div>
              <div className="bg-[#F38E26] text-white font-black text-center py-2.5 uppercase tracking-widest text-[9px] rounded-t-2xl flex items-center justify-center cursor-pointer relative" onClick={() => setShowEvening(!showEvening)}>
                <span>Clases por la Tarde/Noche</span>
                <span className="absolute right-4">{showEvening ? "▲" : "▼"}</span>
              </div>
              {showEvening && <div className="overflow-x-auto border-x border-b border-gray-200 dark:border-white/5 rounded-b-2xl">
                <table className="w-full border-collapse text-left table-fixed">
                  <thead>
                    <tr className="bg-[#F38E26]/5 text-gray-400 dark:text-white/20 border-b border-gray-200 dark:border-white/5 text-[7px] sm:text-[8px] uppercase tracking-wider font-black">
                      <th className="p-1 sm:p-3 text-center w-14 sm:w-24 text-[7px] sm:text-[8px]">Hora</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">L</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">M</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">MI</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">J</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">V</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">S</th>
                      <th className="p-1 sm:p-3 text-center text-[7px] sm:text-[8px]">D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderSlotRows(eveningSlots)}
                  </tbody>
                </table>
              </div>}
            </div>

            {/* Actividades Leyenda */}
            <div className="pt-4 border-t border-gray-200 dark:border-white/5 text-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 dark:text-white/20 block mb-3">Actividades</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center items-center text-[8px] font-black uppercase">
                {allActivities.map((act: any, i: number) => (
                  <span key={i} className="flex items-center gap-1 group relative" style={{ color: act.color, textShadow: '0px 1px 2px rgba(0,0,0,0.8)' }}>
                    ● {act.name} ({act.code})
                    {act.id && (
                      <button onClick={() => handleDeleteActivity(act.id)} className="hidden group-hover:block absolute -top-4 -right-2 bg-red-500 text-white p-0.5 rounded-full z-10"><X size={10}/></button>
                    )}
                  </span>
                ))}
                <button onClick={() => setIsNewActivityModalOpen(true)} className="ml-4 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 dark:text-white/40 border border-white/10">+ Nueva Actividad Personalizada</button>
              </div>
            </div>

          </div>

          {/* Feriados */}
          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-6 rounded-[35px]">
            <h4 className="text-[10px] font-black uppercase text-gray-500 dark:text-white/30 tracking-widest mb-4">Feriados Registrados en el Sistema</h4>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {holidays.length > 0 ? holidays.map(h => (
                <div key={h.id} className="flex justify-between items-center bg-white dark:bg-[#141b29]/40 p-3 rounded-xl border border-gray-200 dark:border-white/5">
                  <div>
                    <p className="font-black text-black dark:text-white text-[9px] uppercase">{h.description}</p>
                    <p className="text-[8px] text-gray-400 dark:text-white/20 font-black">{new Date(h.date + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                  </div>
                  <button onClick={() => handleDeleteHoliday(h.id)} className="text-[8px] font-black text-red-500 bg-red-500/10 px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-all">Eliminar</button>
                </div>
              )) : (
                <p className="text-center text-gray-400 dark:text-white/10 italic text-[9px] font-black uppercase py-6">No hay feriados agendados</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {activeSchedule ? (
            <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-6 rounded-[35px] space-y-6">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-gray-500 dark:text-white/30 tracking-widest">
                    Control de Asistencia
                  </h4>
                  <p className="text-sm font-black text-black dark:text-white uppercase leading-tight mt-1">
                    {activeSchedule.name}
                  </p>
                  <p className="text-[8px] text-orange-400 font-black uppercase tracking-widest mt-1">
                    📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR')} • {activeSchedule.start_time} hs
                  </p>
                  <p className="text-[10px] font-black text-black dark:text-white mt-2">
                    Confirmados: <span className="text-orange-500">{classBookings.length} / {activeSchedule.capacity}</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => {
                    setNewClassData({
                      id: activeSchedule.id,
                      name: activeSchedule.name,
                      code: activeSchedule.code,
                      day_of_week: activeSchedule.day_of_week,
                      specific_date: activeSchedule.specific_date,
                      start_time: activeSchedule.start_time,
                      end_time: activeSchedule.end_time,
                      color: activeSchedule.color,
                      capacity: activeSchedule.capacity
                    });
                    setClassDayMode(activeSchedule.specific_date ? 'specific' : 'recurrent');
                    setIsEditingClass(true);
                    setIsClassModalOpen(true);
                  }} className="text-[8px] font-black text-gray-500 dark:text-white/30 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded">Editar</button>
                  <button onClick={async () => {
                    try {
                      const targetDateStr = selectedDate;
                      await fetchClassBookings(activeSchedule.id, targetDateStr);
                      const res = await fetch(`${API_URL}/admin/class_schedules`);
                      if (res.ok) {
                        const data = await res.json();
                        setSchedules(data);
                        const freshActive = data.find((s: any) => s.id === activeSchedule.id);
                        if (freshActive) setActiveSchedule(freshActive);
                        // Visual feedback to confirm refresh
                        const btn = document.getElementById('refresh-btn');
                        if (btn) {
                          btn.style.transform = 'rotate(180deg)';
                          setTimeout(() => btn.style.transform = 'rotate(0deg)', 300);
                        }
                      }
                    } catch (e) {
                      console.error(e);
                    }
                  }} id="refresh-btn" style={{ transition: 'transform 0.3s ease' }} className="text-[12px] font-black text-blue-500 dark:text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded">🔄</button>
                  <button onClick={() => {
                    if (window.confirm("¿Eliminar este horario de clase de forma permanente?")) {
                      handleDeleteClass(activeSchedule.id);
                      setActiveSchedule(null);
                    }
                  }} className="text-[8px] font-black text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 px-2 py-1 rounded transition-colors">Eliminar</button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black">Registrar Asistencia Espontánea (Walk-In)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-white/20" size={12} />
                    <input type="text" placeholder="Buscar por Nombre o DNI..." className="w-full bg-[#141b29]/40 border border-white/10 dark:border-white/10 rounded-xl py-2 pl-8 pr-3 text-black dark:text-white text-[10px] outline-none" value={walkInQuery} onChange={e=>setWalkInQuery(e.target.value)} />
                    {filteredMembersSearch.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-[#1b2435] border border-white/10 rounded-xl mt-1 overflow-hidden shadow-2xl">
                        {filteredMembersSearch.map((m: any) => (
                          <div key={m.id} onClick={() => {
                            if (classBookings.length >= activeSchedule.capacity) {
                              alert("Sin Cupo");
                              return;
                            }
                            handleAddWalkIn(m);
                          }} className={`p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-b-0 text-[10px] uppercase font-black flex justify-between items-center ${classBookings.length >= activeSchedule.capacity ? 'opacity-50 text-white/50' : 'text-white'}`}>
                            <span>{m.name} <span className="text-white/40 font-normal">({m.dni})</span></span>
                            <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase ${classBookings.length >= activeSchedule.capacity ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{classBookings.length >= activeSchedule.capacity ? 'Sin Cupo' : 'Añadir'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setIsNewMemberOpen(true)} className="px-3 bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-green-500 hover:text-white transition-all">+ Socio</button>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-white/5">
                <p className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black">Listado de Confirmados</p>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                  {classBookings.length > 0 ? classBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#141b29]/40 rounded-xl border border-gray-200 dark:border-white/5">
                      <div className="min-w-0">
                        <p className="font-black text-black dark:text-white text-[10px] uppercase truncate">{b.member.name}</p>
                        <p className="text-[8px] text-gray-400 dark:text-white/20 font-black">DNI: {b.member.dni}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={b.status === 'attended'} onChange={() => handleToggleAttendance(b.id, b.status)} className="w-4 h-4 accent-green-500 rounded border-white/10" />
                          <span className={`text-[8px] font-black uppercase ${b.status === 'attended' ? 'text-green-500' : 'text-gray-400'}`}>Asistió</span>
                        </label>
                        <button onClick={() => handleDeleteBooking(b.id)} className="text-red-500 hover:text-red-400 p-1 bg-red-500/10 hover:bg-red-500/20 rounded ml-2" title="Eliminar de la clase">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center text-gray-400 dark:text-white/10 italic text-[9px] font-black uppercase py-8">
                      Nadie reservó esta clase para hoy aún.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-8 rounded-[35px] text-center py-20 flex flex-col items-center justify-center">
              <Clock className="text-gray-400 dark:text-white/10 mb-4" size={40} />
              <p className="text-[10px] font-black uppercase text-gray-500 dark:text-white/20 tracking-wider">
                Selecciona una clase de la grilla para ver confirmados y tomar asistencia.
              </p>
            </div>
          )}
        </div>
      </div>

      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1b2435] border border-gray-200 dark:border-white/10 p-8 rounded-[35px] w-full max-w-sm">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-black uppercase text-red-500">Configurar Feriado</h4>
              <button onClick={() => setIsHolidayModalOpen(false)} className="text-gray-400 hover:text-white"><X size={16}/></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Fecha Feriado</label>
                <input type="date" className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-red-500" value={holidayDate} onChange={e=>setHolidayDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Motivo / Descripción</label>
                <input type="text" placeholder="Ej: Navidad, Feriado Puente..." className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-red-500" value={holidayDesc} onChange={e=>setHolidayDesc(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsHolidayModalOpen(false)} className="flex-1 py-3 text-[9px] font-black uppercase text-gray-400">Cancelar</button>
                <button onClick={handleSaveHoliday} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase">Registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}


      {isMassClassModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1b2435] border border-gray-200 dark:border-white/10 p-8 rounded-[35px] w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-black uppercase text-orange-500">Carga Masiva de Clases</h4>
              <button onClick={() => setIsMassClassModalOpen(false)} className="text-gray-400 hover:text-white"><X size={16}/></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Seleccionar Actividad</label>
                <select value={massClassData.activity_name} onChange={e => setMassClassData({...massClassData, activity_name: e.target.value})} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-3 rounded-2xl text-[10px] uppercase font-black text-black dark:text-white outline-none">
                  {allActivities.map((act: any, i: number) => <option key={i} value={act.name}>{act.name} ({act.code})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Días de la semana</label>
                <div className="flex gap-2 justify-between">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => (
                    <button key={i} onClick={() => setMassClassData(prev => ({...prev, days: prev.days.includes(i) ? prev.days.filter(d => d !== i) : [...prev.days, i]}))} className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${massClassData.days.includes(i) ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/40'}`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              {/* Toggles */}
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                <button 
                  onClick={() => setMassClassData({...massClassData, mode: 'global'})} 
                  className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${massClassData.mode === 'global' ? 'bg-white dark:bg-[#1b2435] shadow text-orange-500' : 'text-gray-400'}`}>
                  Mismo Horario
                </button>
                <button 
                  onClick={() => setMassClassData({...massClassData, mode: 'per_day'})} 
                  className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${massClassData.mode === 'per_day' ? 'bg-white dark:bg-[#1b2435] shadow text-orange-500' : 'text-gray-400'}`}>
                  Por Día
                </button>
              </div>

              {massClassData.mode === 'global' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Hora de Inicio (HH:MM)</label>
                      <input type="time" value={massClassData.start_time} onChange={e => setMassClassData({...massClassData, start_time: e.target.value})} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-3 rounded-2xl text-[10px] font-black text-black dark:text-white outline-none text-center" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Hora de Fin (HH:MM)</label>
                      <input type="time" value={massClassData.end_time} onChange={e => setMassClassData({...massClassData, end_time: e.target.value})} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-3 rounded-2xl text-[10px] font-black text-black dark:text-white outline-none text-center" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Intervalo o Duración (Minutos)</label>
                    <input type="number" min="1" value={massClassData.interval_minutes} onChange={e => setMassClassData({...massClassData, interval_minutes: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-3 rounded-2xl text-[10px] font-black text-black dark:text-white outline-none text-center" />
                  </div>
                </>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  {massClassData.days.length === 0 ? (
                    <p className="text-center text-[9px] uppercase font-black text-gray-400 py-4">Selecciona días para configurar</p>
                  ) : (
                    massClassData.days.map(d => {
                      const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                      const blocks = massClassData.perDayConfigs[d] || [{ start_time: '07:00', end_time: '23:00', interval_minutes: 60 }];
                      
                      const updateBlock = (index: number, field: string, val: string | number) => {
                        const newBlocks = [...blocks];
                        newBlocks[index] = { ...newBlocks[index], [field]: val };
                        setMassClassData(prev => ({
                          ...prev,
                          perDayConfigs: {
                            ...prev.perDayConfigs,
                            [d]: newBlocks
                          }
                        }));
                      };

                      const addBlock = () => {
                        setMassClassData(prev => ({
                          ...prev,
                          perDayConfigs: {
                            ...prev.perDayConfigs,
                            [d]: [...blocks, { start_time: '07:00', end_time: '23:00', interval_minutes: 60 }]
                          }
                        }));
                      };
                      
                      const removeBlock = (index: number) => {
                        const newBlocks = blocks.filter((_, i) => i !== index);
                        setMassClassData(prev => ({
                          ...prev,
                          perDayConfigs: {
                            ...prev.perDayConfigs,
                            [d]: newBlocks
                          }
                        }));
                      };

                      return (
                        <div key={d} className="p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-2xl space-y-2 relative">
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black uppercase text-orange-500">{dayNames[d]}</p>
                            <button onClick={addBlock} className="w-5 h-5 bg-orange-500 text-white rounded-md flex items-center justify-center font-black text-xs hover:bg-orange-600 transition-colors">+</button>
                          </div>
                          
                          {blocks.map((b, i) => (
                            <div key={i} className="flex gap-2 items-end bg-white dark:bg-black/40 p-2 rounded-xl relative group border border-transparent dark:border-white/5">
                              <div className="flex-1">
                                <label className="text-[7px] text-gray-400 uppercase font-black block text-center mb-1">Inicio</label>
                                <input type="time" value={b.start_time} onChange={e => updateBlock(i, 'start_time', e.target.value)} className="w-full bg-transparent border border-gray-200 dark:border-white/10 p-2 rounded-lg text-[9px] font-black text-center text-black dark:text-white" />
                              </div>
                              <div className="flex-1">
                                <label className="text-[7px] text-gray-400 uppercase font-black block text-center mb-1">Fin</label>
                                <input type="time" value={b.end_time} onChange={e => updateBlock(i, 'end_time', e.target.value)} className="w-full bg-transparent border border-gray-200 dark:border-white/10 p-2 rounded-lg text-[9px] font-black text-center text-black dark:text-white" />
                              </div>
                              <div className="flex-1">
                                <label className="text-[7px] text-gray-400 uppercase font-black block text-center mb-1">Int (m)</label>
                                <input type="number" min="1" value={b.interval_minutes} onChange={e => updateBlock(i, 'interval_minutes', parseInt(e.target.value))} className="w-full bg-transparent border border-gray-200 dark:border-white/10 p-2 rounded-lg text-[9px] font-black text-center text-black dark:text-white" />
                              </div>
                              {blocks.length > 1 && (
                                <button onClick={() => removeBlock(i)} className="absolute -right-1 -top-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity z-10">✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Capacidad por clase</label>
                <input type="number" min="1" value={massClassData.capacity} onChange={e => setMassClassData({...massClassData, capacity: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-3 rounded-2xl text-[10px] font-black text-black dark:text-white outline-none text-center" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsMassClassModalOpen(false)} className="flex-1 py-3 text-[9px] font-black uppercase text-gray-400">Cancelar</button>
                <button onClick={handleMassClassSubmit} disabled={massClassData.days.length === 0} className="flex-1 py-3 bg-orange-500 text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-50">Generar Clases</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isNewActivityModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1b2435] border border-gray-200 dark:border-white/10 p-8 rounded-[35px] w-full max-w-sm max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-black uppercase text-orange-500">Gestionar Actividades</h4>
              <button onClick={() => setIsNewActivityModalOpen(false)} className="text-gray-400 hover:text-white"><X size={16}/></button>
            </div>
            
            {/* List of existing activities */}
            <div className="mb-6 space-y-2 max-h-40 overflow-y-auto custom-scrollbar bg-black/5 dark:bg-black/20 rounded-2xl p-4">
              {allActivities.map((act: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: act.color }}></span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-black dark:text-white">
                      {act.name} ({act.code})
                    </span>
                  </div>
                  {act.id && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => {
                        setNewActivityData({ name: act.name, code: act.code, color: act.color });
                        setEditingActivityId(act.id);
                      }} className="text-blue-500 hover:bg-blue-500/10 p-1.5 rounded-lg transition-colors" title="Editar Actividad">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                      </button>
                      <button onClick={() => handleDeleteActivity(act.id)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors" title="Eliminar Actividad">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="border-t border-gray-200 dark:border-white/10 pt-4 mb-4">
              <h5 className="text-[10px] font-black uppercase text-gray-500 dark:text-white/40 tracking-wider">{editingActivityId ? "Editar Actividad" : "Crear Nueva Actividad"}</h5>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Nombre</label>
                <input type="text" value={newActivityData.name} onChange={e => setNewActivityData({...newActivityData, name: e.target.value})} placeholder="Ej. Pilates Funcional" className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-3 rounded-2xl text-[10px] font-black text-black dark:text-white outline-none uppercase" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Código (2 letras)</label>
                <input type="text" maxLength={2} value={newActivityData.code} onChange={e => setNewActivityData({...newActivityData, code: e.target.value})} placeholder="PF" className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-3 rounded-2xl text-[10px] font-black text-black dark:text-white outline-none uppercase text-center" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Color HEX</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={newActivityData.color} onChange={e => setNewActivityData({...newActivityData, color: e.target.value})} className="w-12 h-12 rounded-xl cursor-pointer" />
                  <input type="text" value={newActivityData.color} onChange={e => setNewActivityData({...newActivityData, color: e.target.value})} className="flex-1 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-3 rounded-2xl text-[10px] font-black text-black dark:text-white outline-none text-center" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => {
                  if (editingActivityId) {
                    setEditingActivityId(null);
                    setNewActivityData({ name: '', code: '', color: '#ffffff' });
                  } else {
                    setIsNewActivityModalOpen(false);
                  }
                }} className="flex-1 py-3 text-[9px] font-black uppercase text-gray-400">Cancelar</button>
                <button onClick={handleNewActivitySubmit} className="flex-1 py-3 bg-orange-500 text-white rounded-xl text-[9px] font-black uppercase">{editingActivityId ? "Guardar Cambios" : "Crear Actividad"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isClassModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1b2435] border border-gray-200 dark:border-white/10 p-8 rounded-[35px] w-full max-w-sm max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-black uppercase text-orange-500">{isEditingClass ? 'Editar Clase Fija' : 'Añadir Clase Fija'}</h4>
              <button onClick={() => setIsClassModalOpen(false)} className="text-gray-400 hover:text-white"><X size={16}/></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Seleccionar Actividad</label>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" 
                    value={newClassData.name} 
                    onChange={e => {
                      const selected = allActivities.find((act: any) => act.name === e.target.value);
                      if (selected) {
                        setNewClassData(prev => ({
                          ...prev,
                          name: selected.name,
                          code: selected.code,
                          color: selected.color
                        }));
                      }
                    }}>
                    <option value="">-- Seleccionar Actividad --</option>
                    {allActivities.map((act: any, i: number) => <option key={i} value={act.name}>{act.name}</option>)}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => { setIsClassModalOpen(false); setIsNewActivityModalOpen(true); }} 
                    className="px-3 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl text-[9px] font-black uppercase hover:bg-orange-500 hover:text-white transition-all whitespace-nowrap">
                    + Nueva
                  </button>
                </div>
              </div>

              

              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Actividad / Nombre</label>
                <input type="text" className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={newClassData.name} onChange={e=>setNewClassData({...newClassData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Código (2 letras)</label>
                  <input type="text" maxLength={2} className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500 text-center uppercase" value={newClassData.code} onChange={e=>setNewClassData({...newClassData, code: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Día</label>
                  <div className="flex gap-2 mb-2 bg-[#141b29]/40 p-1 rounded-xl">
                    <button type="button" onClick={() => setClassDayMode('recurrent')} className={`flex-1 text-[9px] py-1 rounded-lg uppercase font-black transition-all ${classDayMode === 'recurrent' ? 'bg-[#F38E26] text-white shadow' : 'text-gray-400 hover:text-white'}`}>Recurrente</button>
                    <button type="button" onClick={() => setClassDayMode('specific')} className={`flex-1 text-[9px] py-1 rounded-lg uppercase font-black transition-all ${classDayMode === 'specific' ? 'bg-[#F38E26] text-white shadow' : 'text-gray-400 hover:text-white'}`}>F. Específica</button>
                  </div>
                  {classDayMode === 'recurrent' ? (
                    <select className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={newClassData.day_of_week ?? 0} onChange={e=>setNewClassData({...newClassData, day_of_week: parseInt(e.target.value), specific_date: null})}>
                      {weekdayNames.map((n, i) => <option key={i} value={i}>{n}</option>)}
                    </select>
                  ) : (
                    <input type="date" className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={newClassData.specific_date || ''} onChange={e=>setNewClassData({...newClassData, specific_date: e.target.value, day_of_week: null})} />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Inicio</label>
                  <input type="time" className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500 text-center" value={newClassData.start_time} onChange={e=>setNewClassData({...newClassData, start_time: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Fin</label>
                  <input type="time" className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500 text-center" value={newClassData.end_time} onChange={e=>setNewClassData({...newClassData, end_time: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Capacidad</label>
                  <input type="number" className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={newClassData.capacity} onChange={e=>setNewClassData({...newClassData, capacity: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" className="w-10 h-10 bg-transparent border-0 outline-none cursor-pointer rounded-xl flex-shrink-0" value={newClassData.color} onChange={e=>setNewClassData({...newClassData, color: e.target.value})} />
                    <input type="text" className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={newClassData.color} onChange={e=>setNewClassData({...newClassData, color: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="pt-4 space-y-3">
                <button onClick={() => { setIsClassModalOpen(false); setIsMassClassModalOpen(true); }} className="w-full py-2 bg-purple-600/10 text-purple-500 border border-purple-600/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all shadow-sm">
                  ⚡ Carga Masiva (Repetitivas)
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setIsClassModalOpen(false)} className="flex-1 py-3 text-[9px] font-black uppercase text-gray-400">Cancelar</button>
                  <button onClick={handleSaveClass} className="flex-1 py-3 bg-[#0a0a0a] text-white rounded-xl text-[9px] font-black uppercase border border-[#F38E26]">Guardar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isNewMemberOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={handleCreateNewMember} className="bg-white dark:bg-[#1b2435] border border-gray-200 dark:border-white/10 p-8 rounded-[35px] w-full max-w-sm space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-black uppercase text-green-500">Crear y Agregar Nuevo Socio</h4>
              <button type="button" onClick={() => setIsNewMemberOpen(false)} className="text-gray-400 hover:text-white"><X size={16}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Nombre Completo" required className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none" value={newMemberData.name} onChange={e=>setNewMemberData({...newMemberData, name: e.target.value})} />
              <input type="text" placeholder="DNI" required className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none" value={newMemberData.dni} onChange={e=>setNewMemberData({...newMemberData, dni: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="WhatsApp / Celular" className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none" value={newMemberData.phone} onChange={e=>setNewMemberData({...newMemberData, phone: e.target.value})} />
              <input type="email" placeholder="Correo" className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none" value={newMemberData.email} onChange={e=>setNewMemberData({...newMemberData, email: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Membresía</label>
              <select className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none" value={newMemberData.membership_type} onChange={e=>setNewMemberData({...newMemberData, membership_type: e.target.value})}>
                <option value="Basic">Basic (3 días)</option>
                <option value="Premium">Premium (5 días)</option>
                <option value="Elite">Elite (7 días)</option>
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setIsNewMemberOpen(false)} className="flex-1 py-3 text-[9px] font-black uppercase text-gray-400">Cancelar</button>
              <button type="submit" className="flex-1 py-3 bg-green-500 text-white rounded-xl text-[9px] font-black uppercase">Crear y Sumar</button>
            </div>
          </form>
        </div>
      )}

      
      {/* Custom confirm modal overlay in AgendaModule */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/75 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xs bg-white dark:bg-[#1b2435] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden text-black dark:text-white">
            {/* Top orange glow tint */}
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-[#F38E26]/20 rounded-full blur-2xl pointer-events-none" />
            
            {/* Icon */}
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-4 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-bounce">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>

            {/* Content */}
            <h4 className="text-base font-black text-center uppercase tracking-tight mb-2">{confirmModal.title}</h4>
            <p className="text-[10px] text-gray-500 dark:text-white/60 text-center leading-relaxed mb-6 font-bold">{confirmModal.message}</p>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 border border-gray-200 dark:border-white/10 dark:hover:bg-white/10 active:scale-95 rounded-xl text-[9px] font-black uppercase transition-all">
                Cerrar
              </button>
              <button 
                onClick={confirmModal.onConfirm} 
                className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase text-white shadow-lg active:scale-95 transition-all bg-red-500 hover:bg-red-600 shadow-red-500/25">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



export default function AdminDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('gym_session'));
  const [userRole, setUserRole] = useState<'gerente' | 'administracion' | 'entrenador'>(() => (localStorage.getItem('gym_role') as any) || 'gerente');
  const [loggedUser, setLoggedUser] = useState<any>(() => { try { const s = localStorage.getItem('gym_user'); return s ? JSON.parse(s) : null; } catch { return null; } });
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [activeTab, setActiveTab] = useState('Socios');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'dia' | 'semana' | 'mes'>('mes');

  const [members, setMembers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [financeData, setFinanceData] = useState<any>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'member' | 'staff' | 'workout' | 'plan' | 'history'>('member');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [memberCheckins, setMemberCheckins] = useState<any[]>([]);
  const [checkinStats, setCheckinStats] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [systemAnnouncement, setSystemAnnouncement] = useState<any>(null);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<{ status: string; last_paid_month?: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  const viewTermsPDF = async () => {
    const doc = new jsPDF();
    
    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
    });

    try {
      // Load Images
      const [watermarkImg, logoImg] = await Promise.all([
        loadImage("/bunker.png"),
        loadImage("/bunker.png")
      ]);

      // Background Watermark (Favicon)
      const gState = new (doc as any).GState({ opacity: 0.05 });
      doc.setGState(gState);
      doc.addImage(watermarkImg, 'PNG', 40, 80, 130, 130);
      
      // Restore Opacity for Header
      doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
      doc.addImage(logoImg, 'PNG', 10, 10, 30, 30);
    } catch (e) {
      console.warn("No se pudieron cargar las imágenes para el PDF", e);
    }

    // Header & Title
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("TÉRMINOS Y CONDICIONES DE USO", 50, 22);
    doc.setFontSize(11); doc.text("GYM Manager — Atlascore IT Services S.A.S.", 50, 30);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("Versión: 2.0", 160, 15); doc.text("Fecha: 01/05/2026", 160, 20);
    doc.line(10, 38, 200, 38);

    // Content
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    const terms = [
      { t: "1. Partes del Acuerdo", c: "El presente documento regula la relación contractual entre Atlascore IT Services S.A.S. (en adelante \"el Proveedor\") y la persona física o jurídica que contrata el acceso al software GYM Manager (en adelante \"el Cliente\"). La aceptación de estos términos —mediante registro, pago o uso efectivo del sistema— implica conformidad plena con las condiciones aquí establecidas." },
      { t: "2. Descripción del Servicio", c: "GYM Manager es un sistema de gestión de gimnasios provisto bajo modalidad SaaS (Software as a Service), que incluye:\n- Gestión de socios: altas, bajas, modificaciones y estado de membresía.\n- Control de acceso: registro de ingresos y egresos vinculados al estado de pago del abono.\n- Gestión de pagos y abonos: facturación, vencimientos, alertas de mora.\n- Panel administrativo: reportes, estadísticas y configuración del establecimiento.\nEl alcance exacto de funcionalidades disponibles depende del plan contratado." },
      { t: "3. Modalidad de Licencia", c: "3.1 Tipo de licencia: El acceso al software se otorga mediante licencia de uso mensual, no exclusiva, intransferible y revocable. El Cliente no adquiere derechos de propiedad sobre el software, su código fuente, base de datos estructural ni ningún componente del sistema.\n3.2 Vigencia: La licencia se activa a partir del primer pago y se renueva automáticamente cada mes calendario, salvo notificación de baja con al menos 5 días hábiles de anticipación.\n3.3 Restricciones: Queda expresamente prohibido sublicenciar, vender o ceder el acceso; realizar ingeniería inversa; usar el sistema para fines distintos a la gestión interna del establecimiento." },
      { t: "4. Precio y Condiciones de Pago", c: "El precio de la licencia mensual será el vigente al momento de la contratación y podrá ser actualizado con un preaviso mínimo de 30 días corridos. El pago deberá realizarse dentro de los primeros 5 días de cada mes. El incumplimiento habilitará al Proveedor a suspender el acceso sin previo aviso adicional, sin perjuicio del cobro del período adeudado." },
      { t: "5. Datos Personales de Socios", c: "5.1 El Cliente actúa como responsable del tratamiento de los datos personales de sus socios. Atlascore actúa como encargado del tratamiento, limitándose a almacenar y procesar dichos datos para prestar el servicio.\n5.2 El sistema puede almacenar: nombre y apellido, DNI/CUIT, fecha de nacimiento, datos de contacto, historial de pagos, estado de membresía y registros de acceso.\n5.3 El Cliente garantiza que cuenta con el consentimiento de sus socios y que cumple con la Ley N° 25.326 de Protección de Datos Personales.\n5.4 Atlascore se compromete a no comercializar ni divulgar los datos personales de los socios del Cliente a terceros, excepto requerimiento judicial." },
      { t: "6. Control de Acceso", c: "El módulo de control de acceso opera en función del estado de pago de cada socio. El Proveedor no garantiza la infalibilidad del sistema ante fallas de conectividad, cortes de energía, errores de hardware del Cliente u otras circunstancias ajenas a su control. El Cliente es el único responsable de la operación y mantenimiento de los dispositivos de acceso." },
      { t: "7. Disponibilidad y Soporte", c: "El Proveedor se compromete a mantener el servicio disponible con un nivel de uptime objetivo del 99% mensual, excluidos mantenimientos programados notificados con al menos 24 horas de anticipación. Las interrupciones no imputables al Proveedor no generan derecho a compensación. El soporte técnico se prestará por los canales y horarios informados oportunamente." },
      { t: "8. Propiedad Intelectual", c: "Todos los derechos de propiedad intelectual sobre GYM Manager —incluyendo software, diseño, bases de datos estructurales, documentación y marca— son de titularidad exclusiva de Atlascore IT Services S.A.S.. Ninguna disposición de este acuerdo transfiere al Cliente derechos de propiedad intelectual." },
      { t: "9. Limitación de Responsabilidad", c: "En ningún caso Atlascore IT Services S.A.S. será responsable por daños indirectos, lucro cesante, pérdida de datos, interrupción del negocio u otros daños consecuentes. La responsabilidad máxima del Proveedor frente al Cliente se limita al valor del último mes de licencia abonado." },
      { t: "10. Suspensión y Rescisión", c: "El Proveedor podrá suspender o rescindir el acceso por: falta de pago por más de 5 días hábiles, uso en violación de los presentes términos, o instrucción judicial. El Cliente podrá rescindir notificando con al menos 5 días hábiles de anticipación. No se realizarán reembolsos de períodos parciales." },
      { t: "11. Modificaciones a los Términos", c: "Atlascore se reserva el derecho de modificar estos términos. Los cambios serán notificados por correo electrónico o mediante aviso dentro del sistema con un mínimo de 15 días corridos de anticipación. El uso continuado del servicio tras dicho plazo implicará aceptación de los nuevos términos." },
      { t: "12. Jurisdicción y Ley Aplicable", c: "Este acuerdo se rige por las leyes de la República Argentina. Ante cualquier controversia, las partes se someten a la jurisdicción de los Tribunales Ordinarios de la Ciudad de Córdoba, renunciando expresamente a cualquier otro fuero que pudiera corresponder." }
    ];

    let y = 46;
    terms.forEach(item => {
      if (y > 265) { doc.addPage(); y = 15; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(item.t, 15, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      const lines = doc.splitTextToSize(item.c, 180);
      doc.text(lines, 15, y); y += (lines.length * 4.5) + 4;
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.line(10, 275, 200, 275);
      doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(150);
      doc.text("© 2026 Atlascore IT Services S.A.S. — Todos los derechos reservados", 105, 281, { align: "center" });
      doc.text(`Página ${i} de ${pageCount}`, 105, 286, { align: "center" });
      doc.setTextColor(0);
    }

    // Set Metadata for specific filename on download
    doc.setProperties({
      title: "BunkerGYM_Terminos_Y_Condiciones",
      subject: "Términos y Condiciones de Uso",
      author: "BUNKER GYM"
    });

    // Open in new tab using Blob URL
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.document.title = "BUNKER GYM - Términos y Condiciones";
  };

  useEffect(() => { if (isAuthenticated) refreshData(); }, [isAuthenticated, startDate, endDate]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const API_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? "http://localhost:8000" 
    : "/api";

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setError(null);
    
    if (!acceptedTerms) {
      setError("Debe aceptar los Términos y Condiciones de uso para ingresar.");
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUser.trim(),
          password: loginPass
        })
      });

      if (res.ok) {
        const staffMember = await res.json();
        const role = (staffMember.role || '').toLowerCase() === 'administración' ? 'administracion' : (staffMember.role || '').toLowerCase();
        localStorage.setItem('gym_session', '1'); 
        localStorage.setItem('gym_role', role); 
        localStorage.setItem('gym_user', JSON.stringify(staffMember));
        setIsAuthenticated(true);
        setLoggedUser(staffMember);
        setUserRole(role as any);
        if (role === 'entrenador') setActiveTab('Socios');
        else setActiveTab('Resumen');
        return;
      }
      
      const data = await res.json().catch(() => ({}));
      setError(data.detail || "Credenciales incorrectas. Verifique usuario y contraseña.");
    } catch (err) {
      setError("Error de conexión al verificar credenciales.");
    }
  };

  const fetchLicenseStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/configs/license_status`);
      if (res.ok) {
        const data = await res.json();
        const value = data.value || {};
        
        let calculatedStatus = 'DEUDA';
        if (value.last_paid_month) {
           const paidDate = new Date(value.last_paid_month);
           const now = new Date();
           if (paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear()) {
             calculatedStatus = 'AL DIA';
           } else {
             const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
             if (paidDate.getMonth() === lastMonth.getMonth() && paidDate.getFullYear() === lastMonth.getFullYear()) {
               if (now.getDate() <= 10) calculatedStatus = 'POR VENCER';
               else calculatedStatus = 'DEUDA';
             } else {
               calculatedStatus = 'DEUDA';
             }
           }
        }
        setLicenseInfo({ ...value, status: calculatedStatus });
      }
    } catch (err) {
      console.error("Error fetching license status:", err);
    }
  };

  useEffect(() => {
    fetchLicenseStatus();
      // Fetch announcement
      fetch(`${API_URL}/admin/configs/system_announcement`).then(async (annRes) => {
        if (annRes.ok) {
          const annData = await annRes.json();
          setSystemAnnouncement(annData.value);
        }
      });

  }, []);

  const renderLicenseBanner = (size: 'login' | 'sidebar' | 'header') => {
    if (!licenseInfo) return null;
    const { status } = licenseInfo;

    let bgClass = "bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700/60 text-red-700 dark:text-red-400";
    let badgeClass = "text-red-600 dark:text-red-300 font-bold";
    let Icon = XCircle;

    if (status === 'AL DIA' || status === 'AL DÍA' || status === 'ACTIVO') {
      bgClass = "bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-700/60 text-green-700 dark:text-green-400";
      badgeClass = "text-green-600 dark:text-green-300 font-bold";
      Icon = CheckCircle;
    } else if (status === 'POR VENCER') {
      bgClass = "bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400";
      badgeClass = "text-amber-600 dark:text-amber-300 font-bold";
      Icon = AlertTriangle;
    } else if (status === 'DEUDA' || status === 'VENCIDA') {
      bgClass = "bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700/60 text-red-700 dark:text-red-400";
      badgeClass = "text-red-600 dark:text-red-300 font-bold";
      Icon = XCircle;
    }

    const isMaster = loggedUser?.id === 0 || loggedUser?.username?.toLowerCase() === 'master';

    const handleRenew = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showConfirm(
        "Confirmar Renovación",
        "¿Desea marcar la licencia como AL DIA para el mes en curso?",
        async () => {
          try {
            const currentHistory = Array.isArray((licenseInfo as any)?.history) ? (licenseInfo as any).history : [];
            const newHistory = [{ date: new Date().toISOString(), user: loggedUser?.name || 'Master' }, ...currentHistory].slice(0, 50);
            const newStatus = { status: 'AL DIA', last_paid_month: new Date().toISOString(), history: newHistory };

            const res = await fetch(`${API_URL}/admin/configs/license_status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: newStatus })
            });
            if (res.ok) {
              setLicenseInfo(newStatus as any);
              refreshData();
            } else {
              alert("Error al renovar la licencia");
            }
          } catch (err) {
            console.error("Error updating license status:", err);
          }
        }
      );
    };

    if (size === 'login') {
      return (
        <div className={`flex items-start gap-2 p-3 border rounded-xl animate-in fade-in duration-500 ${bgClass}`}>
          <Icon size={14} className="flex-shrink-0 mt-0.5" />
          <p className="text-[8px] font-black uppercase leading-relaxed">
            Suscripción de Licencia en Atlascore <span className={badgeClass}>{status}</span>
          </p>
        </div>
      );
    }

    if (size === 'sidebar') {
      return (
        <div className={`flex flex-col gap-1.5 p-2 border rounded-xl mt-1 ${bgClass}`}>
          <div className="flex items-start gap-1.5">
            <Icon size={10} className="flex-shrink-0 mt-0.5" />
            <p className="text-[7px] font-black uppercase leading-snug">
              Licencia en Atlascore <span className={badgeClass}>{status}</span>
            </p>
          </div>
          {isMaster && status !== 'AL DIA' && (
            <button
              onClick={handleRenew}
              className="mt-1 w-full py-1 bg-orange-500 hover:bg-orange-600 text-black dark:text-white font-black text-[7px] uppercase tracking-wider rounded transition-colors"
            >
              Marcar AL DIA
            </button>
          )}
        </div>
      );
    }

    // header banner
    return (
      <div className={`flex items-center justify-between gap-2 px-3 py-2 border rounded-xl flex-1 max-w-xs animate-in fade-in duration-700 ${bgClass}`}>
        <div className="flex items-center gap-2">
          <Icon size={12} className="flex-shrink-0" />
          <p className="text-[7px] font-black uppercase leading-snug">
            Suscripción de Licencia en Atlascore <span className={badgeClass}>{status}</span>
          </p>
        </div>
        {isMaster && status !== 'AL DIA' && (
          <button
            onClick={handleRenew}
            className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 text-black dark:text-white font-black text-[7px] uppercase tracking-wider rounded transition-colors whitespace-nowrap"
          >
            Marcar AL DIA
          </button>
        )}
      </div>
    );
  };

  const refreshData = async () => {
    try {
      setError(null);
      fetchLicenseStatus();
      // Fetch announcement
      fetch(`${API_URL}/admin/configs/system_announcement`).then(async (annRes) => {
        if (annRes.ok) {
          const annData = await annRes.json();
          setSystemAnnouncement(annData.value);
          if (annData.value?.active) {
            setIsAnnouncementModalOpen(true);
          }
        }
      });

      // 1. Fetch Members + Plans
      const [membersRes, plansRes] = await Promise.all([
        fetch(`${API_URL}/admin/members`),
        fetch(`${API_URL}/admin/plans`)
      ]);
      if (!membersRes.ok) throw new Error(`Error ${membersRes.status}: No se pudo obtener la lista de socios`);
      const membersData = await membersRes.json();
      const updatedMembers = membersData;
      setMembers(updatedMembers);
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.map((p: any) => ({ ...p, daysPerWeek: p.days_per_week })));
      }

      // 2. Fetch Stats
      const statsRes = await fetch(`${API_URL}/admin/stats`);
      if (!statsRes.ok) throw new Error("No se pudo conectar con el servidor (Estadísticas)");
      const stats = await statsRes.json();
      
      // Calculate real revenue from all members' history
      const allHistory = membersData.flatMap((m:any) => (m.billing_history || []).map((h:any) => ({ ...h, member_id: m.id, member_name: m.name })));
      const totalRevenue = allHistory.reduce((acc:number, curr:any) => acc + curr.amount, 0);

      // Group history by month for cashflow
      const monthlyData: { [key: string]: number } = {};
      allHistory.forEach((h: any) => {
        const month = h.date.split('-').slice(0, 2).join('-'); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + h.amount;
      });

      const cashflow = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({
          month: new Date(month + '-01').toLocaleString('es-ES', { month: 'short' }),
          ingresos: amount,
          egresos: amount * 0.3 // Real estimate or mock egresos for now
        }))
        .slice(-4);

      setFinanceData((prev: any) => ({
        ...prev,
        all_history: allHistory,
        total_revenue: totalRevenue,
        active_members: stats.active_members,
        churn_risk: stats.churn_risk_count,
        por_vencer: stats.por_vencer_count,
        total_expenses: totalRevenue * 0.3, // Real estimate or derived from egresos
        cashflow_data: cashflow.length > 0 ? cashflow : [
          { month: "Ene", ingresos: 0, egresos: 0 },
          { month: "Feb", ingresos: 0, egresos: 0 },
          { month: "Mar", ingresos: 0, egresos: 0 },
          { month: "Abr", ingresos: totalRevenue, egresos: totalRevenue * 0.3 }
        ],
        revenue_breakdown: [
          { name: "Musculación", value: (membersData.filter((m: any) => !m.membership_type || m.membership_type.includes("Básico")).length * 5000) || 0 },
          { name: "Premium", value: (membersData.filter((m: any) => m.membership_type?.includes("Premium")).length * 8500) || 0 },
          { name: "Elite", value: (membersData.filter((m: any) => m.membership_type?.includes("Elite")).length * 12000) || 0 }
        ],
        monthly_growth: stats.monthly_growth || [],
        arpu: membersData.length > 0 ? (totalRevenue / membersData.length).toFixed(0) : 0, 
        churn_rate: stats.active_members > 0 ? ((stats.churn_risk_count / stats.active_members) * 100).toFixed(1) : 0
      }));

      // Staff (Use real data from models if available)
      const staffRes = await fetch(`${API_URL}/admin/staff`); // Assuming this endpoint exists or I'll add it
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaff(staffData);
      } else if (staff.length === 0) {
        setStaff([{ id: 101, name: "Marcus Rossi", role: "Entrenador", status: "ACTIVO", shift: "Mañana" }]);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setError(error.message || "Error de conexión con la base de datos");
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('GYM ATLAS: REPORTE OFICIAL', 14, 22);
    doc.text('RESUMEN EJECUTIVO', 14, 45);
    autoTable(doc, { startY: 50, head: [['Métrica', 'Valor']], body: [['Ingresos', `$${financeData?.total_revenue || 0}`], ['Socios', members.length]] });
    doc.save(`Reporte_Atlas.pdf`);
  };

  const handleSavePlan = async () => {
    try {
      const classesRaw = selectedItem?.classesInput ?? (selectedItem?.classes || []).join(', ');
      const classesList = typeof classesRaw === 'string'
        ? classesRaw.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
        : (selectedItem?.classes || []);

      const payload = {
        name: selectedItem.name,
        price: Number(selectedItem.price) || 0,
        days_per_week: selectedItem.daysPerWeek ?? selectedItem.days_per_week ?? 3,
        classes: classesList,
        is_active: true,
        allow_unification: !!selectedItem.allow_unification,
        enable_custom_payment_methods: !!selectedItem.enable_custom_payment_methods,
        price_cash: selectedItem.enable_custom_payment_methods ? (selectedItem.price_cash !== '' && selectedItem.price_cash != null ? Number(selectedItem.price_cash) : Number(selectedItem.price) || 0) : null,
        price_transfer: selectedItem.enable_custom_payment_methods ? (selectedItem.price_transfer !== '' && selectedItem.price_transfer != null ? Number(selectedItem.price_transfer) : Number(selectedItem.price) || 0) : null,
      };
      const isEdit = !!selectedItem.id;
      if (isEdit) {
        const res = await fetch(`${API_URL}/admin/plans/${selectedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) refreshData(); else alert('Error al actualizar plan');
      } else {
        const res = await fetch(`${API_URL}/admin/plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) refreshData(); else alert('Error al crear plan');
      }
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };
  const handleSaveMember = async (formData: any = selectedItem) => {
    try {
      const payload = { ...formData };
      if (typeof payload.dni === 'string') {
        payload.dni = payload.dni.trim() || null;
      } else if (!payload.dni) {
        payload.dni = null;
      }

      if (typeof payload.email === 'string') {
        payload.email = payload.email.trim() || null;
      } else if (!payload.email) {
        payload.email = null;
      }

      if (typeof payload.phone === 'string') {
        payload.phone = payload.phone.trim() || null;
      } else if (!payload.phone) {
        payload.phone = null;
      }

      if (isEditMode) {
        if (!payload.password || payload.password.trim() === '' || payload.password.startsWith('pbkdf2:')) {
          delete payload.password;
        }
        const res = await fetch(`${API_URL}/admin/members/${formData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          refreshData();
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.detail || "Error al actualizar socio");
          return;
        }
      } else {
        const res = await fetch(`${API_URL}/admin/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            password: payload.password?.trim() || '123',
            photo_url: payload.photo_url || (payload.dni ? `https://i.pravatar.cc/300?u=${payload.dni}` : `https://i.pravatar.cc/300?u=${encodeURIComponent(payload.name || 'member')}`)
          })
        });
        if (res.ok) {
          refreshData();
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.detail || "Error al crear socio. Verifique los datos ingresados.");
          return;
        }
      }
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };

  const handleSaveStaff = async () => {
    try {
      const payload = { ...selectedItem };
      if (isEditMode) {
        if (!payload.password || payload.password.trim() === '' || payload.password.startsWith('pbkdf2:')) {
          delete payload.password;
        }
        const res = await fetch(`${API_URL}/admin/staff/${selectedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) refreshData();
        else alert("Error al actualizar staff");
      } else {
        const res = await fetch(`${API_URL}/admin/staff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            password: payload.password?.trim() || '1234'
          })
        });
        if (res.ok) refreshData();
        else alert("Error al crear staff");
      }
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };

  const handlePayment = async (
    amount: number,
    method: string,
    billingDate?: string,
    nextDueDate?: string,
    keepBillingDay?: boolean,
    fixedBillingDay?: number
  ) => {
    try {
      const staffName = loggedUser?.name || 'Administración';
      const processedBy = encodeURIComponent(staffName);
      const bDateParam = billingDate ? `&billing_date=${encodeURIComponent(billingDate)}` : '';
      const nextDueParam = nextDueDate ? `&next_due_date=${encodeURIComponent(nextDueDate)}` : '';
      const keepParam = `&keep_billing_day=${keepBillingDay ? 'true' : 'false'}`;
      const fixedParam = fixedBillingDay ? `&fixed_billing_day=${fixedBillingDay}` : '';

      const res = await fetch(`${API_URL}/admin/payments?member_id=${selectedItem.id}&amount=${amount}&method=${method}&processed_by=${processedBy}${bDateParam}${nextDueParam}${keepParam}${fixedParam}`, {
        method: 'POST'
      });
      if (res.ok) {
        const pdfBase64 = await generatePaymentPDF(selectedItem, amount, method, staffName, billingDate, nextDueDate);
        setIsPaymentModalOpen(false);
        refreshData();

        // Enviar comprobante automáticamente por Correo (con PDF adjunto y diseño institucional) y WhatsApp en segundo plano
        const contractedPlansStr = [selectedItem.membership_type || 'Musculación', ...(selectedItem.additional_plans || [])].join(' + ');
        fetch(`${API_URL}/admin/members/${selectedItem.id}/send_payment_receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amount,
            method: method,
            staff_name: staffName,
            plan: contractedPlansStr,
            date: (billingDate ? new Date(billingDate + 'T00:00:00').toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')) + ' ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            pdf_base64: pdfBase64 || ''
          })
        }).catch(err => console.warn('[AUTO-RECEIPT] Error enviando comprobante en segundo plano:', err));
      }
    } catch (e) { console.error(e); }
  };

  const generatePaymentPDF = async (member: any, amount: number, method: string, staffName: string, customDate?: string, nextDueDate?: string): Promise<string> => {
    const doc = new jsPDF({ compress: true });

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
      // Dibujar marca de agua centrada
      doc.addImage(bgImg, 'PNG', 45, 80, 120, 120, undefined, 'FAST');
      // Restaurar opacidad
      doc.setGState(new (doc as any).GState({opacity: 1.0}));
    } catch (e) {
      console.warn('No se pudo cargar la marca de agua', e);
    }

    doc.setFontSize(22);
    doc.setTextColor(249, 115, 22);
    doc.text('BUNKER GYM', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('COMPROBANTE DE PAGO', 105, 30, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Fecha: ${customDate || new Date().toLocaleDateString('es-AR') + ' ' + new Date().toLocaleTimeString('es-AR')}`, 14, 45);

    const contractedPlansStr = [member.membership_type || 'Musculación', ...(member.additional_plans || [])].join(' + ');

    autoTable(doc, {
      startY: 55,
      head: [['Detalle', 'Información']],
      body: [
        ['Nombre Completo', member.name || '-'],
        ['DNI', member.dni || '-'],
        ['Correo Electrónico', member.email || '-'],
        ['Número de Teléfono', member.phone || '-'],
        ['Planes Contratados', contractedPlansStr],
        ['Monto Total Abonado', `$${amount.toLocaleString()}`],
        ['Medio de Pago Utilizado', method || '-'],
        ['Usuario del Sistema', staffName || '-'],
        ...(nextDueDate ? [['Próximo Vencimiento', new Date(nextDueDate.includes('T') ? nextDueDate : `${nextDueDate}T00:00:00`).toLocaleDateString('es-AR')]] : [])
      ],
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] },
    });

    // Sello diagonal "PAGADO" centrado en la tabla
    const tableEndY = (doc as any).lastAutoTable.finalY || 136;
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
    doc.text('Sello Institucional - Bunker Gym', 105, finalY + 26, { align: 'center' });

    try {
      const logo = await loadImage('/bunker.png');
      doc.addImage(logo, 'PNG', 85, finalY + 35, 40, 40, undefined, 'FAST');
    } catch (e) {
      console.warn('No se pudo cargar el logo final', e);
    }

    // Texto de validez sutil al pie
    doc.setFontSize(7);
    doc.setTextColor(190, 190, 190);
    doc.text('ESTE COMPROBANTE ES VÁLIDO COMO CONSTANCIA DE PAGO', 105, finalY + 82, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.save(`Comprobante_Pago_${member.name.replace(/\\s+/g, '_')}.pdf`);

    try {
      const dataUri = doc.output('datauristring');
      return dataUri.split(',')[1] || '';
    } catch (e) {
      console.warn('No se pudo obtener base64 del PDF comprobante', e);
      return '';
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Socios': return <MembersModule 
        API_URL={API_URL} 
        members={members} 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        onHistory={(m:any)=>{ 
          setSelectedItem(m); 
          setMemberCheckins([]); 
          setCheckinStats(null); 
          setModalType('history'); 
          setIsModalOpen(true); 
          fetch(`${API_URL}/admin/members/${m.id}/checkins`).then(r=>r.json()).then(data=>{ 
            const checkinsList = Array.isArray(data) ? data : (data.checkins || []); 
            setMemberCheckins(checkinsList); 
            setCheckinStats({ total: data.total_sessions || 0, used: data.sessions_used || 0, remaining: data.sessions_remaining || 0, plans_breakdown: data.plans_breakdown || null }); 
          }).catch(()=>{}); 
        }} 
        onEdit={(m: any) => { 
          const validPlan = plans.find((p:any) => p.name === m.membership_type)?.name || plans[0]?.name || ''; 
          setSelectedItem({...m, membership_type: validPlan}); 
          setIsEditMode(true); 
          setModalType('member'); 
          setIsModalOpen(true); 
        }} 
        onDelete={(m: any) => { 
          showConfirm(
            "¿Dar de baja socio?", 
            `¿Estás seguro de que deseas dar de baja a ${m.name}? Su estado pasará a INACTIVO sin borrar sus datos ni su historial.`, 
            async () => { 
              const res = await fetch(`${API_URL}/admin/members/${m.id}`, { method: 'DELETE' }); 
              if (res.ok) refreshData(); 
            }
          ); 
        }} 
        onReactivate={(m: any) => {
          showConfirm(
            "¿Reactivar socio?",
            `¿Deseas reactivar a ${m.name}? Su estado volverá a estar AL DÍA.`,
            async () => {
              const res = await fetch(`${API_URL}/admin/members/${m.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...m, status: 'ACTIVO' })
              });
              if (res.ok) refreshData();
            }
          );
        }}
        onPermanentDelete={(m: any) => {
          showConfirm(
            "¿Eliminar socio definitivamente?",
            `¿Estás seguro de que deseas eliminar permanentemente a ${m.name} de la base de datos? Esta acción borrará al socio y sus pagos.`,
            async () => {
              const res = await fetch(`${API_URL}/admin/members/${m.id}?permanent=true`, {
                method: 'DELETE'
              });
              if (res.ok) refreshData();
            }
          );
        }}
        onAddClick={() => { 
          setSelectedItem({name:'', dni:'', phone:'', email:'', password:'1234', status:'ACTIVO', membership_type: plans[0]?.name || ''}); 
          setIsEditMode(false); 
          setModalType('member'); 
          setIsModalOpen(true); 
        }} 
        onPayClick={(m: any) => { 
          setSelectedItem(m); 
          setIsPaymentModalOpen(true); 
        }} 
      />;
      case 'Planes': return <PlansModule plans={plans} onEdit={(p:any)=>{setSelectedItem({...p, allow_unification: !!p.allow_unification, enable_custom_payment_methods: !!p.enable_custom_payment_methods, price_cash: p.price_cash ?? p.price ?? 0, price_transfer: p.price_transfer ?? p.price ?? 0, classesInput: (p.classes || []).join(', ')}); setIsEditMode(true); setModalType('plan'); setIsModalOpen(true);}} onDelete={(p:any)=>{ showConfirm("¿Eliminar Plan?", `¿Estás seguro de que deseas eliminar el plan "${p.name}" del sistema?`, async () => { const res = await fetch(`${API_URL}/admin/plans/${p.id}`,{method:'DELETE'}); if(res.ok) refreshData(); }); }} onAddClick={()=>{setSelectedItem({name:'', price:0, daysPerWeek:3, classes:[], classesInput: '', allow_unification: false, enable_custom_payment_methods: false, price_cash: '', price_transfer: ''}); setIsEditMode(false); setModalType('plan'); setIsModalOpen(true);}} />;
      case 'Entrenamientos': return <EntrenamientosModule API_URL={API_URL} />;
      case 'Agenda': return <AgendaModule members={members} API_URL={API_URL} setConfirmModal={setConfirmModal} />;
      case 'Mi Perfil': return <ProfileModule user={loggedUser} onSave={async (newPassword: string) => {
        if (!newPassword) { alert('Ingresá una nueva contraseña'); return; }
        if (loggedUser.id === 0 || loggedUser.username?.toLowerCase() === 'master') { alert('La cuenta master no se puede modificar desde aquí'); return; }
        try {
          const payload = { name: loggedUser.name, username: loggedUser.username || loggedUser.name, role: loggedUser.role, shift: loggedUser.shift || 'Mañana', password: newPassword };
          const res = await fetch(`${API_URL}/admin/staff/${loggedUser.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (res.ok) { alert('Contraseña actualizada correctamente'); setLoggedUser({ ...loggedUser, password: newPassword }); }
          else { const err = await res.json().catch(() => ({})); alert(`Error al actualizar: ${err.detail || res.status}`); }
        } catch(e) { alert('Error de conexión al guardar la contraseña'); }
      }} />;
      case 'Staff': return (userRole === 'gerente' || userRole === 'administracion') ? <StaffModule staff={staff} onEdit={(s: any) => { setSelectedItem({...s, password: ''}); setShowStaffPassword(false); setIsEditMode(true); setModalType('staff'); setIsModalOpen(true); }} onDelete={(id: any) => { showConfirm("¿Eliminar empleado?", "¿Estás seguro de que deseas eliminar este empleado?", async () => { const res = await fetch(`${API_URL}/admin/staff/${id}`, {method:'DELETE'}); if(res.ok) refreshData(); }); }} onAddClick={() => { setSelectedItem({name:'', username:'', role:'Entrenador', shift:'Mañana', password:'1234'}); setShowStaffPassword(false); setIsEditMode(false); setModalType('staff'); setIsModalOpen(true); }} /> : <NoAccess />;
      case 'Sistema': return (loggedUser?.id === 0 || loggedUser?.username?.toLowerCase() === 'master') ? <SystemModule API_URL={API_URL} licenseInfo={licenseInfo} onRenewLicense={async () => {
        showConfirm("Confirmar Renovación", "¿Desea marcar la licencia como AL DIA para el mes en curso?", async () => {
          try {
            const currentHistory = Array.isArray((licenseInfo as any)?.history) ? (licenseInfo as any).history : [];
            const newHistory = [{ date: new Date().toISOString(), user: loggedUser?.name || 'Master' }, ...currentHistory].slice(0, 50); // Keep last 50
            const newStatus = { status: 'AL DIA', last_paid_month: new Date().toISOString(), history: newHistory };
            
            const res = await fetch(`${API_URL}/admin/configs/license_status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: newStatus })
            });
            if (res.ok) {
              setLicenseInfo(newStatus as any);
            } else {
              alert("Error al renovar la licencia");
            }
          } catch (err) {
            console.error("Error updating license status:", err);
          }
        });
      }} /> : null;
      case 'Finanzas': return userRole === 'gerente' ? <FinanceModule data={financeData} members={members} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} filterType={filterType} setFilterType={setFilterType} /> : <NoAccess />;
      case 'Facturación': return (userRole === 'gerente' || userRole === 'administracion') ? <BillingModule members={members} onDeletePayment={(id: number) => { showConfirm("¿Eliminar Cobro?", "¿Estás seguro de que deseas eliminar este registro de cobro?", async () => { const res = await fetch(`${API_URL}/admin/payments/${id}`, { method: 'DELETE' }); if (res.ok) refreshData(); else alert('Error al eliminar'); }); }} /> : <NoAccess />;
      default: return <SummaryModule members={members} financeData={financeData} userRole={userRole} setActiveTab={setActiveTab} />;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-[#050505] flex flex-col items-center justify-center p-4 overflow-hidden transition-colors duration-300">
        <div className="absolute top-4 right-4"><button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-black dark:text-white shadow-lg transition-all">{isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}</button></div>
        <div className="w-full max-w-[380px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-10 rounded-[40px] backdrop-blur-3xl shadow-2xl animate-in zoom-in duration-500">
          <div className="flex justify-center mb-8">
            <img src="/bunker.png" alt="Bunker Gym Logo" className="h-32 w-auto object-contain drop-shadow-xl" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
            <div className="hidden p-4 bg-orange-500 rounded-2xl shadow-xl shadow-orange-500/30"><ShieldCheck size={32} className="text-black dark:text-white" /></div>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[9px] font-black uppercase mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <XCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="Usuario" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl py-4 px-6 text-black dark:text-white outline-none focus:border-orange-500 transition-all text-center text-xs placeholder:text-gray-400 dark:placeholder:text-white/40" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} required />
            <input type="password" placeholder="Contraseña" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl py-4 px-6 text-black dark:text-white outline-none focus:border-orange-500 transition-all text-center text-xs placeholder:text-gray-400 dark:placeholder:text-white/40" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required />
            
            <div className="flex items-center gap-2 px-2 py-1">
              <input type="checkbox" id="terms" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="w-3 h-3 accent-orange-500 cursor-pointer" />
              <label htmlFor="terms" className="text-[9px] text-gray-500 dark:text-white/40 font-black uppercase cursor-pointer select-none">
                Acepto los <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); viewTermsPDF(); }} className="text-cyan-400 underline decoration-cyan-400 underline-offset-2 hover:text-cyan-300 transition-colors font-black">Términos y Condiciones — Atlascore IT Services S.A.S.</span>
              </label>
            </div>

            {/* License expired notice on login */}
            {renderLicenseBanner('login')}

            <button type="submit" className="w-full py-4 bg-orange-500 rounded-2xl font-black text-black dark:text-white text-xs uppercase tracking-widest transition-all hover:bg-orange-600 shadow-xl shadow-orange-500/20">Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 dark:bg-[#050505] text-black dark:text-[#e0e0e0] font-sans flex overflow-hidden text-[9px] transition-colors duration-300">
      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-6 rounded-[32px] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-orange-500">
                {confirmModal.title || "Confirmación"}
              </h3>
            </div>
            <p className="text-[10px] text-gray-600 dark:text-gray-300 font-bold uppercase leading-relaxed mb-6">
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 text-gray-500 dark:text-white/40 font-black uppercase text-[9px] hover:text-black dark:hover:text-white transition-colors"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancelar
              </button>
              <button
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-black dark:text-white rounded-xl font-black uppercase text-[9px] tracking-wider shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portaled Modals (Centered in Viewport) */}
      {isModalOpen && modalType === 'member' && (
        <MemberModal 
          member={selectedItem} 
          plans={plans} 
          API_URL={API_URL} 
          onSave={handleSaveMember} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}

      {((isModalOpen && modalType !== 'member') || isPaymentModalOpen) && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-10 bg-black/50 dark:bg-black/90 backdrop-blur-md overflow-y-auto">
          {isModalOpen && modalType !== 'member' && (
            <div className={`bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-8 rounded-[40px] w-full ${modalType === 'workout' || modalType === 'history' ? 'max-w-4xl' : 'max-w-md'} shadow-2xl animate-in zoom-in duration-300`}>
              <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-black uppercase tracking-widest text-orange-500">{modalType}</h2><button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400 hover:text-black dark:text-white/20 dark:hover:text-white transition-colors"/></button></div>
              <div className="space-y-3">
                {modalType === 'history' && (
                  <div className="space-y-4">
                     <h3 className="text-xs font-black uppercase text-gray-600 dark:text-white/40">Historial: {selectedItem.name}</h3>
                     <div className="grid grid-cols-2 gap-4">
                       {/* Pagos */}
                       <div>
                         <p className="text-[8px] font-black uppercase text-orange-500 mb-2 tracking-widest">Pagos y Planes</p>
                         <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
                           {selectedItem.billing_history?.length > 0 ? selectedItem.billing_history.map((h:any, i:number)=>(
                             <div key={i} className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/5 p-3 rounded-xl flex justify-between items-center">
                               <div><p className="font-black text-black dark:text-white uppercase text-[9px]">{h.plan}</p><p className="text-[7px] text-gray-500 dark:text-white/20 font-black">{h.date} · {h.method}</p></div>
                               <div className="flex items-center gap-2">
                                   <p className="text-sm font-black text-green-500">${h.amount?.toLocaleString()}</p>
                                   <button onClick={() => generatePaymentPDF({ ...selectedItem, membership_type: h.plan, additional_plans: [] }, h.amount, h.method, 'Historial', h.date)} className="p-1.5 bg-orange-500/20 hover:bg-orange-500 text-orange-500 hover:text-white rounded-lg transition-colors" title="Descargar Recibo">
                                     <Download size={12}/>
                                   </button>
                                 </div>
                               </div>
                           )) : <p className="text-center text-gray-400 dark:text-white/10 uppercase font-black py-8 text-[8px]">Sin cobros</p>}
                         </div>
                       </div>
                       {/* Asistencia */}
                       <div>
                         <p className="text-[8px] font-black uppercase text-blue-400 mb-2 tracking-widest">Asistencia · {memberCheckins.length} ingresos registrados</p>
                         {checkinStats?.plans_breakdown ? (
                           <div className="space-y-2 mb-3">
                             {checkinStats.plans_breakdown.filter((pb: any) => pb.type.toLowerCase() !== 'adicional').map((pb: any, idx: number) => (
                               <div key={idx} className="bg-gray-50 dark:bg-black/40 p-2.5 rounded-xl border border-gray-200 dark:border-white/5">
                                 <div className="flex justify-between items-center mb-1.5">
                                   <span className="text-[9px] font-black uppercase text-orange-500">{pb.name} ({pb.type})</span>
                                 </div>
                                 <div className="flex gap-2 text-center">
                                   <div className="flex-1 bg-white/5 rounded-lg p-1">
                                     <p className="text-[10px] font-black text-black dark:text-white">{pb.total}</p>
                                     <p className="text-[6px] text-gray-400 dark:text-white/30 uppercase font-black">Permitidas</p>
                                   </div>
                                   <div className="flex-1 bg-white/5 rounded-lg p-1">
                                     <p className="text-[10px] font-black text-orange-400">{pb.used}</p>
                                     <p className="text-[6px] text-gray-400 dark:text-white/30 uppercase font-black">Utilizadas</p>
                                   </div>
                                   <div className="flex-1 bg-white/5 rounded-lg p-1">
                                     <p className="text-[10px] font-black text-blue-400">{pb.remaining}</p>
                                     <p className="text-[6px] text-gray-400 dark:text-white/30 uppercase font-black">Restantes</p>
                                   </div>
                                 </div>
                               </div>
                             ))}
                           </div>
                         ) : checkinStats && (
                           <div className="flex gap-2 mb-2">{[{l:'Total',v:checkinStats.total,c:'text-white/40'},{l:'Usadas',v:checkinStats.used,c:'text-orange-400'},{l:'Restantes',v:checkinStats.remaining,c:'text-blue-400'}].map(s=><div key={s.l} className="flex-1 bg-black/20 rounded-lg p-1 text-center"><p className={`text-[10px] font-black ${s.c}`}>{s.v}</p><p className="text-[6px] text-white/20 uppercase font-black">{s.l}</p></div>)}</div>
                         )}
                         <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
                           {memberCheckins.length > 0 ? memberCheckins.map((c:any, i:number)=>(
                             <div key={i} className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/5 p-3 rounded-xl flex justify-between items-center">
                               <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 text-[8px] font-black">{memberCheckins.length - i}</div>
                                  {(() => { 
                                    const dt = new Date(c.checkin_at.replace(/\.\d+Z$/, 'Z')); 
                                    const fecha = dt.toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'2-digit'}); 
                                    const hora = dt.toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit',hour12:true}); 
                                    const titleStr = c.type ? `${fecha} ${c.type}` : fecha;
                                    return (
                                      <div>
                                        <p className="font-black text-black dark:text-white text-[9px]">{titleStr}</p>
                                        <p className="text-[7px] text-gray-500 dark:text-white/20 font-black">{hora}</p>
                                      </div>
                                    ); 
                                  })()}
                               </div>
                               <button
                                 onClick={async () => {
                                   if (confirm("¿Eliminar este ingreso del historial?")) {
                                     const res = await fetch(`${API_URL}/admin/checkins/${c.id}`, { method: 'DELETE' });
                                     if (res.ok) {
                                       const updatedCheckins = memberCheckins.filter((item: any) => item.id !== c.id);
                                       setMemberCheckins(updatedCheckins);
                                       if (checkinStats) {
                                         const newUsed = checkinStats.used - 1;
                                         const newRemaining = Math.max(0, checkinStats.total - newUsed);
                                         setCheckinStats({ ...checkinStats, used: newUsed, remaining: newRemaining });
                                       }
                                       refreshData();
                                     }
                                   }
                                 }}
                                 className="p-1 hover:bg-red-500/10 rounded text-red-500 transition-colors"
                               >
                                 <Trash2 size={12} />
                               </button>
                             </div>
                           )) : <p className="text-center text-gray-400 dark:text-white/10 uppercase font-black py-8 text-[8px]">Sin ingresos registrados</p>}
                         </div>
                       </div>
                     </div>
                  </div>
                )}
                {modalType === 'plan' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Plan (nombre)</label>
                      <input type="text" placeholder="Ej: Premium, Musculación..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.name || ''} onChange={e => setSelectedItem({...selectedItem, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Días (habilitados por semana)</label>
                      <input type="number" placeholder="Ej: 3, 5, 7..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.daysPerWeek ?? selectedItem?.days_per_week ?? 3} onChange={e => setSelectedItem({...selectedItem, daysPerWeek: parseInt(e.target.value) || 0, days_per_week: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Precio Mensual</label>
                      <input type="number" placeholder="Ej: 8500" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.price || 0} onChange={e => setSelectedItem({...selectedItem, price: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Clases Adicionales (separadas por coma)</label>
                      <input 
                        type="text" 
                        placeholder="Ej: Yoga, Zumba, Funcional..." 
                        className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" 
                        value={selectedItem?.classesInput ?? (selectedItem?.classes || []).join(', ')} 
                        onChange={e => setSelectedItem({...selectedItem, classesInput: e.target.value})} 
                      />
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10 mt-2">
                      <input 
                        type="checkbox" 
                        id="allow_unification"
                        checked={!!selectedItem?.allow_unification} 
                        onChange={e => setSelectedItem({...selectedItem, allow_unification: e.target.checked})}
                        className="w-4 h-4 text-orange-500 rounded accent-orange-500 cursor-pointer"
                      />
                      <label htmlFor="allow_unification" className="text-[10px] font-black uppercase text-black dark:text-white cursor-pointer select-none">
                        Permitir unificación con otros planes
                      </label>
                    </div>

                    {/* Diferenciación de precios por método de pago */}
                    <div className="pt-2 border-t border-gray-200 dark:border-white/10 space-y-3">
                      <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent rounded-2xl border border-orange-500/20">
                        <div className="space-y-0.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            <DollarSign size={13} className="text-orange-500" />
                            <p className="text-[10px] font-black uppercase text-orange-500">Diferenciar precios por método de pago</p>
                          </div>
                          <p className="text-[8px] text-gray-500 dark:text-white/40 leading-tight">
                            Habilita tarifas diferenciadas para cobros en Efectivo o Transferencia.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input 
                            type="checkbox" 
                            checked={!!selectedItem?.enable_custom_payment_methods} 
                            onChange={e => {
                              const checked = e.target.checked;
                              setSelectedItem({
                                ...selectedItem, 
                                enable_custom_payment_methods: checked,
                                price_cash: checked ? (selectedItem?.price_cash ?? selectedItem?.price ?? 0) : selectedItem?.price_cash,
                                price_transfer: checked ? (selectedItem?.price_transfer ?? selectedItem?.price ?? 0) : selectedItem?.price_transfer
                              });
                            }} 
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      {selectedItem?.enable_custom_payment_methods && (
                        <div className="p-4 bg-gray-50 dark:bg-black/30 rounded-2xl border border-orange-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          <p className="text-[9px] font-black uppercase text-orange-400 tracking-wider">
                            Montos según método de cobro:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1 bg-white dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/10">
                              <label className="text-[9px] text-emerald-500 uppercase font-black flex items-center gap-1.5">
                                <Banknote size={13} />
                                Cobro en Efectivo
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">$</span>
                                <input 
                                  type="number" 
                                  placeholder="Monto efectivo..."
                                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg py-2 pl-7 pr-3 text-black dark:text-white text-xs font-bold outline-none focus:border-emerald-500"
                                  value={selectedItem?.price_cash ?? ''} 
                                  onChange={e => setSelectedItem({ ...selectedItem, price_cash: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })} 
                                />
                              </div>
                            </div>

                            <div className="space-y-1 bg-white dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/10">
                              <label className="text-[9px] text-cyan-400 uppercase font-black flex items-center gap-1.5">
                                <Smartphone size={13} />
                                Cobro por Transferencia
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">$</span>
                                <input 
                                  type="number" 
                                  placeholder="Monto transferencia..."
                                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg py-2 pl-7 pr-3 text-black dark:text-white text-xs font-bold outline-none focus:border-cyan-400"
                                  value={selectedItem?.price_transfer ?? ''} 
                                  onChange={e => setSelectedItem({ ...selectedItem, price_transfer: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })} 
                                />
                              </div>
                            </div>
                          </div>
                          <p className="text-[8px] text-gray-400 dark:text-white/40 italic">
                            💡 Al cobrar la cuota a un socio, el monto sugerido se adaptará de acuerdo a si elegís Efectivo o Transferencia.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {modalType === 'staff' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Nombre Completo</label>
                      <input type="text" placeholder="Ej: Juan Pérez" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs" value={selectedItem?.name} onChange={e => setSelectedItem({...selectedItem, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Nombre de Usuario (Para logueo)</label>
                      <input type="text" placeholder="Ej: juan.perez" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs" value={selectedItem?.username || ''} onChange={e => setSelectedItem({...selectedItem, username: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Rol / Puesto</label>
                      <select className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs" value={selectedItem?.role} onChange={e => setSelectedItem({...selectedItem, role: e.target.value})}>
                        <option value="Entrenador">Entrenador</option><option value="Administración">Administración</option><option value="Gerente">Gerente</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Turno de Trabajo</label>
                      <select className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs" value={selectedItem?.shift} onChange={e => setSelectedItem({...selectedItem, shift: e.target.value})}>
                        <option value="Mañana">Mañana</option><option value="Tarde">Tarde</option><option value="Noche">Noche</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 mt-2">
                       <div className="flex items-center justify-between ml-2">
                         <label className="text-[8px] text-gray-500 dark:text-white/40 uppercase font-black flex items-center gap-1.5">
                           <Lock size={12} className="text-orange-500" />
                           Contraseña de Acceso
                         </label>
                         {isEditMode && (
                           <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                             Cifrada en BD
                           </span>
                         )}
                       </div>
                       <div className="relative flex items-center">
                         <input 
                           type={showStaffPassword ? "text" : "password"} 
                           placeholder={isEditMode ? "•••••••• (Dejar en blanco para mantener la actual)" : "Asignar contraseña (por defecto: 1234)"} 
                           className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 pr-12 text-black dark:text-white text-xs outline-none focus:border-orange-500 transition-all placeholder:text-gray-400 dark:placeholder:text-white/30" 
                           value={selectedItem?.password || ''} 
                           onChange={e => setSelectedItem({...selectedItem, password: e.target.value})} 
                         />
                         <button
                           type="button"
                           onClick={() => setShowStaffPassword(!showStaffPassword)}
                           className="absolute right-4 p-1 text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white transition-colors"
                           title={showStaffPassword ? "Ocultar contraseña" : "Ver contraseña"}
                         >
                           {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                         </button>
                       </div>
                       <p className="text-[8px] text-gray-400 dark:text-white/30 ml-2">
                         {isEditMode 
                           ? "La contraseña actual está protegida y cifrada en la base de datos. Escribe aquí solo si deseas cambiarla."
                           : "Se guardará cifrada de forma segura en la base de datos."}
                       </p>
                    </div>
                  </div>
                )}
              </div>
              {modalType !== 'history' && (
                <div className="flex gap-4 mt-8 border-t border-gray-200 dark:border-white/5 pt-6"><button className="flex-1 py-3 text-gray-600 dark:text-white/40 font-black uppercase text-[10px]" onClick={() => setIsModalOpen(false)}>Cancelar</button><button className="flex-1 py-3 bg-orange-500 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-orange-500/20" onClick={() => { if(modalType==='plan') handleSavePlan(); else if(modalType==='staff') handleSaveStaff(); }}>Guardar</button></div>
              )}
            </div>
          )}
          {isPaymentModalOpen && (
            <PaymentModal plans={plans} member={selectedItem} onPay={handlePayment} onClose={()=>setIsPaymentModalOpen(false)} />
          )}
        </div>
      )}

      <aside className="w-40 h-full border-r border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-black/40 backdrop-blur-3xl flex flex-col p-4 shrink-0">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex justify-center mb-4">
            <img src="/bunker.png" alt="Bunker Gym Logo" className="w-24 h-auto object-contain drop-shadow-md" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
            <div className="hidden w-16 h-16 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg"><Brain size={24} className="text-black dark:text-white" /></div>
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center justify-center gap-2 p-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-black dark:text-white shadow-sm transition-all hover:scale-[1.02]">
            {isDarkMode ? <Sun size={12}/> : <Moon size={12}/>}
            <span className="text-[9px] font-black uppercase tracking-widest">{isDarkMode ? 'Claro' : 'Oscuro'}</span>
          </button>

          {/* License expired banner — sidebar */}
          {renderLicenseBanner('sidebar')}
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar pr-1">
          <SidebarItem icon={<LayoutDashboard size={14} />} label="Resumen" active={activeTab === 'Resumen'} onClick={() => setActiveTab('Resumen')} />
          <SidebarItem icon={<User size={14} />} label="Mi Perfil" active={activeTab === 'Mi Perfil'} onClick={() => setActiveTab('Mi Perfil')} />
          <SidebarItem icon={<Users size={14} />} label="Socios" active={activeTab === 'Socios'} onClick={() => setActiveTab('Socios')} />
          <SidebarItem icon={<Settings size={14} />} label="Planes" active={activeTab === 'Planes'} onClick={() => setActiveTab('Planes')} />
          
          <SidebarItem icon={<img src="/ejercicio.png" alt="Ejercicios" className="w-4 h-4 opacity-50 dark:invert" />} label="Ejercicios" active={activeTab === 'Entrenamientos'} onClick={() => setActiveTab('Entrenamientos')} />
          <SidebarItem icon={<Calendar size={14} />} label="Agenda" active={activeTab === 'Agenda'} onClick={() => setActiveTab('Agenda')} />
          
          {(userRole === 'gerente' || userRole === 'administracion') && (
            <>
              <SidebarItem icon={<Receipt size={14} />} label="Facturación" active={activeTab === 'Facturación'} onClick={() => setActiveTab('Facturación')} />
              <SidebarItem icon={<Briefcase size={14} />} label="Personal" active={activeTab === 'Staff'} onClick={() => setActiveTab('Staff')} />
            </>
          )}

          {userRole === 'gerente' && (
            <>
              <div className="h-px bg-gray-200 dark:bg-white/5 my-4" />
              <SidebarItem icon={<DollarSign size={14} />} label="Finanzas" active={activeTab === 'Finanzas'} onClick={() => setActiveTab('Finanzas')} />
              {(loggedUser?.id === 0 || loggedUser?.username?.toLowerCase() === 'master') && (
                <SidebarItem icon={<Settings size={14} />} label="Sistema" active={activeTab === 'Sistema'} onClick={() => setActiveTab('Sistema')} />
              )}
            </>
          )}
        </nav>
        <button onClick={() => { localStorage.removeItem('gym_session'); localStorage.removeItem('gym_role'); localStorage.removeItem('gym_user'); setIsAuthenticated(false); setLoggedUser(null); }} className="w-full p-2 bg-red-500/10 hover:bg-red-500 rounded-xl text-red-500 hover:text-black dark:hover:text-white text-[9px] font-black uppercase tracking-widest transition-all mt-4">Salir</button>
        <div className="mt-4 text-center text-[7px] font-black uppercase tracking-wider text-gray-400 dark:text-white/20 select-none">
          BUNKER GYM OS<br/>Atlascore v3.0 &middot; 07/09/2026
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 relative bg-gray-100 dark:bg-[#050505]">
        <header className="flex items-center justify-between mb-8 max-w-full gap-4">
          <div className="min-w-0"><h2 className="text-xl font-black text-black dark:text-white tracking-tighter uppercase truncate">{activeTab}</h2><p className="text-[7px] text-gray-500 dark:text-white/20 uppercase font-black tracking-[0.3em]">BUNKER GYM</p></div>

          {/* License expired banner — header */}
          <div className="flex items-center gap-2">
            {renderLicenseBanner('header')}
            
            {systemAnnouncement?.active && (
              <button 
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
                title="Ver anuncio del sistema"
              >
                <Info size={12} /> Anuncio
              </button>
            )}
          </div>

          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 font-black text-[8px] uppercase tracking-widest hover:scale-105 transition-all whitespace-nowrap"><Download size={14}/> Reporte Global</button>
        </header>
        <div className="max-w-full overflow-x-hidden">
        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #fca5a5' }}>
            <strong>Error de Conexión:</strong> {error}. Verifique que la base de datos esté configurada correctamente en Vercel.
          </div>
        )}
          {renderContent()}
        </div>
        <SystemNoticeModal 
          announcement={systemAnnouncement} 
          isOpen={isAnnouncementModalOpen} 
          onClose={() => setIsAnnouncementModalOpen(false)} 
        />
      </main>
    </div>
  );
}

function PaymentModal({ plans, member, onPay, onClose }: any) {
  const [method, setMethod] = useState('Efectivo');
  
  const mainPlanObj = plans.find((p:any) => member.membership_type && p.name.toLowerCase().includes(member.membership_type.toLowerCase())) || plans[0];
  const addPlansList: string[] = member.additional_plans || [];
  const addPlanObjs = addPlansList.map(n => plans.find((p:any) => p.name === n)).filter(Boolean);

  const getPriceForPlan = (plan: any, currentMethod: string) => {
    if (!plan) return 0;
    if (plan.enable_custom_payment_methods) {
      if (currentMethod === 'Efectivo' && plan.price_cash != null && plan.price_cash !== '') {
        return Number(plan.price_cash);
      }
      if (currentMethod === 'Transferencia' && plan.price_transfer != null && plan.price_transfer !== '') {
        return Number(plan.price_transfer);
      }
    }
    return Number(plan.price) || 0;
  };

  const calculateTotal = (currentMethod: string) => {
    const mainP = getPriceForPlan(mainPlanObj, currentMethod);
    const addP = addPlanObjs.reduce((acc: number, curr: any) => acc + getPriceForPlan(curr, currentMethod), 0);
    return mainP + addP;
  };

  const [amount, setAmount] = useState(() => calculateTotal('Efectivo'));

  const handleSelectMethod = (newMethod: string) => {
    setMethod(newMethod);
    setAmount(calculateTotal(newMethod));
  };

  const currentMainPrice = getPriceForPlan(mainPlanObj, method);
  const isCustomMain = Boolean(mainPlanObj?.enable_custom_payment_methods && ((method === 'Efectivo' && mainPlanObj?.price_cash != null) || (method === 'Transferencia' && mainPlanObj?.price_transfer != null)));

  // Fecha de cobro actual (por defecto día de hoy / current_day)
  const today = new Date();
  const currentDayNum = today.getDate();
  const [billingDate, setBillingDate] = useState(() => today.toISOString().split('T')[0]);
  const [billingDayNum, setBillingDayNum] = useState<number>(currentDayNum);

  // Mantener día de cobro para siempre
  const initialKeep = Boolean(member.keep_billing_day ?? member.wellness_data?.keep_billing_day);
  const initialFixedDay = member.fixed_billing_day ?? member.wellness_data?.fixed_billing_day ?? currentDayNum;
  const [keepBillingDay, setKeepBillingDay] = useState<boolean>(initialKeep);
  const [fixedBillingDay, setFixedBillingDay] = useState<number>(initialFixedDay);

  // Calcular Próximo Cobro por defecto
  const computeDefaultNextDue = (fixedDay: number, keep: boolean) => {
    const base = new Date();
    let targetMonth = base.getMonth() + 1;
    let targetYear = base.getFullYear();
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    const dayToUse = keep ? fixedDay : base.getDate();
    const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
    const finalDay = Math.min(dayToUse, maxDays);
    const d = new Date(targetYear, targetMonth, finalDay);
    return d.toISOString().split('T')[0];
  };

  const [nextDueDate, setNextDueDate] = useState<string>(() => {
    return computeDefaultNextDue(initialFixedDay, initialKeep);
  });

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-5 sm:p-6 rounded-[28px] w-full max-w-md shadow-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
      {/* Header fijo con Logo Bunker Gym */}
      <div className="flex flex-col items-center mb-2.5 shrink-0">
        <img 
          src="/bunker.png" 
          alt="Bunker Gym Logo" 
          className="h-10 w-auto object-contain drop-shadow-md mb-1.5" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
        />
        <h2 className="text-lg font-black uppercase tracking-widest text-green-500 text-center">Facturación en Recepción</h2>
        <p className="text-[10px] text-gray-500 dark:text-white/30 text-center uppercase font-black">Socio: {member.name}</p>
      </div>
      
      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3.5">
         {/* Desglose de planes contratados */}
         <div className="bg-gray-50 dark:bg-black/40 p-3 rounded-2xl border border-gray-200 dark:border-white/10 space-y-1.5">
            <p className="text-[9px] font-black uppercase text-gray-400 dark:text-white/40 tracking-wider">Desglose de Cobro:</p>
            <div className="flex justify-between items-center text-xs font-bold text-black dark:text-white">
               <span>Plan Principal ({mainPlanObj?.name || member.membership_type})</span>
               <div className="flex items-center gap-1.5">
                 {isCustomMain && (
                   <span className="text-[7.5px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                     Precio {method}
                   </span>
                 )}
                 <span>${currentMainPrice.toLocaleString()}</span>
               </div>
            </div>
            {addPlanObjs.map((ap: any, i: number) => {
              const apPrice = getPriceForPlan(ap, method);
              const isCustomAp = Boolean(ap?.enable_custom_payment_methods && ((method === 'Efectivo' && ap?.price_cash != null) || (method === 'Transferencia' && ap?.price_transfer != null)));
              return (
                <div key={i} className="flex justify-between items-center text-xs font-bold text-orange-500">
                   <span>+ {ap.name} (Adicional)</span>
                   <div className="flex items-center gap-1.5">
                     {isCustomAp && (
                       <span className="text-[7.5px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                         Precio {method}
                       </span>
                     )}
                     <span>${apPrice.toLocaleString()}</span>
                   </div>
                </div>
              );
            })}
            <div className="border-t border-gray-200 dark:border-white/10 pt-1.5 flex justify-between text-sm font-black text-green-500">
               <span>Total Sugerido ({method})</span>
               <span>${calculateTotal(method).toLocaleString()}</span>
            </div>
         </div>

         {/* Monto Final a Cobrar */}
         <div className="space-y-1">
            <label className="text-[9px] text-gray-500 dark:text-white/30 uppercase font-black ml-2">Monto Final a Cobrar</label>
            <input type="number" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl p-2.5 text-xl font-black text-black dark:text-white text-center outline-none focus:border-green-500 transition-all" value={amount} onChange={e => setAmount(parseInt(e.target.value) || 0)} />
         </div>

         {/* Método de Pago */}
         <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-[9px] text-gray-500 dark:text-white/30 uppercase font-black">Método de Pago</label>
              {mainPlanObj?.enable_custom_payment_methods && (
                <span className="text-[7.5px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  ✨ Precios Diferenciados Activos
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
               <PaymentBtn active={method === 'Efectivo'} onClick={()=>handleSelectMethod('Efectivo')} label="Efectivo" icon={<Banknote size={15}/>} />
               <PaymentBtn active={method === 'Tarjeta'} onClick={()=>handleSelectMethod('Tarjeta')} label="Tarjeta" icon={<CreditCard size={15}/>} />
               <PaymentBtn active={method === 'Transferencia'} onClick={()=>handleSelectMethod('Transferencia')} label="Transferencia" icon={<Smartphone size={15}/>} />
               <PaymentBtn active={method === 'QR'} onClick={()=>handleSelectMethod('QR')} label="QR" icon={<Smartphone size={15}/>} />
            </div>
         </div>

         {/* Sección: Fecha de Cobro, Próximo Cobro y Mantener Día de Cobro para siempre */}
         <div className="bg-gray-50 dark:bg-black/40 p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-gray-500 dark:text-white/40 uppercase font-black tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-orange-500" />
                Fecha y Próximo Vencimiento
              </label>
              {keepBillingDay && (
                <span className="text-[8px] font-black uppercase text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                  Día {fixedBillingDay} Fijo
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Campo 1: Fecha de cobro (carga por defecto el número del día que se cobra / current_day) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[8px] text-gray-400 dark:text-white/40 uppercase font-black">
                    Fecha de Cobro
                  </span>
                  <span className="text-[8px] font-black text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                    Día {billingDayNum}
                  </span>
                </div>
                <input 
                  type="date"
                  className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2 px-2.5 text-xs font-bold text-black dark:text-white outline-none focus:border-green-500 transition-all"
                  value={billingDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBillingDate(val);
                    if (val) {
                      const d = new Date(val + 'T00:00:00').getDate();
                      setBillingDayNum(d);
                      if (!keepBillingDay) {
                        const nextD = new Date(val + 'T00:00:00');
                        nextD.setMonth(nextD.getMonth() + 1);
                        setNextDueDate(nextD.toISOString().split('T')[0]);
                      }
                    }
                  }}
                />
              </div>

              {/* Campo 2: Próximo Cobro con Botón de Calendario */}
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[8px] text-gray-400 dark:text-white/40 uppercase font-black">
                    Próximo Cobro
                  </span>
                  <span className="text-[8px] font-black text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                    Vence día {nextDueDate ? new Date(nextDueDate + 'T00:00:00').getDate() : '—'}
                  </span>
                </div>
                <input 
                  type="date"
                  className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2 px-2.5 text-xs font-bold text-black dark:text-white outline-none focus:border-orange-500 transition-all"
                  value={nextDueDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNextDueDate(val);
                    if (val && keepBillingDay) {
                      const d = new Date(val + 'T00:00:00').getDate();
                      setFixedBillingDay(d);
                    }
                  }}
                />
              </div>
            </div>

            {/* Checklist: Mantener día de cobro para siempre */}
            <label className="flex items-start gap-2.5 p-2.5 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 cursor-pointer hover:border-orange-500/40 transition-all select-none">
              <input 
                type="checkbox"
                checked={keepBillingDay}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setKeepBillingDay(checked);
                  if (checked) {
                    const d = nextDueDate ? new Date(nextDueDate + 'T00:00:00').getDate() : billingDayNum;
                    setFixedBillingDay(d);
                  }
                }}
                className="mt-0.5 w-4 h-4 rounded text-orange-500 focus:ring-orange-500 cursor-pointer accent-orange-500 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black text-black dark:text-white uppercase tracking-wider">
                    Mantener día de cobro para siempre
                  </span>
                  {keepBillingDay && (
                    <span className="text-[7px] font-black text-green-400 bg-green-500/15 px-1.5 py-0.2 rounded">
                      Día {fixedBillingDay} ACTIVO
                    </span>
                  )}
                </div>
                <p className="text-[8px] text-gray-500 dark:text-white/40 leading-snug mt-0.5">
                  Fija el día {fixedBillingDay} de cada mes. Siempre mantendrá esta fecha de cobro sin importar si el socio paga fuera del límite (ej: si vence el 23 y paga el 25). Los estados <b>Al día</b>, <b>Por vencer</b> y <b>Deuda</b> se regirán por este día fijo guardado.
                </p>
              </div>
            </label>
         </div>
      </div>

      {/* Footer fijo con botones de acción */}
      <div className="flex gap-3 pt-3 mt-3 border-t border-gray-200 dark:border-white/10 shrink-0">
        <button 
          className="flex-1 py-3 text-gray-600 dark:text-white/40 font-black uppercase text-[10px] hover:text-black dark:hover:text-white transition-colors" 
          onClick={onClose}
        >
          Cancelar
        </button>
        <button 
          className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-green-600/30 transition-all hover:scale-[1.02]" 
          onClick={()=>onPay(amount, method, billingDate, nextDueDate, keepBillingDay, fixedBillingDay)}
        >
          Generar Pago
        </button>
      </div>
    </div>
  );
}

function PaymentBtn({ active, onClick, label, icon }: any) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${active ? 'bg-green-600 border-green-400 text-black dark:text-white shadow-lg' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/20 hover:text-black dark:text-white'}`}>
       {icon}<span className="text-[10px] font-black uppercase">{label}</span>
    </button>
  );
}

function BillingModule({ members, onDeletePayment }: any) {
  const [filterType, setFilterType] = useState<'dia' | 'semana' | 'mes' | 'rango'>('mes');
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleFilterChange = (type: string) => {
    setFilterType(type as any);
    const d = new Date();
    if (type === 'dia') {
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(d.toISOString().split('T')[0]);
    } else if (type === 'semana') {
      const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    } else if (type === 'mes') {
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    }
  };

  const allHistory = members.flatMap((m:any) => (m.billing_history || []).map((h:any) => ({...h, userName: m.name})));
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59);

  const filteredHistory = allHistory.filter((h:any) => {
    const d = new Date(h.date);
    return d >= start && d <= end;
  });

  const sorted = filteredHistory.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = sorted.reduce((acc:number, curr:any)=>acc+curr.amount, 0);
  const planCounts: any = sorted.reduce((acc:any, curr:any) => {
    const p = curr.plan || 'Sin Plan';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const mostUsedPlan = Object.entries(planCounts).sort((a:any, b:any) => b[1] - a[1])[0]?.[0] || 'N/A';

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4 bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/5">
         <div className="flex items-center gap-4 flex-wrap w-full">
            <div className="space-y-1"><label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black">Filtrar por</label>
              <select className="block w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-[8px] outline-none" value={filterType} onChange={e=>handleFilterChange(e.target.value)}>
                <option value="dia">Día Actual</option>
                <option value="semana">Semana Actual</option>
                <option value="mes">Mes Actual</option>
                <option value="rango">Rango Personalizado</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black">Desde</label><input type="date" className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-[8px] outline-none" value={startDate} onChange={e=>{setStartDate(e.target.value); setFilterType('rango');}}/></div>
            <div className="space-y-1"><label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black">Hasta</label><input type="date" className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-[8px] outline-none" value={endDate} onChange={e=>{setEndDate(e.target.value); setFilterType('rango');}}/></div>
         </div>
      </div>

       <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/5"><p className="text-[9px] font-black text-gray-500 dark:text-white/20 uppercase">Cobros Registrados</p><p className="text-xl font-black text-black dark:text-white">${total.toLocaleString()}</p></div>
          <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/5"><p className="text-[9px] font-black text-gray-500 dark:text-white/20 uppercase">Más Usado</p><p className="text-xl font-black text-orange-500 truncate" title={mostUsedPlan}>{mostUsedPlan}</p></div>
          <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/5"><p className="text-[9px] font-black text-gray-500 dark:text-white/20 uppercase">Facturas</p><p className="text-xl font-black text-black dark:text-white">{sorted.length}</p></div>
       </div>
       <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-3xl overflow-x-auto shadow-2xl">
          <table className="w-full text-left min-w-full table-fixed">
             <thead className="bg-white dark:bg-white/5 border-b border-gray-200 dark:border-white/5 text-[8px] text-gray-500 dark:text-white/20 font-black uppercase tracking-widest"><tr><th className="p-4">Socio</th><th className="p-4">Fecha</th><th className="p-4">Plan</th><th className="p-4">Método</th><th className="p-4">Cobró</th><th className="p-4 text-right">Monto</th><th className="p-4 w-10"></th></tr></thead>
             <tbody className="divide-y divide-white/5">
                {sorted.length > 0 ? sorted.map((h:any, i:number)=>(
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                     <td className="p-4 font-black uppercase text-black dark:text-white truncate max-w-[120px]">{h.userName}</td>
                     <td className="p-4 text-gray-600 dark:text-white/40 text-[9px] whitespace-nowrap">{h.date}</td>
                     <td className="p-4 text-gray-600 dark:text-white/40 text-[9px] truncate max-w-[100px]">{h.plan}</td>
                     <td className="p-4"><span className="px-2 py-1 bg-white dark:bg-white/5 rounded-lg text-[7px] font-black uppercase">{h.method}</span></td>
                     <td className="p-4 text-[9px] font-black text-orange-400 truncate max-w-[100px]">{h.processed_by || '—'}</td>
                     <td className="p-4 text-right font-black text-green-500 whitespace-nowrap">${h.amount.toLocaleString()}</td>
                     <td className="p-4 text-center">
                       {h.id && <button onClick={() => onDeletePayment(h.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={12}/></button>}
                     </td>
                  </tr>
                )) : <tr><td colSpan={5} className="p-8 text-center text-xs text-gray-500 dark:text-white/40 uppercase font-black tracking-widest">No hay facturas en este periodo</td></tr>}
             </tbody>
          </table>
       </div>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick }: any) {
  return <div onClick={onClick} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${active ? 'bg-orange-500 text-black dark:text-white shadow-lg' : 'text-gray-500 dark:text-white/20 hover:text-black dark:text-white hover:bg-white dark:bg-white/5'}`}>{icon}<span className="text-[9px] font-black uppercase tracking-widest">{label}</span></div>;
}

function SummaryCard({ title, value, icon, onClick, color }: any) {
  const colors: any = { blue: 'text-orange-400', green: 'text-green-400', orange: 'text-orange-400', purple: 'text-purple-400' };
  return <div onClick={onClick} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-4 rounded-xl cursor-pointer hover:border-orange-500/20 transition-all flex justify-between items-center"><div className="space-y-1"><p className="text-[7px] font-black text-gray-500 dark:text-white/20 uppercase tracking-widest">{title}</p><p className="text-lg font-black text-black dark:text-white">{value}</p></div><div className={`${colors[color]} bg-white dark:bg-white/5 p-2 rounded-lg`}>{icon}</div></div>;
}

function getCohortChartData(newMembers: any[], retainedMembers: any[], start: Date, end: Date, filterType: string) {
  if (filterType === 'dia') {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      
      const nuevosInDay = newMembers.filter((m: any) => {
        if (!m.joined_at) return false;
        return m.joined_at.split('T')[0] === key;
      }).length;
      
      const isWithinFilter = d >= start && d <= end;
      const recurrentesInDay = isWithinFilter ? retainedMembers.length : Math.max(0, retainedMembers.length - 2);

      days.push({ label, nuevos: nuevosInDay, recurrentes: recurrentesInDay });
    }
    return days;
  }

  if (filterType === 'semana') {
    const weeks: any[] = [];
    for (let w = 4; w >= 1; w--) {
      const isCurrentWeek = w === 4;
      weeks.push({
        label: `Semana ${w}`,
        nuevos: isCurrentWeek ? newMembers.length : 0,
        recurrentes: retainedMembers.length
      });
    }
    return weeks;
  }

  // filterType === 'mes' or 'rango'
  const months: any[] = [];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  const endMonth = end.getMonth();
  const endYear = end.getFullYear();

  for (let i = 3; i >= 0; i--) {
    const d = new Date(endYear, endMonth - i, 1);
    const mName = monthNames[d.getMonth()];
    const isCurrent = i === 0;
    
    const nuevosCount = isCurrent ? newMembers.length : 0;
    const recurrentesCount = isCurrent 
      ? retainedMembers.length 
      : Math.max(0, retainedMembers.length - (i * 2));

    months.push({
      label: isCurrent ? `${mName} (Actual)` : mName,
      nuevos: nuevosCount,
      recurrentes: recurrentesCount
    });
  }
  return months;
}

function SummaryModule({ members, financeData, userRole, setActiveTab }: any) {
  const [filterType, setFilterType] = useState<'mes' | 'dia' | 'semana' | 'rango'>('mes');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleFilterChange = (type: string) => {
    setFilterType(type as any);
    const d = new Date();
    if (type === 'dia') {
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(d.toISOString().split('T')[0]);
    } else if (type === 'semana') {
      const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    } else if (type === 'mes') {
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    }
  };

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59);

  // Billing history in period
  const allHistory = (members || []).flatMap((m: any) => 
    (m.billing_history || []).map((h: any) => ({ ...h, userName: m.name, member_id: m.id }))
  );
  const filteredHistory = allHistory.filter((h: any) => {
    const d = new Date(h.date);
    return d >= start && d <= end;
  });
  const totalPeriodRevenue = filteredHistory.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

  // New members in period: only explicitly marked new members (m.is_new) who joined within period
  const newMembersInPeriod = (members || []).filter((m: any) => {
    if (!m.is_new) return false;
    if (!m.joined_at) return true;
    const jd = new Date(m.joined_at);
    return jd >= start && jd <= end;
  });

  const activeCount = (members || []).filter((m: any) => m.status === 'ACTIVO' || m.status === 'AL DIA').length;

  // Retained members (siguieron yendo): active members who are not marked as new
  const retainedInPeriod = (members || []).filter((m: any) => {
    if (m.is_new) return false;
    return m.status === 'ACTIVO' || m.status === 'AL DIA';
  });

  const totalCohort = newMembersInPeriod.length + retainedInPeriod.length;
  const retentionPercent = totalCohort > 0 ? ((retainedInPeriod.length / totalCohort) * 100).toFixed(1) : '100';

  const cohortChartData = getCohortChartData(newMembersInPeriod, retainedInPeriod, start, end, filterType);
  const cohortPieData = [
    { name: 'Socios Nuevos', value: newMembersInPeriod.length },
    { name: 'Siguieron Yendo (Recurrentes)', value: retainedInPeriod.length }
  ];

  // Dynamic cashflow grouping for the period
  const groupedData: { [key: string]: { ingresos: number, count: number } } = {};
  filteredHistory.forEach((h: any) => {
    let key = '';
    const d = new Date(h.date);
    if (filterType === 'dia') {
      key = d.toISOString().split('T')[0];
    } else if (filterType === 'semana') {
      const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      key = monday.toISOString().split('T')[0];
    } else {
      key = h.date.split('-').slice(0, 2).join('-');
    }
    if (!groupedData[key]) groupedData[key] = { ingresos: 0, count: 0 };
    groupedData[key].ingresos += h.amount;
    groupedData[key].count += 1;
  });

  const periodCashflow = Object.entries(groupedData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, stats]) => {
      let label = dateKey;
      if (filterType === 'mes') {
        label = new Date(dateKey + '-01').toLocaleString('es-ES', { month: 'short' });
      } else if (filterType === 'semana') {
        label = 'Sem ' + new Date(dateKey).getDate() + '/' + (new Date(dateKey).getMonth()+1);
      } else {
        label = new Date(dateKey).getDate() + '/' + (new Date(dateKey).getMonth()+1);
      }
      return {
        month: label,
        ingresos: stats.ingresos,
        facturas: stats.count
      };
    });

  const displayCashflow = periodCashflow.length > 0 ? periodCashflow : (financeData?.cashflow_data || []);

  return (
    <div className="space-y-5">
      {/* Date Filter Bar */}
      <div className="flex items-center gap-4 bg-white dark:bg-white/5 p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap w-full">
          <div className="space-y-1">
            <label className="text-[8px] text-gray-500 dark:text-white/40 uppercase font-black">Filtrar por</label>
            <select 
              className="block w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-black dark:text-white text-[9px] font-bold uppercase outline-none focus:border-orange-500" 
              value={filterType} 
              onChange={e => handleFilterChange(e.target.value)}
            >
              <option value="mes">Mes Actual</option>
              <option value="dia">Día Actual</option>
              <option value="semana">Semana Actual</option>
              <option value="rango">Rango Personalizado</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] text-gray-500 dark:text-white/40 uppercase font-black">Desde</label>
            <input 
              type="date" 
              className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-black dark:text-white text-[9px] font-bold outline-none focus:border-orange-500" 
              value={startDate} 
              onChange={e => { setStartDate(e.target.value); setFilterType('rango'); }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] text-gray-500 dark:text-white/40 uppercase font-black">Hasta</label>
            <input 
              type="date" 
              className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-black dark:text-white text-[9px] font-bold outline-none focus:border-orange-500" 
              value={endDate} 
              onChange={e => { setEndDate(e.target.value); setFilterType('rango'); }}
            />
          </div>
          <div className="ml-auto text-right hidden sm:block">
            <span className="text-[8px] uppercase font-black text-gray-400 dark:text-white/30 block">Filtro de Resumen</span>
            <span className="text-[10px] font-black text-orange-500 uppercase">{startDate} al {endDate}</span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard 
          title="Socios Activos" 
          value={activeCount} 
          icon={<Users size={16}/>} 
          onClick={() => setActiveTab('Socios')} 
          color="blue" 
        />
        <SummaryCard 
          title="Socios Nuevos (Período)" 
          value={newMembersInPeriod.length} 
          icon={<Sparkles size={16}/>} 
          onClick={() => setActiveTab('Socios')} 
          color="green" 
        />
        {(userRole === 'gerente' || userRole === 'administracion') && (
          <SummaryCard 
            title="Facturas (Período)" 
            value={filteredHistory.length} 
            icon={<Receipt size={16}/>} 
            onClick={() => setActiveTab('Facturación')} 
            color="purple" 
          />
        )}
        {userRole === 'gerente' && (
          <SummaryCard 
            title="Caja (Período)" 
            value={`$${totalPeriodRevenue.toLocaleString()}`} 
            icon={<DollarSign size={16}/>} 
            onClick={() => setActiveTab('Finanzas')} 
            color="orange" 
          />
        )}
      </div>

      {/* Gráfico de Adquisición vs Retención (Nuevos vs Siguieron Yendo) */}
      <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-200 dark:border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Users size={15} className="text-emerald-400" />
              Adquisición vs Retención de Socios (Nuevos vs Siguieron Yendo)
            </h3>
            <p className="text-[9px] text-gray-500 dark:text-white/40 font-bold">
              Socios nuevos incorporados en el período ({startDate} al {endDate}) vs socios preexistentes que siguieron activos.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              🌟 {newMembersInPeriod.length} Nuevos
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              🔄 {retainedInPeriod.length} Siguieron Yendo
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-56 bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohortChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="label" stroke="#555" fontSize={9} />
                <YAxis stroke="#555" fontSize={9} />
                <Tooltip contentStyle={{backgroundColor:'#111', border:'none', fontSize:'10px', borderRadius:'10px'}} />
                <Legend wrapperStyle={{fontSize:'9px', textTransform:'uppercase', fontWeight:'900'}} />
                <Bar dataKey="nuevos" name="Socios Nuevos" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recurrentes" name="Siguieron Yendo (Recurrentes)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-56 bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/5 flex flex-col justify-between">
            <p className="text-[8px] font-black uppercase text-gray-400 dark:text-white/40 tracking-wider text-center">
              Distribución en el Período
            </p>
            <div className="h-36 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cohortPieData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value">
                    <Cell fill="#10b981" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor:'#111', border:'none', fontSize:'10px', borderRadius:'10px'}} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-black text-black dark:text-white">{totalCohort}</span>
                <span className="text-[7px] font-bold text-gray-400 uppercase">Total Activos</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[8px] font-black uppercase text-gray-400 dark:text-white/30 pt-1 border-t border-gray-200 dark:border-white/5">
              <span>Tasa de Retención</span>
              <span className="text-emerald-400 font-bold">{retentionPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-black uppercase text-gray-600 dark:text-white/40 tracking-widest">
              Balance de Caja ({filterType.toUpperCase()})
            </h3>
            <span className="text-xs font-black text-emerald-400">
              Total: ${totalPeriodRevenue.toLocaleString()}
            </span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayCashflow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false}/>
                <XAxis dataKey="month" stroke="#444" fontSize={9}/>
                <Tooltip contentStyle={{backgroundColor:'#111', border:'none', fontSize:'10px'}}/>
                <Area type="monotone" dataKey="ingresos" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.15}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-black uppercase text-gray-600 dark:text-white/40 tracking-widest">
              Actividad Facturación Reciente
            </h3>
            <span className="text-[9px] font-bold text-gray-400">
              {filteredHistory.length} registros
            </span>
          </div>
          <div className="flex flex-col justify-center h-44 space-y-2 overflow-y-auto custom-scrollbar pr-1">
            {filteredHistory.slice().reverse().slice(0, 4).map((h: any, i: number) => (
              <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-black/20 p-2.5 rounded-xl border border-gray-200 dark:border-white/5">
                <div>
                  <span className="text-[10px] font-black uppercase block text-black dark:text-white">{h.userName}</span>
                  <span className="text-[8px] text-gray-400 dark:text-white/30">{h.date} · {h.method}</span>
                </div>
                <span className="text-green-500 font-black text-xs">${Number(h.amount || 0).toLocaleString()}</span>
              </div>
            ))}
            {filteredHistory.length === 0 && (
              <p className="text-[9px] text-gray-400 dark:text-white/30 italic text-center py-8">
                No hay facturas registradas en este período
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function memberDaysInfo(
  joinedAt: string, 
  status: string, 
  membershipType?: string,
  nextDueDateStr?: string,
  _keepBillingDay?: boolean,
  _fixedBillingDay?: number
): { daysIn: number; daysLeft: number; overdueDays: number; totalDays: number } {
  const plan = (membershipType || '').toUpperCase();
  let totalDays = 30;
  if (plan.includes('TRIMESTRAL')) totalDays = 90;
  else if (plan.includes('SEMESTRAL')) totalDays = 180;
  else if (plan.includes('ANUAL')) totalDays = 365;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (status === 'INACTIVO') {
    return { daysIn: 0, daysLeft: 0, overdueDays: 0, totalDays };
  }

  if (nextDueDateStr) {
    const dueDate = new Date(nextDueDateStr.includes('T') ? nextDueDateStr : `${nextDueDateStr}T00:00:00`);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0 || status === 'DEUDA') {
      const overdueDays = Math.max(1, Math.abs(diffDays));
      return { daysIn: totalDays, daysLeft: 0, overdueDays, totalDays };
    }
    const daysLeft = diffDays;
    const daysIn = Math.max(0, Math.min(totalDays, totalDays - daysLeft));
    return { daysIn, daysLeft, overdueDays: 0, totalDays };
  }

  if (!joinedAt) return { daysIn: 0, daysLeft: totalDays, overdueDays: 0, totalDays };
  const joined = new Date(joinedAt);
  const d1 = new Date(joined.getFullYear(), joined.getMonth(), joined.getDate());
  const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const totalDaysSinceJoined = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  
  if (totalDaysSinceJoined < 0) {
    return { daysIn: 0, daysLeft: totalDays, overdueDays: 0, totalDays };
  }
  
  if (status === 'DEUDA') {
    const lastCycleEnd = Math.floor(totalDaysSinceJoined / totalDays) * totalDays;
    const overdueDays = totalDaysSinceJoined - lastCycleEnd;
    return { daysIn: totalDays, daysLeft: 0, overdueDays, totalDays };
  }
  
  const daysIn = totalDaysSinceJoined % totalDays;
  const daysLeft = totalDays - daysIn;
  return { daysIn, daysLeft, overdueDays: 0, totalDays };
}

function isMemberNew(m: any): boolean {
  if (!m || !m.is_new) return false;
  if (m.joined_at) {
    const joinDate = new Date(m.joined_at);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - joinDate.getTime()) / 86400000);
    return diffDays >= 0 && diffDays <= 30;
  }
  return true;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    'ACTIVO':     'bg-green-500/15 text-green-400',
    'AL DIA':     'bg-green-500/15 text-green-400',
    'POR VENCER': 'bg-yellow-500/15 text-yellow-400',
    'DEUDA':      'bg-red-500/15 text-red-400',
    'INACTIVO':   'bg-gray-500/15 text-gray-400',
  };
  const label: Record<string, string> = { 'ACTIVO': 'AL DÍA', 'AL DIA': 'AL DÍA' };
  return (
    <span className={`text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${cfg[status] || 'bg-gray-500/15 text-gray-400'}`}>
      {label[status] || status}
    </span>
  );
}

function WhatsAppIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.04 3.67C14.24 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.67 20.16 9.32 19.8 8.13 19.11L7.85 18.94L4.73 19.76L5.56 16.72L5.37 16.42C4.62 15.22 4.22 13.58 4.22 11.91C4.22 7.37 7.92 3.67 12.04 3.67ZM8.82 7.15C8.64 7.15 8.44 7.22 8.28 7.39C8.04 7.64 7.42 8.22 7.42 9.42C7.42 10.62 8.3 11.78 8.42 11.94C8.54 12.1 10.15 14.59 12.61 15.65C13.2 15.9 13.65 16.05 14.01 16.17C14.6 16.35 15.13 16.33 15.56 16.27C16.03 16.2 17.02 15.67 17.23 15.08C17.44 14.49 17.44 13.98 17.37 13.88C17.31 13.78 17.15 13.72 16.91 13.6C16.67 13.48 15.48 12.89 15.26 12.81C15.04 12.73 14.88 12.69 14.72 12.93C14.56 13.17 14.09 13.72 13.95 13.88C13.81 14.04 13.67 14.06 13.43 13.94C13.19 13.82 12.42 13.57 11.51 12.76C10.8 12.13 10.32 11.35 10.2 11.14C10.08 10.93 10.19 10.82 10.31 10.7C10.42 10.59 10.56 10.41 10.68 10.27C10.8 10.13 10.84 10.03 10.92 9.87C11 9.71 10.96 9.57 10.9 9.45C10.84 9.33 10.38 8.19 10.18 7.72C9.99 7.27 9.79 7.33 9.64 7.32C9.5 7.31 9.34 7.31 9.18 7.31L8.82 7.15Z" />
    </svg>
  );
}

function MembersModule({ members, onEdit, onDelete, onReactivate, onPermanentDelete, onAddClick, onPayClick, onHistory, searchQuery, setSearchQuery, API_URL }: any) {
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [sendingWsId, setSendingWsId] = useState<number | null>(null);
  const [wsToast, setWsToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const statusOptions = ['TODOS', 'NUEVOS', 'ACTIVO', 'POR VENCER', 'DEUDA', 'INACTIVO'];

  const showWsToast = (message: string, type: 'success' | 'error' = 'success') => {
    setWsToast({ message, type });
    setTimeout(() => setWsToast(null), 4000);
  };

  const handleSendWhatsApp = async (m: any) => {
    setSendingWsId(m.id);
    try {
      const envSenderPhone = (import.meta as any).env?.VITE_WHATSAPP_PHONE || '';
      const targetApi = API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? "http://localhost:8000" : "/api");
      const res = await fetch(`${targetApi}/admin/members/${m.id}/send_whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_phone: envSenderPhone || undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.whatsapp_sent && data.email_sent) {
          showWsToast(`Aviso enviado a ${m.name} por WhatsApp y Correo (${data.email})`, 'success');
        } else if (data.email_sent && !data.whatsapp_sent) {
          showWsToast(`Aviso enviado por Correo a ${m.name} (${data.email})`, 'success');
        } else {
          showWsToast(`Aviso de WhatsApp enviado a ${m.name} (+${data.clean_phone || 'OK'})`, 'success');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showWsToast(`Error al enviar: ${err.detail || res.status}`, 'error');
      }
    } catch (e) {
      showWsToast(`Error de conexión al enviar notificación`, 'error');
    } finally {
      setSendingWsId(null);
    }
  };

  const filteredMembers = members
    .filter((m: any) => {
      const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || (m.dni && String(m.dni).includes(searchQuery));
      let matchStatus = true;
      if (statusFilter === 'TODOS') matchStatus = true;
      else if (statusFilter === 'NUEVOS') matchStatus = isMemberNew(m);
      else matchStatus = m.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4 relative">
      {wsToast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border text-xs font-black flex items-center gap-3 transition-all ${wsToast.type === 'success' ? 'bg-[#0b1d14]/95 border-[#25D366]/40 text-[#25D366]' : 'bg-red-950/95 border-red-500/40 text-red-400'}`}>
          <WhatsAppIcon size={16} />
          <span>{wsToast.message}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="font-black text-lg uppercase">Gestión de Socios</h3>
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-white/20" size={14} />
            <input type="text" placeholder="Buscar por DNI o Nombre..." className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-4 text-black dark:text-white text-[10px] outline-none focus:border-orange-500/50 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {statusOptions.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${statusFilter === s ? (s === 'NUEVOS' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'bg-orange-500 text-black') : 'bg-white dark:bg-white/5 text-gray-500 dark:text-white/30 hover:text-black dark:hover:text-white'}`}>
                {s === 'TODOS' ? `Todos (${members.length})` 
                  : s === 'NUEVOS' ? `✨ Nuevos (${members.filter(isMemberNew).length})`
                  : s === 'ACTIVO' ? `Al día (${members.filter((m:any)=>m.status==='ACTIVO'||m.status==='AL DIA').length})` 
                  : s === 'POR VENCER' ? `Por vencer (${members.filter((m:any)=>m.status==='POR VENCER').length})` 
                  : s === 'DEUDA' ? `Deuda (${members.filter((m:any)=>m.status==='DEUDA').length})` 
                  : `Inactivo (${members.filter((m:any)=>m.status==='INACTIVO').length})`}
              </button>
            ))}
          </div>
          <button onClick={onAddClick} className="bg-orange-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 whitespace-nowrap">+ Nuevo Socio</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filteredMembers.map((m: any) => {
          const isFixed = Boolean(m.keep_billing_day ?? m.wellness_data?.keep_billing_day);
          const fixedDay = m.fixed_billing_day ?? m.wellness_data?.fixed_billing_day;
          const nextDue = m.next_due_date || m.wellness_data?.next_due_date;
          const { daysIn, daysLeft, overdueDays, totalDays } = memberDaysInfo(
            m.joined_at, 
            m.status, 
            m.membership_type, 
            nextDue, 
            isFixed, 
            fixedDay
          );
          const isSending = sendingWsId === m.id;
          return (
            <div key={m.id} className="p-4 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/5 hover:border-orange-500/10 transition-all group overflow-hidden">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center font-black text-orange-500 text-sm shrink-0">{m.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-black dark:text-white text-[10px] uppercase break-words leading-tight">{m.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black truncate">{m.membership_type || '—'}</span>
                    <StatusBadge status={m.status} />
                    {isMemberNew(m) && (
                      <span className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1 shadow-sm animate-pulse">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        NUEVO
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => handleSendWhatsApp(m)}
                  disabled={isSending}
                  title={`Enviar aviso por WhatsApp${m.email ? ' y Correo' : ''} a ${m.name} (${m.status})`}
                  className="p-2 bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366] hover:text-white rounded-xl transition-all shadow-sm shrink-0 disabled:opacity-50 flex items-center gap-1"
                >
                  {isSending ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <WhatsAppIcon size={14} />
                      {m.email && <Mail size={12} className="opacity-80" />}
                    </>
                  )}
                </button>
              </div>
              <div className="mb-3 px-1">
                <div className="flex items-center justify-between text-[7px] text-gray-400 dark:text-white/30 font-black uppercase mb-1">
                  <span>
                    {m.status === 'INACTIVO' ? 'Socio Inactivo' : daysLeft <= 0 ? (overdueDays > 0 ? `${overdueDays}d de deuda` : '0d restantes') : `${daysLeft}d restantes`}
                  </span>
                  {isFixed ? (
                    <span className="text-orange-400 font-bold bg-orange-500/10 px-1.5 py-0.2 rounded border border-orange-500/20" title={`Día ${fixedDay} fijo recurrente`}>
                      Día {fixedDay} fijo
                    </span>
                  ) : (
                    <span>{m.status === 'INACTIVO' ? 'Baja' : `Día ${daysIn}/${totalDays}`}</span>
                  )}
                </div>
                <div className="w-full h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m.status === 'INACTIVO' ? 'bg-gray-500' : m.status === 'DEUDA' ? 'bg-red-500' : m.status === 'POR VENCER' ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: m.status === 'INACTIVO' ? '0%' : m.status === 'DEUDA' ? '100%' : `${Math.min(100, (daysIn / totalDays) * 100)}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onPayClick(m)} className="col-span-2 py-2 bg-green-500/10 text-green-500 rounded-lg text-[8px] font-black uppercase hover:bg-green-500 hover:text-black dark:text-white transition-all">Cobrar</button>
                <button onClick={() => onEdit(m)} className="py-2 bg-white dark:bg-white/5 text-gray-600 dark:text-white/40 rounded-lg text-[8px] font-black uppercase">Editar</button>
                <button onClick={() => onHistory(m)} className="py-2 bg-white dark:bg-white/5 text-orange-400 rounded-lg text-[8px] font-black uppercase">Historial</button>
                {m.status === 'INACTIVO' ? (
                  <>
                    <button onClick={() => onReactivate(m)} className="py-2 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg text-[8px] font-black uppercase transition-all" title="Reactivar socio a estado Al Día">Reactivar</button>
                    <button onClick={() => onPermanentDelete(m)} className="py-2 bg-red-500/15 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-[8px] font-black uppercase transition-all" title="Eliminar definitivamente de la base de datos">Eliminar</button>
                  </>
                ) : (
                  <button onClick={() => onDelete(m)} className="col-span-2 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-[8px] font-black uppercase opacity-75 group-hover:opacity-100 transition-all" title="Dar de baja (pasa a Inactivo sin borrar)">Dar de Baja</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlansModule({ plans, onEdit, onDelete, onAddClick }: any) {
  return (
    <div className="space-y-6">
      {/* Header con descripción */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-white/5 p-5 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
              <Settings size={18} />
            </div>
            <h3 className="font-black text-lg uppercase tracking-tight text-black dark:text-white">
              Planes y Membresías
            </h3>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-white/40 font-bold">
            Administrá las tarifas del gimnasio y configurá montos diferenciados para Efectivo o Transferencia.
          </p>
        </div>
        <button 
          onClick={onAddClick} 
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
        >
          <span>+ Nuevo Plan</span>
        </button>
      </div>

      {/* Grid de Planes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {plans.map((p: any) => {
          const hasCustomMethods = Boolean(p.enable_custom_payment_methods);
          return (
            <div 
              key={p.id} 
              className="p-5 bg-white dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/5 hover:border-orange-500/30 transition-all duration-300 relative group flex flex-col justify-between shadow-lg hover:shadow-orange-500/5"
            >
              <div>
                {/* Top badges */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-xl bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest border border-orange-500/20">
                    {p.name}
                  </span>
                  {p.allow_unification && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[7px] font-black uppercase border border-cyan-500/20">
                      Unificable
                    </span>
                  )}
                </div>

                {/* Base Price */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-black dark:text-white tracking-tight">
                      ${Number(p.price || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-white/30 font-black uppercase">
                      / mes (Base)
                    </span>
                  </div>
                </div>

                {/* Differentiated pricing box */}
                {hasCustomMethods ? (
                  <div className="mb-4 p-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[7.5px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Precios por Método
                      </span>
                      <span className="text-[7px] font-bold text-gray-400 dark:text-white/30 uppercase">Automático</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div className="bg-white/60 dark:bg-black/30 p-2 rounded-xl border border-gray-200/50 dark:border-white/5">
                        <p className="text-[7px] font-black uppercase text-emerald-500 flex items-center gap-1">
                          <Banknote size={10} /> Efectivo
                        </p>
                        <p className="text-xs font-black text-black dark:text-white mt-0.5">
                          ${p.price_cash != null ? Number(p.price_cash).toLocaleString() : Number(p.price).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/60 dark:bg-black/30 p-2 rounded-xl border border-gray-200/50 dark:border-white/5">
                        <p className="text-[7px] font-black uppercase text-cyan-400 flex items-center gap-1">
                          <Smartphone size={10} /> Transf.
                        </p>
                        <p className="text-xs font-black text-black dark:text-white mt-0.5">
                          ${p.price_transfer != null ? Number(p.price_transfer).toLocaleString() : Number(p.price).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 text-center">
                    <p className="text-[8px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-wide">
                      Mismo precio en todos los métodos
                    </p>
                  </div>
                )}

                {/* Plan Specs */}
                <div className="space-y-1.5 mb-5 pt-2 border-t border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-white/60 font-bold">
                    <CheckCircle size={12} className="text-emerald-500 shrink-0"/> 
                    <span>{p.daysPerWeek ?? p.days_per_week} días por semana</span>
                  </div>
                  <div className="flex items-start gap-2 text-[10px] text-gray-600 dark:text-white/60 font-bold">
                    <CheckCircle size={12} className="text-emerald-500 shrink-0 mt-0.5"/> 
                    <span className="leading-tight break-words">
                      {(p.classes || []).length > 0 ? (p.classes || []).join(', ') : 'Musculación libre'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
                <button 
                  onClick={() => onEdit(p)} 
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl text-[9px] font-black uppercase text-black dark:text-white transition-all active:scale-95"
                >
                  Editar
                </button>
                <button 
                  onClick={() => onDelete(p)} 
                  className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all active:scale-95"
                  title="Eliminar Plan"
                >
                  <Trash2 size={15}/>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StaffModule({ staff, onEdit, onDelete, onAddClick }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-black text-lg uppercase">Personal</h3><button onClick={onAddClick} className="bg-orange-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">+ Nuevo</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {staff.map((s: any) => (
           <div key={s.id} className="p-6 bg-white dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/5 group hover:border-orange-500/20 transition-all">
             <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 text-lg font-black group-hover:bg-orange-500 group-hover:text-black dark:text-white transition-all shadow-lg">{s.name[0]}</div><div><p className="font-black text-black dark:text-white text-[11px] uppercase mb-1 truncate w-24">{s.name}</p><p className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black tracking-widest">{s.role}</p></div></div>
             <div className="flex gap-2"><button onClick={() => onEdit(s)} className="flex-1 py-2 bg-white dark:bg-white/5 rounded-xl text-[9px] font-black uppercase">Editar</button><button onClick={() => onDelete(s.id)} className="p-2 bg-red-500/10 text-red-500 rounded-xl"><Trash2 size={16}/></button></div>
           </div>
         ))}
      </div>
    </div>
  );
}

function FinanceModule({ data, members, startDate, setStartDate, endDate, setEndDate, filterType, setFilterType }: any) {
  if (!data) return <p>Cargando...</p>;
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59);
  
  const filteredHistory = (data.all_history || []).filter((h: any) => {
    const d = new Date(h.date);
    return d >= start && d <= end;
  });

  const revenueByPlan: { [key: string]: number } = {};
  filteredHistory.forEach((h: any) => {
    const planName = h.plan || "Sin Plan";
    revenueByPlan[planName] = (revenueByPlan[planName] || 0) + h.amount;
  });
  const dynamicRevenueBreakdown = Object.entries(revenueByPlan).map(([name, value]) => ({ name, value }));

  const groupedData: { [key: string]: { ingresos: number, count: number } } = {};
  filteredHistory.forEach((h: any) => {
    let key = '';
    const d = new Date(h.date);
    if (filterType === 'dia') {
      key = d.toISOString().split('T')[0];
    } else if (filterType === 'semana') {
      const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      key = monday.toISOString().split('T')[0];
    } else {
      key = h.date.split('-').slice(0, 2).join('-');
    }
    if (!groupedData[key]) groupedData[key] = { ingresos: 0, count: 0 };
    groupedData[key].ingresos += h.amount;
    groupedData[key].count += 1;
  });

  const cashflow_data = Object.entries(groupedData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, stats]) => {
      let label = dateKey;
      if (filterType === 'mes') {
        label = new Date(dateKey + '-01').toLocaleString('es-ES', { month: 'short' });
      } else if (filterType === 'semana') {
        label = 'Sem ' + new Date(dateKey).getDate() + '/' + (new Date(dateKey).getMonth()+1);
      } else {
        label = new Date(dateKey).getDate() + '/' + (new Date(dateKey).getMonth()+1);
      }
      return {
        month: label,
        ingresos: stats.ingresos,
        facturas: stats.count
      };
    });

  const totalFilteredRevenue = filteredHistory.reduce((acc:number, curr:any) => acc + curr.amount, 0);

  const memberMap = Object.fromEntries((members || []).map((m: any) => [m.id, m.name]));
  const debtors = (members || []).filter((m: any) => m.status === 'DEUDA' || m.status === 'POR VENCER');

  // Adquisición vs Retención (Socios Nuevos vs Socios que Siguieron Yendo)
  const newMembers = (members || []).filter((m: any) => {
    if (!m.is_new) return false;
    if (!m.joined_at) return true;
    const jd = new Date(m.joined_at);
    return jd >= start && jd <= end;
  });


  const retainedMembers = (members || []).filter((m: any) => {
    if (m.is_new) return false;
    return m.status === 'ACTIVO' || m.status === 'AL DIA';
  });

  const totalCohort = newMembers.length + retainedMembers.length;
  const retentionPercent = totalCohort > 0 ? ((retainedMembers.length / totalCohort) * 100).toFixed(1) : '100';

  const cohortChartData = getCohortChartData(newMembers, retainedMembers, start, end, filterType);

  const cohortPieData = [
    { name: 'Socios Nuevos', value: newMembers.length },
    { name: 'Siguieron Yendo (Recurrentes)', value: retainedMembers.length }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/5">
         <div className="flex items-center gap-4 flex-wrap w-full">
            <div className="space-y-1"><label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black">Agrupación</label>
              <select className="block w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-[8px] outline-none" value={filterType} onChange={e=>setFilterType(e.target.value)}>
                <option value="dia">Por Día</option>
                <option value="semana">Por Semana</option>
                <option value="mes">Por Mes</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black">Desde</label><input type="date" className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-[8px] outline-none" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
            <div className="space-y-1"><label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black">Hasta</label><input type="date" className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-[8px] outline-none" value={endDate} onChange={e=>setEndDate(e.target.value)}/></div>
         </div>
      </div>

      {/* Gráfico: Socios Nuevos vs Retención ("Siguieron yendo") */}
      <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-200 dark:border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Users size={15} className="text-emerald-400" />
              Adquisición vs Retención de Socios (Nuevos vs Siguieron Yendo)
            </h3>
            <p className="text-[9px] text-gray-500 dark:text-white/40 font-bold">
              Comparativa entre socios incorporados en el período y socios preexistentes que mantuvieron su actividad o pago.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase">
              🌟 {newMembers.length} Nuevos
            </span>
            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] font-black uppercase">
              🔄 {retainedMembers.length} Siguieron Yendo
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-56 bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohortChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="label" stroke="#555" fontSize={9} />
                <YAxis stroke="#555" fontSize={9} />
                <Tooltip contentStyle={{backgroundColor:'#111', border:'none', fontSize:'10px', borderRadius:'10px'}} />
                <Legend wrapperStyle={{fontSize:'9px', textTransform:'uppercase', fontWeight:'900'}} />
                <Bar dataKey="nuevos" name="Socios Nuevos" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recurrentes" name="Siguieron Yendo (Recurrentes)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-56 bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/5 flex flex-col justify-between">
            <p className="text-[8px] font-black uppercase text-gray-400 dark:text-white/40 tracking-wider text-center">
              Distribución en el Período
            </p>
            <div className="h-36 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cohortPieData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value">
                    <Cell fill="#10b981" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor:'#111', border:'none', fontSize:'10px', borderRadius:'10px'}} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-black text-black dark:text-white">{totalCohort}</span>
                <span className="text-[7px] font-bold text-gray-400 uppercase">Total Activos</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[8px] font-black uppercase text-gray-400 dark:text-white/30 pt-1 border-t border-gray-200 dark:border-white/5">
              <span>Tasa de Retención</span>
              <span className="text-emerald-400 font-bold">{retentionPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <div className="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/5 flex flex-col justify-between">
            <h3 className="text-[9px] font-black text-gray-500 dark:text-white/20 uppercase tracking-widest mb-4">Ingresos por Tipo de Plan</h3>
            <div className="h-40">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={dynamicRevenueBreakdown.length ? dynamicRevenueBreakdown : [{name:'Sin datos', value:1}]} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value">
                        {dynamicRevenueBreakdown.map((_:any, index:number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                     </Pie>
                     <Tooltip contentStyle={{backgroundColor:'#111', border:'none', fontSize:'10px'}} />
                     <Legend wrapperStyle={{fontSize:'8px', textTransform:'uppercase', fontWeight:'900'}} />
                  </PieChart>
               </ResponsiveContainer>
            </div>
         </div>
         <div className="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/5 flex flex-col justify-between">
            <h3 className="text-[9px] font-black text-gray-500 dark:text-white/20 uppercase tracking-widest mb-4">Crecimiento de Ventas y Facturaciones</h3>
            <div className="h-40">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cashflow_data}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                     <XAxis dataKey="month" stroke="#444" fontSize={8} />
                     <YAxis yAxisId="left" stroke="#444" fontSize={8} />
                     <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={8} />
                     <Tooltip contentStyle={{backgroundColor:'#111', border:'none', fontSize:'10px'}} />
                     <Line yAxisId="left" type="monotone" dataKey="ingresos" name="Caja" stroke="#10b981" strokeWidth={3} dot={{r:3}} />
                     <Line yAxisId="right" type="monotone" dataKey="facturas" name="Cant. Facturas" stroke="#3b82f6" strokeWidth={3} dot={{r:3}} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Historial de Transacciones */}
      <div className="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/5">
        <h3 className="text-[9px] font-black text-gray-500 dark:text-white/20 uppercase tracking-widest mb-3">Historial de Transacciones</h3>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
          {filteredHistory.length === 0 ? (
            <p className="text-[9px] text-gray-400 dark:text-white/30 italic text-center py-4">Sin transacciones en el período seleccionado</p>
          ) : filteredHistory.slice().reverse().map((tx: any, i: number) => {
            const memberName = memberMap[tx.member_id] || tx.member_name || `Socio #${tx.member_id ?? '?'}`;
            const txDate = tx.date ? new Date(tx.date + 'T00:00:00').toLocaleDateString('es-AR') : '—';
            return (
              <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-black/30 rounded-lg px-3 py-2">
                <div>
                  <p className="text-[9px] font-black text-black dark:text-white leading-tight">{memberName}</p>
                  <p className="text-[7px] text-gray-400 dark:text-white/30">{txDate} · {tx.method || '—'}</p>
                  <p className="text-[7px] text-orange-400 font-black">Cobró: {tx.processed_by || '—'}</p>
                </div>
                <span className="text-[10px] font-black text-green-500">+${tx.amount?.toFixed(2) ?? '0.00'}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5 flex justify-between">
          <p className="text-[8px] text-gray-400 dark:text-white/20 uppercase font-black">{filteredHistory.length} transacciones</p>
          <p className="text-[9px] font-black text-green-500">Total: ${totalFilteredRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Deudores y Morosidad */}
      <div className="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/5">
        <h3 className="text-[9px] font-black text-gray-500 dark:text-white/20 uppercase tracking-widest mb-3">Reporte de Deudores y Morosidad</h3>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
          {debtors.length === 0 ? (
            <p className="text-[9px] text-gray-400 dark:text-white/30 italic text-center py-4">Sin socios en deuda o por vencer</p>
          ) : debtors.map((m: any) => (
            <div key={m.id} className="flex justify-between items-center bg-gray-50 dark:bg-black/30 rounded-lg px-3 py-2">
              <div>
                <p className="text-[9px] font-black text-black dark:text-white leading-tight">{m.name}</p>
                <p className="text-[7px] text-gray-400 dark:text-white/30">DNI {m.dni} · {m.membership_type || 'Sin plan'}</p>
              </div>
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${m.status === 'DEUDA' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
        {debtors.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5 flex justify-between">
            <p className="text-[8px] text-gray-400 dark:text-white/20 uppercase font-black">{debtors.filter((m:any)=>m.status==='DEUDA').length} en deuda · {debtors.filter((m:any)=>m.status==='POR VENCER').length} por vencer</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileModule({ user, onSave }: any) {
  const [password, setPassword] = useState('');
  
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-8 rounded-3xl text-center space-y-4">
         <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mx-auto text-black dark:text-white shadow-xl shadow-orange-500/20">
            <User size={32} />
         </div>
         <div>
            <h2 className="text-xl font-black text-black dark:text-white uppercase tracking-widest">{user?.name}</h2>
            <p className="text-[10px] text-orange-400 font-black uppercase mt-1">{user?.role}</p>
         </div>
      </div>
      
      <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
         <h3 className="text-xs font-black text-gray-600 dark:text-white/40 uppercase tracking-widest mb-4">Seguridad de la Cuenta</h3>
         <div className="space-y-2">
            <label className="text-[9px] text-gray-500 dark:text-white/20 uppercase font-black px-2">Nueva Contraseña</label>
            <input type="text" placeholder="Ingresa tu nueva clave..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs" value={password} onChange={e=>setPassword(e.target.value)} />
         </div>
         <button className="w-full py-4 bg-orange-500 rounded-xl font-black text-black dark:text-white text-xs uppercase transition-all hover:bg-orange-600 shadow-lg shadow-orange-500/20 mt-4" onClick={() => onSave(password)}>Guardar Cambios</button>
      </div>
    </div>
  );
}

function NoAccess() {
  return <div className="h-40 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10"><Lock size={24} className="text-red-500 mb-4" /><h3 className="text-xs font-black text-black dark:text-white uppercase tracking-widest">Acceso Restringido</h3></div>;
}

