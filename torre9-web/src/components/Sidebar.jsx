import React, { useState } from 'react';
import {
    LayoutDashboard,
    FileBarChart,
    Banknote,
    Search,
    Settings,
    User,
    LogOut,
    Building2,
    Menu,
    X,
    ChevronRight,
    ShieldCheck,
    Calendar,
    Printer
} from 'lucide-react';

const Sidebar = ({
    config,
    user,
    view,
    setView,
    adminSubView,
    setAdminSubView,
    logout,
    notificationsCount = 0,
    isCollapsed,
    setIsCollapsed
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const menuItems = [
        { id: 'dashboard', label: 'Panel de Control', icon: <LayoutDashboard size={20} />, view: 'admin' },
        { id: 'reports', label: 'Reportes Automáticos', icon: <FileBarChart size={20} />, view: 'admin' },
        { id: 'management', label: 'Gestión (CRUD)', icon: <Search size={20} />, view: 'admin' },
        { id: 'debt_monitor', label: 'Deudas y Conciliaciones', icon: <Banknote size={20} />, view: 'admin', badge: notificationsCount > 0 ? notificationsCount : null },
        { id: 'history', label: 'Control Histórico', icon: <Calendar size={20} />, view: 'admin' },
        { id: 'advanced_reports', label: 'Reportes Avanzados', icon: <Printer size={20} />, view: 'admin' },
        { id: 'settings', label: 'Configuración', icon: <Settings size={20} />, view: 'admin' },
    ];

    const handleNav = (id) => {
        setAdminSubView(id);
        setView('admin');
        if (window.innerWidth < 1024) setIsOpen(false);
    };

    const toggleSidebar = () => setIsOpen(!isOpen);
    const toggleCollapse = () => setIsCollapsed(!isCollapsed);

    return (
        <>
            {/* Mobile Trigger */}
            <button
                onClick={toggleSidebar}
                className="fixed top-4 left-4 z-[60] lg:hidden p-3 bg-ledger-ink text-white rounded-xl shadow-xl"
            >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
                    onClick={toggleSidebar}
                ></div>
            )}

            {/* Sidebar Container */}
            <aside className={`fixed top-0 left-0 h-full bg-ledger-ink text-slate-300 z-50 transition-all duration-300 ease-in-out border-r border-slate-800 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isCollapsed ? 'w-20' : 'w-72'}`}>

                {/* Brand Header */}
                <div className={`p-6 border-b border-slate-800 flex items-center justify-between ${isCollapsed ? 'flex-col gap-4' : 'flex-row'}`}>
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-10 h-10 bg-ledger-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-ledger-accent/20 shrink-0">
                            <Building2 size={24} strokeWidth={1.5} />
                        </div>
                        {!isCollapsed && (
                            <div className="animate-in fade-in duration-500">
                                <h1 className="font-black text-white text-sm tracking-tighter uppercase leading-none truncate">{config.nombre_torre}</h1>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 truncate">{config.nombre_condominio}</p>
                            </div>
                        )}
                    </div>

                    {/* Collapse Toggle (Desktop only) */}
                    <button
                        onClick={toggleCollapse}
                        className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:bg-ledger-accent hover:text-white transition-colors border border-slate-700 shadow-lg"
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronRight size={16} className="rotate-180" />}
                    </button>
                </div>

                {/* User Profile Summary */}
                <div className={`p-5 bg-slate-900/50 flex items-center border-b border-slate-800 transition-all ${isCollapsed ? 'justify-center' : 'gap-4'}`}>
                    <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-ledger-accent shrink-0">
                        <User size={20} />
                    </div>
                    {!isCollapsed && (
                        <div className="animate-in fade-in duration-500 overflow-hidden">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Administrador</p>
                            <p className="text-xs font-bold text-white mt-1 uppercase tracking-tight">{user?.username || 'ADMIN'}</p>
                        </div>
                    )}
                </div>

                {/* Navigation Section */}
                <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar overflow-x-hidden">
                    {!isCollapsed && <div className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] animate-in slide-in-from-left-2">Menú Principal</div>}

                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleNav(item.id)}
                            title={isCollapsed ? item.label : ''}
                            className={`w-full flex items-center rounded-xl transition-all group relative ${isCollapsed ? 'justify-center py-4' : 'justify-between px-4 py-3.5'} ${view === 'admin' && adminSubView === item.id ? 'bg-ledger-accent text-white shadow-lg shadow-ledger-accent/20' : 'hover:bg-slate-800/50 hover:text-white'}`}
                        >
                            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'}`}>
                                <span className={`${view === 'admin' && adminSubView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-ledger-accent'} transition-colors shrink-0`}>
                                    {item.icon}
                                </span>
                                {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-wider animate-in fade-in duration-300 whitespace-nowrap">{item.label}</span>}
                            </div>
                            {!isCollapsed && item.badge && (
                                <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg border border-red-400">
                                    {item.badge}
                                </span>
                            )}
                            {isCollapsed && item.badge && (
                                <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-900"></div>
                            )}
                            {!isCollapsed && view === 'admin' && adminSubView === item.id && <ChevronRight size={14} className="opacity-50" />}
                        </button>
                    ))}

                    {!isCollapsed && <div className="px-4 py-6 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] animate-in slide-in-from-left-2">Más Opciones</div>}

                    <button
                        onClick={() => { setView('owner'); if (window.innerWidth < 1024) setIsOpen(false); }}
                        title={isCollapsed ? 'Vista Propietario' : ''}
                        className={`w-full flex items-center rounded-xl transition-all group ${isCollapsed ? 'justify-center py-4 mt-4' : 'gap-4 px-4 py-3.5'} ${view === 'owner' ? 'bg-slate-800 text-white border border-slate-700' : 'hover:bg-slate-800/50 hover:text-white'}`}
                    >
                        <span className={`${view === 'owner' ? 'text-ledger-accent' : 'text-slate-500 group-hover:text-ledger-accent'} transition-colors shrink-0`}>
                            <ShieldCheck size={18} />
                        </span>
                        {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-wider animate-in fade-in duration-300">Vista Propietario</span>}
                    </button>
                </nav>

                {/* Footer Actions */}
                <div className={`p-4 bg-slate-900/30 border-t border-slate-800 transition-all ${isCollapsed ? 'flex justify-center' : ''}`}>
                    <button
                        onClick={logout}
                        title={isCollapsed ? 'Cerrar Sesión' : ''}
                        className={`w-full flex items-center rounded-xl text-red-400 hover:bg-red-400/10 transition-all group ${isCollapsed ? 'justify-center py-4' : 'gap-4 px-4 py-4'}`}
                    >
                        <LogOut size={18} className="group-hover:translate-x-1 transition-transform shrink-0" />
                        {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-[0.2em] animate-in fade-in duration-300">Cerrar Sesión</span>}
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
