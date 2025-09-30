import { useState, useEffect } from "react";
import CreatePoll from "./CreatePoll";
import AdminPage from "./AdminPage";
import Navigation from "./components/Navigation";
import { pollsContract, ContractPoll } from "./utils/contractInteraction";
import { parseBlockchainError, logError } from "./utils/errorHandling";
import { useToast } from "./components/ToastContainer";
import { formatTimeRemaining, getTimeUrgencyClass } from "./utils/timeFormat";

// Convert ContractPoll to display format
interface Poll extends Omit<ContractPoll, 'id' | 'votes'> {
  id: number;
  votes: number[];
  totalVotes: number;
  timeLeft: string;
  rewards: string;
}

type PageType = 'home' | 'polls' | 'create' | 'admin';

interface PollsAppProps {
  initialView?: PageType;
  onNavigate?: (page: PageType) => void;
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
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

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

  const handleNavigation = (page: PageType) => {
    setCurrentView(page);
    if (onNavigate) {
      onNavigate(page);
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
        console.log(`   Is Active: ${contractPoll.isActive}`);
        console.log(`   Created At: ${new Date(contractPoll.createdAt).toLocaleString()}`);
      });
      
      // Convert ContractPoll to display Poll format
      const displayPolls: Poll[] = contractPolls.map((contractPoll, index) => {
        const totalVotes = contractPoll.votes.reduce((sum, votes) => sum + votes, 0);
        
        const displayPoll = {
          id: parseInt(contractPoll.id),
          title: contractPoll.title,
          description: contractPoll.description,
          options: contractPoll.options,
          votes: contractPoll.votes,
          totalVotes,
          timeLeft: contractPoll.isActive ? "Active" : "Ended",
          creator: contractPoll.creator,
          rewards: "0 MASSA", // Default for now
          isActive: contractPoll.isActive,
          createdAt: contractPoll.createdAt,
          endTime: contractPoll.endTime,
          status: contractPoll.status
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
      if (!walletAddress) return;
      
      console.log(`🔍 Checking voting status for ${polls.length} polls...`);
      const voted = new Set<number>();
      
      // Check voting status for each poll
      for (const poll of polls) {
        try {
          const hasVoted = await pollsContract.hasVoted(poll.id.toString(), walletAddress);
          if (hasVoted) {
            voted.add(poll.id);
            console.log(`✅ User has voted on poll ${poll.id}: "${poll.title}"`);
          } else {
            console.log(`⭕ User has not voted on poll ${poll.id}: "${poll.title}"`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to check voting status for poll ${poll.id}:`, error);
        }
      }
      
      setVotedPolls(voted);
      console.log(`📊 Voting status check complete. Voted on ${voted.size} out of ${polls.length} polls.`);
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

  const connectWallet = async () => {
    setIsConnectingWallet(true);
    try {
      const connected = await pollsContract.connectWallet();
      if (connected) {
        await checkWalletConnection();
        toast.success('Wallet connected successfully!');
      } else {
        toast.error('Failed to connect wallet. Please try again.');
      }
    } catch (error) {
      logError(error, { action: 'connecting wallet' });
      const friendlyError = parseBlockchainError(error, { action: 'connecting wallet' });
      toast.error(`${friendlyError.message} ${friendlyError.suggestion}`);
    } finally {
      setIsConnectingWallet(false);
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
        message: 'Please connect your wallet to vote',
        type: 'error'
      });
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
      console.log(`   Poll isActive: ${poll.isActive}`);
      console.log(`   Poll status: ${poll.status}`);
      console.log(`   Poll endTime: ${new Date(poll.endTime).toLocaleString()} (${poll.endTime})`);
      console.log(`   Current time: ${new Date().toLocaleString()} (${Date.now()})`);
      console.log(`   Time remaining: ${poll.endTime - Date.now()}ms`);
    }
    
    if (!poll || !poll.isActive) {
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
      toast.success(`Successfully voted for "${poll.options[optionIndex]}"! Your vote has been recorded on the blockchain.`, 6000);

      // Refresh polls to show updated vote counts
      console.log('🔄 Refreshing polls to show updated vote counts...');
      setTimeout(() => {
        fetchPollsQuietly();
      }, 3000);

      console.log(`✅ Successfully voted for option ${optionIndex} (${poll.options[optionIndex]}) in poll ${pollId}`);
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
        <header className="polls-header">
          <div className="header-content">
            <div className="header-left">
              <h1>🗳️ Massa Polls</h1>
              <p>Decentralized voting on the Massa blockchain</p>
            </div>
            <div className="header-right">
              {/* Wallet Connection Status */}
              <div className="wallet-section">
                {isWalletConnected ? (
                  <div className="wallet-connected">
                    <span className="wallet-status">✅ Wallet Connected</span>
                    {walletAddress && (
                      <span className="wallet-address">
                        {walletAddress.length > 20 ? 
                          `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : 
                          walletAddress
                        }
                      </span>
                    )}
                  </div>
                ) : (
                  <button 
                    className="connect-wallet-btn"
                    onClick={connectWallet}
                    disabled={isConnectingWallet}
                  >
                    {isConnectingWallet ? '🔄 Connecting...' : '🔗 Connect Wallet'}
                  </button>
                )}
              </div>
              <a 
                href="https://explorer.massa.net/mainnet" 
                target="_blank" 
                rel="noopener noreferrer"
                className="explorer-link"
              >
                🔗 Massa Explorer
              </a>
              <a 
                href={`https://explorer.massa.net/mainnet/address/${CONTRACT_CREATOR_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-link-small"
              >
                🔗
              </a>
            </div>
          </div>
        </header>
        
        <div className="contract-info-header">
          <div className="contract-details">
            <span className="contract-label">📍 Contract:</span>
            <span className="contract-address">{pollsContract.getContractAddress()}</span>
            <a 
              href={pollsContract.getExplorerUrl()}
              target="_blank" 
              rel="noopener noreferrer"
              className="explorer-link-small"
            >
              🔗
            </a>
          </div>
        </div>

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
              
              {/* Voting Status Messages */}
              {votingStatus.message && (
                <div className={`voting-feedback voting-${votingStatus.type}`}>
                  {votingStatus.isVoting && <span className="voting-spinner">🔄 </span>}
                  {votingStatus.message}
                </div>
              )}
              {selectedPoll.options.map((option, index) => (
                <div key={index} className="vote-option">
                  <button
                    className={`vote-btn ${votedPolls.has(selectedPoll.id) ? 'voted' : ''} ${!selectedPoll.isActive ? 'inactive' : ''}`}
                    onClick={() => handleVote(selectedPoll.id, index)}
                    disabled={votedPolls.has(selectedPoll.id) || !selectedPoll.isActive || votingStatus.isVoting}
                    title={!selectedPoll.isActive ? 'This poll is no longer active' : ''}
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
              ))}
            </div>

            <div className="poll-stats">
              <div className="stat">
                <h4>Total Votes</h4>
                <p>{selectedPoll.totalVotes}</p>
              </div>
              <div className="stat">
                <h4>Time Remaining</h4>
                <p>{selectedPoll.timeLeft}</p>
              </div>
              <div className="stat">
                <h4>Reward Pool</h4>
                <p>{selectedPoll.rewards}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="polls-grid-container">
          {/* Loading State */}
          {isLoadingPolls && (
            <div className="loading-state">
              <h3>🔄 Loading Polls from Blockchain...</h3>
              <p>Fetching the latest polls from the Massa network. This may take a moment.</p>
            </div>
          )}

          {/* Error State */}
          {pollsError && !isLoadingPolls && (
            <div className="error-state">
              <h3>❌ Error Loading Polls</h3>
              <p>{pollsError}</p>
              <button className="retry-btn" onClick={fetchPolls}>
                🔄 Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingPolls && !pollsError && polls.length === 0 && (
            <div className="empty-state">
              <h3>📊 No Polls Found</h3>
              <p>No polls have been created on the blockchain yet. Be the first to create one!</p>
              <button className="create-first-poll-btn" onClick={() => handleNavigation('create')}>
                🚀 Create First Poll
              </button>
            </div>
          )}

          {/* Polls Grid */}
          {!isLoadingPolls && !pollsError && polls.length > 0 && (
            <>
              <div className="polls-header-info">
                <div className="polls-header-left">
                  <h3>📊 Blockchain Polls</h3>
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
                      📊 Beta
                    </button>
                    <button
                      className={`view-mode-btn ${viewMode === 'classic' ? 'active' : ''}`}
                      onClick={() => setViewMode('classic')}
                      title="Card View (Classic)"
                    >
                      🎴 Classic
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
                    🔄 Refresh
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
                        <th className="th-time">TIME REMAINING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {polls.map(poll => (
                        <tr
                          key={poll.id}
                          className={`poll-row ${!poll.isActive ? 'poll-inactive' : ''}`}
                          onClick={() => setSelectedPoll(poll)}
                        >
                          <td className="td-poll">
                            <div className="poll-cell">
                              <div className="poll-icon">
                                <span>🗳️</span>
                              </div>
                              <div className="poll-info">
                                <div className="poll-title-row">
                                  <span className="poll-title">{poll.title}</span>
                                  <span className="poll-id">#{poll.id}</span>
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
                            <span className={`status-badge ${poll.isActive ? 'active' : 'inactive'}`}>
                              {poll.isActive ? 'Active' : 'Ended'}
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
                            <span className={`time-remaining ${getTimeUrgencyClass(poll.endTime, poll.isActive)}`}>
                              {formatTimeRemaining(poll.endTime, poll.isActive)}
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
                      className={`poll-card-classic ${!poll.isActive ? 'poll-inactive' : ''}`}
                      onClick={() => setSelectedPoll(poll)}
                    >
                      <div className="poll-card-header">
                        <div className="poll-card-title-row">
                          <h3>{poll.title}</h3>
                          <span className={`status-pill ${poll.isActive ? 'active' : 'ended'}`}>
                            {poll.isActive ? 'Active' : 'Ended'}
                          </span>
                        </div>
                        <p className="poll-card-description">{poll.description}</p>
                      </div>

                      <div className="poll-card-stats">
                        <div className="stat-box">
                          <span className="stat-icon">👥</span>
                          <div className="stat-details">
                            <span className="stat-value">{poll.totalVotes}</span>
                            <span className="stat-label">responses</span>
                          </div>
                        </div>
                        <div className="stat-box">
                          <span className="stat-icon">📅</span>
                          <div className="stat-details">
                            <span className="stat-value">
                              {poll.isActive ? formatTimeRemaining(poll.endTime, poll.isActive) : 'Ended'}
                            </span>
                            <span className="stat-label">
                              {poll.isActive ? new Date(poll.endTime).toLocaleDateString() : new Date(poll.endTime).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="poll-card-footer">
                        <button className="poll-action-btn">
                          {poll.isActive ? 'View Results' : 'Edit & Publish'}
                        </button>
                        <div className="poll-card-menu">⋮</div>
                      </div>

                      <div className="poll-card-meta">
                        <span className="poll-created">Created {new Date(poll.endTime - (poll.isActive ? 7 * 24 * 60 * 60 * 1000 : 0)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
