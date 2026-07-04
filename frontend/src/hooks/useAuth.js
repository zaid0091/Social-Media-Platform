import useAuthStore from '@/store/useAuthStore';

export default function useAuth() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const updateUser = useAuthStore((state) => state.updateUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const refreshSession = useAuthStore((state) => state.refreshSession);

  return {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser,
    setLoading,
    refreshSession
  };
}
