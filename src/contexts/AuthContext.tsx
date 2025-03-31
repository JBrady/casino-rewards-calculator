import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
}

// Create the context with a default value (can be null or an initial state)
// Using `undefined` forces consumers to check if they are within a Provider
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Check initial session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Set loading to false *after* initial check/update
      // Avoid setting loading=true on every auth change, only initially
      if (loading) setLoading(false);
    });

    // Cleanup listener on component unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // State updates are handled by the onAuthStateChange listener
    setLoading(false);
    return { error };
  };

  const signUp = async (email: string, password: string): Promise<{ error: AuthError | null }> => {
    setLoading(true);
    try {
      // Note: Supabase sends a confirmation email by default (if enabled).
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

      if (authError) {
        // Throw auth error to be caught below
        throw authError;
      }

      // If signup was successful and we got user data, the trigger will handle profile creation.
      // We no longer need to attempt the insert from the client.
      if (authData?.user) {
        console.log(`User ${authData.user.id} created, trigger will handle profile.`);
      } else {
        // This case should be rare if authError is null, but handle defensively
        throw new Error('Sign up succeeded according to Supabase, but no user data was returned.');
      }

      // User needs to confirm email (if enabled), state won't fully change until login post-confirmation.
      // Return null error on success, matching AuthContextType
      return { error: null };

    } catch (error) {
      // Catch errors from auth.signUp only
      console.error("Sign up auth error:", error);
      // Ensure the returned error conforms to AuthError type for the interface
      const returnedError = error instanceof AuthError ? error : new AuthError(String(error), (error instanceof Error && 'status' in error ? error.status as number : undefined));
      // Return the auth error, matching AuthContextType
      return { error: returnedError }; 
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    // State updates handled by listener
    setLoading(false);
    return { error };
  };

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  // Render children only after initial loading is complete?
  // Or show loading state within provider?
  // For now, let consumers handle the loading state.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
