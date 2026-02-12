import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check sessionStorage for token
        const token = sessionStorage.getItem('token');
        const storedUser = sessionStorage.getItem('user');
        if (token && storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!res.ok) throw new Error('Credenciales inválidas');

            const data = await res.json();
            sessionStorage.setItem('token', data.token);
            const userData = { username: data.username, rol: data.rol };
            sessionStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    };

    const logout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
