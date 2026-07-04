import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,
  isAuthenticated: false,
  loading: true,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const response = await api.post('/auth/login/', { username, password });
      const { access_token, user } = response.data;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', access_token);
      }
      
      // Update global API headers for immediate request chaining
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      set({
        user,
        token: access_token,
        isAuthenticated: true,
        loading: false
      });
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout/');
    } catch (e) {
      // Ignored for offline safety
    }
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
    
    delete api.defaults.headers.common['Authorization'];

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false
    });
  },

  checkAuth: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false, loading: false });
      return;
    }

    try {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await api.get('/users/profile/');
      set({
        user: response.data,
        token,
        isAuthenticated: true,
        loading: false
      });
    } catch (error) {
      // Refresh token failure or invalid credential: wipe access token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
      }
      delete api.defaults.headers.common['Authorization'];
      set({ user: null, token: null, isAuthenticated: false, loading: false });
    }
  }
}));

export default useAuthStore;
