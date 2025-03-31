import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate
import MetricCard from '../components/Dashboard/MetricCard';
import { formatDistanceToNowStrict } from 'date-fns'; // Use strict for more precise output like "5 hours ago"
import { 
  getTrackedCasinos, 
  TrackedCasino, 
  updateLastCollected, 
  getActivityLog, 
  ActivityLog,
  deleteTrackedCasino // Import the delete function
} from '../lib/supabaseClient'; 

const placeholderMetrics = {
  totalBalance: 1234.56,
  totalPlaythroughRequired: 5000,
  totalPlaythroughCompleted: 1500.75,
  totalNetRewards: 450.20,
};

const Dashboard: React.FC = () => {
  const [trackedCasinos, setTrackedCasinos] = useState<TrackedCasino[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]); // State for activity log
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true); // State for activity loading
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null); // State for activity errors
  const [collectingId, setCollectingId] = useState<string | null>(null); // Track which casino is being collected

  const [, setTick] = useState(0);

  const navigate = useNavigate(); // Add this line to get the navigate function

  // --- Helper Functions ---
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const calculateTimeRemaining = (nextCollectionTime: Date | null): string => {
    if (!nextCollectionTime) return 'Never';
    const now = new Date();
    const diffMs = nextCollectionTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return 'Now';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let remaining = '';
    if (diffHours > 0) remaining += `${diffHours}h `;
    if (diffMinutes > 0) remaining += `${diffMinutes}m`;

    return remaining.trim() || 'Soon';
  };

  // Fetch tracked casinos
  const fetchCollections = useCallback(async () => {
    try {
      setLoadingCollections(true);
      setCollectionsError(null);
      const data = await getTrackedCasinos();
      setTrackedCasinos(data);
    } catch (err: any) {
      setCollectionsError(err.message || 'Failed to fetch collections');
      console.error('Fetch Collections Error:', err);
    } finally {
      setLoadingCollections(false);
    }
  }, []);

  const fetchActivityLog = useCallback(async () => {
    setLoadingActivity(true);
    setActivityError(null);
    try {
      const logs = await getActivityLog(); // Fetch real logs
      setActivityLog(logs);
      console.log('Fetched Activity Log:', logs);
    } catch (err: any) {
      console.error('Error fetching activity log:', err);
      setActivityError(err.message || 'Failed to load activity log.');
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
    fetchActivityLog();
  }, [fetchCollections, fetchActivityLog]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTick(prevTick => prevTick + 1);
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const upcomingCollections = trackedCasinos
    .map(collection => {
      const lastCollectedTime = collection.last_collected_at ? collection.last_collected_at.getTime() : 0;
      const nextCollectionTime = lastCollectedTime !== 0
          ? new Date(lastCollectedTime + collection.collection_interval_hours * 60 * 60 * 1000)
          : new Date(Date.now() + collection.collection_interval_hours * 60 * 60 * 1000);

      const calculatedNextTime = collection.last_collected_at
          ? new Date(collection.last_collected_at.getTime() + collection.collection_interval_hours * 60 * 60 * 1000)
          : new Date();

      return {
        ...collection,
        id: collection.id,
        name: collection.casino_name,
        interval: collection.collection_interval_hours,
        nextCollectionTime: calculatedNextTime,
        timeRemaining: calculateTimeRemaining(calculatedNextTime)
      };
    })
    .sort((a, b) => {
        if (a.timeRemaining === 'Now' && b.timeRemaining !== 'Now') return -1;
        if (a.timeRemaining !== 'Now' && b.timeRemaining === 'Now') return 1;
        if (a.timeRemaining === 'Now' && b.timeRemaining === 'Now') return 0;
        return a.nextCollectionTime.getTime() - b.nextCollectionTime.getTime();
    });

  const handleCollect = async (id: string) => {
    setCollectingId(id);
    setCollectionsError(null);
    try {
      await updateLastCollected(id);
      console.log(`Successfully collected from ${id}. Refetching collections...`);
      await fetchCollections();
      await fetchActivityLog(); // Refetch activity log after collection too
    } catch (err: any) {
      console.error('Collection Error:', err);
      setCollectionsError(err.message || 'Failed to mark as collected');
    } finally {
      setCollectingId(null);
    }
  };

  const handleEdit = (id: string) => {
    console.log("Edit clicked for:", id);
    // TODO: Navigate to edit page or open modal
    alert(`Edit functionality not yet implemented for ID: ${id}`); 
  };

  const handleDelete = async (id: string) => {
    // Find the casino name for a more user-friendly confirmation message
    const casinoToDelete = trackedCasinos.find(casino => casino.id === id);
    const casinoName = casinoToDelete ? casinoToDelete.casino_name : 'this casino';

    if (window.confirm(`Are you sure you want to permanently delete ${casinoName}?`)) {
      // Optional: Set a deleting state here if needed
      // setDeletingId(id);
      setCollectionsError(null); // Clear previous errors
      try {
        await deleteTrackedCasino(id);
        console.log(`Successfully deleted casino ${id}`);
        // Refresh the list after deletion
        await fetchCollections(); 
        // Optionally refresh activity log if you decide to log deletions
        // await fetchActivityLog(); 
      } catch (err: any) {
        console.error('Delete Error:', err);
        setCollectionsError(err.message || 'Failed to delete casino');
        // Optional: Show error to user via toast/alert
      } finally {
        // Optional: Clear deleting state here
        // setDeletingId(null);
      }
    }
  };

  return (
    <div className="container mx-auto pt-4">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <Link
          to="/add-casino"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Track New Casino
        </Link>
      </div>

      {/* Key Metrics Section (Still using placeholders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Balance"
          value={formatCurrency(placeholderMetrics.totalBalance)}
        />
        <MetricCard
          title="Playthrough Progress"
          value={`${formatCurrency(placeholderMetrics.totalPlaythroughCompleted)} / ${formatCurrency(placeholderMetrics.totalPlaythroughRequired)}`}
        />
        <MetricCard
          title="Total Net Rewards"
          value={formatCurrency(placeholderMetrics.totalNetRewards)}
        />
        <div className="bg-white p-4 rounded-lg shadow flex items-center justify-center text-gray-400">
          <span>More Metrics...</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow pt-4">
          <h3 className="text-lg font-semibold mb-3 px-4">Upcoming Collections</h3>
          {loadingCollections ? (
            <p className="text-gray-500 italic px-4">Loading collections...</p>
          ) : collectionsError ? (
            <p className="text-red-500 italic px-4">Error: {collectionsError}</p>
          ) : upcomingCollections.length > 0 ? (
            <ul className="space-y-3 px-4 max-h-96 overflow-y-auto">
              {upcomingCollections.map((collection) => {
                const isCollectingThis = collectingId === collection.id;
                return (
                  <li key={collection.id} className="flex justify-between items-center border-b border-gray-100 py-2 last:border-b-0">
                    <div>
                      <span className="font-medium">{collection.name}</span>
                      <span className="text-xs text-gray-500 block">Interval: {collection.interval}h</span>
                      {collection.bonus_description && (
                        <span className="text-xs text-gray-400 block italic">{collection.bonus_description}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold block mb-1 ${collection.timeRemaining === 'Now' ? 'text-green-600' : 'text-gray-700'}`}>
                        {collection.timeRemaining}
                      </span>
                      <div className="flex items-center space-x-1.5 ml-2"> {/* Container for buttons */}
                        <button
                          // Navigate to the edit page for this specific casino ID
                          onClick={() => navigate(`/edit-casino/${collection.id}`)} 
                          className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 rounded bg-blue-100 hover:bg-blue-200 transition-colors disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(collection.id)} // Placeholder for delete handler
                          className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 rounded bg-red-100 hover:bg-red-200 transition-colors disabled:opacity-50"
                          disabled={collectingId === collection.id} // Disable delete while collecting
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => handleCollect(collection.id)}
                          disabled={collectingId === collection.id || collection.timeRemaining !== 'Now'}
                          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${collection.timeRemaining === 'Now' && collectingId !== collection.id
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          } ${collectingId === collection.id ? 'opacity-50 animate-pulse' : ''}`}
                        >
                          {collectingId === collection.id ? 'Collecting...' : collection.timeRemaining === 'Now' ? 'Collect' : collection.timeRemaining}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-500 italic px-4">No casinos tracked yet. Add some!</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow pt-4">
          <h3 className="text-lg font-semibold mb-3 px-4">Recent Activity</h3>
          {loadingActivity ? (
            <p className="text-gray-500 italic px-4">Loading activity...</p>
          ) : activityError ? (
            <p className="text-red-500 italic px-4">Error: {activityError}</p>
          ) : activityLog.length > 0 ? (
            <ul className="space-y-3 px-4 max-h-96 overflow-y-auto"> {/* Matched max height to Upcoming Collections */}
              {activityLog.map((log) => (
                <li key={log.id} className="flex justify-between items-start border-b border-gray-100 pb-2 last:border-b-0">
                  <div>
                    <span className="font-medium text-gray-800 block">{log.description}</span>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNowStrict(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic px-4">No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
