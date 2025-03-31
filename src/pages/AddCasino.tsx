import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addTrackedCasino } from '../lib/supabaseClient'; // Import the API function

const AddCasino: React.FC = () => {
  const [casinoName, setCasinoName] = useState('');
  const [bonusDescription, setBonusDescription] = useState('');
  const [interval, setInterval] = useState(''); // Renamed from frequency
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!casinoName || interval === '' || parseInt(interval, 10) <= 0) {
      setError('Casino Name and a positive Collection Interval (hours) are required.');
      return;
    }

    setLoading(true);
    const casinoData = {
      casino_name: casinoName,
      bonus_description: bonusDescription || null, // Send null if empty
      collection_interval_hours: parseInt(interval, 10), // Corrected property name
    };

    try {
      console.log('Submitting to API:', casinoData);
      await addTrackedCasino(casinoData);

      // On success, navigate back to dashboard
      navigate('/dashboard');

    } catch (err: any) {
      console.error("Error adding casino:", err);
      setError(err.message || 'Failed to add casino. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <h2 className="text-2xl font-semibold mb-6 text-center">Track a New Casino</h2>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label htmlFor="casinoName" className="block text-sm font-medium text-gray-700 mb-1">
            Casino Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="casinoName"
            value={casinoName}
            onChange={(e) => setCasinoName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g., Lucky Dragon Casino"
          />
        </div>

        <div>
          <label htmlFor="bonusDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Bonus Description / Notes (Optional)
          </label>
          <textarea
            id="bonusDescription"
            value={bonusDescription}
            onChange={(e) => setBonusDescription(e.target.value)}
            rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="e.g., Daily $5 free play, must collect by midnight"
          />
        </div>

        <div>
          <label htmlFor="interval" className="block text-sm font-medium text-gray-700 mb-1">
            Collection Interval (hours) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="interval"
            value={interval}
            onChange={(e) => setInterval(e.target.value)} // Update state with the raw string value
            required
            min="0.1" // Allow fractional hours if needed, adjust as necessary
            step="any" // Allow decimals
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g., 24"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm italic">{error}</p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')} // Go back button
            disabled={loading}
            className="mr-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Casino'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddCasino;
