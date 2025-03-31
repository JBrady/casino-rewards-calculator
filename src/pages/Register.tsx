import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import { useAuthContext } from '../contexts/AuthContext'; 

const Register: React.FC = () => {
  const navigate = useNavigate(); 
  const { signUp } = useAuthContext(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null); 

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: signUpError } = await signUp(email, password);

    if (signUpError) {
      console.error("Registration component error:", signUpError);
      if (signUpError.message.includes('User already registered')) {
          setError('This email is already registered. Please try logging in.');
      } else if (signUpError.message.includes('Password should be at least 6 characters')) {
          setError('Password must be at least 6 characters long.');
      } else if (signUpError.message.includes('Unable to validate email address: invalid format')) {
          setError('Please enter a valid email address.');
      } else if (signUpError.message.includes('failed to create user profile')) { 
          setError('Registration successful, but failed to create user profile. Please contact support.');
      } else {
          setError(signUpError.message || 'An unexpected error occurred during registration.');
      }
    } else {
      setMessage('Registration successful! Please check your email for the confirmation link.');
      setEmail('');
      setPassword('');
      // navigate('/login'); 
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Create Account</h2>
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || !!message} 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6} 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || !!message}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}
        {message && (
          <p className="text-sm text-green-600 text-center">{message}</p>
        )}

        <div>
          <button
            type="submit"
            disabled={loading || !!message}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${ (loading || !!message) ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' }`}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </div>
      </form>
      {!message && (
          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Login here
            </Link>
          </p>
      )}
    </div>
  );
};

export default Register;
