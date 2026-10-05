import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Sun, Moon, LogOut, Plus, Minus, Save, Dumbbell, TrendingUp,
  CheckCircle, AlertCircle, Clock, X, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

interface EvolutionEntry {
  date: string;
  exercises: Exercise[];
}

interface MemberData {
  id: number;
  dni: string;
  name: string;
  email: string;
  status: string;
  membership_type: string;
  joined_at: string;
  evolution: EvolutionEntry[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_URL =
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api'
    : 'http://localhost:8000';

const EXERCISE_CATEGORIES: Record<string, string[]> = {
  Piernas: ['Sentadillas', 'Prensa de Piernas', 'Extensión de Cuádríceps', 'Curl de Isquiotibiales', 'Peso Muerto', 'Zancadas'],
  Pecho: ['Press Banca', 'Press Inclinado', 'Aperturas', 'Fondos en Paralelas'],
  Espalda: ['Dominadas', 'Remo con Barra', 'Remo con Mancuerna', 'Jalón al Pecho'],
  Hombros: ['Press Militar', 'Elevaciones Laterales', 'Press Arnold', 'Pájaros'],
  Brazos: ['Curl de Bíceps', 'Curl Martillo', 'Tríceps en Polea', 'Fondos de Tríceps'],
  Core: ['Plancha', 'Abdominales', 'Russian Twist', 'Elevación de Piernas'],
  Cardio: ['Caminadora', 'Bicicleta Estática', 'Elíptica', 'Saltar la Soga'],
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof CheckCircle }> = {
  ACTIVO:      { label: 'Activo',      color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30',  Icon: CheckCircle },
  DEUDA:       { label: 'En Deuda',    color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30',    Icon: AlertCircle },
  'POR VENCER':{ label: 'Por Vencer',  color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', Icon: Clock },
  INACTIVO:    { label: 'Inactivo',    color: 'text-gray-400',   bg: 'bg-gray-400/10',   border: 'border-gray-400/30',   Icon: AlertCircle },
};

const CHART_COLORS = ['#F38E26','#F38E26','#10b981','#a855f7','#f43f5e','#eab308','#06b6d4'];

const todayISO = () => new Date().toISOString().split('T')[0];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildChartData(evolution: EvolutionEntry[]) {
  const allNames = Array.from(
    new Set(evolution.flatMap(e => e.exercises.map(ex => ex.name)))
  );
  return evolution.map(entry => {
    const row: Record<string, string | number> = { date: entry.date };
    allNames.forEach(name => {
      const ex = entry.exercises.find(e => e.name === name);
      if (ex) row[name] = ex.weight;
    });
    return row;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NumPad({ value, onChange, onSubmit, loading, error, isDark }:
  { value: string; onChange: (v: string) => void; onSubmit: () => void; loading: boolean; error: string; isDark: boolean }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <div className="w-full max-w-xs mx-auto space-y-3">
      <div className={`rounded-2xl border-2 px-5 py-4 text-center text-3xl font-black tracking-[0.3em] transition-colors
        ${error ? 'border-red-500 text-red-400' :
          isDark ? 'border-[#F38E26]/40 text-white bg-white/5' : 'border-[#F38E26]/50 text-gray-900 bg-white/70'}`}>
        {value || <span className="opacity-30">DNI</span>}
      </div>
      {error && (
        <p className="text-center text-red-400 text-sm font-medium">{error}</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k, i) => (
          <button
            key={i}
            disabled={k === '' || loading}
            onClick={() => {
              if (k === '⌫') onChange(value.slice(0, -1));
              else if (k !== '') onChange(value + k);
            }}
            className={`h-16 rounded-2xl text-2xl font-bold transition-all active:scale-95
              ${k === '' ? 'invisible' : ''}
              ${k === '⌫'
                ? isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-100 text-red-500 hover:bg-red-200'
                : isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white/80 text-gray-800 hover:bg-white shadow-sm'
              }`}
          >
            {k}
          </button>
        ))}
      </div>
      <button
        onClick={onSubmit}
        disabled={value.length < 4 || loading}
        className={`w-full h-16 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed
          text-xl font-black tracking-wide transition-all active:scale-95 shadow-lg border border-[#F38E26]
          ${isDark ? 'bg-[#F38E26] text-[#0a0a0a]' : 'bg-[#0a0a0a] text-white'}`}
      >
        {loading ? 'Buscando...' : 'INGRESAR →'}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-10">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:'rgba(243,142,38,0.3)', borderTopColor:'#F38E26'}} />
    </div>
  );
}

function CounterBtn({ label, value, onChange, min = 0, step = 1, isDark }:
  { label: string; value: number; onChange: (v: number) => void; min?: number; step?: number; isDark: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90
            ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
        >
          <Minus size={14} />
        </button>
        <span className={`w-12 text-center text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {value}{label === 'Peso' ? '' : ''}
        </span>
        <button
          onClick={() => onChange(value + step)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
          style={{backgroundColor:'#F38E26'}}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function ExerciseCard({ ex, onUpdate, onRemove, isDark }:
  { ex: Exercise; onUpdate: (e: Exercise) => void; onRemove: () => void; isDark: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`rounded-2xl p-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`font-bold text-sm`} style={{color: isDark ? '#F38E26' : '#d07020'}}>{ex.name}</span>
        <button onClick={onRemove} className={`rounded-full p-1 transition-colors ${isDark ? 'hover:bg-white/10 text-white/40' : 'hover:bg-gray-100 text-gray-400'}`}>
          <X size={14} />
        </button>
      </div>
      <div className="flex justify-around">
        <CounterBtn label="Series" value={ex.sets} onChange={v => onUpdate({ ...ex, sets: v })} min={1} isDark={isDark} />
        <CounterBtn label="Reps" value={ex.reps} onChange={v => onUpdate({ ...ex, reps: v })} min={1} isDark={isDark} />
        <CounterBtn label="Peso" value={ex.weight} onChange={v => onUpdate({ ...ex, weight: v })} min={0} step={2.5} isDark={isDark} />
      </div>
      <p className={`text-center text-xs mt-2 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
        {ex.sets} × {ex.reps} rep  ·  {ex.weight} kg
      </p>
    </motion.div>
  );
}

function ExercisePicker({ onAdd, isDark }: { onAdd: (name: string) => void; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full h-12 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2
          font-bold text-sm hover:bg-[#F38E26]/5 transition-all"
        style={{borderColor:'rgba(243,142,38,0.4)', color:'#F38E26'}}
      >
        <Plus size={18} /> Agregar Ejercicio
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className={`absolute bottom-14 left-0 right-0 z-50 rounded-2xl border shadow-2xl max-h-80 overflow-y-auto
              ${isDark ? 'bg-[#1b2435] border-white/10' : 'bg-white border-gray-200'}`}
          >
            <div className="p-2">
              {Object.entries(EXERCISE_CATEGORIES).map(([cat, exs]) => (
                <div key={cat}>
                  <button
                    onClick={() => setOpenCat(openCat === cat ? null : cat)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-colors
                      ${isDark ? 'hover:bg-white/5' : 'hover:bg-[#F38E26]/5'}`}
                    style={{color: isDark ? '#F38E26' : '#d07020'}}
                  >
                    {cat}
                    {openCat === cat ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <AnimatePresence>
                    {openCat === cat && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-4 pb-2 flex flex-col gap-1">
                          {exs.map(name => (
                            <button
                              key={name}
                              onClick={() => { onAdd(name); setOpen(false); setOpenCat(null); }}
                              className={`text-left text-sm px-3 py-2 rounded-lg transition-colors
                                ${isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-orange-50 text-gray-700'}`}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TotemPlan() {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('totem-theme') !== 'light'; } catch { return true; }
  });
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [dniInput, setDniInput] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [member, setMember] = useState<MemberData | null>(null);
  const [activeTab, setActiveTab] = useState<'training' | 'history'>('training');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // Persist theme
  useEffect(() => {
    try { localStorage.setItem('totem-theme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  const handleLogin = useCallback(async () => {
    if (dniInput.length < 4) return;
    setLoadingLogin(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/totem/${dniInput}`);
      if (!res.ok) {
        setLoginError('DNI no encontrado. Verificá tus datos.');
        return;
      }
      const data: MemberData = await res.json();
      setMember(data);

      // Load today's exercises from evolution history
      const todayEntry = data.evolution.find(e => e.date === todayISO());
      setExercises(todayEntry ? todayEntry.exercises : []);
      setView('dashboard');
      setDniInput('');
    } catch {
      setLoginError('Error de conexión. Intentá nuevamente.');
    } finally {
      setLoadingLogin(false);
    }
  }, [dniInput]);

  const handleLogout = () => {
    setMember(null);
    setExercises([]);
    setView('login');
    setSaveOk(false);
    setActiveTab('training');
  };

  const addExercise = (name: string) => {
    if (exercises.find(e => e.name === name)) return;
    setExercises(prev => [...prev, { name, sets: 3, reps: 10, weight: 20 }]);
  };

  const updateExercise = (idx: number, updated: Exercise) => {
    setExercises(prev => prev.map((e, i) => i === idx ? updated : e));
  };

  const removeExercise = (idx: number) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!member || exercises.length === 0) return;
    setSaving(true);
    const entry: EvolutionEntry = { date: todayISO(), exercises };
    try {
      const res = await fetch(`${API_URL}/totem/${member.dni}/evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        const data = await res.json();
        setMember(prev => prev ? { ...prev, evolution: data.evolution } : prev);
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Chart data ───────────────────────────────────────────────────────────
  const chartData = member ? buildChartData(member.evolution) : [];
  const chartKeys = member
    ? Array.from(new Set(member.evolution.flatMap(e => e.exercises.map(ex => ex.name))))
    : [];

  // ─── Status config ────────────────────────────────────────────────────────
  const statusCfg = member ? (STATUS_CFG[member.status] ?? STATUS_CFG['INACTIVO']) : null;

  // ─── Theme classes ────────────────────────────────────────────────────────
  const bg    = isDark ? 'bg-[#0a0a0a]'         : 'bg-[#F38E26]';
  const card  = isDark ? 'bg-black/30 border-white/10' : 'bg-white border-[#F38E26]/30 text-gray-900 shadow-sm';
  const text  = isDark ? 'text-white'            : 'text-white';
  const muted = isDark ? 'text-white/50'         : 'text-white/70';

  return (
    <div className={`min-h-screen ${bg} ${text} font-['Outfit',sans-serif] transition-colors duration-300`}>

      {/* ─── LOGIN SCREEN ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {view === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
            </div>

            {/* Theme toggle */}
            <button
              onClick={() => setIsDark(v => !v)}
              className={`absolute top-6 right-6 p-3 rounded-full border transition-all
                ${isDark ? 'bg-white/10 border-white/20 text-yellow-400 hover:bg-white/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100 shadow-sm'}`}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Logo */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-8 flex flex-col items-center gap-4"
            >
              <img src="/bunker.png" alt="Bunker Gym Logo" className="w-44 h-44 object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)] drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]" />
              <div className="text-center">
                <h1 className="text-3xl font-black tracking-tight" style={{color:'#F38E26'}}>FUSION FITNESS</h1>
                <p className={`text-sm font-semibold tracking-[0.2em] uppercase mt-1 ${muted}`}>Totem de Entrenamiento</p>
              </div>
            </motion.div>

            {/* DNI input + numpad */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-full max-w-xs"
            >
              <p className={`text-center text-sm font-medium mb-4 ${muted}`}>Ingresá tu DNI para ver tu plan</p>
              <NumPad
                value={dniInput}
                onChange={v => { setDniInput(v); setLoginError(''); }}
                onSubmit={handleLogin}
                loading={loadingLogin}
                error={loginError}
                isDark={isDark}
              />
            </motion.div>
          </motion.div>
        )}

        {/* ─── DASHBOARD SCREEN ────────────────────────────────────────────── */}
        {view === 'dashboard' && member && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="min-h-screen flex flex-col"
          >
            {/* Header */}
            <header className={`sticky top-0 z-40 border-b px-6 py-4 flex items-center justify-between backdrop-blur-sm
              ${isDark ? 'bg-[#141b29]/95 border-white/10' : 'bg-white/90 border-gray-200'}`}>
              <div className="flex items-center gap-4">
                <img src="/bunker.png" alt="Bunker Gym Logo" className="w-9 h-9 object-contain" />
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Bienvenido/a</p>
                  <h2 className="text-lg font-black leading-tight">{member.name}</h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Status badge */}
                {statusCfg && (
                  <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border
                    ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}>
                    <statusCfg.Icon size={12} />
                    {statusCfg.label}
                  </div>
                )}
                {/* Theme toggle */}
                <button
                  onClick={() => setIsDark(v => !v)}
                  className={`p-2.5 rounded-full border transition-all
                    ${isDark ? 'bg-white/10 border-white/20 text-yellow-400 hover:bg-white/20' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                >
                  {isDark ? <Sun size={17} /> : <Moon size={17} />}
                </button>
                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className={`p-2.5 rounded-full border transition-all
                    ${isDark ? 'bg-white/10 border-white/20 text-white/60 hover:bg-red-500/20 hover:text-red-400 hover:border-red-400/30'
                             : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200'}`}
                >
                  <LogOut size={17} />
                </button>
              </div>
            </header>

            {/* Plan info strip */}
            <div className={`px-6 py-4 border-b ${isDark ? 'border-white/5 bg-orange-500/5' : 'border-orange-100 bg-orange-50'}`}>
              <div className="max-w-2xl mx-auto flex flex-wrap items-center gap-4 text-sm">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold
                  ${isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-100 text-orange-700'}`}>
                  <Dumbbell size={15} />
                  {member.membership_type || 'Sin plan'}
                </div>
                <div className={`${muted} text-xs`}>
                  Miembro desde {member.joined_at ? new Date(member.joined_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : '—'}
                </div>
                {statusCfg && (
                  <div className={`sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border
                    ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}>
                    <statusCfg.Icon size={11} />
                    {statusCfg.label}
                  </div>
                )}
              </div>
            </div>

            {/* Tab bar */}
            <div className={`px-6 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="max-w-2xl mx-auto flex gap-1 pt-3 pb-0">
                {([['training', Dumbbell, 'Entrenamiento de Hoy'], ['history', TrendingUp, 'Historial']] as const).map(([tab, Icon, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-bold transition-all border-b-2
                       ${activeTab === tab
                        ? (isDark ? 'text-[#F38E26] border-[#F38E26] bg-[#F38E26]/10' : 'text-[#d07020] border-[#F38E26] bg-[#F38E26]/5')
                        : (isDark ? 'text-white/40 border-transparent hover:text-white/70' : 'text-gray-400 border-transparent hover:text-gray-600')
                       }`}
                  >
                    <Icon size={15} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="max-w-2xl mx-auto">
                <AnimatePresence mode="wait">

                  {/* ── TRAINING TAB ─────────────────────────────────────── */}
                  {activeTab === 'training' && (
                    <motion.div
                      key="training"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-black text-lg">Registro de hoy</h3>
                          <p className={`text-xs ${muted}`}>
                            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                        </div>
                        {exercises.length > 0 && (
                          <motion.button
                            onClick={handleSave}
                            disabled={saving}
                            whileTap={{ scale: 0.95 }}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg border border-[#F38E26] ${saveOk ? 'bg-[#10b981] border-green-500 text-white' : isDark ? 'bg-[#F38E26] text-[#0a0a0a]' : 'bg-[#0a0a0a] text-white'}`}
                          >
                            {saving ? <Spinner /> : saveOk ? <CheckCircle size={16} /> : <Save size={16} />}
                            {saving ? 'Guardando…' : saveOk ? '¡Guardado!' : 'Guardar'}
                          </motion.button>
                        )}
                      </div>

                      {exercises.length === 0 && (
                        <div className={`rounded-2xl border-2 border-dashed p-10 text-center
                          ${isDark ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'}`}>
                          <Dumbbell size={32} className="mx-auto mb-3 opacity-40" />
                          <p className="font-semibold text-sm">Todavía no agregaste ejercicios</p>
                          <p className="text-xs mt-1 opacity-60">Usá el botón de abajo para empezar</p>
                        </div>
                      )}

                      <AnimatePresence>
                        {exercises.map((ex, i) => (
                          <ExerciseCard
                            key={ex.name}
                            ex={ex}
                            onUpdate={updated => updateExercise(i, updated)}
                            onRemove={() => removeExercise(i)}
                            isDark={isDark}
                          />
                        ))}
                      </AnimatePresence>

                      <ExercisePicker onAdd={addExercise} isDark={isDark} />
                    </motion.div>
                  )}

                  {/* ── HISTORY TAB ──────────────────────────────────────── */}
                  {activeTab === 'history' && (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <h3 className="font-black text-lg">Evolución de pesos</h3>

                      {chartData.length < 2 ? (
                        <div className={`rounded-2xl border-2 border-dashed p-10 text-center
                          ${isDark ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'}`}>
                          <TrendingUp size={32} className="mx-auto mb-3 opacity-40" />
                          <p className="font-semibold text-sm">Necesitás al menos 2 sesiones guardadas</p>
                          <p className="text-xs mt-1 opacity-60">¡Seguí entrenando y acá vas a ver tu progreso!</p>
                        </div>
                      ) : (
                        <div className={`rounded-2xl border p-4 ${card}`}>
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#ffffff10' : '#f0f0f0'} />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: isDark ? '#ffffff60' : '#9ca3af' }}
                                tickFormatter={d => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: isDark ? '#ffffff60' : '#9ca3af' }}
                                unit=" kg"
                              />
                              <Tooltip
                                contentStyle={{
                                  background: isDark ? '#18181b' : '#fff',
                                  border: isDark ? '1px solid #ffffff20' : '1px solid #e5e7eb',
                                  borderRadius: 12,
                                  fontSize: 12,
                                }}
                                formatter={(v) => [`${v ?? 0} kg`]}
                                labelFormatter={d => new Date(d as any).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                              />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              {chartKeys.map((key, i) => (
                                <Line
                                  key={key}
                                  type="monotone"
                                  dataKey={key}
                                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                  strokeWidth={2}
                                  dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                                  activeDot={{ r: 6 }}
                                  connectNulls
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* History list */}
                      <div className="space-y-3">
                        {[...member.evolution].reverse().map(entry => (
                          <div key={entry.date} className={`rounded-2xl border p-4 ${card}`}>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                              {new Date(entry.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {entry.exercises.map(ex => (
                                <div
                                  key={ex.name}
                                  className={`text-xs px-3 py-1.5 rounded-xl font-medium
                                    ${isDark ? 'bg-white/5 text-white/70' : 'bg-gray-100 text-gray-700'}`}
                                >
                                  {ex.name} · {ex.sets}×{ex.reps} · <span className="font-black">{ex.weight}kg</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
