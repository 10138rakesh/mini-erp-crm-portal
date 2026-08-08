import React, { createContext, useState, useEffect, useContext } from 'react';

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up API fetch helper that automatically appends the JWT bearer token
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const activeToken = token || localStorage.getItem('erp_token');
    
    const headers = {
      'Content-Type': 'application/json',
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (err: any) {
      if (err instanceof TypeError || err?.message?.includes('fetch')) {
        throw new Error(`Unable to connect to the backend server at ${API_BASE_URL}. Please ensure the backend server is running.`);
      }
      throw err;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('erp_token');
      if (savedToken) {
        setToken(savedToken);
        try {
          // Verify token against backend
          const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${savedToken}`,
          };
          const res = await fetch(`${API_BASE_URL}/auth/me`, { headers });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
          } else {
            // Token expired or invalid
            localStorage.removeItem('erp_token');
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          console.error('Error verifying token on startup:', error);
          // If server is offline, don't clear token immediately so they can try again,
          // but for safety, clear session if it fails
          localStorage.removeItem('erp_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid credentials');
      }

      const data = await res.json();
      localStorage.setItem('erp_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (error: any) {
      console.error('Login request failed:', error);
      if (error instanceof TypeError || error?.message?.includes('fetch')) {
        throw new Error(`Unable to connect to the backend server at ${API_BASE_URL}. Please ensure the backend server is running.`);
      }
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('erp_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
