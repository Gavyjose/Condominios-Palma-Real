import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Building2, Lock, User } from 'lucide-react';

const LoginPage = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const success = await login(username, password);
        if (!success) setError('Usuario o contraseña incorrectos');
    };

    return (
        <div className="min-h-screen bg-ledger-audit flex items-center justify-center p-6 relative overflow-hidden">
            {/* Elementos decorativos sutiles tipo marca de agua */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/20 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-200/30 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-[440px] relative">
                <div className="ledger-card overflow-hidden shadow-2xl">
                    <div className="bg-ledger-ink p-10 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-blue-600/10 opacity-50"></div>
                        <div className="relative z-10 space-y-4">
                            <div className="bg-white/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/20 shadow-inner">
                                <Building2 className="text-white" size={40} strokeWidth={1.5} />
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">TORRE 9</h1>
                            <div className="h-px w-12 bg-blue-500/50 mx-auto"></div>
                            <p className="text-blue-100/60 text-[10px] font-black uppercase tracking-[0.2em]">Sistema de Gestión Operativa</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-10 space-y-8 bg-white">
                        <div className="space-y-2 text-center mb-4">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Identificación de Usuario</h2>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs text-center font-bold border border-red-100 animate-in fade-in zoom-in duration-300">
                                {error}
                            </div>
                        )}

                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Usuario</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-ledger-accent transition-colors" size={18} />
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ingrese identificador"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="ledger-input pl-12 bg-slate-50/50 border-slate-100 hover:border-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clave de Acceso</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-ledger-accent transition-colors" size={18} />
                                    <input
                                        required
                                        type="password"
                                        placeholder="············"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="ledger-input pl-12 bg-slate-50/50 border-slate-100 hover:border-slate-200"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full ledger-button-primary h-14 text-sm uppercase tracking-widest shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 overflow-hidden group"
                        >
                            <span>ACCEDER AL REGISTRO</span>
                            <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <Building2 size={12} />
                            </div>
                        </button>

                        <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            Seguridad Institucional v2.0
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
