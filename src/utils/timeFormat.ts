/**
 * Time formatting utilities for poll durations and timestamps
 */

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

/**
 * Calculate time remaining until a future timestamp
 */
export function getTimeRemaining(endTime: number): TimeRemaining {
  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true
    };
  }

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return {
    days,
    hours: hours % 24,
    minutes: minutes % 60,
    seconds: seconds % 60,
    isExpired: false
  };
}

/**
 * Format time remaining as a human-readable string
 */
export function formatTimeRemaining(endTime: number, isActive: boolean): string {
  if (!isActive) {
    return 'Ended';
  }

  const timeLeft = getTimeRemaining(endTime);

  if (timeLeft.isExpired) {
    return 'Expired';
  }

  // Show different formats based on time remaining
  if (timeLeft.days > 0) {
    if (timeLeft.days > 7) {
      return `${timeLeft.days} days`;
    }
    return `${timeLeft.days}d ${timeLeft.hours}h`;
  }

  if (timeLeft.hours > 0) {
    return `${timeLeft.hours}h ${timeLeft.minutes}m`;
  }

  if (timeLeft.minutes > 0) {
    return `${timeLeft.minutes}m`;
  }

  return `${timeLeft.seconds}s`;
}

/**
 * Get a color class based on time remaining (for urgency indication)
 */
export function getTimeUrgencyClass(endTime: number, isActive: boolean): string {
  if (!isActive) {
    return 'time-ended';
  }

  const timeLeft = getTimeRemaining(endTime);

  if (timeLeft.isExpired) {
    return 'time-expired';
  }

  // Less than 1 hour - urgent
  if (timeLeft.days === 0 && timeLeft.hours === 0) {
    return 'time-urgent';
  }

  // Less than 24 hours - soon
  if (timeLeft.days === 0) {
    return 'time-soon';
  }

  // Less than 3 days - moderate
  if (timeLeft.days < 3) {
    return 'time-moderate';
  }

  // More than 3 days - normal
  return 'time-normal';
}

/**
 * Format a timestamp as a readable date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a timestamp as a readable date and time string
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}