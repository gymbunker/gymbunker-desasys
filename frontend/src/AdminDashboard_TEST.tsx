import { LayoutDashboard, Users, User, Brain, DollarSign, Lock, ShieldCheck, Briefcase, Download, CheckCircle, XCircle, Trash2, X, Settings, Receipt, CreditCard, Smartphone, Banknote, Search, Moon, Sun, Calendar, Clock, Menu, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [memberCheckins, setMemberCheckins] = useState<any[]>([]);
  const [checkinStats, setCheckinStats] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  useEffect(() => { if (isAuthenticated) refreshData(); }, [isAuthenticated, startDate, endDate]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setError(null);
    
    // Cuenta maestra de respaldo (por si la BD está vacía)
    if (loginUser === 'master' && loginPass === 'Ndf010399') {
      const u = { name: 'Master', role: 'Gerente', id: 0 };
      localStorage.setItem('gym_session', '1'); localStorage.setItem('gym_role', 'gerente'); localStorage.setItem('gym_user', JSON.stringify(u));
      setIsAuthenticated(true); setUserRole('gerente'); setLoggedUser(u); setActiveTab('Resumen');
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
        localStorage.setItem('gym_session', '1'); localStorage.setItem('gym_role', role); localStorage.setItem('gym_user', JSON.stringify(staffMember));
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

  const API_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? "http://localhost:8000" 
    : "/api";

  const refreshData = async () => {
    try {
      setError(null);
      // 1. Fetch Members + Plans
      const [membersRes, plansRes] = await Promise.all([
        fetch(`${API_URL}/admin/members`),
        fetch(`${API_URL}/admin/plans`)
      ]);
      if (!membersRes.ok) throw new Error(`Error ${membersRes.status}: No se pudo obtener la lista de socios`);
      const membersData = await membersRes.json();
      const updatedMembers = await Promise.all(membersData.map(async (m: any) => {
        if (m.joined_at && m.last_checkin) {
          const joined = new Date(m.joined_at);
          const today = new Date();
          if (joined.getTime() > today.getTime()) {
            try {
              const res = await fetch(`${API_URL}/admin/members/${m.id}/checkins`);
              if (res.ok) {
                const checkins = await res.json();
                const checkinsList = Array.isArray(checkins) ? checkins : (checkins.checkins || []);
                if (checkinsList.length > 0) {
                  const earliest = checkinsList[checkinsList.length - 1].checkin_at;
                  return { ...m, effective_joined_at: earliest };
                }
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
        return m;
      }));
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
    doc.setFontSize(18); doc.text('FUSION FITNESS: REPORTE OFICIAL', 14, 22);
    doc.text('RESUMEN EJECUTIVO', 14, 45);
    autoTable(doc, { startY: 50, head: [['Métrica', 'Valor']], body: [['Ingresos', `$${financeData?.total_revenue || 0}`], ['Socios', members.length]] });
    doc.save(`Reporte_Koach.pdf`);
  };

  const handleSavePlan = async () => {
    try {
      const payload = {
        name: selectedItem.name,
        price: selectedItem.price,
        days_per_week: selectedItem.daysPerWeek ?? selectedItem.days_per_week ?? 3,
        classes: selectedItem.classes || [],
        is_active: true
      };
      if (isEditMode) {
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
  const handleSaveMember = async () => {
    try {
      if (isEditMode) {
        const res = await fetch(`${API_URL}/admin/members/${selectedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...selectedItem,
            password: selectedItem.password || '123'
          })
        });
        if (res.ok) refreshData();
        else alert("Error al actualizar socio");
      } else {
        const res = await fetch(`${API_URL}/admin/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...selectedItem,
            password: '123',
            photo_url: `https://i.pravatar.cc/300?u=${selectedItem.dni}`
          })
        });
        if (res.ok) refreshData();
        else alert("Error al crear socio. Verifique si el DNI ya existe.");
      }
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };

  const handleSaveStaff = async () => {
    try {
      if (isEditMode) {
        const res = await fetch(`${API_URL}/admin/staff/${selectedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedItem)
        });
        if (res.ok) refreshData();
        else alert("Error al actualizar staff");
      } else {
        const res = await fetch(`${API_URL}/admin/staff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedItem)
        });
        if (res.ok) refreshData();
        else alert("Error al crear staff");
      }
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };

  const handlePayment = async (amount: number, method: string) => {
    try {
      const processedBy = encodeURIComponent(loggedUser?.name || 'Administración');
      const res = await fetch(`${API_URL}/admin/payments?member_id=${selectedItem.id}&amount=${amount}&method=${method}&processed_by=${processedBy}`, {
        method: 'POST'
      });
      if (res.ok) {
        generatePaymentPDF(selectedItem, amount, method, loggedUser?.name || 'Administración');
        setIsPaymentModalOpen(false);
        refreshData();
      }
    } catch (e) { console.error(e); }
  };

  const generatePaymentPDF = async (member: any, amount: number, method: string, staffName: string) => {
    const doc = new jsPDF();

    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
    });

    try {
      const bgImg = await loadImage('/fusion_fitness.ico');
      const gState = new (doc as any).GState({opacity: 0.10});
      doc.setGState(gState);
      // Dibujar marca de agua centrada
      const wmSize = 160;
      const wmX = (210 - wmSize) / 2;
      const wmY = (297 - wmSize) / 2;
      doc.addImage(bgImg, 'PNG', wmX, wmY, wmSize, wmSize);
      // Restaurar opacidad
      doc.setGState(new (doc as any).GState({opacity: 1.0}));
    } catch (e) {
      console.warn('No se pudo cargar la marca de agua', e);
    }

    doc.setFontSize(22);
    doc.setTextColor(243, 142, 38);
    doc.text('FUSION FITNESS', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('RECIBO DE PAGO', 105, 30, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}`, 14, 45);

    autoTable(doc, {
      startY: 55,
      head: [['Detalle', 'Información']],
      body: [
        ['Nombre Completo', member.name || '-'],
        ['DNI', member.dni || '-'],
        ['Correo Electrónico', member.email || '-'],
        ['Número de Teléfono', member.phone || '-'],
        ['Plan que se Abono', member.membership_type || '-'],
        ['Monto Abonado', `$${amount.toLocaleString()}`],
        ['Medio de Pago Utilizado', method || '-'],
        ['Usuario del Sistema', staffName || '-'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [243, 142, 38] },
    });

    // Sello diagonal "PAGADO" centrado en la tabla
    // align:'center' + angle en jsPDF desplaza el origen → el texto sale del cuadro.
    // Solución: calcular el punto de inicio manualmente para que el centro visual
    // quede en (105, tableCenterY).
    const tableEndY = (doc as any).lastAutoTable.finalY || 136;
    const tableCenterY = (55 + tableEndY) / 2;

    doc.setFontSize(80);
    const textW = doc.getTextWidth('PAGADO');
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);
    // Con angle:45 el texto avanza en dirección (+cos45, -sin45) en coords de pantalla.
    // Inicio = centro - (textW/2) * dirección
    const stampStartX = 105 - (textW / 2) * cos45;
    const stampStartY = tableCenterY + (textW / 2) * sin45;

    doc.setGState(new (doc as any).GState({opacity: 0.25}));
    doc.setTextColor(243, 142, 38);
    doc.text('PAGADO', stampStartX, stampStartY, { angle: 45 });
    doc.setGState(new (doc as any).GState({opacity: 1.0}));
    doc.setTextColor(0, 0, 0);

    const finalY = tableEndY;
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('---------------------------------------------------------', 105, finalY + 20, { align: 'center' });
    doc.text('Sello Institucional - Fusion Fitness', 105, finalY + 26, { align: 'center' });

     try {
      const logo = await loadImage('/logo_B.png');
      const logoAspect = logo.width / logo.height;
      const logoW = 55;
      const logoH = logoW / logoAspect;
      const logoX = (210 - logoW) / 2;
      doc.addImage(logo, 'PNG', logoX, finalY + 32, logoW, logoH);
    } catch (e) {
      console.warn('No se pudo cargar el logo final', e);
    }

    // Texto de validez sutil al pie
    doc.setFontSize(7);
    doc.setTextColor(190, 190, 190);
    doc.text('ESTE COMPROBANTE ES VÁLIDO COMO CONSTANCIA DE PAGO', 105, finalY + 82, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.save(`FusionFitness_Comprobante_${member.name.replace(/\\s+/g, '_')}.pdf`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Agenda': return <AgendaModule members={members} API_URL={API_URL} onAddMemberClick={() => { setSelectedItem({name:'', dni:'', phone:'', email:'', password:'1234', status:'ACTIVO', membership_type: plans[0]?.name || ''}); setIsEditMode(false); setModalType('member'); setIsModalOpen(true); }} />;
      case 'Socios': return <MembersModule members={members} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onHistory={(m:any)=>{ setSelectedItem(m); setMemberCheckins([]); setCheckinStats(null); setModalType('history'); setIsModalOpen(true); fetch(`${API_URL}/admin/members/${m.id}/checkins`).then(r=>r.json()).then(data=>{ const checkinsList = Array.isArray(data) ? data : (data.checkins || []); const planName = m.membership_type || 'Básico'; const plan = plans.find((p:any) => p.name === planName); const daysPerWeek = plan ? (plan.daysPerWeek ?? plan.days_per_week ?? 3) : 3; const totalSessions = daysPerWeek * 4; const today = new Date(); let cycleStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000); const joinedStr = m.effective_joined_at || m.joined_at; if(joinedStr){ cycleStart = new Date(joinedStr); } const sessionsUsed = checkinsList.filter((c:any) => { const checkinDate = new Date(c.checkin_at.replace(' ', 'T')); return checkinDate >= cycleStart; }).length; const sessionsRemaining = Math.max(0, totalSessions - sessionsUsed); setMemberCheckins(checkinsList); setCheckinStats({ total: totalSessions, used: sessionsUsed, remaining: sessionsRemaining }); }).catch(()=>{}); }} onEdit={(m: any) => { const validPlan = plans.find((p:any) => p.name === m.membership_type)?.name || plans[0]?.name || ''; setSelectedItem({...m, membership_type: validPlan}); setIsEditMode(true); setModalType('member'); setIsModalOpen(true); }} onDelete={async (id: any) => { if(confirm("¿Dar de baja socio?")){ const res = await fetch(`${API_URL}/admin/members/${id}`, {method:'DELETE'}); if(res.ok) refreshData(); } }} onAddClick={() => { setSelectedItem({name:'', dni:'', phone:'', email:'', password:'1234', status:'ACTIVO', membership_type: plans[0]?.name || ''}); setIsEditMode(false); setModalType('member'); setIsModalOpen(true); }} onPayClick={(m: any) => { setSelectedItem(m); setIsPaymentModalOpen(true); }} />;
      case 'Planes': return <PlansModule plans={plans} onEdit={(p:any)=>{setSelectedItem(p); setIsEditMode(true); setModalType('plan'); setIsModalOpen(true);}} onDelete={async (id:any)=>{ if(!confirm('¿Eliminar plan?')) return; const res = await fetch(`${API_URL}/admin/plans/${id}`,{method:'DELETE'}); if(res.ok) refreshData(); }} onAddClick={()=>{setSelectedItem({name:'', price:0, daysPerWeek:3, classes:[]}); setIsEditMode(false); setModalType('plan'); setIsModalOpen(true);}} />;
      case 'Mi Perfil': return <ProfileModule user={loggedUser} onSave={async (newPassword: string) => {
        if (!newPassword) { alert('Ingresá una nueva contraseña'); return; }
        if (loggedUser.id === 0) { alert('La cuenta master no se puede modificar desde aquí'); return; }
        try {
          const payload = { name: loggedUser.name, username: loggedUser.username || loggedUser.name, role: loggedUser.role, shift: loggedUser.shift || 'Mañana', password: newPassword };
          const res = await fetch(`${API_URL}/admin/staff/${loggedUser.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (res.ok) { alert('Contraseña actualizada correctamente'); setLoggedUser({ ...loggedUser, password: newPassword }); }
          else { const err = await res.json().catch(() => ({})); alert(`Error al actualizar: ${err.detail || res.status}`); }
        } catch(e) { alert('Error de conexión al guardar la contraseña'); }
      }} />;
      case 'Staff': return (userRole === 'gerente' || userRole === 'administracion') ? <StaffModule staff={staff} onEdit={(s: any) => { setSelectedItem({...s}); setIsEditMode(true); setModalType('staff'); setIsModalOpen(true); }} onDelete={async (id: any) => { if(confirm("¿Eliminar empleado?")){ const res = await fetch(`${API_URL}/admin/staff/${id}`, {method:'DELETE'}); if(res.ok) refreshData(); } }} onAddClick={() => { setSelectedItem({name:'', role:'Entrenador', shift:'Mañana', password:'1234'}); setIsEditMode(false); setModalType('staff'); setIsModalOpen(true); }} /> : <NoAccess />;
      case 'Finanzas': return userRole === 'gerente' ? <FinanceModule data={financeData} members={members} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} filterType={filterType} setFilterType={setFilterType} /> : <NoAccess />;
      case 'Facturación': return (userRole === 'gerente' || userRole === 'administracion') ? <BillingModule members={members} onDeletePayment={async (id: number) => { if (!confirm('¿Eliminar este cobro?')) return; const res = await fetch(`${API_URL}/admin/payments/${id}`, { method: 'DELETE' }); if (res.ok) refreshData(); else alert('Error al eliminar'); }} /> : <NoAccess />;
      default: return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard title="Socios Activos" value={members.length} icon={<Users size={16}/>} onClick={() => setActiveTab('Socios')} color="blue" />
            {(userRole === 'gerente' || userRole === 'administracion') && (
              <SummaryCard title="Facturas" value={members.flatMap((m:any) => (m.billing_history || [])).length} icon={<Receipt size={16}/>} onClick={() => setActiveTab('Facturación')} color="purple" />
            )}
            {userRole === 'gerente' && (
              <SummaryCard title="Caja Total" value={`$${financeData?.total_revenue?.toLocaleString()}`} icon={<DollarSign size={16}/>} onClick={() => setActiveTab('Finanzas')} color="green" />
            )}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
             <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-4 rounded-xl"><h3 className="text-[10px] font-black uppercase text-gray-600 dark:text-white/40 mb-3 tracking-widest">Balance de Caja</h3><div className="h-40"><ResponsiveContainer width="100%" height="100%"><AreaChart data={financeData?.cashflow_data}><CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false}/><XAxis dataKey="month" stroke="#444" fontSize={9}/><Tooltip contentStyle={{backgroundColor:'#111', border:'none', fontSize:'10px'}}/><Area type="monotone" dataKey="ingresos" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.1}/></AreaChart></ResponsiveContainer></div></div>
             <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-4 rounded-xl"><h3 className="text-[10px] font-black uppercase text-gray-600 dark:text-white/40 mb-3 tracking-widest">Actividad Facturación</h3><div className="flex flex-col justify-center h-40 space-y-2">{members.flatMap((m:any)=>(m.billing_history||[]).map((h:any)=>({...h,member_name:m.name}))).sort((a:any,b:any)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,3).map((h:any,i:number)=>(<div key={i} className="flex justify-between items-center bg-gray-100 dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-white/5"><div><span className="text-[10px] font-black uppercase block">{h.member_name}</span><span className="text-[8px] text-gray-400 dark:text-white/30">{h.date} · {h.method}</span></div><span className="text-green-500 font-black text-xs">${h.amount?.toLocaleString()}</span></div>))}</div></div>
          </div>
        </div>
      );
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-[#F5F8FD] dark:bg-[#0a0a0a] flex flex-col items-center justify-center p-4 overflow-hidden transition-colors duration-300 select-none">
        <div className="absolute top-4 right-4"><button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-[#F38E26]/10 dark:bg-white/5 border border-white/20 rounded-full text-black dark:text-white shadow-lg transition-all">{isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}</button></div>
        <div className="w-full max-w-[340px] bg-white dark:bg-black/30 border border-[#F38E26]/20 dark:border-white/10 p-5 sm:p-8 rounded-3xl backdrop-blur-2xl shadow-2xl animate-in zoom-in duration-500 space-y-4">
          <div className="flex justify-center">
            <img src={isDarkMode ? "/logo_B.png" : "/logo.png"} alt="Fusion Fitness Logo" className={`${isDarkMode ? "h-20 sm:h-36" : "h-24 sm:h-[12rem] -my-2"} w-auto object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]`} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
            <div className="hidden p-6 rounded-2xl border border-[#F38E26]" style={{backgroundColor:'#F38E26'}}><ShieldCheck size={48} className="text-white" /></div>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[9px] font-black uppercase mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <XCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <input type="text" placeholder="Usuario" className="w-full bg-[#F38E26]/5 dark:bg-black/40 border border-[#F38E26]/40 dark:border-white/10 focus:border-[#F38E26] rounded-xl py-2.5 px-4 text-black dark:text-white outline-none transition-all text-center text-xs placeholder:text-gray-400 dark:placeholder:text-white/40 focus:ring-2 focus:ring-[#F38E26]/10" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} required />
            <input type="password" placeholder="Contraseña" className="w-full bg-[#F38E26]/5 dark:bg-black/40 border border-[#F38E26]/40 dark:border-white/10 focus:border-[#F38E26] rounded-xl py-2.5 px-4 text-black dark:text-white outline-none transition-all text-center text-xs placeholder:text-gray-400 dark:placeholder:text-white/40 focus:ring-2 focus:ring-[#F38E26]/10" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required />
            
            <button type="submit" className="w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-[#0a0a0a] text-white border border-[#F38E26] dark:bg-[#F38E26] dark:text-[#0a0a0a] hover:scale-[1.01]">Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FD] dark:bg-[#0a0a0a] text-black dark:text-[#e0e0e0] font-sans flex overflow-hidden text-[9px] transition-colors duration-300">
      {/* Portaled Modals (Centered in Viewport) */}
      {(isModalOpen || isPaymentModalOpen) && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-10 bg-black/50 dark:bg-black/90 backdrop-blur-md overflow-y-auto">
          {isModalOpen && (
            <div className={`bg-white dark:bg-[#1b2435] border border-gray-200 dark:border-white/10 p-8 rounded-[40px] w-full ${modalType === 'workout' || modalType === 'history' ? 'max-w-4xl' : 'max-w-md'} shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar`}>
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
                               <p className="text-sm font-black text-green-500">${h.amount?.toLocaleString()}</p>
                             </div>
                           )) : <p className="text-center text-gray-400 dark:text-white/10 uppercase font-black py-8 text-[8px]">Sin cobros</p>}
                         </div>
                       </div>
                       {/* Asistencia */}
                       <div>
                         <p className="text-[8px] font-black uppercase text-blue-400 mb-1 tracking-widest">Asistencia · {memberCheckins.length} ingresos</p>
                         {checkinStats && <div className="flex gap-2 mb-2">{[{l:'Total',v:checkinStats.total,c:'text-white/40'},{l:'Usadas',v:checkinStats.used,c:'text-orange-400'},{l:'Restantes',v:checkinStats.remaining,c:'text-blue-400'}].map(s=><div key={s.l} className="flex-1 bg-black/20 rounded-lg p-1 text-center"><p className={`text-[10px] font-black ${s.c}`}>{s.v}</p><p className="text-[6px] text-white/20 uppercase font-black">{s.l}</p></div>)}</div>}
                         <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
                           {memberCheckins.length > 0 ? memberCheckins.map((c:any, i:number)=>(
                             <div key={i} className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/5 p-3 rounded-xl flex justify-between items-center">
                               <div className="flex items-center gap-2">
                                 <div className="w-6 h-6 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 text-[8px] font-black">{memberCheckins.length - i}</div>
                                 {(() => { const dt = new Date(c.checkin_at.replace(/\.\d+Z$/, 'Z')); const fecha = dt.toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'2-digit'}); const hora = dt.toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit',hour12:true}); return <div><p className="font-black text-black dark:text-white text-[9px]">{fecha} • <span className="text-orange-500">{c.type || 'Tótem'}</span></p><p className="text-[7px] text-gray-500 dark:text-white/20 font-black">{hora}</p></div>; })()}
                               </div>
                             </div>
                           )) : <p className="text-center text-gray-400 dark:text-white/10 uppercase font-black py-8 text-[8px]">Sin ingresos registrados</p>}
                         </div>
                       </div>
                     </div>
                  </div>
                )}
                {modalType === 'member' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                       <input type="text" placeholder="Nombre Completo" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.name} onChange={e => setSelectedItem({...selectedItem, name: e.target.value})} />
                       <input type="text" placeholder="DNI" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.dni} onChange={e => setSelectedItem({...selectedItem, dni: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <input type="text" placeholder="WhatsApp / Número" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.phone} onChange={e => setSelectedItem({...selectedItem, phone: e.target.value})} />
                       <input type="email" placeholder="Correo Electrónico" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.email} onChange={e => setSelectedItem({...selectedItem, email: e.target.value})} />
                    </div>
                    <select className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.membership_type || plans[0]?.name || ''} onChange={e => setSelectedItem({...selectedItem, membership_type: e.target.value})}>
                       {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Fecha de Inicio del Plan</label>
                      <input type="date" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.joined_at ? selectedItem.joined_at.split('T')[0] : ''} onChange={e => setSelectedItem({...selectedItem, joined_at: e.target.value ? e.target.value + 'T00:00:00' : null})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Contraseña de Acceso</label>
                      <input type="text" placeholder="Asignar Contraseña" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.password || ''} onChange={e => setSelectedItem({...selectedItem, password: e.target.value})} />
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-white/5 space-y-3">
                      <p className="text-[9px] font-black uppercase text-orange-500 tracking-wider ml-2">Plan de Entrenamiento / Rutina</p>
                      
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {(selectedItem?.routine || []).map((ex: any, idx: number) => (
                          <div key={idx} className="flex gap-2 items-center bg-gray-50 dark:bg-black/40 p-2 rounded-xl border border-gray-200 dark:border-white/5">
                            <input 
                              type="text" 
                              placeholder="Ejercicio" 
                              className="flex-1 bg-transparent border-0 outline-none text-black dark:text-white text-[10px] uppercase font-black px-1" 
                              value={ex.name} 
                              onChange={e => {
                                const newRoutine = [...(selectedItem.routine || [])];
                                newRoutine[idx].name = e.target.value;
                                setSelectedItem({...selectedItem, routine: newRoutine});
                              }} 
                            />
                            <input 
                              type="text" 
                              placeholder="Sets" 
                              className="w-10 bg-transparent border-0 outline-none text-black dark:text-white text-[10px] text-center" 
                              value={ex.sets} 
                              onChange={e => {
                                const newRoutine = [...(selectedItem.routine || [])];
                                newRoutine[idx].sets = e.target.value;
                                setSelectedItem({...selectedItem, routine: newRoutine});
                              }} 
                            />
                            <span className="text-[8px] text-gray-500 font-bold">x</span>
                            <input 
                              type="text" 
                              placeholder="Reps" 
                              className="w-10 bg-transparent border-0 outline-none text-black dark:text-white text-[10px] text-center" 
                              value={ex.reps} 
                              onChange={e => {
                                const newRoutine = [...(selectedItem.routine || [])];
                                newRoutine[idx].reps = e.target.value;
                                setSelectedItem({...selectedItem, routine: newRoutine});
                              }} 
                            />
                            <button 
                              type="button" 
                              onClick={() => {
                                const newRoutine = (selectedItem.routine || []).filter((_: any, i: number) => i !== idx);
                                setSelectedItem({...selectedItem, routine: newRoutine});
                              }} 
                              className="text-red-500 hover:text-red-400 p-1 font-black"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {(selectedItem?.routine || []).length === 0 && (
                          <p className="text-center text-gray-400 dark:text-white/15 italic text-[9px] font-black uppercase py-4">Sin ejercicios asignados. Usará rutina por defecto.</p>
                        )}
                      </div>
                      
                      <button 
                        type="button" 
                        onClick={() => {
                          const newRoutine = [...(selectedItem?.routine || []), { id: Date.now(), name: '', sets: '3', reps: '12', weight: 0, completed: false }];
                          setSelectedItem({...selectedItem, routine: newRoutine});
                        }} 
                        className="w-full py-2 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl text-[9px] font-black uppercase hover:bg-orange-500 hover:text-white transition-colors"
                      >
                        + Agregar Ejercicio
                      </button>
                    </div>
                  </div>
                )}
                {modalType === 'plan' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Plan (nombre)</label>
                      <input type="text" placeholder="Ej: Premium, Musculación..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.name} onChange={e => setSelectedItem({...selectedItem, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Días (habilitados por semana)</label>
                      <input type="number" placeholder="Ej: 3, 5, 7..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.daysPerWeek} onChange={e => setSelectedItem({...selectedItem, daysPerWeek: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Precio Mensual</label>
                      <input type="number" placeholder="Ej: 8500" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={selectedItem?.price} onChange={e => setSelectedItem({...selectedItem, price: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Clases Adicionales (separadas por coma)</label>
                      <input type="text" placeholder="Ej: Yoga, Zumba, Funcional..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs" value={(selectedItem?.classes || []).join(', ')} onChange={e => setSelectedItem({...selectedItem, classes: e.target.value.split(',').map((c:string)=>c.trim()).filter((c:string)=>c)})} />
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
                    <div className="space-y-1 mt-2">
                       <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-2">Contraseña de Acceso</label>
                       <input type="text" placeholder="Contraseña..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs" value={selectedItem?.password || ''} onChange={e => setSelectedItem({...selectedItem, password: e.target.value})} />
                    </div>
                  </div>
                )}
              </div>
              {modalType !== 'history' && (
                <div className="flex gap-4 mt-8 border-t border-gray-200 dark:border-white/5 pt-6"><button className="flex-1 py-3 text-gray-600 dark:text-white/40 font-black uppercase text-[10px]" onClick={() => setIsModalOpen(false)}>Cancelar</button><button className="flex-1 py-3 bg-[#0a0a0a] dark:bg-[#F38E26] text-white dark:text-[#0a0a0a] border border-[#F38E26] rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] transition-all" onClick={() => { if(modalType==='plan') handleSavePlan(); else if(modalType==='member') handleSaveMember(); else if(modalType==='staff') handleSaveStaff(); }}>Guardar</button></div>
              )}
            </div>
          )}
          {isPaymentModalOpen && (
            <PaymentModal plans={plans} member={selectedItem} onPay={handlePayment} onClose={()=>setIsPaymentModalOpen(false)} />
          )}
        </div>
      )}

      {isSidebarOpen && (
        <div className="fixed inset-0 z-[900] bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-[1000] w-56 border-r border-white/5 bg-[#141b29] flex flex-col p-4 transition-transform duration-300 shrink-0 md:static md:w-40 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex justify-between items-center mb-2">
            <div className="flex justify-center flex-1">
              <img src="/logo_B.png" alt="Logo" className="h-20 w-auto object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
              <div className="hidden w-16 h-16 rounded-xl flex items-center justify-center border border-[#F38E26]" style={{backgroundColor:'#F38E26'}}><Brain size={24} className="text-white" /></div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="text-white/60 hover:text-white md:hidden p-1.5 rounded-lg bg-white/5">
              <X size={14} />
            </button>
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center justify-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl text-white shadow-sm transition-all hover:scale-[1.02]">
            {isDarkMode ? <Sun size={12}/> : <Moon size={12}/>}
            <span className="text-[9px] font-black uppercase tracking-widest">{isDarkMode ? 'Claro' : 'Oscuro'}</span>
          </button>
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar pr-1">
          <SidebarItem icon={<LayoutDashboard size={14} />} label="Resumen" active={activeTab === 'Resumen'} onClick={() => { setActiveTab('Resumen'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<Calendar size={14} />} label="Agenda / Clases" active={activeTab === 'Agenda'} onClick={() => { setActiveTab('Agenda'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<User size={14} />} label="Mi Perfil" active={activeTab === 'Mi Perfil'} onClick={() => { setActiveTab('Mi Perfil'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<Users size={14} />} label="Socios" active={activeTab === 'Socios'} onClick={() => { setActiveTab('Socios'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<Settings size={14} />} label="Planes" active={activeTab === 'Planes'} onClick={() => { setActiveTab('Planes'); setIsSidebarOpen(false); }} />
          
          {(userRole === 'gerente' || userRole === 'administracion') && (
            <>
              <SidebarItem icon={<Receipt size={14} />} label="Facturación" active={activeTab === 'Facturación'} onClick={() => { setActiveTab('Facturación'); setIsSidebarOpen(false); }} />
              <SidebarItem icon={<Briefcase size={14} />} label="Personal" active={activeTab === 'Staff'} onClick={() => { setActiveTab('Staff'); setIsSidebarOpen(false); }} />
            </>
          )}

          {userRole === 'gerente' && (
            <>
              <div className="h-px bg-white/5 my-4" />
              <SidebarItem icon={<DollarSign size={14} />} label="Finanzas" active={activeTab === 'Finanzas'} onClick={() => { setActiveTab('Finanzas'); setIsSidebarOpen(false); }} />
            </>
          )}
        </nav>
        <button onClick={() => { localStorage.removeItem('gym_session'); localStorage.removeItem('gym_role'); localStorage.removeItem('gym_user'); setIsAuthenticated(false); setLoggedUser(null); }} className="w-full p-2 bg-red-500/10 hover:bg-red-500 rounded-xl text-red-500 hover:text-white text-[9px] font-black uppercase tracking-widest transition-all mt-4 shrink-0">Salir</button>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 relative bg-[#F5F8FD] dark:bg-[#0a0a0a]">
        <header className="flex items-center justify-between mb-6 sm:mb-8 max-w-full gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="text-black dark:text-white p-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 md:hidden hover:scale-105 transition-all">
              <Menu size={16} />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-black dark:text-white tracking-tighter uppercase truncate leading-none">{activeTab}</h2>
              <p className="text-[7px] uppercase font-black tracking-[0.3em] mt-1" style={{color:'#F38E26'}}>Fusion Fitness</p>
            </div>
          </div>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest hover:scale-105 transition-all whitespace-nowrap bg-[#0a0a0a] text-white dark:bg-[#F38E26] dark:text-[#0a0a0a] border border-[#F38E26] shadow-sm"><Download size={14}/> Reporte Global</button>
        </header>
        <div className="max-w-full overflow-x-hidden">
        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #fca5a5' }}>
            <strong>Error de Conexión:</strong> {error}. Verifique que la base de datos esté configurada correctamente en Vercel.
          </div>
        )}
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

function PaymentModal({ plans, member, onPay, onClose }: any) {
  const [method, setMethod] = useState('Efectivo');
  // Buscar el plan por coincidencia parcial (ej: "Elite" entra en "Elite (Libre)")
  const planObj = plans.find((p:any) => member.membership_type && p.name.toLowerCase().includes(member.membership_type.toLowerCase())) || plans[0];
  const [amount, setAmount] = useState(planObj?.price || 0);

  return (
    <div className="bg-white dark:bg-[#1b2435] border border-gray-200 dark:border-white/10 p-10 rounded-[40px] w-full max-w-md shadow-3xl animate-in zoom-in duration-300">
      <h2 className="text-xl font-black mb-2 uppercase tracking-widest text-green-500 text-center">Facturación en Recepción</h2>
      <p className="text-[10px] text-gray-500 dark:text-white/20 text-center uppercase font-black mb-8">Socio: {member.name}</p>
      
      <div className="space-y-6">
         <div className="space-y-2">
            <label className="text-[9px] text-gray-500 dark:text-white/20 uppercase font-black ml-4">Monto a Cobrar</label>
            <input type="number" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl p-6 text-3xl font-black text-black dark:text-white text-center outline-none focus:border-green-500" value={amount} onChange={e => setAmount(parseInt(e.target.value) || 0)} />
         </div>

         <div className="space-y-2">
            <label className="text-[9px] text-gray-500 dark:text-white/20 uppercase font-black ml-4">Método de Pago</label>
            <div className="grid grid-cols-2 gap-2">
               <PaymentBtn active={method === 'Efectivo'} onClick={()=>setMethod('Efectivo')} label="Efectivo" icon={<Banknote size={16}/>} />
               <PaymentBtn active={method === 'Tarjeta'} onClick={()=>setMethod('Tarjeta')} label="Tarjeta" icon={<CreditCard size={16}/>} />
               <PaymentBtn active={method === 'Transferencia'} onClick={()=>setMethod('Transferencia')} label="Transferencia" icon={<Smartphone size={16}/>} />
               <PaymentBtn active={method === 'QR'} onClick={()=>setMethod('QR')} label="QR" icon={<Smartphone size={16}/>} />
            </div>
         </div>

         <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-white/5"><button className="flex-1 py-4 text-gray-600 dark:text-white/40 font-black uppercase text-[10px]" onClick={onClose}>Cancelar</button><button className="flex-1 py-4 bg-[#0a0a0a] dark:bg-[#F38E26] text-white dark:text-[#0a0a0a] border border-[#F38E26] rounded-2xl font-black uppercase text-[10px]" onClick={()=>onPay(amount, method)}>Generar Pago</button></div>
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

       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/5"><p className="text-[9px] font-black text-gray-500 dark:text-white/20 uppercase">Cobros Registrados</p><p className="text-xl font-black text-black dark:text-white">${total.toLocaleString()}</p></div>
          <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/5"><p className="text-[9px] font-black text-gray-500 dark:text-white/20 uppercase">Más Usado</p><p className="text-xl font-black truncate" style={{color:'#F38E26'}} title={mostUsedPlan}>{mostUsedPlan}</p></div>
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
                     <td className="p-4 text-[9px] font-black truncate max-w-[100px]" style={{color:'#F38E26'}}>{h.processed_by || '—'}</td>
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
  return <div onClick={onClick} style={active ? {backgroundColor:'#F38E26'} : {}} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${active ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>{icon}<span className="text-[9px] font-black uppercase tracking-widest">{label}</span></div>;
}

function SummaryCard({ title, value, icon, onClick, color }: any) {
  const iconColor = color === 'green' ? '#10b981' : color === 'purple' ? '#a855f4' : '#F38E26';
  return <div onClick={onClick} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-4 rounded-xl cursor-pointer transition-all flex justify-between items-center" onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(243,142,38,0.3)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor=''}}><div className="space-y-1"><p className="text-[7px] font-black text-gray-500 dark:text-white/20 uppercase tracking-widest">{title}</p><p className="text-sm sm:text-lg font-black text-black dark:text-white">{value}</p></div><div className="bg-white dark:bg-white/5 p-2 rounded-lg" style={{color: iconColor}}>{icon}</div></div>;
}

function memberDaysInfo(joinedAt: string, _status: string): { daysIn: number; daysLeft: number; overdueDays: number } {
  if (!joinedAt) return { daysIn: 0, daysLeft: 30, overdueDays: 0 };
  const joined = new Date(joinedAt);
  const today = new Date();
  
  // Set time of both dates to 00:00:00 to calculate calendar days exactly
  const d1 = new Date(joined.getFullYear(), joined.getMonth(), joined.getDate());
  const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const totalDaysSinceJoined = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  
  if (totalDaysSinceJoined < 0) {
    return { daysIn: 0, daysLeft: 30, overdueDays: 0 };
  }
  
  if (totalDaysSinceJoined >= 30) {
    return { daysIn: 30, daysLeft: 0, overdueDays: totalDaysSinceJoined - 30 };
  }
  
  const daysIn = totalDaysSinceJoined;
  const daysLeft = 30 - daysIn;
  return { daysIn, daysLeft, overdueDays: 0 };
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

function MembersModule({ members, onEdit, onDelete, onAddClick, onPayClick, onHistory, searchQuery, setSearchQuery }: any) {
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  const statusOptions = ['TODOS', 'ACTIVO', 'POR VENCER', 'DEUDA', 'INACTIVO'];

  const filteredMembers = members.filter((m: any) => {
    const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.dni.includes(searchQuery);
    const matchStatus = statusFilter === 'TODOS' || m.status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a: any, b: any) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="font-black text-lg uppercase">Gestión de Socios</h3>
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-white/20" size={14} />
            <input type="text" placeholder="Buscar por DNI o Nombre..." className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-4 text-black dark:text-white text-[10px] ou" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {statusOptions.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${statusFilter === s ? 'bg-orange-500 text-black' : 'bg-white dark:bg-white/5 text-gray-500 dark:text-white/30 hover:text-black dark:hover:text-white'}`}>
                {s === 'TODOS' ? `Todos (${members.length})` : s === 'ACTIVO' ? `Al día (${members.filter((m:any)=>m.status==='ACTIVO'||m.status==='AL DIA').length})` : s === 'POR VENCER' ? `Por vencer (${members.filter((m:any)=>m.status==='POR VENCER').length})` : s === 'DEUDA' ? `Deuda (${members.filter((m:any)=>m.status==='DEUDA').length})` : `Inactivo (${members.filter((m:any)=>m.status==='INACTIVO').length})`}
              </button>
            ))}
          </div>
          <button onClick={onAddClick} className="bg-orange-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 whitespace-nowrap">+ Nuevo Socio</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filteredMembers.map((m: any) => {
          const { daysIn, daysLeft } = memberDaysInfo(m.effective_joined_at || m.joined_at, m.status);
          return (
            <div key={m.id} className="p-4 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/5 hover:border-orange-500/10 transition-all group overflow-hidden">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center font-black text-orange-500 text-sm shrink-0">{m.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-black dark:text-white text-[10px] uppercase break-words leading-tight">{m.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black truncate">{m.membership_type || '—'}</span>
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              </div>
              <div className="mb-3 px-1">
                <p className="text-[7px] text-gray-400 dark:text-white/20 font-black uppercase">
                  {`Día ${daysIn}/30 · ${daysLeft <= 0 ? '0d restantes' : `${daysLeft}d restantes`}`}
                </p>
                <div className="w-full h-1 bg-gray-100 dark:bg-white/5 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m.status === 'DEUDA' ? 'bg-red-500' : m.status === 'POR VENCER' ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: m.status === 'DEUDA' ? '100%' : `${Math.min(100, (daysIn / 30) * 100)}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onPayClick(m)} className="col-span-2 py-2 bg-green-500/10 text-green-500 rounded-lg text-[8px] font-black uppercase hover:bg-green-500 hover:text-black dark:text-white transition-all">Cobrar</button>
                <button onClick={() => onEdit(m)} className="py-2 bg-white dark:bg-white/5 text-gray-600 dark:text-white/40 rounded-lg text-[8px] font-black uppercase">Editar</button>
                <button onClick={() => onHistory(m)} className="py-2 bg-white dark:bg-white/5 text-orange-400 rounded-lg text-[8px] font-black uppercase">Historial</button>
                <button onClick={() => onDelete(m.id)} className="col-span-2 py-2 bg-red-500/10 text-red-500 rounded-lg text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all">Dar de Baja</button>
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
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-black text-lg uppercase">Planes</h3><button onClick={onAddClick} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#0a0a0a] text-white dark:bg-[#F38E26] dark:text-[#0a0a0a] border border-[#F38E26]">+ Nuevo</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {plans.map((p: any) => (
           <div key={p.id} className="p-6 bg-white dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/5 relative group">
              <p className="text-[8px] font-black uppercase tracking-widest mb-2" style={{color:'#F38E26'}}>{p.name}</p>
              <p className="text-2xl font-black mb-4">${p.price}<span className="text-[10px] text-gray-500 dark:text-white/20 font-black">/mes</span></p>
              <div className="space-y-1 mb-6">
                 <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-white/40 font-bold"><CheckCircle size={10} className="text-green-500"/> {p.daysPerWeek} días</div>
                 <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-white/40 font-bold truncate"><CheckCircle size={10} className="text-green-500"/> {p.classes.join(', ') || 'Musculación'}</div>
              </div>
              <div className="flex gap-2"><button onClick={()=>onEdit(p)} className="flex-1 py-2 bg-white dark:bg-white/5 rounded-xl text-[9px] font-black uppercase">Editar</button><button onClick={()=>onDelete(p.id)} className="p-2 text-red-500/30 hover:text-red-500"><Trash2 size={14}/></button></div>
           </div>
         ))}
      </div>
    </div>
  );
}

function StaffModule({ staff, onEdit, onDelete, onAddClick }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-black text-lg uppercase">Personal</h3><button onClick={onAddClick} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#0a0a0a] text-white dark:bg-[#F38E26] dark:text-[#0a0a0a] border border-[#F38E26]">+ Nuevo</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {staff.map((s: any) => (
           <div key={s.id} className="p-6 bg-white dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/5 group transition-all" onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(243,142,38,0.2)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor=''}}>
             <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black transition-all shadow-lg" style={{backgroundColor:'rgba(243,142,38,0.1)', color:'#F38E26'}} onMouseEnter={e=>{e.currentTarget.style.backgroundColor='#F38E26';e.currentTarget.style.color='#fff'}} onMouseLeave={e=>{e.currentTarget.style.backgroundColor='rgba(243,142,38,0.1)';e.currentTarget.style.color='#F38E26'}}>{s.name[0]}</div><div><p className="font-black text-black dark:text-white text-[11px] uppercase mb-1 truncate w-24">{s.name}</p><p className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black tracking-widest">{s.role}</p></div></div>
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
         <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white shadow-xl" style={{backgroundColor:'#F38E26', boxShadow:'0 20px 40px rgba(243,142,38,0.2)'}}>
            <User size={32} />
         </div>
         <div>
            <h2 className="text-xl font-black text-black dark:text-white uppercase tracking-widest">{user?.name}</h2>
             <p className="text-[10px] font-black uppercase mt-1" style={{color:'#F38E26'}}>{user?.role}</p>
         </div>
      </div>
      
      <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-6 rounded-3xl space-y-4">
         <h3 className="text-xs font-black text-gray-600 dark:text-white/40 uppercase tracking-widest mb-4">Seguridad de la Cuenta</h3>
         <div className="space-y-2">
            <label className="text-[9px] text-gray-500 dark:text-white/20 uppercase font-black px-2">Nueva Contraseña</label>
            <input type="text" placeholder="Ingresa tu nueva clave..." className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-black dark:text-white text-xs" value={password} onChange={e=>setPassword(e.target.value)} />
         </div>
         <button className="w-full py-4 rounded-xl font-black text-xs uppercase transition-all mt-4 bg-[#0a0a0a] text-white border border-[#F38E26] dark:bg-[#F38E26] dark:text-[#0a0a0a] hover:scale-[1.01]" onClick={() => onSave(password)}>Guardar Cambios</button>
      </div>
    </div>
  );
}

function NoAccess() {
  return <div className="h-40 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10"><Lock size={24} className="text-red-500 mb-4" /><h3 className="text-xs font-black text-black dark:text-white uppercase tracking-widest">Acceso Restringido</h3></div>;
}

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
  const [newClassData, setNewClassData] = useState<{ id?: number, name: string, code: string, day_of_week: number, start_time: string, end_time: string, color: string, capacity: number }>({ name: 'Entrenamiento Funcional', code: 'EF', day_of_week: 0, start_time: '08:30', end_time: '09:30', color: '#3b82f6', capacity: 15 });
  const [isEditingClass, setIsEditingClass] = useState(false);

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

  const defaultActivities = [
    { name: 'Entrenamiento Funcional', code: 'EF', color: '#3b82f6' },
    { name: 'Pilates en Suelo', code: 'PS', color: '#f97316' },
    { name: 'Entrenamiento Personalizado', code: 'EP', color: '#ec4899' },
    { name: 'Salsa y Bachata', code: 'SB', color: '#eab308' },
    { name: 'Zumba', code: 'ZB', color: '#ef4444' },
    { name: 'Reguetón Juvenil', code: 'RJ', color: '#06b6d4' }
  ];

  const [activities, setActivities] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('gym_activities');
      return stored ? JSON.parse(stored) : defaultActivities;
    } catch {
      return defaultActivities;
    }
  });

  const [isAddingNewActivity, setIsAddingNewActivity] = useState(false);
  const [newActivityData, setNewActivityData] = useState({ name: '', code: '', color: '#3b82f6' });

  const handleAddNewActivity = () => {
    if (!newActivityData.name || !newActivityData.code) {
      alert("Por favor completa el nombre y código de la actividad.");
      return;
    }
    const codeUpper = newActivityData.code.substring(0, 2).toUpperCase();
    const updated = [...activities, { name: newActivityData.name, code: codeUpper, color: newActivityData.color }];
    setActivities(updated);
    localStorage.setItem('gym_activities', JSON.stringify(updated));
    
    // Auto-select this newly created activity in the new class form
    setNewClassData(prev => ({
      ...prev,
      name: newActivityData.name,
      code: codeUpper,
      color: newActivityData.color
    }));
    
    setNewActivityData({ name: '', code: '', color: '#3b82f6' });
    setIsAddingNewActivity(false);
  };

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
      slotsMap.set(`${s.start}-${s.end}`, s);
    });

    allSchedules.forEach(s => {
      const key = `${s.start_time}-${s.end_time}`;
      if (!slotsMap.has(key)) {
        slotsMap.set(key, { start: s.start_time, end: s.end_time });
      }
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

  useEffect(() => {
    fetchSchedules();
    fetchHolidays();
  }, []);

  const selectedWeekday = getDayOfWeek(selectedDate);
  const isHoliday = holidays.find(h => h.date === selectedDate);

  const fetchClassBookings = async (scheduleId: number) => {
    try {
      const res = await fetch(`${API_URL}/admin/class_schedules/${scheduleId}/bookings?date=${selectedDate}`);
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

  const handleAddWalkIn = async (member: any) => {
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

  const handleSaveClass = async () => {
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
    if (!confirm("¿Eliminar este feriado?")) return;
    try {
      const res = await fetch(`${API_URL}/admin/holidays/${id}`, { method: 'DELETE' });
      if (res.ok) fetchHolidays();
    } catch (e) { console.error(e); }
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
          <td className="p-1 sm:p-3 text-center w-14 sm:w-24">
            <span className="inline-block px-1.5 sm:px-3 py-1 sm:py-1.5 bg-[#F38E26]/10 text-gray-700 dark:text-gray-300 font-black rounded-lg sm:rounded-xl border border-gray-200 dark:border-white/10 text-[7px] sm:text-[9px] uppercase tracking-tight">
              {slot.start} - {slot.end}
            </span>
          </td>
          {weekdayShortNames.map((_, dayIndex) => {
            const cellSchedules = schedules.filter(s => s.day_of_week === dayIndex && s.start_time === slot.start && s.end_time === slot.end);
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
                    start_time: slot.start,
                    end_time: slot.end,
                    color: '#3b82f6',
                    capacity: 15
                  });
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
                          fetchClassBookings(s.id);
                        }}
                        style={{ backgroundColor: s.color }}
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
            setNewClassData({ name: 'Entrenamiento Funcional', code: 'EF', day_of_week: selectedWeekday, start_time: '08:30', end_time: '09:30', color: '#3b82f6', capacity: 15 });
            setIsEditingClass(false);
            setIsClassModalOpen(true);
          }} className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#0a0a0a] text-white dark:bg-[#F38E26] dark:text-[#0a0a0a] border border-[#F38E26] whitespace-nowrap">+ Agregar Clase Fija</button>
          <button onClick={() => setIsHolidayModalOpen(true)} className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">+ Configurar Feriado</button>
        </div>
      </div>

      {isHoliday && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider">⚠️ DÍA NO LABORABLE: {isHoliday.description}</p>
          <button onClick={() => handleDeleteHoliday(isHoliday.id)} className="text-[8px] font-black uppercase tracking-widest bg-red-500 text-white px-3 py-1 rounded-lg">Eliminar Feriado</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Grilla Semanal */}
          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 p-6 rounded-[35px] space-y-6">
            
            {/* Clases por la Mañana */}
            <div>
              <div className="bg-[#F38E26] text-white font-black text-center py-2.5 uppercase tracking-widest text-[9px] rounded-t-2xl">
                Clases por la Mañana
              </div>
              <div className="overflow-x-auto border-x border-b border-gray-200 dark:border-white/5 rounded-b-2xl">
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
              </div>
            </div>

            {/* Clases por la Tarde / Noche */}
            <div>
              <div className="bg-[#F38E26] text-white font-black text-center py-2.5 uppercase tracking-widest text-[9px] rounded-t-2xl">
                Clases por la Tarde/Noche
              </div>
              <div className="overflow-x-auto border-x border-b border-gray-200 dark:border-white/5 rounded-b-2xl">
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
              </div>
            </div>

            {/* Actividades Leyenda */}
            <div className="pt-4 border-t border-gray-200 dark:border-white/5 text-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 dark:text-white/20 block mb-3">Actividades</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-[8px] font-black uppercase">
                <span className="text-[#3b82f6]">● Entrenamiento Funcional (EF)</span>
                <span className="text-[#f97316]">● Pilates en Suelo (PS)</span>
                <span className="text-[#ec4899]">● Entrenamiento Personalizado (EP)</span>
                <span className="text-[#eab308]">● Salsa y Bachata (SB)</span>
                <span className="text-[#ef4444]">● Zumba (ZB)</span>
                <span className="text-[#06b6d4]">● Reguetón Juvenil (RJ)</span>
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
                    setNewClassData(activeSchedule);
                    setIsEditingClass(true);
                    setIsClassModalOpen(true);
                  }} className="text-[8px] font-black text-gray-500 dark:text-white/30 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded">Editar</button>
                  <button onClick={() => {
                    handleDeleteClass(activeSchedule.id);
                  }} className="text-[8px] font-black text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded">Eliminar</button>
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
                          <div key={m.id} onClick={() => handleAddWalkIn(m)} className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-b-0 text-[10px] uppercase font-black flex justify-between items-center text-white">
                            <span>{m.name} <span className="text-white/40 font-normal">({m.dni})</span></span>
                            <span className="text-[8px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-black uppercase">Añadir</span>
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
                      const selected = activities.find(act => act.name === e.target.value);
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
                    {activities.map((act, i) => (
                      <option key={i} value={act.name}>{act.name} ({act.code})</option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => setIsAddingNewActivity(!isAddingNewActivity)} 
                    className="px-3 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl text-[9px] font-black uppercase hover:bg-orange-500 hover:text-white transition-all whitespace-nowrap">
                    {isAddingNewActivity ? "Cerrar" : "+ Nueva"}
                  </button>
                </div>
              </div>

              {isAddingNewActivity && (
                <div className="p-4 bg-[#141b29]/60 dark:bg-black/40 border border-orange-500/20 rounded-2xl space-y-3">
                  <p className="text-[9px] font-black uppercase text-orange-500">Nueva Actividad Personalizada</p>
                  <div className="space-y-1">
                    <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-1">Nombre de Actividad</label>
                    <input type="text" placeholder="Ej: Spinning, Yoga..." className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={newActivityData.name} onChange={e=>setNewActivityData({...newActivityData, name: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-1">Código (2 letras)</label>
                      <input type="text" maxLength={2} placeholder="Ej: SP" className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-black dark:text-white text-xs outline-none focus:border-orange-500 uppercase text-center font-bold" value={newActivityData.code} onChange={e=>setNewActivityData({...newActivityData, code: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-gray-500 dark:text-white/20 uppercase font-black ml-1">Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" className="w-10 h-10 p-0 bg-transparent border-0 outline-none cursor-pointer rounded-xl flex-shrink-0" value={newActivityData.color} onChange={e=>setNewActivityData({...newActivityData, color: e.target.value})} />
                        <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-black dark:text-white text-[10px] outline-none focus:border-orange-500" value={newActivityData.color} onChange={e=>setNewActivityData({...newActivityData, color: e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={handleAddNewActivity} className="w-full py-2 bg-orange-500 text-white rounded-xl text-[9px] font-black uppercase hover:scale-[1.01] transition-all">Guardar Actividad</button>
                </div>
              )}

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
                  <select className="w-full bg-[#141b29]/40 dark:bg-black/40 border border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={newClassData.day_of_week} onChange={e=>setNewClassData({...newClassData, day_of_week: parseInt(e.target.value)})}>
                    {weekdayNames.map((n, i) => <option key={i} value={i}>{n}</option>)}
                  </select>
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
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsClassModalOpen(false)} className="flex-1 py-3 text-[9px] font-black uppercase text-gray-400">Cancelar</button>
                <button onClick={handleSaveClass} className="flex-1 py-3 bg-[#0a0a0a] text-white rounded-xl text-[9px] font-black uppercase border border-[#F38E26]">Guardar</button>
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

