import React from 'react';

interface MetricCardProps {
  title: string;
  value: React.ReactNode; // Use ReactNode for flexibility (string, number, JSX)
  // Optional: Add icon?: React.ReactNode;
  // Optional: Add children?: React.ReactNode; // For extra content like progress bars
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-sm font-medium text-gray-500 mb-1 truncate">{title}</h3>
      <div className="text-xl md:text-2xl font-semibold">{value}</div>
      {/* Placeholder for potential children like progress bars */}
      {/* {children} */}
    </div>
  );
};

export default MetricCard;
