import { useState, useEffect } from "react";
import { pollsContract, ContractPoll } from "./utils/contractInteraction";
import { useToast } from "./components/ToastContainer";
import { formatTimeRemaining, getTimeUrgencyClass } from "./utils/timeFormat";
import PollIcon from '@mui/icons-material/Poll';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface ParticipantDashboardProps {
  onBack: () => void;
  onViewPoll?: (pollId: number) => void;
}

interface VotedPoll extends ContractPoll {
  votedOption?: number;
  canClaimReward: boolean;
  hasClaimedReward: boolean;
  estimatedReward: number;
}

const ParticipantDashboard = ({ onBack, onViewPoll }: ParticipantDashboardProps) => {
  const toast = useToast();
  const [polls, setPolls] = useState<VotedPoll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimingPollId, setClaimingPollId] = useState<string | null>(null);

  useEffect(() => {
    loadParticipantData();
  }, []);

  const loadParticipantData = async () => {
    setIsLoading(true);
    try {
      // Get wallet address
      const address = await pollsContract.getWalletAddress();
      setWalletAddress(address);

      if (!address) {
        toast.error("Please connect your wallet to view your participation");
        setIsLoading(false);
        return;
      }

      // Get all polls
      const allPolls = await pollsContract.getAllPolls();

      // Filter and enhance polls the user has voted on
      const votedPollsData: VotedPoll[] = [];

      for (const poll of allPolls) {
        try {
          const hasVoted = await pollsContract.hasVoted(poll.id, address);

          if (hasVoted) {
            // Check if user has claimed reward
            let hasClaimedReward = false;
            try {
              hasClaimedReward = await pollsContract.hasClaimed(poll.id, address);
            } catch (err) {
              console.log(`Could not check claim status for poll ${poll.id}`);
            }

            // Calculate estimated reward
            const poolInMassa = (poll.rewardPool || 0) / 1e9;
            const totalVotes = poll.votes?.reduce((sum, v) => sum + v, 0) || 0;
            let estimatedReward = 0;

            if (poll.distributionMode === 0) {
              // Equal split
              estimatedReward = totalVotes > 0 ? poolInMassa / totalVotes : 0;
            } else if (poll.distributionMode === 1) {
              // Fixed reward
              estimatedReward = (poll.fixedRewardAmount || 0) / 1e9;
            }

            // Can claim if: poll ended, not active, has MANUAL_PULL distribution, has reward pool, hasn't claimed
            const canClaimReward =
              poll.status !== 'active' &&
              poll.distributionType === 0 &&
              poolInMassa > 0 &&
              !hasClaimedReward &&
              !poll.rewardsDistributed;

            votedPollsData.push({
              ...poll,
              canClaimReward,
              hasClaimedReward,
              estimatedReward
            });
          }
        } catch (err) {
          console.error(`Error checking vote status for poll ${poll.id}:`, err);
        }
      }

      setPolls(votedPollsData);
    } catch (err) {
      console.error("Error loading participant data:", err);
      toast.error("Failed to load your participation data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimReward = async (pollId: string) => {
    setIsClaiming(true);
    setClaimingPollId(pollId);
    try {
      await pollsContract.claimReward(pollId);
      toast.success("Reward claimed successfully!");
      loadParticipantData(); // Reload to update claim status
    } catch (err) {
      console.error("Error claiming reward:", err);
      toast.error("Failed to claim reward: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsClaiming(false);
      setClaimingPollId(null);
    }
  };

  const handleClaimAll = async () => {
    const claimablePolls = polls.filter(p => p.canClaimReward);

    if (claimablePolls.length === 0) {
      toast.error("No rewards available to claim");
      return;
    }

    setIsClaiming(true);
    let successCount = 0;
    let failCount = 0;

    for (const poll of claimablePolls) {
      try {
        await pollsContract.claimReward(poll.id);
        successCount++;
      } catch (err) {
        console.error(`Failed to claim reward for poll ${poll.id}:`, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully claimed ${successCount} reward(s)!`);
      loadParticipantData();
    }

    if (failCount > 0) {
      toast.error(`Failed to claim ${failCount} reward(s)`);
    }

    setIsClaiming(false);
  };

  const getDistributionModeBadge = (mode: number) => {
    switch (mode) {
      case 0: return "Equal Split";
      case 1: return "Fixed Reward";
      case 2: return "Weighted";
      default: return "Unknown";
    }
  };

  const getDistributionTypeBadge = (type: number) => {
    switch (type) {
      case 0: return "Manual Pull";
      case 1: return "Manual Push";
      case 2: return "Autonomous";
      default: return "Unknown";
    }
  };

  // Calculate dashboard stats
  const totalVoted = polls.length;
  const activeVoted = polls.filter(p => p.status === 'active').length;
  const claimableRewards = polls.filter(p => p.canClaimReward).length;
  const totalClaimableAmount = polls
    .filter(p => p.canClaimReward)
    .reduce((sum, p) => sum + p.estimatedReward, 0);
  const totalClaimedRewards = polls.filter(p => p.hasClaimedReward).length;

  if (isLoading) {
    return (
      <div className="participant-dashboard">
        <div className="participant-dashboard-container">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <div className="loading-state">
            <RefreshIcon sx={{ fontSize: 32 }} />
            <p>Loading your participation data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="participant-dashboard">
        <div className="participant-dashboard-container">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <div className="empty-state">
            <AccountBalanceWalletIcon sx={{ fontSize: 48 }} />
            <h2>Wallet Not Connected</h2>
            <p>Please connect your wallet to view your participation dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="participant-dashboard">
      <div className="participant-dashboard-container">
        <button className="back-btn" onClick={onBack}>
          ← Back to Polls
        </button>

        <div className="participant-dashboard-header">
          <h1>Participant Dashboard</h1>
          <p>Track your votes and claim rewards</p>
        </div>

        {/* Overview Cards */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon blue">
              <HowToVoteIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{totalVoted}</span>
              <span className="stat-label">Polls Voted</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <CheckCircleIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{activeVoted}</span>
              <span className="stat-label">Active Polls</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">
              <CardGiftcardIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{claimableRewards}</span>
              <span className="stat-label">Rewards Available</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">
              <AttachMoneyIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{totalClaimableAmount.toFixed(2)}</span>
              <span className="stat-label">Total Claimable (MASSA)</span>
            </div>
          </div>
        </div>

        {/* Claim All Button */}
        {claimableRewards > 0 && (
          <div className="claim-all-panel">
            <div className="claim-all-info">
              <CardGiftcardIcon sx={{ fontSize: 24, marginRight: 1 }} />
              <div>
                <h3>You have {claimableRewards} reward{claimableRewards > 1 ? 's' : ''} available to claim</h3>
                <p>Total: <strong>{totalClaimableAmount.toFixed(4)} MASSA</strong></p>
              </div>
            </div>
            <button
              onClick={handleClaimAll}
              disabled={isClaiming}
              className="claim-all-btn"
            >
              {isClaiming ? 'Claiming...' : `Claim All Rewards`}
            </button>
          </div>
        )}

        {/* Voted Polls Table */}
        {totalVoted === 0 ? (
          <div className="empty-state">
            <PollIcon sx={{ fontSize: 48 }} />
            <h2>No Participation Yet</h2>
            <p>You haven't voted on any polls yet. Start participating to earn rewards!</p>
          </div>
        ) : (
          <>
            <div className="section-header">
              <h2>
                <HistoryIcon sx={{ fontSize: 24, marginRight: 1, verticalAlign: 'middle' }} />
                Your Voting History
              </h2>
              <button onClick={loadParticipantData} className="refresh-btn">
                <RefreshIcon sx={{ fontSize: 18 }} /> Refresh
              </button>
            </div>

            <div className="participant-polls-table">
              <table>
                <thead>
                  <tr>
                    <th>Poll</th>
                    <th>Status</th>
                    <th>Distribution</th>
                    <th>Estimated Reward</th>
                    <th>Reward Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {polls.map((poll) => {
                    const poolInMassa = (poll.rewardPool || 0) / 1e9;

                    return (
                      <tr key={poll.id} className={poll.canClaimReward ? 'claimable' : ''}>
                        <td>
                          <div className="poll-title-cell">
                            <strong>{poll.title}</strong>
                            <small>#{poll.id}</small>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${poll.status === 'active' ? 'active' : 'ended'}`}>
                            {poll.status === 'active' ? 'Active' : 'Ended'}
                          </span>
                        </td>
                        <td>
                          <div className="distribution-info-cell">
                            <small>{getDistributionModeBadge(poll.distributionMode || 0)}</small>
                            <small className="muted">{getDistributionTypeBadge(poll.distributionType || 0)}</small>
                          </div>
                        </td>
                        <td>
                          <strong>{poll.estimatedReward > 0 ? `${poll.estimatedReward.toFixed(4)} MASSA` : 'N/A'}</strong>
                        </td>
                        <td>
                          {poll.hasClaimedReward ? (
                            <span className="reward-status claimed">
                              <CheckCircleIcon sx={{ fontSize: 16, marginRight: 0.5 }} />
                              Claimed
                            </span>
                          ) : poll.canClaimReward ? (
                            <span className="reward-status claimable">
                              <CardGiftcardIcon sx={{ fontSize: 16, marginRight: 0.5 }} />
                              Ready to Claim
                            </span>
                          ) : poll.rewardsDistributed ? (
                            <span className="reward-status distributed">
                              <TrendingUpIcon sx={{ fontSize: 16, marginRight: 0.5 }} />
                              Distributed
                            </span>
                          ) : poll.status === 'active' ? (
                            <span className="reward-status pending">
                              <HistoryIcon sx={{ fontSize: 16, marginRight: 0.5 }} />
                              Poll Active
                            </span>
                          ) : poolInMassa === 0 ? (
                            <span className="reward-status none">No Reward</span>
                          ) : (
                            <span className="reward-status pending">
                              <HistoryIcon sx={{ fontSize: 16, marginRight: 0.5 }} />
                              Pending
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            {poll.canClaimReward && (
                              <button
                                className="action-btn claim"
                                onClick={() => handleClaimReward(poll.id)}
                                disabled={isClaiming && claimingPollId === poll.id}
                              >
                                {isClaiming && claimingPollId === poll.id ? (
                                  <>
                                    <RefreshIcon sx={{ fontSize: 16 }} />
                                  </>
                                ) : (
                                  <>
                                    <AttachMoneyIcon sx={{ fontSize: 16 }} /> Claim
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              className="action-btn view"
                              onClick={() => onViewPoll && onViewPoll(parseInt(poll.id))}
                              title="View Poll Details"
                            >
                              <VisibilityIcon sx={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Section */}
            <div className="participation-summary">
              <h3>Participation Summary</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Total Polls Voted:</span>
                  <span className="summary-value">{totalVoted}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Rewards Claimed:</span>
                  <span className="summary-value">{totalClaimedRewards}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Pending Claims:</span>
                  <span className="summary-value">{claimableRewards}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Claimable:</span>
                  <span className="summary-value highlight">{totalClaimableAmount.toFixed(4)} MASSA</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ParticipantDashboard;
