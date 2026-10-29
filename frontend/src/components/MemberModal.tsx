import { useState, useEffect } from 'react';
import { X, Save, Paperclip, Upload, ExternalLink, Trash2, Check, Loader2, Eye, EyeOff, Lock } from 'lucide-react';
import ProgressChart from './ProgressChart';

export default function MemberModal({ member, plans, API_URL, onSave, onClose }: any) {
  const [activeTab, setActiveTab] = useState<'datos' | 'entrenamiento' | 'progreso'>('datos');
  const [formData, setFormData] = useState(member);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  
  // Entrenamiento State
  const [routine, setRoutine] = useState<any[]>(member?.routine || []);
  const [routineDocuments, setRoutineDocuments] = useState<any[]>(member?.routine_documents || []);
  const [trainingPlans, setTrainingPlans] = useState<any[]>([]);
  const [assignedPlanId, setAssignedPlanId] = useState<number | null>(member?.training_plan_id || null);
  const [appliedPlanNotice, setAppliedPlanNotice] = useState<string>('');
  const [rightPanelTab, setRightPanelTab] = useState<'exercises' | 'plans'>('exercises');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [progressData, setProgressData] = useState<any>(null);
  const [chartFilter, setChartFilter] = useState<'7d'|'30d'|'all'>('all');
  const [exercises, setExercises] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('Todos');
  const [selectedZone, setSelectedZone] = useState<string>('Todas');

  const segments = ['Todos', 'Tren superior', 'Tren medio / core', 'Tren inferior', 'Cuerpo completo'];
  const availableZones = selectedSegment === 'Todos' ? [] : Array.from(new Set(exercises.filter((e:any) => e.segment === selectedSegment).map((e:any) => e.zone)));

  useEffect(() => {
    setSelectedZone('Todas');
  }, [selectedSegment]);

  const [newClassMode, setNewClassMode] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(0);

  useEffect(() => {
    // Fetch exercise library
    fetch(`${API_URL}/admin/exercises`)
      .then(r => r.json())
      .then(data => setExercises(data))
      .catch(e => console.error(e));

    // Fetch training plans (paquetes)
    fetch(`${API_URL}/admin/training_plans`)
      .then(r => r.json())
      .then(data => setTrainingPlans(data))
      .catch(e => console.error(e));
      
    if (member?.dni) {
      fetch(`${API_URL}/user/${member.dni}/progress`)
        .then(r => r.json())
        .then(data => setProgressData(data))
        .catch(e => console.error("Error fetching progress", e));
    }
  }, [API_URL, member]);

  const handleAddClass = () => {
    if (!newClassName) return;
    setRoutine([...routine, { class_name: newClassName, exercises: [] }]);
    setNewClassName('');
    setNewClassMode(false);
    setSelectedClassIndex(routine.length);
  };

  const handleAddExercise = (ex: any) => {
    const updated = [...routine];
    if (!updated[selectedClassIndex]) return;
    updated[selectedClassIndex].exercises.push({
      exercise_id: ex.id,
      name: ex.name,
      sets: 4,
      reps: 10,
      kg: 0,
      coach_notes: ''
    });
    setRoutine(updated);
  };

  const handleUpdateExercise = (cIdx: number, eIdx: number, field: string, value: any) => {
    const updated = [...routine];
    updated[cIdx].exercises[eIdx][field] = value;
    setRoutine(updated);
  };

  const handleRemoveExercise = (cIdx: number, eIdx: number) => {
    const updated = [...routine];
    updated[cIdx].exercises.splice(eIdx, 1);
    setRoutine(updated);
  };

  // Apply complete pre-made Training Plan to Member
  const handleApplyTrainingPlan = (plan: any) => {
    if (!plan) return;
    if (routine.length > 0 && !window.confirm(`¿Deseas cargar el plan "${plan.name}" en la rutina del socio?`)) {
      return;
    }
    const newDays = JSON.parse(JSON.stringify(plan.days || []));
    setRoutine(newDays);
    setSelectedClassIndex(0);
    setAssignedPlanId(plan.id);
    setAppliedPlanNotice(`¡Plan "${plan.name}" cargado con ${newDays.length} día(s)! Guardá los cambios abajo para confirmar.`);

    // Also import plan documents if any
    if (plan.documents && plan.documents.length > 0) {
      const existingNames = (routineDocuments || []).map((d: any) => d.name);
      const newDocs = plan.documents.filter((d: any) => !existingNames.includes(d.name));
      setRoutineDocuments([...(routineDocuments || []), ...newDocs]);
    }
  };

  // Upload custom document for this member
  const handleUploadMemberDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("El archivo no debe superar los 15MB.");
      return;
    }

    setUploadingDoc(true);
    try {
      const reader = new FileReader();
      reader.onload = async (loadEvt) => {
        const base64Str = loadEvt.target?.result as string;
        try {
          const res = await fetch(`${API_URL}/admin/upload_document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              content_base64: base64Str,
              content_type: file.type || 'application/pdf'
            })
          });
          if (res.ok) {
            const data = await res.json();
            const newDoc = {
              name: file.name,
              url: data.url,
              size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            };
            setRoutineDocuments(prev => [...(prev || []), newDoc]);
          } else {
            const newDoc = {
              name: file.name,
              url: base64Str,
              size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            };
            setRoutineDocuments(prev => [...(prev || []), newDoc]);
          }
        } catch (err) {
          const newDoc = {
            name: file.name,
            url: base64Str,
            size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
          };
          setRoutineDocuments(prev => [...(prev || []), newDoc]);
        } finally {
          setUploadingDoc(false);
          e.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingDoc(false);
    }
  };

  const handleRemoveMemberDocument = (idx: number) => {
    setRoutineDocuments(prev => prev.filter((_: any, i: number) => i !== idx));
  };

  const handleSaveInternal = () => {
    const cleanFormData = { ...formData };
    if (passwordTouched && newPassword.trim()) {
      cleanFormData.password = newPassword.trim();
    } else if (cleanFormData.id) {
      // Editing existing member: do not overwrite password
      delete cleanFormData.password;
    } else {
      // New member
      cleanFormData.password = newPassword.trim() || '123';
    }

    onSave({ 
      ...cleanFormData, 
      training_plan_id: assignedPlanId,
      routine,
      routine_documents: routineDocuments
    });
  };

  const filteredExercises = exercises.filter((e:any) => {
    const matchSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (e.muscle_group && e.muscle_group.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchSegment = selectedSegment === 'Todos' || e.segment === selectedSegment;
    const matchZone = selectedZone === 'Todas' || e.zone === selectedZone;
    return matchSearch && matchSegment && matchZone;
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-8 rounded-[40px] w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh]">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-black dark:text-white uppercase tracking-widest">
            {member.id ? 'Editar Socio' : 'Nuevo Socio'}
          </h2>
          <button onClick={onClose}><X size={24} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors" /></button>
        </div>

        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-white/10 pb-2">
          <button onClick={() => setActiveTab('datos')} className={`text-[10px] font-black uppercase tracking-widest pb-2 ${activeTab === 'datos' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}>Datos Personales</button>
          <button onClick={() => setActiveTab('entrenamiento')} className={`text-[10px] font-black uppercase tracking-widest pb-2 ${activeTab === 'entrenamiento' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}>Entrenamiento y Planes</button>
          <button onClick={() => setActiveTab('progreso')} className={`text-[10px] font-black uppercase tracking-widest pb-2 ${activeTab === 'progreso' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}>Progreso</button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {activeTab === 'datos' && (
            <div className="space-y-4 w-full">
              <div className="grid grid-cols-2 gap-4">
                 <input type="text" placeholder="Nombre Completo" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={formData?.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                 <input type="text" placeholder="DNI" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={formData?.dni || ''} onChange={e => setFormData({...formData, dni: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <input type="text" placeholder="WhatsApp / Número" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={formData?.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                 <input type="email" placeholder="Correo Electrónico" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={formData?.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Plan Principal</label>
                <select className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs font-bold uppercase outline-none focus:border-orange-500" value={formData?.membership_type || plans[0]?.name || ''} onChange={e => setFormData({...formData, membership_type: e.target.value})}>
                   {plans.map((p:any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2 mt-4 p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-white/10">
                <label className="text-[10px] text-orange-500 font-black uppercase tracking-wider block">
                  Planes Adicionales (Unificables)
                </label>
                <p className="text-[9px] text-gray-400 dark:text-white/40 mb-2">
                  Seleccioná los planes complementarios que se sumarán al cobro y tendrán asistencias separadas:
                </p>
                {plans.filter((p: any) => p.allow_unification).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {plans.filter((p: any) => p.allow_unification).map((p: any) => {
                      const currentAdd = formData?.additional_plans || [];
                      const isChecked = currentAdd.includes(p.name);
                      return (
                        <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-orange-500/10 border-orange-500/50 text-orange-400 font-bold' : 'bg-white/5 border-white/5 text-gray-400'}`}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, additional_plans: [...currentAdd, p.name] });
                              } else {
                                setFormData({ ...formData, additional_plans: currentAdd.filter((n: string) => n !== p.name) });
                              }
                            }}
                            className="rounded text-orange-500 focus:ring-orange-500"
                          />
                          <div className="text-xs">
                            <p className="font-black uppercase">{p.name}</p>
                            <p className="text-[10px] opacity-70">${p.price?.toLocaleString()} — {p.days_per_week} d/sem</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No hay planes marcados con "Permitir unificación con otros planes".</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Fecha de Inicio del Plan</label>
                <input type="date" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={formData?.joined_at ? formData.joined_at.split('T')[0] : ''} onChange={e => setFormData({...formData, joined_at: e.target.value ? e.target.value + 'T00:00:00' : null})} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Próximo Vencimiento / Cobro</label>
                  <input 
                    type="date" 
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs outline-none focus:border-orange-500" 
                    value={formData?.next_due_date ? formData.next_due_date.split('T')[0] : ''} 
                    onChange={e => {
                      const val = e.target.value;
                      const day = val ? parseInt(val.split('-')[2], 10) : null;
                      setFormData({
                        ...formData, 
                        next_due_date: val ? val + 'T00:00:00' : null,
                        fixed_billing_day: formData?.keep_billing_day ? (formData?.fixed_billing_day || day) : formData?.fixed_billing_day
                      });
                    }} 
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={!!formData?.keep_billing_day} 
                      onChange={e => {
                        const checked = e.target.checked;
                        let fixedDay = formData?.fixed_billing_day;
                        if (checked && !fixedDay && formData?.next_due_date) {
                          fixedDay = parseInt(formData.next_due_date.split('T')[0].split('-')[2], 10);
                        }
                        setFormData({
                          ...formData, 
                          keep_billing_day: checked,
                          fixed_billing_day: checked ? fixedDay : null
                        });
                      }} 
                      className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500" 
                    />
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase text-black dark:text-white">Mantener día fijo de cobro</p>
                      <p className="text-[8px] text-gray-400 dark:text-white/40">
                        {formData?.keep_billing_day && formData?.fixed_billing_day 
                          ? `Fijado para el día ${formData.fixed_billing_day} de cada mes`
                          : 'Mantiene siempre el mismo día cada mes'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-2">
                  <label className="text-[9px] text-gray-500 dark:text-white/40 uppercase font-black flex items-center gap-1.5">
                    <Lock size={12} className="text-orange-500" />
                    Contraseña de Acceso
                  </label>
                  {member?.id && (
                    <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Cifrada en BD
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder={member?.id ? "•••••••• (Dejar en blanco para mantener la actual)" : "Asignar contraseña (por defecto: 123)"} 
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 pr-12 text-black dark:text-white text-xs outline-none focus:border-orange-500 transition-all placeholder:text-gray-400 dark:placeholder:text-white/30" 
                    value={newPassword} 
                    onChange={e => {
                      setNewPassword(e.target.value);
                      setPasswordTouched(true);
                    }} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 p-1 text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white transition-colors"
                    title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[8px] text-gray-400 dark:text-white/30 ml-2">
                  {member?.id 
                    ? "La contraseña actual está protegida y cifrada en la base de datos. Escribe aquí solo si deseas cambiarla."
                    : "Se guardará cifrada de forma segura en la base de datos."}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'progreso' && (
            <div className="w-full h-full flex flex-col gap-6">
              {(() => {
                let filteredEvolution: any[] = progressData?.chart_data || [];
                if (chartFilter === '7d') {
                  const limitDate = new Date();
                  limitDate.setDate(limitDate.getDate() - 7);
                  filteredEvolution = filteredEvolution.filter((e:any) => new Date(e.date) >= limitDate);
                } else if (chartFilter === '30d') {
                  const limitDate = new Date();
                  limitDate.setDate(limitDate.getDate() - 30);
                  filteredEvolution = filteredEvolution.filter((e:any) => new Date(e.date) >= limitDate);
                }

                let totalImprovement = 0;
                let daysTrained = filteredEvolution.length;
                if (filteredEvolution.length > 1) {
                  const first = filteredEvolution[0];
                  const last = filteredEvolution[filteredEvolution.length - 1];
                  let firstTotal = 0; let lastTotal = 0;
                  Object.keys(first).forEach(k => { if (k !== 'date' && typeof first[k] === 'number') firstTotal += first[k]; });
                  Object.keys(last).forEach(k => { if (k !== 'date' && typeof last[k] === 'number') lastTotal += last[k]; });
                  if (firstTotal > 0) totalImprovement = Math.round(((lastTotal - firstTotal) / firstTotal) * 100);
                }

                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center relative overflow-hidden">
                         <p className="text-[10px] font-black uppercase text-gray-500 dark:text-white/40 tracking-widest mb-1">Mejoría Total</p>
                         <p className="text-3xl font-black text-black dark:text-white flex items-baseline gap-1">
                           {totalImprovement > 0 ? `+${totalImprovement}%` : `${totalImprovement}%`}
                         </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center relative overflow-hidden">
                         <p className="text-[10px] font-black uppercase text-gray-500 dark:text-white/40 tracking-widest mb-1">Días Entrenados</p>
                         <p className="text-3xl font-black text-black dark:text-white">{daysTrained}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-3xl border border-gray-200 dark:border-white/10 flex flex-col min-h-[300px]">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black uppercase text-black dark:text-white">Gráfico de Cargas</h3>
                        <div className="flex gap-2">
                          <button onClick={() => setChartFilter('7d')} className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-colors ${chartFilter === '7d' ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-500 dark:text-white/40'}`}>7 Días</button>
                          <button onClick={() => setChartFilter('30d')} className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-colors ${chartFilter === '30d' ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-500 dark:text-white/40'}`}>30 Días</button>
                          <button onClick={() => setChartFilter('all')} className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-colors ${chartFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-500 dark:text-white/40'}`}>Histórico</button>
                        </div>
                      </div>
                      <ProgressChart data={filteredEvolution} />
                    </div>
                  </>
                );
              })()}
              
              {progressData?.uncompleted_history && progressData.uncompleted_history.length > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-3xl">
                  <h3 className="text-sm font-black uppercase mb-4 text-orange-500">Historial de Incompletos</h3>
                  <div className="space-y-2">
                    {progressData.uncompleted_history.map((uh: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                        <div>
                          <p className="text-xs font-bold text-white">{uh.exercise}</p>
                          <p className="text-[10px] text-white/50">{new Date(uh.date).toLocaleDateString()}</p>
                        </div>
                        <p className="text-xs font-bold text-orange-400 italic">"{uh.reason}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'entrenamiento' && (
            <div className="flex flex-col md:flex-row gap-6 h-full">
              {/* Routine Creator and Document List */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-gray-400">Días de Entrenamiento del Socio</h3>
                  {!newClassMode ? (
                    <button onClick={() => setNewClassMode(true)} className="text-[9px] bg-white/10 text-white px-2.5 py-1 rounded-md font-bold hover:bg-orange-500 hover:text-black transition-all">+ Agregar Día</button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="text" autoFocus placeholder="Ej: Día 1..." className="bg-black/40 border border-white/10 rounded-md px-2 py-1 text-xs text-white outline-none" value={newClassName} onChange={e=>setNewClassName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddClass()} />
                      <button onClick={handleAddClass} className="text-[9px] bg-orange-500 text-black px-2 py-1 rounded-md font-bold">OK</button>
                      <button onClick={() => setNewClassMode(false)} className="text-[9px] text-red-500 font-bold">X</button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2">
                  {routine.map((c, idx) => (
                    <button key={idx} onClick={() => setSelectedClassIndex(idx)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-colors ${selectedClassIndex === idx ? 'bg-orange-500 text-black shadow-md' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                      {c.class_name} ({c.exercises ? c.exercises.length : 0})
                    </button>
                  ))}
                  {routine.length === 0 && <p className="text-[10px] text-gray-500 italic">No hay días creados. Agregá un día o seleccioná un paquete prediseñado a la derecha.</p>}
                </div>

                {routine.length > 0 && routine[selectedClassIndex] && (
                  <div className="space-y-2 bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-200 dark:border-white/10">
                    <h4 className="text-[10px] font-black uppercase text-black dark:text-white mb-2">Ejercicios - {routine[selectedClassIndex].class_name}</h4>
                    {routine[selectedClassIndex].exercises.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-4 text-center">No hay ejercicios asignados en este día. Seleccioná de la lista de la derecha para sumar.</p>
                    ) : (
                      routine[selectedClassIndex].exercises.map((ex: any, eIdx: number) => (
                        <div key={eIdx} className="flex flex-col gap-2 bg-white dark:bg-black/40 p-3 rounded-xl border border-gray-200 dark:border-white/10">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-bold text-black dark:text-white truncate flex-1">{ex.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <input type="number" value={ex.sets} onChange={(e) => handleUpdateExercise(selectedClassIndex, eIdx, 'sets', parseInt(e.target.value) || 0)} className="w-12 bg-gray-100 dark:bg-white/10 border-none rounded-md text-xs text-center py-1 font-bold text-black dark:text-white" title="Sets" />
                              <span className="text-[10px] text-gray-400">x</span>
                              <input type="number" value={ex.reps} onChange={(e) => handleUpdateExercise(selectedClassIndex, eIdx, 'reps', parseInt(e.target.value) || 0)} className="w-12 bg-gray-100 dark:bg-white/10 border-none rounded-md text-xs text-center py-1 font-bold text-black dark:text-white" title="Reps" />
                              <span className="text-[10px] text-gray-400">|</span>
                              <span className="text-xs text-orange-500 font-bold">{ex.kg || 0}kg</span>
                              <button onClick={() => handleRemoveExercise(selectedClassIndex, eIdx)} className="text-red-500 ml-2 hover:opacity-80"><X size={14} /></button>
                            </div>
                          </div>
                          <input type="text" placeholder="Instrucciones del entrenador para este ejercicio..." value={ex.coach_notes || ''} onChange={(e) => handleUpdateExercise(selectedClassIndex, eIdx, 'coach_notes', e.target.value)} className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-[10px] text-black dark:text-white italic outline-none focus:border-orange-500/50" />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Attached Documents for this Member */}
                <div className="p-4 bg-gray-50 dark:bg-black/30 rounded-2xl border border-gray-200 dark:border-white/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-black dark:text-white flex items-center gap-2">
                        <Paperclip size={13} className="text-orange-500" />
                        Guías y Documentos Adjuntos del Socio (PDF / DOCX)
                      </h4>
                      <p className="text-[8px] text-gray-400 uppercase tracking-wider">
                        Visibles para el socio desde su app móvil (/app)
                      </p>
                    </div>
                    <label className="cursor-pointer bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-orange-500 hover:text-black transition-all flex items-center gap-1.5 shadow-sm">
                      {uploadingDoc ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                      {uploadingDoc ? "Subiendo..." : "+ Adjuntar"}
                      <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleUploadMemberDocument} disabled={uploadingDoc} />
                    </label>
                  </div>

                  {routineDocuments && routineDocuments.length > 0 ? (
                    <div className="space-y-1.5">
                      {routineDocuments.map((doc: any, dIdx: number) => (
                        <div key={dIdx} className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-white/10 text-xs">
                          <span className="font-bold text-black dark:text-white truncate flex-1">{doc.name}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 p-1 hover:underline">
                              <ExternalLink size={13} />
                            </a>
                            <button onClick={() => handleRemoveMemberDocument(dIdx)} className="text-red-500 p-1 hover:opacity-80">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">No hay documentos adjuntos asignados a este socio aún.</p>
                  )}
                </div>
              </div>

              {/* Right Side: Switcher between Exercise Library & Training Plans Packs */}
              <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-gray-200 dark:border-white/10 pt-4 md:pt-0 md:pl-6 space-y-3">
                <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10">
                  <button
                    onClick={() => setRightPanelTab('exercises')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                      rightPanelTab === 'exercises' ? 'bg-orange-500 text-black shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Ejercicios Sueltos
                  </button>
                  <button
                    onClick={() => setRightPanelTab('plans')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                      rightPanelTab === 'plans' ? 'bg-orange-500 text-black shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Paquetes de Planes ({trainingPlans.length})
                  </button>
                </div>

                {/* Sub-tab 1: Individual Exercises */}
                {rightPanelTab === 'exercises' && (
                  <div className="space-y-2 flex-1 flex flex-col">
                    <input type="text" placeholder="Buscar ejercicio..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-[10px] text-black dark:text-white outline-none focus:border-orange-500" />
                    
                    <div className="flex flex-wrap gap-1">
                      {segments.map(seg => (
                        <button key={seg} onClick={() => setSelectedSegment(seg)} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${selectedSegment === seg ? 'bg-orange-500 text-black' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200'}`}>
                          {seg}
                        </button>
                      ))}
                    </div>

                    {availableZones.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => setSelectedZone('Todas')} className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${selectedZone === 'Todas' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-white'}`}>
                          Todas
                        </button>
                        {availableZones.map((zone: any) => (
                          <button key={zone} onClick={() => setSelectedZone(zone)} className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${selectedZone === zone ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-white'}`}>
                            {zone}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto space-y-1.5 max-h-80 custom-scrollbar pr-1">
                      {filteredExercises.map(ex => (
                        <button key={ex.id} onClick={() => handleAddExercise(ex)} className="w-full text-left bg-gray-50 dark:bg-white/5 hover:bg-orange-500/10 p-2.5 rounded-xl border border-transparent hover:border-orange-500/30 transition-colors group flex justify-between items-center">
                          <div className="truncate flex-1">
                            <div className="text-[10px] font-bold text-black dark:text-white group-hover:text-orange-500 truncate">{ex.name}</div>
                            <div className="text-[8px] text-gray-400">{ex.muscle_group || ex.segment}</div>
                          </div>
                          <span className="text-orange-500 text-xs font-bold shrink-0 ml-1">+</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: Pre-made Plans / Packs */}
                {rightPanelTab === 'plans' && (
                  <div className="space-y-2.5 flex-1 overflow-y-auto max-h-96 custom-scrollbar pr-1">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Seleccioná un plan para aplicarlo al socio:</p>
                    {trainingPlans.map(plan => (
                      <div key={plan.id} className="p-3.5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-2 hover:border-orange-500/40 transition-all">
                        <div className="flex justify-between items-start gap-1">
                          <h5 className="font-black text-xs text-black dark:text-white uppercase truncate flex-1">{plan.name}</h5>
                          <span className="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[8px] font-black uppercase rounded">
                            {plan.category || 'General'}
                          </span>
                        </div>
                        {plan.description && (
                          <p className="text-[9px] text-gray-500 dark:text-white/50 line-clamp-2">{plan.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-[8px] text-gray-400 font-bold">
                          <span>{plan.days?.length || 0} Días</span>
                          <span>•</span>
                          <span>{(plan.days || []).reduce((a: number, d: any) => a + (d.exercises?.length || 0), 0)} Ejercicios</span>
                          {plan.documents && plan.documents.length > 0 && (
                            <span className="text-blue-400">• 📄 {plan.documents.length} Archivo(s)</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleApplyTrainingPlan(plan)}
                          className="w-full mt-1 py-2 bg-orange-500 hover:bg-orange-600 text-black font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <Check size={12} /> Cargar este Plan al Socio
                        </button>
                      </div>
                    ))}

                    {trainingPlans.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-xs italic">
                        No hay paquetes de planes creados. Creá uno en el módulo "Ejercicios" {'>'} "Planes".
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div>
            {appliedPlanNotice && (
              <span className="text-[10px] font-bold text-green-500 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                <Check size={12} strokeWidth={3} /> {appliedPlanNotice}
              </span>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={onClose} className="px-6 py-3 rounded-xl text-xs font-black uppercase text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Cancelar</button>
            <button onClick={handleSaveInternal} className="px-8 py-3 bg-orange-500 text-black rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-orange-600 transition-colors flex items-center gap-2">
              <Save size={16} /> Guardar Socio
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
