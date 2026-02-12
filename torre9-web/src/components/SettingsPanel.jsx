import React, { useState, useEffect } from 'react';
import {
    Settings,
    Building2,
    UserPlus,
    Save,
    Info,
    MapPin,
    Hash,
    CheckCircle2,
    Loader2,
    Trash2,
    FileText
} from 'lucide-react';
import { sortApartamentos } from '../utils/sorting';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const SettingsPanel = ({ onUpdate }) => {
    // Estados para condominios
    const [condominios, setCondominios] = useState([]);
    const [condominioActivo, setCondominioActivo] = useState(null);
    const [newCondo, setNewCondo] = useState({ nombre: '', nombre_torre: '', rif: '', direccion: '' });
    const [editingCondo, setEditingCondo] = useState(null);

    // Estados para apartamentos
    const [apartamentos, setApartamentos] = useState([]);
    const [newApto, setNewApto] = useState({ codigo: '', propietario: '' });
    const [editingApto, setEditingApto] = useState(null);

    // Estados UI
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Estados para el buscador de mapas (OSM)
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        fetchCondominios();
        fetchCondominioActivo();
        fetchApartamentos();
    }, []);

    const fetchCondominios = async () => {
        try {
            const resp = await fetch(`${API_URL}/condominios`);
            const data = await resp.json();
            setCondominios(data);
        } catch (error) {
            console.error("Error fetching condominios:", error);
        }
    };

    const fetchCondominioActivo = async () => {
        try {
            const resp = await fetch(`${API_URL}/condominios/activo`);
            const data = await resp.json();
            setCondominioActivo(data);
        } catch (error) {
            console.error("Error fetching condominio activo:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchApartamentos = async () => {
        try {
            const resp = await fetch(`${API_URL}/apartamentos`);
            const data = await resp.json();
            setApartamentos(data);
        } catch (error) {
            console.error("Error fetching apartamentos:", error);
        }
    };


    // ==============================================================================
    // FUNCIONES CRUD - CONDOMINIOS
    // ==============================================================================

    const createCondominio = async (e) => {
        e.preventDefault();
        try {
            const resp = await fetch(`${API_URL}/condominios`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                },
                body: JSON.stringify(newCondo)
            });
            if (resp.ok) {
                alert("Condominio creado con éxito");
                setNewCondo({ nombre: '', nombre_torre: '', rif: '', direccion: '' });
                fetchCondominios();
            } else {
                alert("Error al crear condominio");
            }
        } catch (error) {
            console.error("Error creating condominio:", error);
        }
    };

    const updateCondominio = async (id) => {
        console.log("🔧 updateCondominio llamado con ID:", id, "editingCondo:", editingCondo);
        try {
            const resp = await fetch(`${API_URL}/condominios/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                },
                body: JSON.stringify(editingCondo)
            });
            console.log("📡 Respuesta del servidor:", resp.status, resp.ok);
            if (resp.ok) {
                setEditingCondo(null);
                fetchCondominios();
                if (condominioActivo?.id === id) fetchCondominioActivo();
                if (onUpdate) onUpdate();
            } else {
                alert("Error al actualizar condominio");
            }
        } catch (error) {
            console.error("Error updating condominio:", error);
        }
    };

    const activarCondominio = async (id) => {
        if (!confirm("¿Cambiar al condominio seleccionado? Esto recargará los datos del edificio activo.")) return;
        try {
            const resp = await fetch(`${API_URL}/condominios/${id}/activar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                }
            });
            if (resp.ok) {
                fetchCondominios();
                fetchCondominioActivo();
                fetchApartamentos();
                if (onUpdate) onUpdate();
                alert("Condominio activado. La aplicación se actualizará.");
            } else {
                alert("Error al activar condominio");
            }
        } catch (error) {
            console.error("Error activating condominio:", error);
        }
    };

    const deleteCondominio = async (id) => {
        if (!confirm("¿Eliminar este condominio? Esta acción es irreversible y eliminará todos sus datos asociados (apartamentos, gastos, etc.).")) return;
        try {
            const resp = await fetch(`${API_URL}/condominios/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                }
            });
            if (resp.ok) {
                fetchCondominios();
            } else {
                const errorData = await resp.json();
                alert(`Error: ${errorData.error || 'No se puede eliminar'}`);
            }
        } catch (error) {
            console.error("Error deleting condominio:", error);
        }
    };

    // ==============================================================================
    // FUNCIONES DE UTILIDAD (MAPAS)
    // ==============================================================================

    // Buscador de direcciones (Nominatim OSM)
    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (editingCondo) {
            setEditingCondo({ ...editingCondo, direccion: query });
        }
        if (query.length < 3) {
            setSuggestions([]);
            return;
        }

        setSearching(true);
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`);
            const data = await resp.json();
            setSuggestions(data);
        } catch (error) {
            console.error("Error buscando dirección:", error);
        } finally {
            setSearching(false);
        }
    };

    const selectAddress = (item) => {
        const fullAddress = item.display_name.toUpperCase();
        if (editingCondo) {
            setEditingCondo({ ...editingCondo, direccion: fullAddress });
        }
        setSearchQuery(fullAddress);
        setSuggestions([]);
    };


    // ==============================================================================
    // FUNCIONES CRUD - APART
    // ==============================================================================

    const addApto = async (e) => {
        e.preventDefault();

        // Validación local (frontend)
        const codigoNormalizado = newApto.codigo.toUpperCase().trim();
        const yaExiste = apartamentos.some(apto => apto.codigo === codigoNormalizado);

        if (yaExiste) {
            alert(`⚠️ El código "${codigoNormalizado}" ya existe en este condominio.\nPor favor verifica la lista o usa otro código.`);
            return;
        }

        try {
            const resp = await fetch(`${API_URL}/apartamentos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    codigo: codigoNormalizado,
                    propietario: newApto.propietario.toUpperCase().trim()
                })
            });
            if (resp.ok) {
                alert("Apartamento agregado con éxito");
                setNewApto({ codigo: '', propietario: '' });
                fetchApartamentos();
                if (onUpdate) onUpdate();
            } else {
                const errorData = await resp.json();
                // Manejo específico para error de duplicados que venga del backend
                if (errorData.error && errorData.error.includes("UNIQUE constraint failed")) {
                    alert(`⚠️ Error: El código "${codigoNormalizado}" ya está registrado en este edificio.`);
                } else {
                    alert(`Error al agregar apto: ${errorData.error || 'Acceso denegado'}`);
                }
            }
        } catch (error) {
            console.error("Error adding apto:", error);
            alert("Error de conexión al registrar el apartamento.");
        }
    };

    const updateApto = async (id) => {
        try {
            const resp = await fetch(`${API_URL}/apartamentos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    codigo: editingApto.codigo.toUpperCase().trim(),
                    propietario: editingApto.propietario.toUpperCase().trim()
                })
            });
            if (resp.ok) {
                setEditingApto(null);
                fetchApartamentos();
                if (onUpdate) onUpdate();
            } else {
                alert("Error al actualizar apartamento");
            }
        } catch (error) {
            console.error("Error updating apto:", error);
        }
    };

    const deleteApto = async (id) => {
        if (!confirm("¿Seguro que deseas eliminar esta unidad? Esta acción es irreversible y afectará los reportes históricos.")) return;
        try {
            const resp = await fetch(`${API_URL}/apartamentos/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                }
            });
            if (resp.ok) {
                fetchApartamentos();
                if (onUpdate) onUpdate();
            } else {
                alert("Error al eliminar apartamento");
            }
        } catch (error) {
            console.error("Error deleting apto:", error);
        }
    };

    if (loading) return (
        <div className="p-20 text-center">
            <Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={48} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando Configuración...</p>
        </div>
    );

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Header Módulo */}
            <div className="ledger-card p-10 flex flex-col md:flex-row items-center justify-between bg-white border-l-4 border-l-ledger-accent gap-8 shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-ledger-audit rounded-2xl border border-ledger-border shadow-inner text-ledger-accent">
                        <Settings size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-ledger-ink uppercase tracking-tighter">Módulo de Configuración</h3>
                        <p className="font-bold text-slate-400 text-xs uppercase tracking-widest mt-1">Sistema Multi-Condominio</p>
                    </div>
                </div>
                {/* Selector de Condominio Activo */}
                {condominioActivo && (() => {
                    // Generar acrónimo de la torre: "ARAGUANEY 9" → "A9"
                    const nombreTorre = condominioActivo.nombre_torre || '';
                    const palabras = nombreTorre.toUpperCase().trim().split(' ');
                    const acronimo = palabras.length >= 2
                        ? palabras[0].charAt(0) + palabras[1]  // Primera letra + número/palabra
                        : nombreTorre.substring(0, 2);  // Fallback: primeras 2 letras

                    return (
                        <div className="relative px-8 py-5 rounded-2xl shadow-xl flex items-center justify-between overflow-hidden">
                            {/* Fondo con efecto de paisaje: agua (azul) y araguaney (amarillo dorado) */}
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-blue-600 to-amber-500 opacity-90"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 via-transparent to-yellow-400/20"></div>

                            {/* Contenido */}
                            <div className="relative flex-1 z-10">
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/90 mb-1">Edificio Activo:</p>
                                <p className="text-base font-black uppercase tracking-tight leading-tight text-white drop-shadow-lg">{condominioActivo.nombre}</p>
                                <p className="text-sm font-bold uppercase tracking-wide mt-0.5 text-white/95 drop-shadow">{nombreTorre}</p>
                            </div>
                            <div className="relative flex items-center justify-center z-10">
                                <p className="text-7xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">{acronimo}</p>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* GESTIÓN DE CONDOMINIOS */}
                <div className="ledger-card p-8 bg-white border-t-4 border-t-emerald-500 shadow-xl space-y-8">
                    <h4 className="text-sm font-black text-ledger-ink uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                        <Building2 className="text-emerald-600" size={18} /> Gestión de Edificios/Condominios
                    </h4>

                    {/* Formulario Nuevo Condominio */}
                    <form onSubmit={createCondominio} className="space-y-4 p-6 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-4">Registrar Nuevo Edificio</p>
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                required
                                type="text"
                                placeholder="NOMBRE DEL EDIFICIO"
                                value={newCondo.nombre}
                                onChange={(e) => setNewCondo({ ...newCondo, nombre: e.target.value.toUpperCase() })}
                                className="ledger-input text-[11px] font-black uppercase"
                            />
                            <input
                                required
                                type="text"
                                placeholder="TORRE/BLOQUE"
                                value={newCondo.nombre_torre}
                                onChange={(e) => setNewCondo({ ...newCondo, nombre_torre: e.target.value.toUpperCase() })}
                                className="ledger-input text-[11px] font-black uppercase"
                            />
                            <input
                                type="text"
                                placeholder="RIF"
                                value={newCondo.rif}
                                onChange={(e) => setNewCondo({ ...newCondo, rif: e.target.value.toUpperCase() })}
                                className="ledger-input text-[11px] font-mono font-black"
                            />
                            <input
                                type="text"
                                placeholder="DIRECCIÓN"
                                value={newCondo.direccion}
                                onChange={(e) => setNewCondo({ ...newCondo, direccion: e.target.value.toUpperCase() })}
                                className="ledger-input text-[11px] font-bold uppercase"
                            />
                        </div>
                        <button type="submit" className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">
                            + Registrar Edificio
                        </button>
                    </form>

                    {/* Tabla de Condominios */}
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50">
                                <tr className="border-b border-slate-200">
                                    <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Edificio</th>
                                    <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Torre</th>
                                    <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">RIF</th>
                                    <th className="p-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                    <th className="p-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {condominios.map((condo) => (
                                    <tr key={condo.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${condo.activo ? 'bg-blue-50/30' : ''}`}>
                                        <td className="p-4">
                                            {editingCondo?.id === condo.id ? (
                                                <input
                                                    type="text"
                                                    value={editingCondo.nombre}
                                                    onChange={(e) => setEditingCondo({ ...editingCondo, nombre: e.target.value.toUpperCase() })}
                                                    className="w-full p-2 bg-white border border-blue-200 rounded text-[10px] font-black uppercase"
                                                />
                                            ) : (
                                                <span className="text-[11px] font-black text-ledger-ink uppercase tracking-tighter">{condo.nombre}</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {editingCondo?.id === condo.id ? (
                                                <input
                                                    type="text"
                                                    value={editingCondo.nombre_torre}
                                                    onChange={(e) => setEditingCondo({ ...editingCondo, nombre_torre: e.target.value.toUpperCase() })}
                                                    className="w-full p-2 bg-white border border-blue-200 rounded text-[10px] font-black uppercase"
                                                />
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{condo.nombre_torre}</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {editingCondo?.id === condo.id ? (
                                                <input
                                                    type="text"
                                                    value={editingCondo.rif}
                                                    onChange={(e) => setEditingCondo({ ...editingCondo, rif: e.target.value.toUpperCase() })}
                                                    className="w-full p-2 bg-white border border-blue-200 rounded text-[10px] font-mono font-black"
                                                />
                                            ) : (
                                                <span className="text-[10px] font-mono font-bold text-slate-500">{condo.rif}</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {condo.activo ? (
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase">Activo</span>
                                            ) : (
                                                <button onClick={() => activarCondominio(condo.id)} className="px-3 py-1 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg text-[9px] font-black uppercase transition-all">
                                                    Activar
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-4 flex items-center justify-center gap-2">
                                            {editingCondo?.id === condo.id ? (
                                                <>
                                                    <button onClick={() => { console.log("✅ Botón guardar clickeado para ID:", condo.id); updateCondominio(condo.id); }} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all"><Save size={14} /></button>
                                                    <button onClick={() => setEditingCondo(null)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all">X</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => setEditingCondo(condo)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><FileText size={14} /></button>
                                                    {!condo.activo && <button onClick={() => deleteCondominio(condo.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* GESTIÓN DE UNIDADES (APARTAMENTOS) */}
                <div className="ledger-card p-8 bg-white border-t-4 border-t-ledger-ink shadow-xl space-y-8">
                    <div>
                        <h4 className="text-sm font-black text-ledger-ink uppercase tracking-[0.2em] mb-2 flex items-center gap-3">
                            <UserPlus className="text-ledger-ink" size={18} /> Gestión de Unidades
                        </h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Del edificio: {condominioActivo?.nombre || 'Cargando...'}</p>
                    </div>

                    {/* Formulario Nuevo Apartamento */}
                    <form onSubmit={addApto} className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Registrar Nueva Unidad</p>
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                required
                                type="text"
                                placeholder="CÓDIGO (Ej: PB-A)"
                                value={newApto.codigo}
                                onChange={(e) => setNewApto({ ...newApto, codigo: e.target.value.toUpperCase() })}
                                className="ledger-input text-[11px] font-black uppercase"
                            />
                            <input
                                required
                                type="text"
                                placeholder="NOMBRE DEL PROPIETARIO"
                                value={newApto.propietario}
                                onChange={(e) => setNewApto({ ...newApto, propietario: e.target.value.toUpperCase() })}
                                className="ledger-input text-[11px] font-black uppercase"
                            />
                        </div>
                        <button type="submit" className="px-6 py-3 bg-ledger-accent text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all">
                            + Registrar Unidad
                        </button>
                    </form>

                    {/* Tabla de Apartamentos */}
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-50 z-10">
                                <tr className="border-b border-slate-200">
                                    <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                                    <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Propietario</th>
                                    <th className="p-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortApartamentos(apartamentos).map((apto) => (
                                    <tr key={apto.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            {editingApto?.id === apto.id ? (
                                                <input
                                                    type="text"
                                                    value={editingApto.codigo}
                                                    onChange={(e) => setEditingApto({ ...editingApto, codigo: e.target.value.toUpperCase() })}
                                                    className="w-24 p-2 bg-white border border-blue-200 rounded text-[10px] font-black uppercase"
                                                />
                                            ) : (
                                                <span className="text-[11px] font-black text-ledger-ink uppercase tracking-tighter">{apto.codigo}</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {editingApto?.id === apto.id ? (
                                                <input
                                                    type="text"
                                                    value={editingApto.propietario}
                                                    onChange={(e) => setEditingApto({ ...editingApto, propietario: e.target.value.toUpperCase() })}
                                                    className="w-full p-2 bg-white border border-blue-200 rounded text-[10px] font-black uppercase"
                                                />
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{apto.propietario}</span>
                                            )}
                                        </td>
                                        <td className="p-4 flex items-center justify-center gap-2">
                                            {editingApto?.id === apto.id ? (
                                                <>
                                                    <button onClick={() => updateApto(apto.id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all"><Save size={14} /></button>
                                                    <button onClick={() => setEditingApto(null)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all">X</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => setEditingApto(apto)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><FileText size={14} /></button>
                                                    <button onClick={() => deleteApto(apto.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                        <Info className="text-blue-600 mt-1 shrink-0" size={16} />
                        <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-tight">
                            Gestiona múltiples edificios desde un solo sistema. Cambia entre condominios usando el botón "Activar".
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
