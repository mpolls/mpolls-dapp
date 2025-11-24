import React, { useState, useEffect } from 'react';
import './DistributionTimePicker.css';

interface DistributionTimePickerProps {
  onTimeSelect: (timestamp: number) => void;
  minDate?: Date;
}

const DistributionTimePicker: React.FC<DistributionTimePickerProps> = ({
  onTimeSelect,
  minDate = new Date()
}) => {
  const [delayAmount, setDelayAmount] = useState<number>(1);
  const [delayUnit, setDelayUnit] = useState<'hours' | 'days'>('hours');
  const [calculatedTimestamp, setCalculatedTimestamp] = useState<number>(0);

  // Constraints: min 32 seconds, max 44 hours (10,000 periods)
  const MIN_DELAY_MS = 32000; // 32 seconds (2 periods)
  const MAX_DELAY_MS = 44 * 60 * 60 * 1000; // 44 hours (10,000 periods)

  // Calculate timestamp whenever inputs change
  useEffect(() => {
    const now = Date.now();
    const delayMs = delayAmount * (delayUnit === 'hours' ? 3600000 : 86400000);
    let timestamp = now + delayMs;

    // Enforce constraints
    if (delayMs < MIN_DELAY_MS) {
      timestamp = now + MIN_DELAY_MS;
    } else if (delayMs > MAX_DELAY_MS) {
      timestamp = now + MAX_DELAY_MS;
    }

    setCalculatedTimestamp(timestamp);
    onTimeSelect(timestamp);
  }, [delayAmount, delayUnit, onTimeSelect, MIN_DELAY_MS, MAX_DELAY_MS]);

  const formatTimestamp = (timestamp: number): string => {
    if (timestamp === 0) return 'Invalid date/time';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="distribution-time-picker">
      <div className="delay-picker">
        <div className="delay-input-group">
          <label>Distribute rewards after:</label>
          <div className="delay-controls">
            <input
              type="number"
              min="1"
              max="44"
              value={delayAmount}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                // Enforce max based on unit
                if (delayUnit === 'hours') {
                  setDelayAmount(Math.min(val, 44));
                } else {
                  setDelayAmount(Math.min(val, 1));
                }
              }}
              className="delay-amount-input"
            />
            <select
              value={delayUnit}
              onChange={(e) => {
                const newUnit = e.target.value as 'hours' | 'days';
                setDelayUnit(newUnit);
                // Adjust amount if it exceeds new unit's max
                if (newUnit === 'days' && delayAmount > 1) {
                  setDelayAmount(1);
                } else if (newUnit === 'hours' && delayAmount > 44) {
                  setDelayAmount(44);
                }
              }}
              className="delay-unit-select"
            >
              <option value="hours">Hours (max 44)</option>
              <option value="days">Days (max 1)</option>
            </select>
          </div>
        </div>
        <div className="delay-info">
          Distribution will occur approximately {delayAmount} {delayUnit} after poll closes (min: 32 seconds, max: 44 hours)
        </div>
      </div>

      <div className="calculated-time">
        <div className="calculated-label">Scheduled for:</div>
        <div className="calculated-value">{formatTimestamp(calculatedTimestamp)}</div>
        {calculatedTimestamp > 0 && (
          <div className="timestamp-ms">
            Timestamp: {Math.floor(calculatedTimestamp / 1000)}s
          </div>
        )}
      </div>

      <div className="distribution-note">
        <strong>Note:</strong> Distribution must be at least 32 seconds in the future.
        Execution will occur automatically at the scheduled time via Massa's deferred calls.
        Actual distribution may occur within 16-32 seconds of the scheduled time due to blockchain period boundaries (16s per period).
      </div>
    </div>
  );
};

export default DistributionTimePicker;
