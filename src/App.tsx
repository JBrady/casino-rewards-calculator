import React, { createContext, useContext, useState } from 'react';
import CasinoRewardsForm from './components/CasinoRewardsForm';

interface Reward {
  day: number;
  reward: string;
  claimed: boolean;
}

interface User {
  username: string;
  streak: number;
  rewards: Reward[];
}

interface AppContextType {
  user: User;
  claimReward: (day: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export default function App() {
  const [user, setUser] = useState<User>({
    username: 'Player1',
    streak: 0,
    rewards: Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      reward: `Reward Day ${i + 1}`,
      claimed: false,
    })),
  });

  const claimReward = (day: number) => {
    setUser(prev => ({
      ...prev,
      rewards: prev.rewards.map(r => 
        r.day === day ? { ...r, claimed: true } : r
      ),
      streak: prev.streak + 1,
    }));
  };

  return (
    <AppContext.Provider value={{ user, claimReward }}>
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="p-4 bg-gray-800">
          <h1 className="text-2xl font-bold">Casino Rewards</h1>
        </header>
        <main className="max-w-4xl mx-auto p-4">
          <CasinoRewardsForm />
        </main>
      </div>
    </AppContext.Provider>
  );
}