import { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export default function SystemModule({ API_URL, licenseInfo, onRenewLicense }: { API_URL: string, licenseInfo: any, onRenewLicense: () => void }) {
  const [announcement, setAnnouncement] = useState({
    active: false,
    title: 'Actualización del Sistema',
    subtitle: 'Atlascore v3.0',
    date_start: '29 de agosto de 2026',
    date_end: '30 de agosto de 2026',
    date_productive: '31 de agosto de 2026',
    version_from: 'v2.6',
    version_to: 'v3.0',
    description: 'Durante la puesta en producción y las primeras horas de operación, el equipo de Atlascore permanecerá atento y disponible para brindar soporte ante cualquier eventualidad que pueda ser notificada. Esta actualización forma parte de la evolución continua de la plataforma e incorpora mejoras orientadas al funcionamiento, estabilidad y crecimiento del sistema.',
    type: 'update'
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/admin/configs/system_announcement`)
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          setAnnouncement(prev => ({ ...prev, ...data.value }));
        }
      })
      .catch(console.error);
  }, [API_URL]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/configs/system_announcement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: announcement })
      });
      if (res.ok) {
        showToast("Anuncio del sistema guardado correctamente.", 'success');
      } else {
        showToast("Error al guardar el anuncio.", 'error');
      }
    } catch (e) {
      console.error(e);
      showToast("Error de conexión al guardar el anuncio.", 'error');
    }
    setIsSaving(false);
  };

  const renderLicenseCard = () => {
    if (!licenseInfo) return null;
    const { status, last_paid_month, history } = licenseInfo;

    let formattedDate = 'N/A';
    if (last_paid_month) {
      try {
        const d = new Date(last_paid_month);
        formattedDate = d.toLocaleString('es-AR', {
          day: '2-digit', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
        }) + ' hs';
      } catch (e) {}
    }

    let bgClass = "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700/60 text-red-700 dark:text-red-400";
    let badgeClass = "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
    let Icon = XCircle;

    if (status === 'AL DIA' || status === 'AL DÍA' || status === 'ACTIVO') {
      bgClass = "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-700/60 text-green-700 dark:text-green-400";
      badgeClass = "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
      Icon = CheckCircle;
    } else if (status === 'POR VENCER') {
      bgClass = "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400";
      badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
      Icon = AlertTriangle;
    } else if (status === 'DEUDA' || status === 'VENCIDA') {
      bgClass = "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700/60 text-red-700 dark:text-red-400";
      badgeClass = "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
      Icon = XCircle;
    }

    return (
      <div className="flex flex-col h-full gap-4 max-h-[500px]">
        {/* Main License Status Card */}
        <div className={`border rounded-[25px] p-6 shrink-0 shadow-sm ${bgClass}`}>
          <div className="flex items-center gap-3 mb-4">
            <Icon size={24} />
            <h3 className="text-sm font-black uppercase">Estado de Licencia Atlascore</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase font-bold opacity-80">Estado Actual</span>
              <span className={`text-xs font-black px-3 py-1 rounded-full ${badgeClass}`}>{status}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase font-bold opacity-80">Último mes abonado</span>
              <span className="text-xs font-bold">{formattedDate}</span>
            </div>
            
            {status !== 'AL DIA' && (
              <button
                onClick={onRenewLicense}
                className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 text-black dark:text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-md active:scale-95 transition-all"
              >
                Marcar Licencia AL DIA
              </button>
            )}
          </div>
        </div>

        {/* History Card */}
        {history && history.length > 0 && (
          <div className="border rounded-[25px] p-6 bg-white dark:bg-[#141b29]/40 border-gray-200 dark:border-white/5 flex-1 overflow-hidden flex flex-col shadow-sm">
            <h4 className="text-[10px] text-gray-500 dark:text-white/40 uppercase font-black tracking-widest mb-4">Historial de Actualizaciones</h4>
            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {history.map((h: any, i: number) => {
                let dStr = h.date;
                try {
                  dStr = new Date(h.date).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                } catch(e) {}
                return (
                  <div key={i} className="flex justify-between items-center text-[10px] bg-gray-50 dark:bg-black/20 rounded-xl px-4 py-3 border border-gray-100 dark:border-white/5">
                    <span className="font-bold text-gray-700 dark:text-gray-300">{dStr}</span>
                    <span className="font-black uppercase text-orange-600 dark:text-orange-400">{h.user || 'Admin'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="text-gray-400" size={20} />
        <h2 className="text-lg font-black uppercase text-gray-900 dark:text-white">Sistema y Ajustes Master</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Configs & Licenses */}
        <div className="space-y-6">
          {renderLicenseCard()}
        </div>

        {/* Right Column: Announcement Settings */}
        <div className="bg-white dark:bg-[#141b29]/40 border border-gray-200 dark:border-white/5 rounded-[25px] p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white">Anuncio Global</h3>
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={announcement.active} onChange={e => setAnnouncement({...announcement, active: e.target.checked})} />
                <div className={`block w-10 h-6 rounded-full transition-colors ${announcement.active ? 'bg-orange-500' : 'bg-gray-300 dark:bg-white/10'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${announcement.active ? 'transform translate-x-4' : ''}`}></div>
              </div>
              <span className="ml-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                {announcement.active ? 'Activo' : 'Inactivo'}
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 dark:text-white/40 uppercase font-bold ml-2">Título del Modal</label>
              <input type="text" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={announcement.title} onChange={e => setAnnouncement({...announcement, title: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 dark:text-white/40 uppercase font-bold ml-2">Subtítulo (Versión Nueva)</label>
                <input type="text" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={announcement.subtitle} onChange={e => setAnnouncement({...announcement, subtitle: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 dark:text-white/40 uppercase font-bold ml-2">Fecha Productiva</label>
                <input type="text" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={announcement.date_productive} onChange={e => setAnnouncement({...announcement, date_productive: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 dark:text-white/40 uppercase font-bold ml-2">Fecha Inicio Trabajos</label>
                <input type="text" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={announcement.date_start} onChange={e => setAnnouncement({...announcement, date_start: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 dark:text-white/40 uppercase font-bold ml-2">Fecha Fin Trabajos</label>
                <input type="text" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={announcement.date_end} onChange={e => setAnnouncement({...announcement, date_end: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 dark:text-white/40 uppercase font-bold ml-2">Versión Anterior</label>
                <input type="text" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={announcement.version_from} onChange={e => setAnnouncement({...announcement, version_from: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 dark:text-white/40 uppercase font-bold ml-2">Versión Nueva</label>
                <input type="text" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500" value={announcement.version_to} onChange={e => setAnnouncement({...announcement, version_to: e.target.value})} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 dark:text-white/40 uppercase font-bold ml-2">Descripción Detallada</label>
              <textarea 
                className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-black dark:text-white text-xs outline-none focus:border-orange-500 min-h-[100px] resize-y" 
                value={announcement.description} 
                onChange={e => setAnnouncement({...announcement, description: e.target.value})} 
              />
            </div>

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 bg-[#0a0a0a] dark:bg-white text-white dark:text-black rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Save size={14} />
              {isSaving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${toastMessage.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'} backdrop-blur-md`}>
            {toastMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            <span className="text-sm font-black uppercase tracking-wider">{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
