import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTrackedCasinoById, updateTrackedCasino, TrackedCasino } from '../lib/supabaseClient';

const EditCasino: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [casinoName, setCasinoName] = useState('');
  const [interval, setInterval] = useState(''); 
  const [bonusDescription, setBonusDescription] = useState(''); 
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); 
  const [saving, setSaving] = useState(false); 

  useEffect(() => {
    if (!id) {
      setError('No casino ID provided.');
      setLoading(false);
      return;
    }

    const fetchCasinoData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTrackedCasinoById(id);
        if (data) {
          setCasinoName(data.casino_name);
          setInterval(data.collection_interval_hours.toString()); 
          setBonusDescription(data.bonus_description || '');
        } else {
          setError('Casino not found or you do not have permission to edit it.');
        }
      } catch (err: any) {
        console.error('Error fetching casino data:', err);
        setError(err.message || 'Failed to load casino data.');
      } finally {
        setLoading(false);
      }
    };

    fetchCasinoData();
  }, [id]); 

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null); 

    const intervalHours = parseFloat(interval);
    if (isNaN(intervalHours) || intervalHours <= 0) {
      setError('Please enter a valid positive number for collection interval in hours.');
      return;
    }

    if (!casinoName) {
      setError('Casino Name is required.');
      return;
    }

    if (!id) { 
      setError('Cannot save changes without a casino ID.');
      return;
    }

    setSaving(true); 

    try {
      const updates: Partial<Omit<TrackedCasino, 'id' | 'user_id' | 'created_at' | 'last_collected_at'>> = {
        casino_name: casinoName,
        collection_interval_hours: intervalHours, 
        bonus_description: bonusDescription || null, 
      };
      await updateTrackedCasino(id, updates);
      navigate('/dashboard'); 
    } catch (err: any) {
      console.error('Error updating casino:', err);
      setError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto pt-4 max-w-lg text-center">Loading casino data...</div>;
  }

  return (
    <div className="container mx-auto pt-4 max-w-lg">
      <h2 className="text-2xl font-semibold mb-6 text-center">Edit Casino</h2>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
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
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="e.g., Lucky Dragon Casino"
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
            onChange={(e) => setInterval(e.target.value)} 
            required
            min="1"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="e.g., 24 (for daily)"
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')} 
            className="inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={saving} 
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={saving || loading} 
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditCasino;
