import { useState, useEffect } from "react";
import CreatePoll from "./CreatePoll";
import AdminPage from "./AdminPage";
import { pollsContract, ContractPoll } from "./utils/contractInteraction";

// Convert ContractPoll to display format
interface Poll extends Omit<ContractPoll, 'id' | 'votes'> {
  id: number;
  votes: number[];
  totalVotes: number;
  timeLeft: string;
  rewards: string;
}

const PollsApp = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(true);
  const [pollsError, setPollsError] = useState<string | null>(null);

  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [votedPolls, setVotedPolls] = useState<Set<number>>(new Set());
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const CONTRACT_CREATOR_ADDRESS = "AU1Pd3bod1Js2xD71GLFd1Q1dA8tnugsHroL54Rn7SzYY5KiozfS";

  useEffect(() => {
    checkAdminStatus();
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    setIsLoadingPolls(true);
    setPollsError(null);
    
    try {
      console.log("🔄 Fetching polls from blockchain...");
      const contractPolls = await pollsContract.getAllPolls();
      
      console.log(`📊 Retrieved ${contractPolls.length} polls from contract`);
      
      // Convert ContractPoll to display Poll format
      const displayPolls: Poll[] = contractPolls.map(contractPoll => {
        const totalVotes = contractPoll.votes.reduce((sum, votes) => sum + votes, 0);
        
        return {
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
          createdAt: contractPoll.createdAt
        };
      });
      
      // If no polls from blockchain, show a message
      if (displayPolls.length === 0) {
        console.log("ℹ️ No polls found on blockchain. Showing empty state.");
      }
      
      setPolls(displayPolls);
    } catch (error) {
      console.error("Failed to fetch polls:", error);
      setPollsError("Failed to load polls from blockchain. Please try again.");
    } finally {
      setIsLoadingPolls(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const connected = await pollsContract.isWalletConnected();
      
      if (connected) {
        const address = await pollsContract.getWalletAddress();
        const isContractCreator = address === CONTRACT_CREATOR_ADDRESS;
        setIsAdmin(isContractCreator);
      }
    } catch (error) {
      console.error("Failed to check admin status:", error);
    }
  };

  const handleVote = async (pollId: number, optionIndex: number) => {
    if (votedPolls.has(pollId)) return;
    
    try {
      // Call the contract to vote
      await pollsContract.vote(pollId.toString(), optionIndex);
      
      setVotedPolls(prev => new Set(prev).add(pollId));
      console.log(`Successfully voted for option ${optionIndex} in poll ${pollId}`);
    } catch (error) {
      console.error("Error voting:", error);
      // You could show an error message to the user here
    }
  };

  const getVotePercentage = (votes: number, total: number) => {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  };

  if (showCreatePoll) {
    return <CreatePoll onBack={() => {
      setShowCreatePoll(false);
      // Refresh polls when returning from create poll page
      fetchPolls();
    }} />;
  }

  if (showAdminPage) {
    return <AdminPage onBack={() => setShowAdminPage(false)} />;
  }

  return (
    <div className="polls-app">
      <header className="polls-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Massa Polls</h1>
            <p>Decentralized Polls & Contests</p>
          </div>
          
          {/* Admin Button */}
          {isAdmin && (
            <div className="header-right">
              <button 
                className="admin-btn"
                onClick={() => setShowAdminPage(true)}
                title="Admin Panel - Contract Creator Only"
              >
                ⚙️ Admin
              </button>
            </div>
          )}
        </div>
        
        {/* Contract Information */}
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
      </header>

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
              {selectedPoll.options.map((option, index) => (
                <div key={index} className="vote-option">
                  <button
                    className={`vote-btn ${votedPolls.has(selectedPoll.id) ? 'voted' : ''}`}
                    onClick={() => handleVote(selectedPoll.id, index)}
                    disabled={votedPolls.has(selectedPoll.id)}
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
              <button className="create-first-poll-btn" onClick={() => setShowCreatePoll(true)}>
                🚀 Create First Poll
              </button>
            </div>
          )}

          {/* Polls Grid */}
          {!isLoadingPolls && !pollsError && polls.length > 0 && (
            <>
              <div className="polls-header-info">
                <h3>📊 Blockchain Polls</h3>
                <p>Showing {polls.length} poll{polls.length !== 1 ? 's' : ''} from the Massa blockchain</p>
                <button className="refresh-polls-btn" onClick={fetchPolls}>
                  🔄 Refresh
                </button>
              </div>
              
              <div className="polls-grid">
                {polls.map(poll => (
                  <div key={poll.id} className="poll-card" onClick={() => setSelectedPoll(poll)}>
                    <div className="poll-badge">
                      <span className="blockchain-badge">⛓️ On-Chain</span>
                      <span className="poll-id">#{poll.id}</span>
                    </div>
                    
                    <h3>{poll.title}</h3>
                    <p className="poll-description">{poll.description}</p>
                    
                    <div className="poll-preview">
                      <div className="poll-stats">
                        <span className="votes">{poll.totalVotes} votes</span>
                        <span className="time-left">{poll.timeLeft}</span>
                      </div>
                      <div className="poll-rewards">
                        🏆 {poll.rewards}
                      </div>
                    </div>
                    
                    <div className="poll-creator">
                      Created by {poll.creator}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="create-poll-section">
        <button className="create-poll-btn" onClick={() => setShowCreatePoll(true)}>
          + Create New Poll
        </button>
      </div>
    </div>
  );
};

export default PollsApp;
