import React, { useState, useEffect } from 'react';
import { Route, Routes, Navigate, Link } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CalculatorPage from './pages/CalculatorPage';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false); 
      }
    );

    // Cleanup subscription on unmount
    return () => {
      // Correct way to unsubscribe
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      console.error("Error logging out:", error.message);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Casino Rewards Calculator</h1>
        {session ? (
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-red-600 rounded hover:bg-red-700"
          >
            Logout
          </button>
        ) : (
          <div>
            <Link to="/login" className="mr-2 text-blue-300 hover:text-blue-100">Login</Link>
            <Link to="/register" className="text-blue-300 hover:text-blue-100">Register</Link>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <Routes>
          <Route
            path="/"
            element={session ? <CalculatorPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/login"
            element={!session ? <LoginPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/register"
            element={!session ? <RegisterPage /> : <Navigate to="/" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;