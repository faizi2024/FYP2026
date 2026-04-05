import { useAuth as useAuthContext } from '@/contexts/auth-context';

// This is a placeholder hook. In a real application, you would implement
// this to connect to your authentication service (e.g., Firebase).
export const useAuth = () => {
  return useAuthContext();
};
