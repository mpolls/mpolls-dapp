import { useState, useEffect } from "react";
import CreatePoll from "./CreatePoll";
import AdminPage from "./AdminPage";
import Navigation from "./components/Navigation";
import { pollsContract, ContractPoll } from "./utils/contractInteraction";
import { parseBlockchainError, logError } from "./utils/errorHandling";
import { useToast } from "./components/ToastContainer";
import { formatTimeRemaining, getTimeUrgencyClass } from "./utils/timeFormat";
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';
import PlaceIcon from '@mui/icons-material/Place';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PeopleIcon from '@mui/icons-material/People';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ErrorIcon from '@mui/icons-material/Error';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

// Convert ContractPoll to display format
interface Poll extends Omit<ContractPoll, 'id' | 'votes'> {
  id: number;
  votes: number[];
  totalVotes: number;
  timeLeft: string;
  rewards: string;
  // Include new economics fields from ContractPoll
  rewardPool: number;
  fundingType: number;
  distributionMode: number;
  distributionType: number;
  fixedRewardAmount: number;
  fundingGoal: number;
  treasuryApproved: boolean;
  rewardsDistributed: boolean;
}

type PageType = 'home' | 'polls' | 'create' | 'admin' | 'projects' | 'token' | 'swap' | 'creator' | 'participant' | 'results';

interface PollsAppProps {
  initialView?: PageType;
  onNavigate?: (page: PageType, pollId?: string) => void;
}

const PollsApp: React.FC<PollsAppProps> = ({ initialView = 'polls', onNavigate }) => {
  const toast = useToast();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(true);
  const [pollsError, setPollsError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<PageType>(initialView);

  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [votedPolls, setVotedPolls] = useState<Set<number>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);

  // Wallet connection state
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Voting feedback state
  const [votingStatus, setVotingStatus] = useState<{
    pollId: number | null;
    isVoting: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | null;
  }>({ pollId: null, isVoting: false, message: '', type: null });

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // View mode state (beta table view or classic card view)
  const [viewMode, setViewMode] = useState<'beta' | 'classic'>('beta');

  // Live countdown update
  const [, setTimeUpdateTrigger] = useState(0);

  const CONTRACT_CREATOR_ADDRESS = "AU1Pd3bod1Js2xD71GLFd1Q1dA8tnugsHroL54Rn7SzYY5KiozfS";

  const handleNavigation = (page: PageType, pollId?: string) => {
    setCurrentView(page);
    if (onNavigate) {
      onNavigate(page, pollId);
    }
  };

  useEffect(() => {
    checkWalletConnection();
    fetchPolls();
  }, []);

  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  // Auto-refresh polls every 30 seconds when enabled and on polls view
  useEffect(() => {
    if (!autoRefreshEnabled || currentView !== 'polls' || selectedPoll) {
      return;
    }

    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing polls...');
      fetchPollsQuietly();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [autoRefreshEnabled, currentView, selectedPoll]);

  // Update time displays every second for live countdown
  useEffect(() => {
    const timeUpdateInterval = setInterval(() => {
      setTimeUpdateTrigger(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timeUpdateInterval);
  }, []);

  // Fetch polls with loading indicator (for initial load and manual refresh)
  const fetchPolls = async () => {
    setIsLoadingPolls(true);
    setPollsError(null);
    await fetchPollsInternal();
  };

  // Fetch polls quietly without showing loading state (for auto-refresh)
  const fetchPollsQuietly = async () => {
    await fetchPollsInternal();
  };

  const fetchPollsInternal = async () => {
    try {
      console.log("🔄 Fetching polls from blockchain...");
      const contractPolls = await pollsContract.getAllPolls();
      
      console.log(`📊 Retrieved ${contractPolls.length} polls from contract`);
      
      // Log detailed information about each contract poll
      contractPolls.forEach((contractPoll, index) => {
        console.log(`\n📋 Contract Poll ${index + 1} Details:`);
        console.log(`   ID: ${contractPoll.id}`);
        console.log(`   Title: "${contractPoll.title}"`);
        console.log(`   Description: "${contractPoll.description}"`);
        console.log(`   Options: [${contractPoll.options.map(opt => `"${opt}"`).join(", ")}]`);
        console.log(`   Creator: ${contractPoll.creator}`);
        console.log(`   Votes: [${contractPoll.votes.join(", ")}]`);
        console.log(`   Status: ${contractPoll.status}`);
        console.log(`   Created At: ${new Date(contractPoll.createdAt).toLocaleString()}`);
      });
      
      // Convert ContractPoll to display Poll format
      const displayPolls: Poll[] = contractPolls.map((contractPoll, index) => {
        const totalVotes = contractPoll.votes.reduce((sum, votes) => sum + votes, 0);
        
        // Format reward pool display
        const rewardPoolInMassa = (contractPoll.rewardPool || 0) / 1e9;
        const rewardsDisplay = rewardPoolInMassa > 0
          ? `${rewardPoolInMassa.toFixed(4)} MASSA`
          : "No rewards";

        const displayPoll = {
          id: parseInt(contractPoll.id),
          title: contractPoll.title,
          description: contractPoll.description,
          options: contractPoll.options,
          votes: contractPoll.votes,
          totalVotes,
          timeLeft: contractPoll.status === 'active' ? "Active" : "Ended",
          creator: contractPoll.creator,
          rewards: rewardsDisplay,
          createdAt: contractPoll.createdAt,
          endTime: contractPoll.endTime,
          status: contractPoll.status,
          // Add new economics fields
          rewardPool: rewardPoolInMassa,
          fundingType: contractPoll.fundingType || 0,
          distributionMode: contractPoll.distributionMode || 0,
          distributionType: contractPoll.distributionType || 0,
          fixedRewardAmount: (contractPoll.fixedRewardAmount || 0) / 1e9,
          fundingGoal: (contractPoll.fundingGoal || 0) / 1e9,
          treasuryApproved: contractPoll.treasuryApproved || false,
          rewardsDistributed: contractPoll.rewardsDistributed || false
        };

        // Log the converted display poll
        console.log(`\n🖥️ Display Poll ${index + 1} (converted):`);
        console.log(`   ID: ${displayPoll.id}`);
        console.log(`   Title: "${displayPoll.title}"`);
        console.log(`   Description: "${displayPoll.description}"`);
        console.log(`   Options: [${displayPoll.options.map(opt => `"${opt}"`).join(", ")}]`);
        console.log(`   Total Votes: ${displayPoll.totalVotes}`);
        console.log(`   Individual Votes: [${displayPoll.votes.join(", ")}]`);
        console.log(`   Status: ${displayPoll.timeLeft}`);
        console.log(`   Creator: ${displayPoll.creator}`);

        return displayPoll;
      });
      
      // If no polls from blockchain, show a message
      if (displayPolls.length === 0) {
        console.log("ℹ️ No polls found on blockchain. Showing empty state.");
      } else {
        console.log(`\n✅ Successfully processed ${displayPolls.length} polls for display`);
        console.log(`📋 Poll titles: [${displayPolls.map(p => `"${p.title}"`).join(", ")}]`);
      }
      
      setPolls(displayPolls);
      setLastRefreshTime(new Date());

      // Check voting status for each poll if wallet is connected
      if (isWalletConnected && displayPolls.length > 0) {
        await checkVotingStatus(displayPolls);
      }
    } catch (error) {
      logError(error, { action: 'fetching polls' });
      const friendlyError = parseBlockchainError(error, { action: 'fetching polls' });
      setPollsError(`${friendlyError.message} ${friendlyError.suggestion}`);
    } finally {
      setIsLoadingPolls(false);
    }
  };

  const checkVotingStatus = async (polls: Poll[]) => {
    try {
      const walletAddress = await pollsContract.getWalletAddress();
      if (!walletAddress) {
        console.log('⚠️ No wallet connected, skipping vote status check');
        return;
      }

      // Use the optimized parallel checking method
      const pollIds = polls.map(p => p.id.toString());
      const votedPollIds = await pollsContract.checkVotedPolls(pollIds, walletAddress);

      setVotedPolls(votedPollIds);
      console.log(`📊 Voting status updated: voted on ${votedPollIds.size} out of ${polls.length} polls`);
    } catch (error) {
      console.error("❌ Failed to check voting status:", error);
    }
  };

  const checkWalletConnection = async () => {
    try {
      const connected = await pollsContract.isWalletConnected();
      setIsWalletConnected(connected);
      
      if (connected) {
        const address = await pollsContract.getWalletAddress();
        setWalletAddress(address);
        const isContractCreator = address === CONTRACT_CREATOR_ADDRESS;
        setIsAdmin(isContractCreator);
      } else {
        setWalletAddress(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Failed to check wallet connection:", error);
      setIsWalletConnected(false);
      setWalletAddress(null);
      setIsAdmin(false);
    }
  };


  const handleVote = async (pollId: number, optionIndex: number) => {
    // Check if already voted
    if (votedPolls.has(pollId)) return;
    
    // Check wallet connection first
    if (!isWalletConnected) {
      setVotingStatus({
        pollId,
        isVoting: false,
        message: 'Please connect your wallet using the "Connect Wallet" button in the header to vote',
        type: 'error'
      });
      toast.error('Please connect your wallet in the header to vote');
      return;
    }
    
    // Get wallet address for blockchain vote checking
    const walletAddress = await pollsContract.getWalletAddress();
    if (!walletAddress) {
      setVotingStatus({
        pollId,
        isVoting: false,
        message: 'Could not get wallet address. Please try reconnecting your wallet.',
        type: 'error'
      });
      return;
    }
    
    // Check if poll is active
    const poll = polls.find(p => p.id === pollId);
    console.log(`🗳️ Attempting to vote on poll ${pollId}:`);
    console.log(`   Poll found:`, poll);
    console.log(`   Wallet address:`, walletAddress);
    if (poll) {
      console.log(`   Poll ID: ${poll.id}`);
      console.log(`   Poll Title: "${poll.title}"`);
      console.log(`   Poll status: ${poll.status}`);
      console.log(`   Poll endTime: ${new Date(poll.endTime).toLocaleString()} (${poll.endTime})`);
      console.log(`   Current time: ${new Date().toLocaleString()} (${Date.now()})`);
      console.log(`   Time remaining: ${poll.endTime - Date.now()}ms`);
    }

    if (!poll || poll.status !== 'active') {
      console.log(`❌ Vote blocked: Poll ${pollId} is ${!poll ? 'not found' : 'inactive'}`);
      setVotingStatus({
        pollId,
        isVoting: false,
        message: 'This poll is no longer active and cannot accept votes',
        type: 'error'
      });
      return;
    }
    
    // Set initial voting state
    setVotingStatus({
      pollId,
      isVoting: true,
      message: 'Checking if you have already voted...',
      type: 'info'
    });
    
    try {
      // Check if user has already voted on blockchain
      console.log(`🔍 Checking if ${walletAddress} has voted on poll ${pollId}...`);
      const hasVotedOnChain = await pollsContract.hasVoted(pollId.toString(), walletAddress);
      
      if (hasVotedOnChain) {
        console.log(`❌ Vote blocked: User has already voted on poll ${pollId}`);
        setVotedPolls(prev => new Set(prev).add(pollId)); // Update local state
        setVotingStatus({
          pollId,
          isVoting: false,
          message: 'You have already voted on this poll',
          type: 'error'
        });
        return;
      }
      
      console.log(`✅ Vote allowed: User has not voted on poll ${pollId}, proceeding...`);

      // Check if poll is still active (based on cached status)
      if (poll.status !== 'active') {
        toast.error('This poll has ended. Voting is no longer allowed.');
        setVotingStatus({
          pollId: null,
          isVoting: false,
          message: '',
          type: null
        });
        return;
      }

      // Additional client-side time check (in case poll just ended)
      const currentTime = Date.now();
      if (poll.endTime && currentTime > poll.endTime) {
        toast.error('This poll has just ended. Voting is no longer allowed.');
        console.log(`⏰ Poll ${pollId} has ended. EndTime: ${new Date(poll.endTime).toLocaleString()}, Current: ${new Date(currentTime).toLocaleString()}`);

        // Update the poll status locally to reflect it's ended
        setPolls(prevPolls =>
          prevPolls.map(p =>
            p.id === pollId ? { ...p, status: 'ended', timeLeft: 'Ended' } : p
          )
        );

        setVotingStatus({
          pollId: null,
          isVoting: false,
          message: '',
          type: null
        });
        return;
      }

      console.log(`✅ All pre-vote checks passed!`);
      console.log(`   ✓ User has not voted`);
      console.log(`   ✓ Poll status: ${poll.status}`);
      console.log(`   ✓ Poll end time check: ${poll.endTime ? `${((poll.endTime - Date.now()) / 1000).toFixed(0)}s remaining` : 'N/A'}`);
      console.log(`   → Proceeding with blockchain vote submission...`);

      // Update voting state
      setVotingStatus({
        pollId,
        isVoting: true,
        message: 'Submitting your vote to the blockchain...',
        type: 'info'
      });

      // Call the contract to vote
      console.log(`📝 Submitting vote: Poll ${pollId}, Option ${optionIndex}`);
      await pollsContract.vote(pollId.toString(), optionIndex);
      
      // Mark as voted locally
      setVotedPolls(prev => new Set(prev).add(pollId));

      // Show success message
      toast.success(`Successfully voted for "${poll.options[optionIndex]}"! Redirecting to results page...`, 3000);

      // Refresh polls to show updated vote counts
      console.log('🔄 Refreshing polls to show updated vote counts...');
      setTimeout(() => {
        fetchPollsQuietly();
      }, 3000);

      console.log(`✅ Successfully voted for option ${optionIndex} (${poll.options[optionIndex]}) in poll ${pollId}`);

      // Redirect to results page after a short delay
      setTimeout(() => {
        if (onNavigate) {
          onNavigate('results', pollId.toString());
        }
      }, 1500);
    } catch (error) {
      logError(error, { action: 'voting on poll', pollId: pollId.toString() });
      const friendlyError = parseBlockchainError(error, { action: 'voting on poll', pollId: pollId.toString() });

      // Update local state if already voted
      if (friendlyError.title === 'Already Voted') {
        setVotedPolls(prev => new Set(prev).add(pollId));
      }

      // Show error message to user
      toast.error(`${friendlyError.message} ${friendlyError.suggestion}`, 8000);
    }
  };

  const getVotePercentage = (votes: number, total: number) => {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  };

  // Conditional rendering based on current view
  if (currentView === 'create') {
    return (
      <>
        <Navigation onNavigate={handleNavigation} currentPage={currentView} />
        <CreatePoll
          onBack={() => {
            handleNavigation('polls');
            fetchPolls();
          }}
        />
      </>
    );
  }

  if (currentView === 'admin') {
    return (
      <>
        <Navigation onNavigate={handleNavigation} currentPage={currentView} />
        <AdminPage
          onBack={() => handleNavigation('polls')}
        />
      </>
    );
  }

  return (
    <>
      <Navigation onNavigate={handleNavigation} currentPage={currentView} />
      <div className="polls-app">
      {selectedPoll ? (
        <div className="poll-detail">
          <button
            className="back-btn"
            onClick={() => setSelectedPoll(null)}
          >
            ← Back to Polls
          </button>
          
          <div className="poll-detail-content">
            <h2>{selectedPoll.title}</h2>
            <p className="poll-description">{selectedPoll.description}</p>
            
            <div className="poll-meta">
              <span>Created by: {selectedPoll.creator}</span>
              <span>Rewards: {selectedPoll.rewards}</span>
              <span>Time left: {selectedPoll.timeLeft}</span>
            </div>

            <div className="voting-section">
              <h3>Cast Your Vote</h3>

              {/* Poll Ended Notice */}
              {(selectedPoll.status !== 'active' || (selectedPoll.endTime && Date.now() > selectedPoll.endTime)) && (
                <div className="poll-ended-notice">
                  <ErrorIcon sx={{ fontSize: 20, marginRight: 0.5 }} />
                  This poll has ended. Voting is no longer allowed.
                </div>
              )}

              {/* Already Voted Notice */}
              {votedPolls.has(selectedPoll.id) && selectedPoll.status === 'active' && selectedPoll.endTime && Date.now() <= selectedPoll.endTime && (
                <div className="already-voted-notice">
                  <CheckCircleIcon sx={{ fontSize: 20, marginRight: 0.5 }} />
                  You've already voted on this poll.
                </div>
              )}

              {/* Voting Status Messages */}
              {votingStatus.message && (
                <div className={`voting-feedback voting-${votingStatus.type}`}>
                  {votingStatus.isVoting && <span className="voting-spinner"><RefreshIcon sx={{ fontSize: 16, marginRight: 0.5, verticalAlign: 'middle' }} /> </span>}
                  {votingStatus.message}
                </div>
              )}
              {selectedPoll.options.map((option, index) => {
                const isPollEnded = selectedPoll.status !== 'active' || (selectedPoll.endTime && Date.now() > selectedPoll.endTime);
                return (
                <div key={index} className="vote-option">
                  <button
                    className={`vote-btn ${votedPolls.has(selectedPoll.id) ? 'voted' : ''} ${isPollEnded ? 'inactive' : ''}`}
                    onClick={() => handleVote(selectedPoll.id, index)}
                    disabled={votedPolls.has(selectedPoll.id) || isPollEnded || votingStatus.isVoting}
                    title={isPollEnded ? 'This poll has ended' : votedPolls.has(selectedPoll.id) ? 'You already voted' : ''}
                  >
                    {option}
                  </button>
                  <div className="vote-bar">
                    <div 
                      className="vote-progress"
                      style={{ width: `${getVotePercentage(selectedPoll.votes[index], selectedPoll.totalVotes)}%` }}
                    ></div>
                  </div>
                  <span className="vote-count">
                    {selectedPoll.votes[index]} votes ({getVotePercentage(selectedPoll.votes[index], selectedPoll.totalVotes)}%)
                  </span>
                </div>
                );
              })}
            </div>

            <div className="poll-stats">
              <div className="stat">
                <h4>Total Votes</h4>
                <p>{selectedPoll.totalVotes}</p>
              </div>
              <div className="stat">
                <h4>Time Remaining</h4>
                <p>{formatTimeRemaining(selectedPoll.endTime, selectedPoll.status === 'active')}</p>
              </div>
              <div className="stat">
                <h4>Status</h4>
                <p>{selectedPoll.status === 'active' ? '🟢 Active' : '🔴 Ended'}</p>
              </div>
            </div>

            {/* Voter Reward Information */}
            {selectedPoll.rewardPool > 0 && (
              <div className="voter-reward-section">
                <h3>
                  <EmojiEventsIcon sx={{ fontSize: 22, marginRight: 0.5, verticalAlign: 'middle' }} />
                  Earn Rewards for Participating
                </h3>
                <div className="reward-info-card">
                  <div className="reward-info-row">
                    <span className="reward-label">Reward Pool:</span>
                    <span className="reward-value highlight">{selectedPoll.rewards}</span>
                  </div>

                  {selectedPoll.distributionMode === 1 && selectedPoll.fixedRewardAmount > 0 && (
                    <div className="reward-info-row">
                      <span className="reward-label">You'll Earn:</span>
                      <span className="reward-value highlight">{selectedPoll.fixedRewardAmount.toFixed(4)} MASSA</span>
                    </div>
                  )}

                  {selectedPoll.distributionMode === 0 && selectedPoll.totalVotes > 0 && (
                    <div className="reward-info-row">
                      <span className="reward-label">Est. Reward per Voter:</span>
                      <span className="reward-value highlight">
                        {((selectedPoll.rewardPool / selectedPoll.totalVotes) || 0).toFixed(4)} MASSA
                      </span>
                    </div>
                  )}

                  <div className="reward-info-row">
                    <span className="reward-label">Distribution:</span>
                    <span className="reward-value">
                      {selectedPoll.distributionMode === 0 && 'Equal Split Among All Voters'}
                      {selectedPoll.distributionMode === 1 && 'Fixed Amount Per Voter'}
                      {selectedPoll.distributionMode === 2 && 'Based on Response Quality'}
                    </span>
                  </div>

                  <div className="reward-info-row">
                    <span className="reward-label">How to Claim:</span>
                    <span className="reward-value">
                      {selectedPoll.distributionType === 0 && 'You claim after poll ends'}
                      {selectedPoll.distributionType === 1 && 'Creator distributes to voters'}
                      {selectedPoll.distributionType === 2 && 'Automatic distribution'}
                    </span>
                  </div>
                </div>

                {/* Claim Reward Button for Voters */}
                {selectedPoll.status !== 'active' &&
                 !selectedPoll.rewardsDistributed &&
                 selectedPoll.distributionType === 0 &&
                 votedPolls.has(selectedPoll.id) && (
                  <div className="claim-reward-section">
                    <button
                      className="claim-reward-btn"
                      onClick={async () => {
                        try {
                          await pollsContract.claimReward(selectedPoll.id.toString());
                          toast.success('Reward claimed successfully!');
                          fetchPolls();
                        } catch (err) {
                          toast.error('Failed to claim reward: ' + (err instanceof Error ? err.message : 'Unknown error'));
                        }
                      }}
                    >
                      <AttachMoneyIcon sx={{ fontSize: 18, marginRight: 0.5 }} />
                      Claim Your Reward
                    </button>
                    <p className="claim-help-text">
                      The poll has ended. Click to claim your reward!
                    </p>
                  </div>
                )}

                {selectedPoll.rewardsDistributed && votedPolls.has(selectedPoll.id) && (
                  <div className="rewards-distributed-notice">
                    <CheckCircleIcon sx={{ fontSize: 20, marginRight: 0.5 }} />
                    Rewards have been distributed for this poll
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="polls-grid-container">
          {/* Loading State */}
          {isLoadingPolls && (
            <div className="loading-state">
              <h3><RefreshIcon sx={{ fontSize: 24, marginRight: 1, verticalAlign: 'middle' }} /> Loading Polls from Blockchain...</h3>
              <p>Fetching the latest polls from the Massa network. This may take a moment.</p>
            </div>
          )}

          {/* Error State */}
          {pollsError && !isLoadingPolls && (
            <div className="error-state">
              <h3><ErrorIcon sx={{ fontSize: 24, marginRight: 1, verticalAlign: 'middle' }} /> Error Loading Polls</h3>
              <p>{pollsError}</p>
              <button className="retry-btn" onClick={fetchPolls}>
                <RefreshIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} /> Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingPolls && !pollsError && polls.length === 0 && (
            <div className="empty-state">
              <h3><TableChartIcon sx={{ fontSize: 24, marginRight: 1, verticalAlign: 'middle' }} /> No Polls Found</h3>
              <p>No polls have been created on the blockchain yet. Be the first to create one!</p>
              <button className="create-first-poll-btn" onClick={() => handleNavigation('create')}>
                <RocketLaunchIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} /> Create First Poll
              </button>
            </div>
          )}

          {/* Polls Grid */}
          {!isLoadingPolls && !pollsError && polls.length > 0 && (
            <>
              <div className="polls-header-info">
                <div className="polls-header-left">
                  <h3><TableChartIcon sx={{ fontSize: 22, marginRight: 1, verticalAlign: 'middle' }} /> Blockchain Polls</h3>
                  <p>Showing {polls.length} poll{polls.length !== 1 ? 's' : ''} from the Massa blockchain</p>
                  {lastRefreshTime && (
                    <small className="last-refresh">
                      Last updated: {lastRefreshTime.toLocaleTimeString()}
                    </small>
                  )}
                </div>
                <div className="polls-header-right">
                  <div className="view-mode-toggle">
                    <button
                      className={`view-mode-btn ${viewMode === 'beta' ? 'active' : ''}`}
                      onClick={() => setViewMode('beta')}
                      title="Table View (Beta)"
                    >
                      <TableChartIcon sx={{ fontSize: 18, marginRight: 0.5 }} /> Beta
                    </button>
                    <button
                      className={`view-mode-btn ${viewMode === 'classic' ? 'active' : ''}`}
                      onClick={() => setViewMode('classic')}
                      title="Card View (Classic)"
                    >
                      <ViewModuleIcon sx={{ fontSize: 18, marginRight: 0.5 }} /> Classic
                    </button>
                  </div>
                  <label className="auto-refresh-toggle">
                    <input
                      type="checkbox"
                      checked={autoRefreshEnabled}
                      onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                    />
                    <span>Auto-refresh (30s)</span>
                  </label>
                  <button className="refresh-polls-btn" onClick={fetchPolls}>
                    <RefreshIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} /> Refresh
                  </button>
                </div>
              </div>
              
              {/* Beta View - Table Layout */}
              {viewMode === 'beta' && (
                <div className="polls-table-container">
                  <table className="polls-table">
                    <thead>
                      <tr>
                        <th className="th-poll">POLL</th>
                        <th className="th-status">STATUS</th>
                        <th className="th-votes">VOTES</th>
                        <th className="th-rewards">REWARDS</th>
                        <th className="th-creator">CREATOR</th>
                        <th className="th-time">END DATE</th>
                        <th className="th-time">TIME REMAINING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {polls.map(poll => (
                        <tr
                          key={poll.id}
                          className={`poll-row ${poll.status !== 'active' ? 'poll-inactive' : ''}`}
                          onClick={() => setSelectedPoll(poll)}
                        >
                          <td className="td-poll">
                            <div className="poll-cell">
                              <div className="poll-icon">
                                <HowToVoteIcon sx={{ fontSize: 24 }} />
                              </div>
                              <div className="poll-info">
                                <div className="poll-title-row">
                                  <span className="poll-title">{poll.title}</span>
                                  <div className="poll-badges">
                                    {votedPolls.has(poll.id) && (
                                      <span className="voted-badge">✓ Voted</span>
                                    )}
                                    <span className="poll-id">#{poll.id}</span>
                                  </div>
                                </div>
                                <span className="poll-description">
                                  {poll.description.length > 60
                                    ? `${poll.description.substring(0, 60)}...`
                                    : poll.description
                                  }
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="td-status">
                            <span className={`status-badge ${poll.status}`}>
                              {poll.status === 'active' && '🟢 Active'}
                              {poll.status === 'closed' && '🔴 Closed'}
                              {poll.status === 'ended' && '⏸️ Ended'}
                              {poll.status === 'for_claiming' && '🎁 For Claiming'}
                            </span>
                          </td>
                          <td className="td-votes">
                            <span className="votes-count">{poll.totalVotes}</span>
                          </td>
                          <td className="td-rewards">
                            <span className="rewards-amount">{poll.rewards}</span>
                          </td>
                          <td className="td-creator">
                            <span className="creator-address">
                              {poll.creator.slice(0, 6)}...{poll.creator.slice(-4)}
                            </span>
                          </td>
                          <td className="td-time">
                            <span className="end-date">
                              {new Date(poll.endTime).toLocaleDateString()} {new Date(poll.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="td-time">
                            <span className={`time-remaining ${getTimeUrgencyClass(poll.endTime, poll.status === 'active')}`}>
                              {formatTimeRemaining(poll.endTime, poll.status === 'active')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Classic View - Card Layout */}
              {viewMode === 'classic' && (
                <div className="polls-grid-classic">
                  {polls.map(poll => (
                    <div
                      key={poll.id}
                      className={`poll-card-classic ${poll.status !== 'active' ? 'poll-inactive' : ''}`}
                      onClick={() => setSelectedPoll(poll)}
                    >
                      <div className="poll-card-header">
                        <div className="poll-card-title-row">
                          <h3>{poll.title}</h3>
                          <span className={`status-pill ${poll.status === 'active' ? 'active' : 'ended'}`}>
                            {poll.status === 'active' ? 'Active' : 'Ended'}
                          </span>
                        </div>
                        <p className="poll-card-description">{poll.description}</p>
                      </div>

                      <div className="poll-card-stats">
                        <div className="stat-box">
                          <span className="stat-icon"><PeopleIcon sx={{ fontSize: 28 }} /></span>
                          <div className="stat-details">
                            <span className="stat-value">{poll.totalVotes}</span>
                            <span className="stat-label">responses</span>
                          </div>
                        </div>
                        <div className="stat-box">
                          <span className="stat-icon"><CalendarTodayIcon sx={{ fontSize: 28 }} /></span>
                          <div className="stat-details">
                            <span className="stat-value">
                              {poll.status === 'active' ? formatTimeRemaining(poll.endTime, poll.status === 'active') : 'Ended'}
                            </span>
                            <span className="stat-label">
                              {new Date(poll.endTime).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="poll-card-footer">
                        <button className="poll-action-btn">
                          {poll.status === 'active' ? 'View Results' : 'Edit & Publish'}
                        </button>
                        <div className="poll-card-menu"><MoreVertIcon sx={{ fontSize: 20 }} /></div>
                      </div>

                      <div className="poll-card-meta">
                        <span className="poll-created">Created {new Date(poll.endTime - (poll.status === 'active' ? 7 * 24 * 60 * 60 * 1000 : 0)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="create-poll-section">
        <button className="create-poll-btn" onClick={() => handleNavigation('create')}>
          + Create New Poll
        </button>
      </div>
      </div>
    </>
  );
};

export default PollsApp;
