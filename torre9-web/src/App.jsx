import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { AdminPanel } from './components/AdminPanel';
import OwnerPanel from './components/OwnerPanel';
import ManagementPanel from './components/ManagementPanel';
import HistoricoMensual from './components/HistoricoMensual';
import ReportSection from './components/ReportSection';
import DebtMonitor from './components/DebtMonitor';
import SettingsPanel from './components/SettingsPanel';
import ReportesAvanzados from './components/ReportesAvanzados';
import { Loader2 } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';

// Nueva configuración de API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const App = () => {
  const { user, logout, loading: authLoading } = useAuth();

  const [view, setView] = useState('admin');
  const [adminSubView, setAdminSubView] = useState('dashboard');
  const [selectedApto, setSelectedApto] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [data, setData] = useState({
    resumen: null,
    gastos: [],
    cobranzas: [],
    terraza: [],
    notifications: [],
    isRefreshing: false
  });
  const [config, setConfig] = useState({
    nombre_condominio: 'CARGANDO...',
    nombre_torre: 'TORRE 9',
    rif: '',
    direccion: ''
  });
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchData = async () => {
    try {
      const fetchJson = async (url) => {
        try {
          const r = await fetch(url);
          if (!r.ok) {
            console.error(`Error en servicio: ${url} (Status: ${r.status})`);
            return null;
          }
          return await r.json();
        } catch (e) {
          console.error(`Falla de conexión: ${url}`, e);
          return null;
        }
      };

      const mesAnioStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      console.log(`[DEBUG] Consultando gastos para: ${mesAnioStr}`);

      // Activar indicador de refresco y limpiar tabla
      setData(prev => ({ ...prev, gastos: [], isRefreshing: true }));

      const [resumen, gastos, cobranzas, terraza, notifications, settings] = await Promise.all([
        fetchJson(`${API_URL}/resumen?mes_anio=${mesAnioStr}`),
        fetchJson(`${API_URL}/gastos?mes_anio=${mesAnioStr}&t=${Date.now()}`),
        fetchJson(`${API_URL}/cobranzas`),
        fetchJson(`${API_URL}/terraza`),
        fetchJson(`${API_URL}/notificaciones`),
        fetchJson(`${API_URL}/config`)
      ]);

      console.log(`[DEBUG] Gastos recibidos (${mesAnioStr}):`, (gastos || []).length);

      setData({
        resumen: resumen || data.resumen,
        gastos: gastos || [],
        cobranzas: cobranzas || [],
        terraza: terraza || [],
        notifications: notifications || [],
        isRefreshing: false
      });

      if (settings && !settings.error) {
        setConfig(settings);
      } else {
        setConfig(prev => ({ ...prev, nombre_condominio: 'TORRE 9 (APP)' }));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setData(prev => ({ ...prev, isRefreshing: false }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user, selectedMonth, selectedYear]);

  if (loading || authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-ledger-accent" size={48} />
    </div>
  );

  if (!user) return <LoginPage />;

  // Cálculos derivados
  const totalAptos = data.cobranzas?.length || 0;
  const aptosSolventes = data.cobranzas?.filter(c => c.deuda_total_usd <= 0.1).length || 0;
  const porcentajeSolvencia = totalAptos > 0 ? ((aptosSolventes / totalAptos) * 100).toFixed(1) : 0;

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      <Sidebar
        config={config}
        user={user}
        view={view}
        setView={setView}
        adminSubView={adminSubView}
        setAdminSubView={setAdminSubView}
        logout={logout}
        notificationsCount={data?.notifications?.length || 0}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${isCollapsed ? 'ml-[80px]' : 'ml-[280px]'}`}>
        <div className="p-8 pb-32">
          {/* Header Global */}
          <header className="flex justify-between items-center mb-8 animate-in slide-in-from-top-4 duration-500">
            <div>
              <h2 className="text-3xl font-black text-ledger-ink tracking-tighter uppercase">{config.nombre_condominio}</h2>
              <p className="text-xs font-bold text-ledger-accent uppercase tracking-[0.2em] opacity-80 mt-1">{config.nombre_torre}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-sm font-black text-slate-700 uppercase">{user.username}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.rol}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-ledger-accent text-white flex items-center justify-center font-black shadow-lg shadow-ledger-accent/20">
                {user.username.charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {view === 'admin' ? (
              <>
                {adminSubView === 'dashboard' && <AdminPanel data={data} porcentajeSolvencia={porcentajeSolvencia} aptosSolventes={aptosSolventes} totalAptos={totalAptos} />}
                {adminSubView === 'reports' && <ReportSection data={data} totalAptos={totalAptos} config={config} />}
                {adminSubView === 'management' && (
                  <ManagementPanel
                    data={data}
                    config={config}
                    onUpdate={fetchData}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
                    isLoading={data.isRefreshing}
                  />
                )}
                {adminSubView === 'debt_monitor' && <DebtMonitor data={data} onUpdate={fetchData} />}
                {adminSubView === 'history' && <HistoricoMensual config={config} API_URL={API_URL} />}
                {adminSubView === 'settings' && <SettingsPanel onUpdate={fetchData} />}
                {adminSubView === 'advanced_reports' && <ReportesAvanzados config={config} API_URL={API_URL} data={data} />}
              </>
            ) : (
              <OwnerPanel
                data={data}
                selectedApto={selectedApto}
                setSelectedApto={setSelectedApto}
                onPaymentNotified={fetchData}
                config={config}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
