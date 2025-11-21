import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { pollsContract, ContractPoll } from './utils/contractInteraction';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PieChartIcon from '@mui/icons-material/PieChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import './PollResults.css';

interface PollResultsProps {
  pollId: string;
  onBack: () => void;
}

type ChartType = 'pie' | 'bar';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

const PollResults: React.FC<PollResultsProps> = ({ pollId, onBack }) => {
  const [poll, setPoll] = useState<ContractPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('pie');

  useEffect(() => {
    const fetchPoll = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`📊 Fetching poll ${pollId} for results...`);
        const polls = await pollsContract.getAllPolls();
        console.log(`📊 All polls retrieved:`, polls);
        const foundPoll = polls.find(p => p.id === pollId);

        if (!foundPoll) {
          setError(`Poll with ID ${pollId} not found`);
          return;
        }

        console.log(`📊 Poll loaded:`, foundPoll);
        console.log(`📊 Poll votes:`, foundPoll.votes);
        console.log(`📊 Poll options:`, foundPoll.options);
        setPoll(foundPoll);
      } catch (err) {
        console.error('Error fetching poll:', err);
        setError('Failed to load poll results');
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, [pollId]);

  if (loading) {
    return (
      <div className="poll-results-container">
        <div className="results-header">
          <button className="back-button" onClick={onBack}>
            <ArrowBackIcon /> Back
          </button>
        </div>
        <div className="loading-state">Loading poll results...</div>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="poll-results-container">
        <div className="results-header">
          <button className="back-button" onClick={onBack}>
            <ArrowBackIcon /> Back
          </button>
        </div>
        <div className="error-state">{error || 'Poll not found'}</div>
      </div>
    );
  }

  const totalVotes = poll.votes.reduce((sum, votes) => sum + votes, 0);

  // Prepare data for charts
  const chartData = poll.options.map((option, index) => ({
    name: option,
    votes: poll.votes[index],
    percentage: totalVotes > 0 ? ((poll.votes[index] / totalVotes) * 100).toFixed(1) : '0'
  }));

  // Custom label for pie chart
  const renderCustomLabel = (entry: any) => {
    const percent = entry.percentage;
    return percent > 0 ? `${percent}%` : '';
  };

  return (
    <div className="poll-results-container">
      <div className="results-header">
        <button className="back-button" onClick={onBack}>
          <ArrowBackIcon /> Back to Polls
        </button>
        <div className="chart-type-selector">
          <button
            className={`chart-type-btn ${chartType === 'pie' ? 'active' : ''}`}
            onClick={() => setChartType('pie')}
          >
            <PieChartIcon /> Pie Chart
          </button>
          <button
            className={`chart-type-btn ${chartType === 'bar' ? 'active' : ''}`}
            onClick={() => setChartType('bar')}
          >
            <BarChartIcon /> Bar Chart
          </button>
        </div>
      </div>

      <div className="results-content">
        <div className="poll-info">
          <h1>{poll.title}</h1>
          <p className="poll-description">{poll.description}</p>
          <div className="poll-meta">
            <span className={`status-badge ${poll.status}`}>
              {poll.status === 'active' ? '🟢 Active' : poll.status === 'closed' ? '🔴 Closed' : '⚫ Ended'}
            </span>
            <span className="total-votes">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
          </div>
        </div>

        <div className="chart-container">
          {totalVotes === 0 ? (
            <div className="no-votes-state">
              <p>No votes yet for this poll</p>
            </div>
          ) : (
            <>
              {chartType === 'pie' ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomLabel}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="votes"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => [
                        `${value} votes (${props.payload.percentage}%)`,
                        props.payload.name
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => [
                        `${value} votes (${props.payload.percentage}%)`,
                        'Votes'
                      ]}
                    />
                    <Bar dataKey="votes" fill="#8884d8">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </div>

        <div className="results-table">
          <h3>Detailed Results</h3>
          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th>Votes</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((data, index) => (
                <tr key={index}>
                  <td>
                    <span
                      className="color-indicator"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {data.name}
                  </td>
                  <td>{data.votes}</td>
                  <td>{data.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PollResults;
