import { useAuthContext } from '../contexts/AuthContext';

// This hook is a simple wrapper around the context hook
// for potential future expansion or simplification for consumers.
export const useAuth = () => {
  return useAuthContext();
};
