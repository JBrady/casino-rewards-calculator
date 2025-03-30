import React, { useState, useEffect, useCallback } from 'react';
import MetricCard from '../components/Dashboard/MetricCard';
import { formatDistanceToNow } from 'date-fns';
import { getTrackedCasinos, TrackedCasino, updateLastCollected } from '../lib/supabaseClient';

const placeholderMetrics = {
  totalBalance: 1234.56,
  totalPlaythroughRequired: 5000,
  totalPlaythroughCompleted: 1500.75,
  totalNetRewards: 450.20,
};

const placeholderActivity = [
  {
    id: 'act1',
    type: 'collection',
    description: 'Collected from Golden Phoenix',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    amount: 25.00
  },
  {
    id: 'act2',
    type: 'deposit',
    description: 'Deposited to Lucky Dragon Casino',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    amount: 100.00
  },
  {
    id: 'act3',
    type: 'playthrough',
    description: 'Updated playthrough at Slots Heaven',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    amount: -50.75
  },
  {
    id: 'act4',
    type: 'collection',
    description: 'Collected from QuickSpin Rewards',
    timestamp: new Date(Date.now() - 0.5 * 60 * 60 * 1000),
    amount: 10.50
  },
  {
    id: 'act5',
    type: 'withdrawal',
    description: 'Withdrawal initiated from Golden Phoenix',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    amount: -200.00
  },
].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

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

const DashboardPage: React.FC = () => {
  const [collections, setCollections] = useState<TrackedCasino[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const [, setTick] = useState(0);

  const fetchCollections = useCallback(async () => {
    try {
      setLoadingCollections(true);
      setCollectionsError(null);
      const data = await getTrackedCasinos();
      setCollections(data);
    } catch (err: any) {
      setCollectionsError(err.message || 'Failed to fetch collections');
      console.error('Fetch Collections Error:', err);
    } finally {
      setLoadingCollections(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTick(prevTick => prevTick + 1);
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const upcomingCollections = collections
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
      await fetchCollections();
    } catch (err: any) {
      console.error('Collection Error:', err);
      setCollectionsError(err.message || 'Failed to mark as collected');
    } finally {
      setCollectingId(null);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>

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
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">Upcoming Collections</h3>
          {loadingCollections ? (
            <p className="text-gray-500 italic">Loading collections...</p>
          ) : collectionsError ? (
            <p className="text-red-500 italic">Error: {collectionsError}</p>
          ) : upcomingCollections.length > 0 ? (
            <ul className="space-y-3 max-h-96 overflow-y-auto">
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
                      {collection.timeRemaining === 'Now' && (
                        <button
                          onClick={() => handleCollect(collection.id)}
                          disabled={isCollectingThis || !!collectingId}
                          className={`px-3 py-1 text-xs font-medium rounded transition-colors 
                                      ${isCollectingThis
                                        ? 'bg-gray-300 text-gray-500 cursor-wait' 
                                        : collectingId
                                          ? 'bg-green-200 text-green-600 cursor-not-allowed' 
                                          : 'bg-green-500 text-white hover:bg-green-600'} `}
                        >
                          {isCollectingThis ? 'Collecting...' : 'Collect'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No casinos tracked yet. Add some!</p>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
          {placeholderActivity.length > 0 ? (
            <ul className="space-y-3 max-h-60 overflow-y-auto">
              {placeholderActivity.map((activity) => (
                <li key={activity.id} className="flex justify-between items-start border-b border-gray-100 pb-2 last:border-b-0">
                  <div>
                    <p className="text-sm text-gray-800">{activity.description}</p>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  {activity.amount !== undefined && (
                    <span className={`text-sm font-semibold ${activity.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {activity.amount > 0 ? '+' : ''}{formatCurrency(activity.amount)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
