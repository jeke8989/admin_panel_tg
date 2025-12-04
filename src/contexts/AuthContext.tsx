import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../utils/api';

type AdminRole = 'admin' | 'user';

interface Admin {
  id: string;
  email: string;
  role: AdminRole;
}

interface AuthContextType {
  admin: Admin | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Проверяем, есть ли сохраненный токен и админ
    const savedAdmin = localStorage.getItem('admin');
    const savedToken = localStorage.getItem('accessToken');

    if (savedAdmin && savedToken) {
      try {
        setAdmin(JSON.parse(savedAdmin));
      } catch (error) {
        console.error('Error parsing saved admin:', error);
        localStorage.removeItem('admin');
        localStorage.removeItem('accessToken');
      }
    }
    setIsLoading(false);
  }, []);

  const getErrorMessage = (error: any): string => {
    // Проверка на сетевую ошибку (сервер недоступен)
    if (!error.response) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        return 'Сервер недоступен. Проверьте, что бэкенд запущен.';
      }
      return error.message || 'Ошибка подключения к серверу';
    }

    if (error.response?.data) {
      const data = error.response.data;
      
      // Обработка ошибок валидации NestJS
      if (Array.isArray(data.message)) {
        return data.message.join(', ');
      }
      
      // Обработка обычных сообщений об ошибках
      if (data.message) {
        return data.message;
      }
      
      // Обработка ошибок без message
      if (data.error) {
        return data.error;
      }
    }
    
    // Обработка HTTP ошибок без данных
    if (error.response?.status) {
      return `Ошибка ${error.response.status}: ${error.response.statusText || 'Неизвестная ошибка'}`;
    }
    
    // Обработка сетевых ошибок
    if (error.message) {
      return error.message;
    }
    
    return 'Произошла неизвестная ошибка';
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, admin: adminData } = response.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('admin', JSON.stringify(adminData));
      setAdmin(adminData);
    } catch (error: any) {
      throw new Error(getErrorMessage(error) || 'Ошибка при входе в систему');
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/register', { email, password });
      const { accessToken, admin: adminData } = response.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('admin', JSON.stringify(adminData));
      setAdmin(adminData);
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Error response:', error.response);
      const errorMessage = getErrorMessage(error) || 'Ошибка при регистрации';
      throw new Error(errorMessage);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('admin');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        isLoading,
        login,
        register,
        logout,
        isAuthenticated: !!admin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

