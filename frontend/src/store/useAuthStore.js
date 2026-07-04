import { create } from 'zustand';
import axios from 'axios';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  unreadNotificationCount: 0,

  setLoading: (isLoading) => set({ isLoading }),
  
  setAccessToken: (accessToken) => set({ accessToken }),

  setUnreadNotificationCount: (count) => set({ unreadNotificationCount: count }),
  incrementUnreadNotificationCount: () => set((state) => ({ unreadNotificationCount: state.unreadNotificationCount + 1 })),

  updateUser: (userData) => set((state) => ({
    user: state.user ? { ...state.user, ...userData } : userData
  })),

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const response = await axios.post('/api/auth/login/', { username, password });
      const { access_token, user } = response.data;
      
      set({
        user,
        accessToken: access_token,
        isAuthenticated: true,
        isLoading: false
      });
      return { success: true };
    } catch (error) {
      set({ isLoading: false });
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  },

  logout: async () => {
    try {
      await axios.post('/api/auth/logout/');
    } catch (e) {
      // Ignored for offline safety
    }

    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      unreadNotificationCount: 0
    });
  },

  refreshSession: async () => {
    set({ isLoading: true });
    try {
      // Get new access token using secure HttpOnly refresh cookie proxy
      const response = await axios.post('/api/auth/refresh/');
      const access = response.data.access_token || response.data.access;

      if (!access) {
        throw new Error('No access token returned from refresh endpoint');
      }

      // Update state temporarily so the profile API call works with authorization headers
      set({ accessToken: access });

      // Fetch user profile info
      const userResponse = await api.get('/users/profile/');

      set({
        user: userResponse.data,
        accessToken: access,
        isAuthenticated: true,
        isLoading: false
      });
      return { success: true };
    } catch (error) {
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false
      });
      return { success: false };
    }
  }
}));

export default useAuthStore;
