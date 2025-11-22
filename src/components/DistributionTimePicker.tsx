import React, { useState, useEffect } from 'react';
import './DistributionTimePicker.css';

interface DistributionTimePickerProps {
  onTimeSelect: (timestamp: number) => void;
  minDate?: Date;
}

type TimingMode = 'delay' | 'datetime';

const DistributionTimePicker: React.FC<DistributionTimePickerProps> = ({
  onTimeSelect,
  minDate = new Date()
}) => {
  const [mode, setMode] = useState<TimingMode>('delay');
  const [delayAmount, setDelayAmount] = useState<number>(24);
  const [delayUnit, setDelayUnit] = useState<'hours' | 'days'>('hours');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('12:00');
  const [calculatedTimestamp, setCalculatedTimestamp] = useState<number>(0);

  // Calculate timestamp whenever inputs change
  useEffect(() => {
    const now = Date.now();
    let timestamp: number;

    if (mode === 'delay') {
      const delayMs = delayAmount * (delayUnit === 'hours' ? 3600000 : 86400000);
      timestamp = now + delayMs;
    } else {
      // Combine date and time
      if (selectedDate && selectedTime) {
        const dateTimeStr = `${selectedDate}T${selectedTime}`;
        timestamp = new Date(dateTimeStr).getTime();
      } else {
        timestamp = 0;
      }
    }

    setCalculatedTimestamp(timestamp);
    onTimeSelect(timestamp);
  }, [mode, delayAmount, delayUnit, selectedDate, selectedTime, onTimeSelect]);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    setSelectedDate(dateStr);
  }, []);

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

  const getMinDateTime = (): string => {
    const min = minDate || new Date();
    return min.toISOString().slice(0, 16);
  };

  return (
    <div className="distribution-time-picker">
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'delay' ? 'active' : ''}`}
          onClick={() => setMode('delay')}
        >
          Delay
        </button>
        <button
          className={`mode-btn ${mode === 'datetime' ? 'active' : ''}`}
          onClick={() => setMode('datetime')}
        >
          Specific Time
        </button>
      </div>

      {mode === 'delay' ? (
        <div className="delay-picker">
          <div className="delay-input-group">
            <label>Distribute rewards after:</label>
            <div className="delay-controls">
              <input
                type="number"
                min="1"
                max="365"
                value={delayAmount}
                onChange={(e) => setDelayAmount(parseInt(e.target.value) || 1)}
                className="delay-amount-input"
              />
              <select
                value={delayUnit}
                onChange={(e) => setDelayUnit(e.target.value as 'hours' | 'days')}
                className="delay-unit-select"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
          <div className="delay-info">
            Distribution will occur approximately {delayAmount} {delayUnit} after poll closes
          </div>
        </div>
      ) : (
        <div className="datetime-picker">
          <div className="datetime-input-group">
            <label>Distribution Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={minDate.toISOString().split('T')[0]}
              className="date-input"
            />
          </div>
          <div className="datetime-input-group">
            <label>Distribution Time:</label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="time-input"
            />
          </div>
        </div>
      )}

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
        <strong>Note:</strong> Distribution will occur during the next autonomous smart contract
        execution after the scheduled time. Actual distribution may be delayed by up to 1 hour.
      </div>
    </div>
  );
};

export default DistributionTimePicker;
