import { useState, useEffect } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

interface DistributionCountdownProps {
  distributionTime: number; // timestamp in milliseconds
  rewardsDistributed?: boolean; // whether rewards have been distributed
}

export const DistributionCountdown = ({ distributionTime, rewardsDistributed = false }: DistributionCountdownProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = distributionTime - now;

      if (diff <= 0) {
        setIsPast(true);
        // Check if rewards have actually been distributed
        if (rewardsDistributed) {
          setTimeRemaining('Distributed');
        } else {
          setTimeRemaining('Distribution executing...');
        }
        return;
      }

      setIsPast(false);

      // Calculate time components
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Format the countdown string with "~" to indicate approximate timing
      if (days > 0) {
        setTimeRemaining(`~${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`~${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`~${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`~${seconds}s`);
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [distributionTime, rewardsDistributed]);

  if (distributionTime === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.85rem',
        color: rewardsDistributed ? '#10b981' : (isPast ? '#f59e0b' : '#10b981'),
        fontWeight: 500
      }}
      title={rewardsDistributed
        ? "Rewards have been distributed to all voters"
        : "Approximate time. Actual execution may occur within 16-32 seconds of scheduled time."}
    >
      <AccessTimeIcon sx={{ fontSize: 16 }} />
      <span>{timeRemaining}</span>
    </div>
  );
};
