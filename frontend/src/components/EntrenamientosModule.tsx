import { useState, useEffect } from 'react';
import { Search, Trash2, X, Edit2, FileText, Upload, Plus, Dumbbell, Layers, Check, ExternalLink, Paperclip, Loader2, UserCheck } from 'lucide-react';

export default function EntrenamientosModule({ API_URL }: any) {
  const [activeModuleTab, setActiveModuleTab] = useState<'exercises' | 'plans'>('exercises');

  // -------------------- EXERCISE LIBRARY STATE --------------------
  const [exercises, setExercises] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('Todos');
  const [selectedZone, setSelectedZone] = useState<string>('Todas');
  const [editingId, setEditingId] = useState<number | null>(null);

  const initialForm = {
    name: '',
    segment: 'Tren superior',
    zone: 'Pecho',
    muscle_group: '',
    mechanics: '',
    equipment: '',
    video_url: '',
    instructions: '',
    rpe: '',
    rir: ''
  };
  const [formData, setFormData] = useState<any>(initialForm);

  // -------------------- TRAINING PLANS (PAQUETES) STATE --------------------
  const [trainingPlans, setTrainingPlans] = useState<any[]>([]);
  const [planSearch, setPlanSearch] = useState('');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);

  const initialPlanForm = {
    name: '',
    description: '',
    category: 'Musculación',
    days: [
      { class_name: 'Día 1', exercises: [] }
    ],
    documents: [] as any[]
  };
  const [planFormData, setPlanFormData] = useState<any>(initialPlanForm);
  const [selectedPlanDay, setSelectedPlanDay] = useState<number>(0);
  const [planExSearch, setPlanExSearch] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Inline create exercise inside plan
  const [inlineNewExMode, setInlineNewExMode] = useState(false);
  const [inlineExData, setInlineExData] = useState({
    name: '',
    segment: 'Tren superior',
    zone: 'Pecho',
    muscle_group: ''
  });

  const loadExercises = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/exercises`);
      if (res.ok) {
        setExercises(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadTrainingPlans = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/training_plans`);
      if (res.ok) {
        setTrainingPlans(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadExercises();
    loadTrainingPlans();
  }, [API_URL]);

  // -------------------- EXERCISE ACTIONS --------------------
  const handleSaveExercise = async () => {
    if (!formData.name) return;
    try {
      const url = editingId ? `${API_URL}/admin/exercises/${editingId}` : `${API_URL}/admin/exercises`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(initialForm);
        loadExercises();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditExercise = (ex: any) => {
    setFormData(ex);
    setEditingId(ex.id);
    setIsModalOpen(true);
  };

  const handleDeleteExercise = async (id: number) => {
    if (!window.confirm("¿Eliminar ejercicio de la biblioteca?")) return;
    try {
      const res = await fetch(`${API_URL}/admin/exercises/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadExercises();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // -------------------- PLAN ACTIONS --------------------
  const handleOpenNewPlan = () => {
    setEditingPlanId(null);
    setPlanFormData(initialPlanForm);
    setSelectedPlanDay(0);
    setInlineNewExMode(false);
    setIsPlanModalOpen(true);
  };

  const handleEditPlan = (plan: any) => {
    setEditingPlanId(plan.id);
    setPlanFormData({
      name: plan.name || '',
      description: plan.description || '',
      category: plan.category || 'Musculación',
      days: plan.days && plan.days.length > 0 ? plan.days : [{ class_name: 'Día 1', exercises: [] }],
      documents: plan.documents || []
    });
    setSelectedPlanDay(0);
    setInlineNewExMode(false);
    setIsPlanModalOpen(true);
  };

  const handleDeletePlan = async (id: number) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este plan de entrenamiento?")) return;
    try {
      const res = await fetch(`${API_URL}/admin/training_plans/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadTrainingPlans();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePlan = async () => {
    if (!planFormData.name.trim()) {
      alert("Por favor ingresa un nombre para el plan.");
      return;
    }
    try {
      const url = editingPlanId ? `${API_URL}/admin/training_plans/${editingPlanId}` : `${API_URL}/admin/training_plans`;
      const method = editingPlanId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planFormData)
      });
      if (res.ok) {
        setIsPlanModalOpen(false);
        setEditingPlanId(null);
        setPlanFormData(initialPlanForm);
        loadTrainingPlans();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error al guardar plan: ${err.detail || res.status}`);
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión al guardar el plan.");
    }
  };

  // Plan Day operations
  const handleAddPlanDay = () => {
    const newDayNum = planFormData.days.length + 1;
    const newDays = [...planFormData.days, { class_name: `Día ${newDayNum}`, exercises: [] }];
    setPlanFormData({ ...planFormData, days: newDays });
    setSelectedPlanDay(newDays.length - 1);
  };

  const handleRemovePlanDay = (dIdx: number) => {
    if (planFormData.days.length <= 1) {
      alert("El plan debe tener al menos un día.");
      return;
    }
    const newDays = planFormData.days.filter((_: any, idx: number) => idx !== dIdx);
    setPlanFormData({ ...planFormData, days: newDays });
    setSelectedPlanDay(Math.max(0, dIdx - 1));
  };

  const handleAddExerciseToPlan = (ex: any) => {
    const daysCopy = [...planFormData.days];
    if (!daysCopy[selectedPlanDay]) return;
    daysCopy[selectedPlanDay].exercises.push({
      exercise_id: ex.id,
      name: ex.name,
      sets: 4,
      reps: 10,
      kg: 0,
      coach_notes: ''
    });
    setPlanFormData({ ...planFormData, days: daysCopy });
  };

  const handleUpdatePlanExercise = (eIdx: number, field: string, val: any) => {
    const daysCopy = [...planFormData.days];
    if (!daysCopy[selectedPlanDay] || !daysCopy[selectedPlanDay].exercises[eIdx]) return;
    daysCopy[selectedPlanDay].exercises[eIdx][field] = val;
    setPlanFormData({ ...planFormData, days: daysCopy });
  };

  const handleRemovePlanExercise = (eIdx: number) => {
    const daysCopy = [...planFormData.days];
    if (!daysCopy[selectedPlanDay]) return;
    daysCopy[selectedPlanDay].exercises.splice(eIdx, 1);
    setPlanFormData({ ...planFormData, days: daysCopy });
  };

  // Inline create exercise directly into plan & library
  const handleCreateInlineExercise = async () => {
    if (!inlineExData.name.trim()) {
      alert("Ingresa el nombre del nuevo ejercicio.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/admin/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inlineExData)
      });
      if (res.ok) {
        const newEx = await res.json();
        loadExercises();
        handleAddExerciseToPlan(newEx);
        setInlineExData({ name: '', segment: 'Tren superior', zone: 'Pecho', muscle_group: '' });
        setInlineNewExMode(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Document Upload Handler (PDF / DOCX via Vercel Blob or Base64)
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 15MB)
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
              size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
              uploaded_at: new Date().toISOString()
            };
            setPlanFormData((prev: any) => ({
              ...prev,
              documents: [...(prev.documents || []), newDoc]
            }));
          } else {
            // Fallback inline data URI
            const newDoc = {
              name: file.name,
              url: base64Str,
              size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
              uploaded_at: new Date().toISOString()
            };
            setPlanFormData((prev: any) => ({
              ...prev,
              documents: [...(prev.documents || []), newDoc]
            }));
          }
        } catch (uploadErr) {
          console.warn("Upload endpoint failed, falling back to data URI", uploadErr);
          const newDoc = {
            name: file.name,
            url: base64Str,
            size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
            uploaded_at: new Date().toISOString()
          };
          setPlanFormData((prev: any) => ({
            ...prev,
            documents: [...(prev.documents || []), newDoc]
          }));
        } finally {
          setUploadingDoc(false);
          e.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error reading file", err);
      setUploadingDoc(false);
    }
  };

  const handleRemoveDocument = (docIdx: number) => {
    const updatedDocs = planFormData.documents.filter((_: any, idx: number) => idx !== docIdx);
    setPlanFormData({ ...planFormData, documents: updatedDocs });
  };

  const segments = ['Todos', 'Tren superior', 'Tren medio / core', 'Tren inferior', 'Cuerpo completo'];
  const availableZones = selectedSegment === 'Todos' ? [] : Array.from(new Set(exercises.filter(e => e.segment === selectedSegment).map(e => e.zone)));

  useEffect(() => {
    setSelectedZone('Todas');
  }, [selectedSegment]);

  // Plan Exercises Category & Zone Filters
  const [planSelectedSegment, setPlanSelectedSegment] = useState<string>('Todos');
  const [planSelectedZone, setPlanSelectedZone] = useState<string>('Todas');
  const planAvailableZones = planSelectedSegment === 'Todos' 
    ? [] 
    : Array.from(new Set(exercises.filter(e => e.segment === planSelectedSegment).map(e => e.zone))).filter(Boolean);

  useEffect(() => {
    setPlanSelectedZone('Todas');
  }, [planSelectedSegment]);

  // Modal: Asignar Plan a Socios
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningPlan, setAssigningPlan] = useState<any>(null);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [assignMemberSearch, setAssignMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  const handleOpenAssignModal = async (plan: any) => {
    setAssigningPlan(plan);
    setIsAssignModalOpen(true);
    setAssignMemberSearch('');
    try {
      const res = await fetch(`${API_URL}/admin/members`);
      if (res.ok) {
        const data = await res.json();
        setMembersList(data);
        const alreadyAssigned = data.filter((m: any) => m.training_plan_id === plan.id).map((m: any) => m.id);
        setSelectedMemberIds(alreadyAssigned);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMemberSelect = (memberId: number) => {
    setSelectedMemberIds(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleConfirmAssign = async () => {
    if (!assigningPlan) return;
    if (selectedMemberIds.length === 0) {
      alert("Seleccioná al menos un socio para asignarle el plan.");
      return;
    }
    setIsAssigning(true);
    try {
      const res = await fetch(`${API_URL}/admin/training_plans/${assigningPlan.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: selectedMemberIds })
      });
      if (res.ok) {
        alert(`¡Plan "${assigningPlan.name}" asignado con éxito a ${selectedMemberIds.length} socio(s)!`);
        setIsAssignModalOpen(false);
      } else {
        alert("Error al asignar el plan a los socios.");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión al asignar el plan.");
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredExercises = exercises.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (e.muscle_group && e.muscle_group.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchSegment = selectedSegment === 'Todos' || e.segment === selectedSegment;
    const matchZone = selectedZone === 'Todas' || e.zone === selectedZone;
    return matchSearch && matchSegment && matchZone;
  });

  const filteredTrainingPlans = trainingPlans.filter(p => {
    const matchName = p.name.toLowerCase().includes(planSearch.toLowerCase());
    const matchDesc = p.description && p.description.toLowerCase().includes(planSearch.toLowerCase());
    const matchCat = p.category && p.category.toLowerCase().includes(planSearch.toLowerCase());
    return matchName || matchDesc || matchCat;
  });

  return (
    <div className="space-y-6">
      {/* Header and Top Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-black text-lg uppercase text-black dark:text-white">Gestión de Entrenamientos</h3>
          <p className="text-[10px] text-gray-500 dark:text-white/40 uppercase tracking-wider">
            Biblioteca de ejercicios y paquetes de planes para socios
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl border border-gray-200 dark:border-white/10 gap-1">
          <button
            onClick={() => setActiveModuleTab('exercises')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeModuleTab === 'exercises'
                ? 'bg-orange-500 text-black shadow-md'
                : 'text-gray-500 dark:text-white/40 hover:text-black dark:hover:text-white'
            }`}
          >
            <Dumbbell size={14} />
            Biblioteca de Ejercicios ({exercises.length})
          </button>
          <button
            onClick={() => setActiveModuleTab('plans')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeModuleTab === 'plans'
                ? 'bg-orange-500 text-black shadow-md'
                : 'text-gray-500 dark:text-white/40 hover:text-black dark:hover:text-white'
            }`}
          >
            <Layers size={14} />
            Planes y Paquetes ({trainingPlans.length})
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: BIBLIOTECA DE EJERCICIOS ==================== */}
      {activeModuleTab === 'exercises' && (
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="BUSCAR POR NOMBRE O MÚSCULO..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-black dark:text-white uppercase outline-none focus:border-orange-500"
              />
            </div>
            <button 
              onClick={() => { setEditingId(null); setFormData(initialForm); setIsModalOpen(true); }} 
              className="bg-orange-500 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-black shadow-lg hover:bg-orange-600 transition-all shrink-0 flex items-center gap-2"
            >
              <Plus size={14} /> Nuevo Ejercicio
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {segments.map(seg => (
              <button 
                key={seg} 
                onClick={() => setSelectedSegment(seg)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${
                  selectedSegment === seg 
                    ? 'bg-orange-500 text-black shadow-md' 
                    : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>

          {selectedSegment !== 'Todos' && availableZones.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-white/10">
              <button 
                onClick={() => setSelectedZone('Todas')}
                className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase transition-all ${
                  selectedZone === 'Todas' 
                    ? 'bg-black dark:bg-white text-white dark:text-black' 
                    : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
              >
                Todas las Zonas
              </button>
              {availableZones.map((z: any) => (
                <button 
                  key={z} 
                  onClick={() => setSelectedZone(z)}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase transition-all ${
                    selectedZone === z 
                      ? 'bg-black dark:bg-white text-white dark:text-black' 
                      : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredExercises.map(ex => (
              <div key={ex.id} className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 p-4 rounded-2xl relative group hover:border-orange-500/40 transition-all">
                <h4 className="font-black text-black dark:text-white text-sm uppercase mb-1">{ex.name}</h4>
                <p className="text-[10px] text-orange-500 font-bold uppercase mb-2">{ex.muscle_group || 'General'}</p>
                <div className="flex items-center gap-2 mt-4 text-[9px] text-gray-500 dark:text-gray-400 font-black uppercase">
                  <span className="bg-gray-200 dark:bg-white/10 px-2 py-1 rounded-md">{ex.segment}</span>
                  <span className="bg-gray-200 dark:bg-white/10 px-2 py-1 rounded-md">{ex.zone}</span>
                </div>
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEditExercise(ex)} className="text-gray-400 hover:text-white transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteExercise(ex.id)} className="text-red-500 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            
            {filteredExercises.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-400 text-xs font-bold uppercase">
                No se encontraron ejercicios
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: PLANES Y PAQUETES ==================== */}
      {activeModuleTab === 'plans' && (
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="BUSCAR PLANES POR NOMBRE O CATEGORÍA..."
                value={planSearch}
                onChange={e => setPlanSearch(e.target.value)}
                className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-black dark:text-white uppercase outline-none focus:border-orange-500"
              />
            </div>
            <button 
              onClick={handleOpenNewPlan}
              className="bg-orange-500 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-black shadow-lg hover:bg-orange-600 transition-all shrink-0 flex items-center gap-2"
            >
              <Plus size={14} /> + Nuevo Plan / Paquete
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrainingPlans.map(plan => {
              const totalDays = plan.days ? plan.days.length : 0;
              const totalExercises = (plan.days || []).reduce((acc: number, d: any) => acc + (d.exercises ? d.exercises.length : 0), 0);
              const totalDocs = plan.documents ? plan.documents.length : 0;

              return (
                <div key={plan.id} className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 p-6 rounded-3xl relative group hover:border-orange-500/40 transition-all flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[8px] font-black uppercase rounded-lg">
                        {plan.category || 'General'}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditPlan(plan)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeletePlan(plan.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-black text-black dark:text-white text-base uppercase">{plan.name}</h4>
                    {plan.description && (
                      <p className="text-xs text-gray-500 dark:text-white/60 line-clamp-2">{plan.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] font-bold text-gray-600 dark:text-white/40">
                      <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg">
                        <Layers size={12} className="text-orange-500" />
                        {totalDays} {totalDays === 1 ? 'Día' : 'Días'}
                      </span>
                      <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg">
                        <Dumbbell size={12} className="text-orange-500" />
                        {totalExercises} Ejercicios
                      </span>
                      {totalDocs > 0 && (
                        <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/20">
                          <FileText size={12} />
                          {totalDocs} {totalDocs === 1 ? 'Archivo' : 'Archivos'}
                        </span>
                      )}
                    </div>

                    {/* Document Preview Snippet */}
                    {totalDocs > 0 && (
                      <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-white/5">
                        <p className="text-[8px] uppercase tracking-wider text-gray-400 font-bold">Documentos del Plan:</p>
                        {plan.documents.map((doc: any, dIdx: number) => (
                          <a 
                            key={dIdx} 
                            href={doc.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-white/5 hover:bg-orange-500/10 text-[10px] text-gray-700 dark:text-gray-300 transition-all border border-transparent hover:border-orange-500/30"
                          >
                            <span className="truncate flex-1 font-bold">{doc.name}</span>
                            <ExternalLink size={12} className="text-orange-500 shrink-0 ml-2" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assign to members button */}
                  <button
                    onClick={() => handleOpenAssignModal(plan)}
                    className="w-full mt-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <UserCheck size={14} /> Asignar a Socio(s)
                  </button>
                </div>
              );
            })}

            {filteredTrainingPlans.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-400 text-xs font-bold uppercase space-y-3">
                <Layers size={32} className="mx-auto opacity-30 text-orange-500" />
                <p>No se encontraron paquetes de planes creados.</p>
                <button onClick={handleOpenNewPlan} className="text-orange-500 underline text-xs uppercase font-black">
                  Crear el primer paquete de entrenamiento
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL: NUEVO / EDITAR PLAN ==================== */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-8 rounded-[35px] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-white/10 mb-4 shrink-0">
              <div>
                <h3 className="font-black text-xl uppercase text-black dark:text-white">
                  {editingPlanId ? "Editar Paquete de Entrenamiento" : "Nuevo Paquete de Entrenamiento"}
                </h3>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                  Configurá los días, ejercicios y adjuntá documentos (PDF/DOCX)
                </p>
              </div>
              <button onClick={() => setIsPlanModalOpen(false)}><X size={22} className="text-gray-400 hover:text-white" /></button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              {/* General Plan Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 dark:text-white/40 ml-1">Nombre del Plan / Paquete</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Rutina Hipertrofia 4 Días - Nivel Avanzado" 
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-xs font-bold text-black dark:text-white outline-none focus:border-orange-500"
                    value={planFormData.name}
                    onChange={e => setPlanFormData({ ...planFormData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 dark:text-white/40 ml-1">Categoría</label>
                  <select 
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-xs font-bold text-black dark:text-white uppercase outline-none focus:border-orange-500"
                    value={planFormData.category}
                    onChange={e => setPlanFormData({ ...planFormData, category: e.target.value })}
                  >
                    <option>Musculación</option>
                    <option>Fuerza</option>
                    <option>Hipertrofia</option>
                    <option>Funcional</option>
                    <option>Pérdida de Grasa</option>
                    <option>Acondicionamiento</option>
                  </select>
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 dark:text-white/40 ml-1">Descripción / Objetivos</label>
                  <textarea 
                    rows={2}
                    placeholder="Objetivo del plan, frecuencia semanal recomendada, tiempos de descanso..." 
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white resize-none outline-none focus:border-orange-500"
                    value={planFormData.description}
                    onChange={e => setPlanFormData({ ...planFormData, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Document Attachments (PDF / DOCX with Vercel Blob) */}
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black uppercase text-black dark:text-white flex items-center gap-2">
                      <Paperclip size={14} className="text-orange-500" />
                      Documentos Adjuntos del Plan (PDF, DOC, DOCX)
                    </h4>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider">
                      Se guardan en Vercel Blob y estarán disponibles para el socio en su aplicación
                    </p>
                  </div>
                  <label className="cursor-pointer bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-orange-500 hover:text-black transition-all flex items-center gap-2 shadow-sm">
                    {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {uploadingDoc ? "Subiendo..." : "+ Adjuntar Archivo"}
                    <input 
                      type="file" 
                      accept=".pdf,.doc,.docx" 
                      className="hidden" 
                      onChange={handleUploadDocument}
                      disabled={uploadingDoc}
                    />
                  </label>
                </div>

                {planFormData.documents && planFormData.documents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {planFormData.documents.map((doc: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10">
                        <div className="flex items-center gap-3 truncate">
                          <FileText size={18} className="text-orange-500 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-bold text-black dark:text-white truncate">{doc.name}</p>
                            <p className="text-[9px] text-gray-400">{doc.size || 'Archivo adjunto'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-orange-500 text-gray-400 transition-colors">
                            <ExternalLink size={14} />
                          </a>
                          <button onClick={() => handleRemoveDocument(idx)} className="p-1 hover:text-red-500 text-gray-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 italic">No hay documentos adjuntos en este plan aún.</p>
                )}
              </div>

              {/* Days & Exercises Builder */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase text-black dark:text-white flex items-center gap-2">
                    <Dumbbell size={14} className="text-orange-500" />
                    Estructura de Días y Ejercicios
                  </h4>
                  <button 
                    onClick={handleAddPlanDay}
                    className="text-[9px] bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-black px-3 py-1.5 rounded-lg font-black uppercase transition-all"
                  >
                    + Agregar Día
                  </button>
                </div>

                {/* Day selector tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {planFormData.days.map((day: any, dIdx: number) => (
                    <div key={dIdx} className="flex items-center shrink-0">
                      <button
                        onClick={() => setSelectedPlanDay(dIdx)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${
                          selectedPlanDay === dIdx
                            ? 'bg-orange-500 text-black shadow-md'
                            : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-white/10'
                        }`}
                      >
                        {day.class_name} ({day.exercises ? day.exercises.length : 0})
                        {planFormData.days.length > 1 && (
                          <span 
                            onClick={(e) => { e.stopPropagation(); handleRemovePlanDay(dIdx); }}
                            className="hover:text-red-600 ml-1"
                          >
                            ×
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Main Days / Exercises Interface */}
                <div className="flex flex-col md:flex-row gap-6 pt-2">
                  {/* Left: Exercises in the active day */}
                  <div className="flex-1 space-y-3 bg-gray-50 dark:bg-black/30 p-4 rounded-2xl border border-gray-200 dark:border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <input 
                        type="text" 
                        value={planFormData.days[selectedPlanDay]?.class_name || ''} 
                        onChange={e => {
                          const daysCopy = [...planFormData.days];
                          daysCopy[selectedPlanDay].class_name = e.target.value;
                          setPlanFormData({ ...planFormData, days: daysCopy });
                        }}
                        className="bg-transparent font-black text-sm uppercase text-black dark:text-white border-b border-dashed border-gray-300 dark:border-white/20 pb-1 outline-none"
                      />
                      <span className="text-[10px] text-gray-400 uppercase font-bold">
                        {planFormData.days[selectedPlanDay]?.exercises.length || 0} Ejercicios en este día
                      </span>
                    </div>

                    {(!planFormData.days[selectedPlanDay] || planFormData.days[selectedPlanDay].exercises.length === 0) ? (
                      <p className="text-xs text-gray-400 italic py-8 text-center">
                        No hay ejercicios en este día. Seleccioná de la lista de la derecha para agregarlos.
                      </p>
                    ) : (
                      planFormData.days[selectedPlanDay].exercises.map((ex: any, eIdx: number) => (
                        <div key={eIdx} className="bg-white dark:bg-neutral-800/80 p-3.5 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-black text-black dark:text-white truncate">{ex.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <input 
                                type="number" 
                                value={ex.sets} 
                                onChange={e => handleUpdatePlanExercise(eIdx, 'sets', parseInt(e.target.value) || 0)} 
                                className="w-12 bg-gray-100 dark:bg-white/10 rounded-md py-1 text-xs text-center font-bold text-black dark:text-white border-none"
                                title="Sets"
                              />
                              <span className="text-[10px] text-gray-400">x</span>
                              <input 
                                type="number" 
                                value={ex.reps} 
                                onChange={e => handleUpdatePlanExercise(eIdx, 'reps', parseInt(e.target.value) || 0)} 
                                className="w-12 bg-gray-100 dark:bg-white/10 rounded-md py-1 text-xs text-center font-bold text-black dark:text-white border-none"
                                title="Reps"
                              />
                              <span className="text-[10px] text-gray-400">|</span>
                              <span className="text-xs text-orange-500 font-bold">{ex.kg || 0}kg</span>
                              <button onClick={() => handleRemovePlanExercise(eIdx)} className="text-red-500 ml-2 hover:opacity-80">
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                          <input 
                            type="text" 
                            placeholder="Notas / Instrucciones del coach para este ejercicio..." 
                            value={ex.coach_notes || ''} 
                            onChange={e => handleUpdatePlanExercise(eIdx, 'coach_notes', e.target.value)}
                            className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 rounded-lg p-2 text-[10px] text-black dark:text-white italic outline-none focus:border-orange-500/40"
                          />
                        </div>
                      ))
                    )}
                  </div>

                  {/* Right: Exercise Picker & Inline Creator */}
                  <div className="w-full md:w-80 space-y-3 shrink-0">
                    <div className="flex justify-between items-center">
                      <h5 className="text-[10px] font-black uppercase text-gray-400">Ejercicios Disponibles</h5>
                      <button 
                        onClick={() => setInlineNewExMode(!inlineNewExMode)}
                        className="text-[9px] text-orange-500 hover:underline font-black uppercase"
                      >
                        {inlineNewExMode ? "Cerrar" : "+ Crear para este pack"}
                      </button>
                    </div>

                    {/* Inline Create Exercise for this Pack */}
                    {inlineNewExMode && (
                      <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl space-y-2">
                        <p className="text-[9px] font-black uppercase text-orange-400">Nuevo Ejercicio Rápido</p>
                        <input 
                          type="text" 
                          placeholder="Nombre del ejercicio..." 
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none"
                          value={inlineExData.name}
                          onChange={e => setInlineExData({ ...inlineExData, name: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text" 
                            placeholder="Zona (Pecho, Espalda...)" 
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none"
                            value={inlineExData.zone}
                            onChange={e => setInlineExData({ ...inlineExData, zone: e.target.value })}
                          />
                          <input 
                            type="text" 
                            placeholder="Músculo principal..." 
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none"
                            value={inlineExData.muscle_group}
                            onChange={e => setInlineExData({ ...inlineExData, muscle_group: e.target.value })}
                          />
                        </div>
                        <button 
                          onClick={handleCreateInlineExercise}
                          className="w-full bg-orange-500 text-black py-2 rounded-lg text-[9px] font-black uppercase hover:bg-orange-600 transition-all"
                        >
                          Crear y Agregar al Día
                        </button>
                      </div>
                    )}

                    <input 
                      type="text" 
                      placeholder="Buscar ejercicios..." 
                      className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-black dark:text-white outline-none focus:border-orange-500"
                      value={planExSearch}
                      onChange={e => setPlanExSearch(e.target.value)}
                    />

                    {/* Segment Filters */}
                    <div className="flex flex-wrap gap-1">
                      {segments.map(seg => (
                        <button 
                          key={seg} 
                          onClick={() => setPlanSelectedSegment(seg)} 
                          className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${
                            planSelectedSegment === seg 
                              ? 'bg-orange-500 text-black shadow-sm' 
                              : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200'
                          }`}
                        >
                          {seg}
                        </button>
                      ))}
                    </div>

                    {/* Zone Chips if segment is selected */}
                    {planAvailableZones.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <button 
                          onClick={() => setPlanSelectedZone('Todas')} 
                          className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${
                            planSelectedZone === 'Todas' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-white'
                          }`}
                        >
                          Todas
                        </button>
                        {planAvailableZones.map((z: any) => (
                          <button 
                            key={z} 
                            onClick={() => setPlanSelectedZone(z)} 
                            className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${
                              planSelectedZone === z ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-white'
                            }`}
                          >
                            {z}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="max-h-64 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                      {exercises
                        .filter(ex => {
                          const matchSearch = ex.name.toLowerCase().includes(planExSearch.toLowerCase()) || 
                                              (ex.muscle_group && ex.muscle_group.toLowerCase().includes(planExSearch.toLowerCase()));
                          const matchSegment = planSelectedSegment === 'Todos' || ex.segment === planSelectedSegment;
                          const matchZone = planSelectedZone === 'Todas' || ex.zone === planSelectedZone;
                          return matchSearch && matchSegment && matchZone;
                        })
                        .map(ex => (
                          <button
                            key={ex.id}
                            onClick={() => handleAddExerciseToPlan(ex)}
                            className="w-full text-left p-2 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-orange-500/10 border border-transparent hover:border-orange-500/30 transition-all flex items-center justify-between group"
                          >
                            <div className="truncate">
                              <p className="text-xs font-bold text-black dark:text-white group-hover:text-orange-500 truncate">{ex.name}</p>
                              <p className="text-[8px] text-gray-400 uppercase">{ex.muscle_group || ex.segment}</p>
                            </div>
                            <Plus size={14} className="text-gray-400 group-hover:text-orange-500 shrink-0 ml-2" />
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsPlanModalOpen(false)}
                className="px-6 py-3 rounded-xl text-xs font-black uppercase text-gray-400 hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSavePlan}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2"
              >
                <Check size={16} /> {editingPlanId ? "Guardar Cambios del Plan" : "Crear Paquete de Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: NUEVO / EDITAR EJERCICIO INDIVIDUAL ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-8 rounded-3xl w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg uppercase text-black dark:text-white">{editingId ? "Editar Ejercicio" : "Nuevo Ejercicio"}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 px-2">Nombre del Ejercicio</label>
                <input type="text" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-orange-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 px-2">Segmento Corporal</label>
                  <select className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs font-bold text-black dark:text-white uppercase outline-none focus:border-orange-500" value={formData.segment || ''} onChange={e => setFormData({...formData, segment: e.target.value})}>
                    <option>Tren superior</option>
                    <option>Tren medio / core</option>
                    <option>Tren inferior</option>
                    <option>Cuerpo completo</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 px-2">Zona Corporal</label>
                  <input type="text" placeholder="Ej: Pecho, Espalda..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-orange-500" value={formData.zone || ''} onChange={e => setFormData({...formData, zone: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 px-2">Grupo Muscular</label>
                  <input type="text" placeholder="Ej: Pectoral mayor" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-orange-500" value={formData.muscle_group || ''} onChange={e => setFormData({...formData, muscle_group: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 px-2">Mecánica</label>
                  <input type="text" placeholder="Ej: Compuesto" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-orange-500" value={formData.mechanics || ''} onChange={e => setFormData({...formData, mechanics: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 px-2">Equipamiento</label>
                  <input type="text" placeholder="Ej: Barra" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-orange-500" value={formData.equipment || ''} onChange={e => setFormData({...formData, equipment: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 px-2">Video URL (Opcional)</label>
                  <input type="text" placeholder="https://..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-orange-500" value={formData.video_url || ''} onChange={e => setFormData({...formData, video_url: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 px-2">RIR Sugerido</label>
                  <input type="text" placeholder="Ej: 1-3" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-orange-500" value={formData.rir || ''} onChange={e => setFormData({...formData, rir: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 px-2">RPE Sugerido</label>
                  <input type="text" placeholder="Ej: 7-9" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-orange-500" value={formData.rpe || ''} onChange={e => setFormData({...formData, rpe: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 px-2">Instrucciones / Tips Técnicos</label>
                <textarea rows={3} placeholder="Detalles de ejecución..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-black dark:text-white resize-none outline-none focus:border-orange-500" value={formData.instructions || ''} onChange={e => setFormData({...formData, instructions: e.target.value})} />
              </div>

              <button onClick={handleSaveExercise} className="w-full bg-orange-500 text-black font-black text-xs uppercase tracking-widest py-4 rounded-xl mt-4 hover:bg-orange-600 transition-all">
                {editingId ? 'Guardar Cambios' : 'Crear Ejercicio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ASIGNAR PLAN A SOCIOS ==================== */}
      {isAssignModalOpen && assigningPlan && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 p-6 sm:p-8 rounded-[35px] w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-white/10 mb-4 shrink-0">
              <div>
                <h3 className="font-black text-lg uppercase text-black dark:text-white flex items-center gap-2">
                  <UserCheck className="text-orange-500" size={18} /> Asignar Plan a Socios
                </h3>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
                  Plan: <span className="text-orange-400 font-bold">{assigningPlan.name}</span> ({assigningPlan.days?.length || 0} Días • {assigningPlan.documents?.length || 0} Archivos)
                </p>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)}>
                <X size={20} className="text-gray-400 hover:text-white" />
              </button>
            </div>

            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <input
                type="text"
                placeholder="BUSCAR SOCIO POR NOMBRE O DNI..."
                value={assignMemberSearch}
                onChange={e => setAssignMemberSearch(e.target.value)}
                className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs font-bold text-black dark:text-white uppercase outline-none focus:border-orange-500 shrink-0"
              />

              <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold px-1 shrink-0">
                <span>{selectedMemberIds.length} socio(s) seleccionado(s)</span>
                <button
                  type="button"
                  onClick={() => {
                    const filtered = membersList.filter(m => 
                      m.name.toLowerCase().includes(assignMemberSearch.toLowerCase()) || 
                      m.dni.includes(assignMemberSearch)
                    );
                    if (selectedMemberIds.length === filtered.length) {
                      setSelectedMemberIds([]);
                    } else {
                      setSelectedMemberIds(filtered.map(m => m.id));
                    }
                  }}
                  className="text-orange-500 uppercase hover:underline"
                >
                  Alternar todos
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1 min-h-0">
                {membersList
                  .filter(m => 
                    m.name.toLowerCase().includes(assignMemberSearch.toLowerCase()) || 
                    m.dni.includes(assignMemberSearch)
                  )
                  .map(member => {
                    const isSelected = selectedMemberIds.includes(member.id);
                    const isAlreadyOnThisPlan = member.training_plan_id === assigningPlan.id;

                    return (
                      <div
                        key={member.id}
                        onClick={() => handleToggleMemberSelect(member.id)}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-orange-500/10 border-orange-500/40 text-black dark:text-white'
                            : 'bg-gray-50 dark:bg-white/5 border-transparent hover:border-gray-300 dark:hover:border-white/10'
                        }`}
                      >
                        <div className="truncate mr-3">
                          <p className="text-xs font-black uppercase text-black dark:text-white truncate">
                            {member.name}
                          </p>
                          <p className="text-[8px] text-gray-400">
                            DNI: {member.dni} • Estado: {member.status}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isAlreadyOnThisPlan && (
                            <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">
                              Tiene este plan
                            </span>
                          )}
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-orange-500 border-orange-500 text-black'
                                : 'border-gray-400 dark:border-white/20'
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-gray-400 hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAssign}
                disabled={isAssigning || selectedMemberIds.length === 0}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2"
              >
                {isAssigning ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirmar Asignación ({selectedMemberIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
