import { useState, useEffect } from "react";
import { pollsContract, ContractPoll } from "./utils/contractInteraction";
import { useToast } from "./components/ToastContainer";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PollIcon from '@mui/icons-material/Poll';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BlockIcon from '@mui/icons-material/Block';

interface CreatorDashboardProps {
  onBack: () => void;
  onViewPoll?: (pollId: number) => void;
}

const CreatorDashboard = ({ onBack, onViewPoll }: CreatorDashboardProps) => {
  const toast = useToast();
  const [polls, setPolls] = useState<ContractPoll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'ended'>('all');
  const [filterFundingType, setFilterFundingType] = useState<'all' | 0 | 1 | 2>('all');
  const [selectedPolls, setSelectedPolls] = useState<Set<string>>(new Set());
  const [fundAmount, setFundAmount] = useState<number>(0);
  const [isFunding, setIsFunding] = useState(false);
  const [showClaimingModal, setShowClaimingModal] = useState(false);
  const [selectedPollForClaiming, setSelectedPollForClaiming] = useState<ContractPoll | null>(null);
  const [claimingData, setClaimingData] = useState<any[]>([]);

  useEffect(() => {
    loadCreatorPolls();
  }, []);

  const loadCreatorPolls = async () => {
    setIsLoading(true);
    try {
      // Get wallet address
      const address = await pollsContract.getWalletAddress();
      setWalletAddress(address);

      if (!address) {
        toast.error("Please connect your wallet to view your polls");
        setIsLoading(false);
        return;
      }

      // Get all polls and filter by creator
      const allPolls = await pollsContract.getAllPolls();
      const creatorPolls = allPolls.filter(poll => poll.creator === address);
      setPolls(creatorPolls);
    } catch (err) {
      console.error("Error loading creator polls:", err);
      toast.error("Failed to load your polls");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPolls = polls.filter(poll => {
    const statusMatch = filterStatus === 'all' ||
      (filterStatus === 'active' && poll.status === 'active') ||
      (filterStatus === 'ended' && poll.status !== 'active');

    const fundingMatch = filterFundingType === 'all' || poll.fundingType === filterFundingType;

    return statusMatch && fundingMatch;
  });

  const togglePollSelection = (pollId: string) => {
    const newSelected = new Set(selectedPolls);
    if (newSelected.has(pollId)) {
      newSelected.delete(pollId);
    } else {
      newSelected.add(pollId);
    }
    setSelectedPolls(newSelected);
  };

  const handleBatchFund = async () => {
    if (selectedPolls.size === 0) {
      toast.error("Please select at least one poll to fund");
      return;
    }

    if (fundAmount <= 0) {
      toast.error("Please enter a valid funding amount");
      return;
    }

    setIsFunding(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const pollId of selectedPolls) {
        try {
          await pollsContract.fundPoll(pollId, fundAmount);
          successCount++;
        } catch (err) {
          console.error(`Failed to fund poll ${pollId}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully funded ${successCount} poll(s) with ${fundAmount} MASSA each`);
        setSelectedPolls(new Set());
        setFundAmount(0);
        loadCreatorPolls();
      }

      if (failCount > 0) {
        toast.error(`Failed to fund ${failCount} poll(s)`);
      }
    } catch (err) {
      console.error("Error in batch funding:", err);
      toast.error("Failed to fund polls");
    } finally {
      setIsFunding(false);
    }
  };

  const handleQuickFund = (amount: number) => {
    setFundAmount(amount);
  };

  const handleSetForClaiming = async (pollId: string) => {
    try {
      await pollsContract.setForClaiming(pollId);
      toast.success(`Poll #${pollId} is now ready for claiming rewards!`);

      // Wait for blockchain confirmation before refreshing
      setTimeout(() => {
        toast.info('Status updated! Refreshing polls list...', 2000);

        // Wait a bit more before refresh to ensure status change is reflected
        setTimeout(async () => {
          await loadCreatorPolls();
        }, 2000); // Additional 2 seconds
      }, 3000); // Initial 3 second wait for transaction confirmation
    } catch (err) {
      console.error("Error setting poll to FOR_CLAIMING:", err);
      toast.error(`Failed to set poll to FOR_CLAIMING: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleClosePoll = async (pollId: string) => {
    if (!confirm("Are you sure you want to close this poll? This will stop accepting votes.")) {
      return;
    }

    try {
      await pollsContract.closePoll(pollId);
      toast.success(`Poll #${pollId} has been closed successfully!`);

      // Wait for blockchain confirmation before refreshing
      setTimeout(() => {
        toast.info('Poll closed! Refreshing polls list...', 2000);

        // Wait a bit more before refresh to ensure status change is reflected
        setTimeout(async () => {
          await loadCreatorPolls();
        }, 2000); // Additional 2 seconds
      }, 3000); // Initial 3 second wait for transaction confirmation
    } catch (err) {
      console.error("Error closing poll:", err);
      toast.error(`Failed to close poll: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleViewClaimingStatus = async (poll: ContractPoll) => {
    setSelectedPollForClaiming(poll);
    setShowClaimingModal(true);

    // Load claiming data from events
    try {
      const votersData = await pollsContract.getPollVotersAndClaims(poll.id);
      setClaimingData(votersData.voters);

      if (votersData.voters.length > 0) {
        toast.success(`Loaded ${votersData.voters.length} voters, ${votersData.totalClaimed} claimed`);
      } else {
        toast.info("No voters found for this poll yet");
      }
    } catch (err) {
      console.error("Error loading claiming status:", err);
      toast.error("Failed to load claiming status");
      setClaimingData([]);
    }
  };

  const calculateRespondentCapacity = (pool: number, fixedReward: number): number => {
    if (fixedReward <= 0) return 0;
    return Math.floor(pool / fixedReward);
  };

  const getFundingTypeBadge = (type: number) => {
    switch (type) {
      case 0: return <span className="funding-badge self">Self-Funded</span>;
      case 1: return <span className="funding-badge community">Community</span>;
      case 2: return <span className="funding-badge treasury">Treasury</span>;
      default: return <span className="funding-badge">Unknown</span>;
    }
  };

  const getDistributionModeBadge = (mode: number) => {
    switch (mode) {
      case 0: return "Equal Split";
      case 1: return "Fixed Reward";
      case 2: return "Weighted";
      default: return "Unknown";
    }
  };

  // Calculate dashboard stats
  const totalPolls = polls.length;
  const activePolls = polls.filter(p => p.status === 'active').length;
  const totalFunding = polls.reduce((sum, poll) => sum + (poll.rewardPool || 0), 0) / 1e9;
  const poolsNeedingFunds = polls.filter(p => {
    const poolInMassa = (p.rewardPool || 0) / 1e9;
    const capacity = calculateRespondentCapacity(poolInMassa, (p.fixedRewardAmount || 0) / 1e9);
    return p.status === 'active' && capacity < 5;
  }).length;

  if (isLoading) {
    return (
      <div className="creator-dashboard">
        <div className="creator-dashboard-container">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <div className="loading-state">
            <RefreshIcon sx={{ fontSize: 32 }} />
            <p>Loading your polls...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="creator-dashboard">
        <div className="creator-dashboard-container">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <div className="empty-state">
            <AccountBalanceWalletIcon sx={{ fontSize: 48 }} />
            <h2>Wallet Not Connected</h2>
            <p>Please connect your wallet to view your creator dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="creator-dashboard">
      <div className="creator-dashboard-container">
        <button className="back-btn" onClick={onBack}>
          ← Back to Polls
        </button>

        <div className="creator-dashboard-header">
          <h1>Creator Dashboard</h1>
          <p>Fund and manage your polls</p>
        </div>

        {/* Overview Cards */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon blue">
              <PollIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{totalPolls}</span>
              <span className="stat-label">Total Polls</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <CheckCircleIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{activePolls}</span>
              <span className="stat-label">Active Polls</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">
              <AttachMoneyIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{totalFunding.toFixed(2)}</span>
              <span className="stat-label">Total Funding (MASSA)</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">
              <WarningIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{poolsNeedingFunds}</span>
              <span className="stat-label">Pools Need Funds</span>
            </div>
          </div>
        </div>

        {/* Quick Funding Panel */}
        {selectedPolls.size > 0 && (
          <div className="quick-funding-panel">
            <h3>
              <AttachMoneyIcon sx={{ fontSize: 20, marginRight: 1 }} />
              Quick Fund {selectedPolls.size} Selected Poll{selectedPolls.size > 1 ? 's' : ''}
            </h3>
            <div className="quick-fund-presets">
              <button onClick={() => handleQuickFund(10)} className="preset-btn">10 MASSA</button>
              <button onClick={() => handleQuickFund(50)} className="preset-btn">50 MASSA</button>
              <button onClick={() => handleQuickFund(100)} className="preset-btn">100 MASSA</button>
              <button onClick={() => handleQuickFund(500)} className="preset-btn">500 MASSA</button>
            </div>
            <div className="quick-fund-custom">
              <input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(parseFloat(e.target.value) || 0)}
                placeholder="Custom amount"
                min="0"
                step="0.1"
              />
              <button
                onClick={handleBatchFund}
                disabled={isFunding || fundAmount <= 0}
                className="fund-btn"
              >
                {isFunding ? 'Funding...' : `Fund ${selectedPolls.size} Poll${selectedPolls.size > 1 ? 's' : ''}`}
              </button>
            </div>
            <p className="funding-total">
              Total: <strong>{(fundAmount * selectedPolls.size).toFixed(2)} MASSA</strong>
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="dashboard-filters">
          <div className="filter-group">
            <label>Status:</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Funding Type:</label>
            <select value={filterFundingType} onChange={(e) => {
              const val = e.target.value;
              setFilterFundingType(val === 'all' ? 'all' : parseInt(val) as 0 | 1 | 2);
            }}>
              <option value="all">All</option>
              <option value="0">Self-Funded</option>
              <option value="1">Community</option>
              <option value="2">Treasury</option>
            </select>
          </div>
          <button onClick={loadCreatorPolls} className="refresh-btn">
            <RefreshIcon sx={{ fontSize: 18 }} /> Refresh
          </button>
        </div>

        {/* Polls Table */}
        {filteredPolls.length === 0 ? (
          <div className="empty-state">
            <PollIcon sx={{ fontSize: 48 }} />
            <h2>No Polls Found</h2>
            <p>You haven't created any polls yet or no polls match your filters</p>
          </div>
        ) : (
          <div className="creator-polls-table">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPolls(new Set(filteredPolls.map(p => p.id)));
                        } else {
                          setSelectedPolls(new Set());
                        }
                      }}
                      checked={selectedPolls.size === filteredPolls.length && filteredPolls.length > 0}
                    />
                  </th>
                  <th>Poll</th>
                  <th>Status</th>
                  <th>Funding Type</th>
                  <th>Pool Balance</th>
                  <th>Distribution</th>
                  <th>Capacity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolls.map((poll) => {
                  const poolInMassa = (poll.rewardPool || 0) / 1e9;
                  const fixedRewardInMassa = (poll.fixedRewardAmount || 0) / 1e9;
                  const capacity = calculateRespondentCapacity(poolInMassa, fixedRewardInMassa);
                  const needsFunding = poll.status === 'active' && capacity < 5;

                  return (
                    <tr key={poll.id} className={needsFunding ? 'needs-funding' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedPolls.has(poll.id)}
                          onChange={() => togglePollSelection(poll.id)}
                        />
                      </td>
                      <td>
                        <div className="poll-title-cell">
                          <strong>{poll.title}</strong>
                          <small>#{poll.id}</small>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${poll.status}`}>
                          {poll.status === 'active' && 'Active'}
                          {poll.status === 'closed' && 'Closed'}
                          {poll.status === 'ended' && 'Ended'}
                          {poll.status === 'for_claiming' && 'For Claiming'}
                        </span>
                      </td>
                      <td>{getFundingTypeBadge(poll.fundingType || 0)}</td>
                      <td>
                        <strong>{poolInMassa.toFixed(4)}</strong> MASSA
                      </td>
                      <td>{getDistributionModeBadge(poll.distributionMode || 0)}</td>
                      <td>
                        <div className={`capacity-cell ${needsFunding ? 'low' : ''}`}>
                          {capacity > 0 ? `~${capacity}` : 'N/A'}
                          {needsFunding && <WarningIcon sx={{ fontSize: 16, marginLeft: 0.5 }} />}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            className="action-btn view"
                            onClick={() => onViewPoll && onViewPoll(parseInt(poll.id))}
                            title="View Poll Details"
                          >
                            <VisibilityIcon sx={{ fontSize: 18 }} />
                          </button>
                          {poll.status === 'active' && (
                            <button
                              className="action-btn close-poll"
                              onClick={() => handleClosePoll(poll.id)}
                              title="Close Poll (Stop Voting)"
                            >
                              <BlockIcon sx={{ fontSize: 18 }} />
                            </button>
                          )}
                          {(poll.status === 'closed' || poll.status === 'ended') && (
                            <button
                              className="action-btn claiming"
                              onClick={() => handleSetForClaiming(poll.id)}
                              title="Enable Reward Claiming"
                            >
                              🎁
                            </button>
                          )}
                          <button
                            className="action-btn claims-status"
                            onClick={() => handleViewClaimingStatus(poll)}
                            title="View Claiming Status"
                          >
                            <AssignmentIcon sx={{ fontSize: 18 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Claiming Status Modal */}
      {showClaimingModal && selectedPollForClaiming && (
        <div className="modal-overlay" onClick={() => setShowClaimingModal(false)}>
          <div className="modal-content claiming-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <AssignmentIcon sx={{ fontSize: 28, marginRight: 1, verticalAlign: 'middle' }} />
                Claiming Status: {selectedPollForClaiming.title}
              </h2>
              <button className="modal-close" onClick={() => setShowClaimingModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="claiming-stats">
                <div className="stat-box">
                  <span className="stat-label">Poll ID</span>
                  <span className="stat-value">#{selectedPollForClaiming.id}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Status</span>
                  <span className={`status-badge ${selectedPollForClaiming.status}`}>
                    {selectedPollForClaiming.status === 'active' && 'Active'}
                    {selectedPollForClaiming.status === 'closed' && 'Closed'}
                    {selectedPollForClaiming.status === 'ended' && 'Ended'}
                    {selectedPollForClaiming.status === 'for_claiming' && 'For Claiming'}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Reward Pool</span>
                  <span className="stat-value">{((selectedPollForClaiming.rewardPool || 0) / 1e9).toFixed(4)} MASSA</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Total Votes</span>
                  <span className="stat-value">
                    {selectedPollForClaiming.votes.reduce((sum, v) => sum + v, 0)}
                  </span>
                </div>
              </div>

              {claimingData.length > 0 ? (
                <div className="voters-list">
                  <h3>Voters & Claiming Status</h3>
                  <table className="voters-table">
                    <thead>
                      <tr>
                        <th>Voter Address</th>
                        <th>Option Voted</th>
                        <th>Claim Status</th>
                        <th>Claimed Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claimingData.map((voter, idx) => (
                        <tr key={idx}>
                          <td>
                            <code className="address-code">
                              {voter.address.substring(0, 10)}...{voter.address.substring(voter.address.length - 8)}
                            </code>
                          </td>
                          <td>{selectedPollForClaiming.options[voter.option] || `Option ${voter.option}`}</td>
                          <td>
                            {voter.hasClaimed ? (
                              <span className="claim-status claimed">✓ Claimed</span>
                            ) : (
                              <span className="claim-status pending">⏳ Pending</span>
                            )}
                          </td>
                          <td>
                            {voter.hasClaimed && voter.claimAmount
                              ? `${(voter.claimAmount / 1e9).toFixed(4)} MASSA`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="claiming-info-message">
                  <p>
                    <strong>No voters yet.</strong> Once users vote on this poll, their information will appear here.
                  </p>
                  <p>
                    Voter data is retrieved from blockchain events, showing who voted and who has claimed rewards.
                  </p>
                </div>
              )}

              <div className="votes-breakdown">
                <h3>Votes by Option</h3>
                <table className="votes-table">
                  <thead>
                    <tr>
                      <th>Option</th>
                      <th>Votes</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPollForClaiming.options.map((option, idx) => {
                      const totalVotes = selectedPollForClaiming.votes.reduce((sum, v) => sum + v, 0);
                      const percentage = totalVotes > 0 ? (selectedPollForClaiming.votes[idx] / totalVotes * 100).toFixed(1) : '0';
                      return (
                        <tr key={idx}>
                          <td>{option}</td>
                          <td>{selectedPollForClaiming.votes[idx]}</td>
                          <td>{percentage}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowClaimingModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorDashboard;
