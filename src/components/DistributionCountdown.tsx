import { useState, useEffect } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

interface DistributionCountdownProps {
  distributionTime: number; // timestamp in milliseconds
}

export const DistributionCountdown = ({ distributionTime }: DistributionCountdownProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = distributionTime - now;

      if (diff <= 0) {
        setIsPast(true);
        setTimeRemaining('Pending distribution');
        return;
      }

      setIsPast(false);

      // Calculate time components
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Format the countdown string
      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [distributionTime]);

  if (distributionTime === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '0.85rem',
      color: isPast ? '#f59e0b' : '#10b981',
      fontWeight: 500
    }}>
      <AccessTimeIcon sx={{ fontSize: 16 }} />
      <span>{timeRemaining}</span>
    </div>
  );
};
