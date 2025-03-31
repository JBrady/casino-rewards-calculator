import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import Dashboard from './pages/Dashboard'; 
import { Login } from './pages/Login';       
import Register from './pages/Register';   
import AddCasino from './pages/AddCasino';   
import EditCasino from './pages/EditCasino'; 
import Calculator from './pages/Calculator'; 

// Higher-order component for protected routes
interface ProtectedRouteProps {
  session: Session | null;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ session, children }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

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
          {/* Root path: redirect based on session */}
          <Route
            path="/"
            element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
          />
          {/* Dashboard: Protected Route */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute session={session}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* Calculator: Protected Route (example, might remove later) */}
          <Route
            path="/calculator"
            element={
              <ProtectedRoute session={session}>
                <Calculator />
              </ProtectedRoute>
            }
          />
          {/* Add Casino: Protected Route */}
          <Route
            path="/add-casino"
            element={
              <ProtectedRoute session={session}>
                <AddCasino />
              </ProtectedRoute>
            }
          />
          {/* Edit Casino: Protected Route */}
          <Route
            path="/edit-casino/:id" // The :id part makes 'id' a URL parameter
            element={
              <ProtectedRoute session={session}>
                <EditCasino />
              </ProtectedRoute>
            }
          />
          {/* Login: Redirect if already logged in */}
          <Route
            path="/login"
            element={!session ? <Login /> : <Navigate to="/dashboard" replace />}
          />
          {/* Register: Redirect if already logged in */}
          <Route
            path="/register"
            element={!session ? <Register /> : <Navigate to="/dashboard" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} /> {/* Catch-all */}
        </Routes>
      </main>
    </div>
  );
}

export default App;