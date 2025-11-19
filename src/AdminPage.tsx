import { useState, useEffect } from "react";
import { pollsContract, ContractPoll } from "./utils/contractInteraction";

interface AdminPageProps {
  onBack: () => void;
}

interface Poll extends Omit<ContractPoll, 'id' | 'votes'> {
  id: number;
  votes: number[];
  totalVotes: number;
  timeLeft: string;
  rewards: string;
  // Include economics fields from ContractPoll
  rewardPool: number;
  fundingType: number;
  distributionMode: number;
  distributionType: number;
  fixedRewardAmount: number;
  fundingGoal: number;
  treasuryApproved: boolean;
  rewardsDistributed: boolean;
}

const CONTRACT_CREATOR_ADDRESS = "AU1Pd3bod1Js2xD71GLFd1Q1dA8tnugsHroL54Rn7SzYY5KiozfS";

const AdminPage = ({ onBack }: AdminPageProps) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [fundAmount, setFundAmount] = useState("1.0");
  const [isFunding, setIsFunding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  
  // Poll management state
  const [activeTab, setActiveTab] = useState<"overview" | "polls" | "funding" | "autonomous" | "treasury">("overview");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);
  const [pollsError, setPollsError] = useState("");
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [pollToClose, setPollToClose] = useState<Poll | null>(null);

  // Autonomous SC state
  const [autonomousEnabled, setAutonomousEnabled] = useState(false);
  const [autonomousInterval, setAutonomousInterval] = useState(3600);
  const [lastAutonomousRun, setLastAutonomousRun] = useState(0);
  const [newInterval, setNewInterval] = useState("3600");
  const [isTogglingAutonomous, setIsTogglingAutonomous] = useState(false);
  const [isUpdatingInterval, setIsUpdatingInterval] = useState(false);

  // Treasury state
  const [pendingTreasuryPolls, setPendingTreasuryPolls] = useState<Poll[]>([]);
  const [isLoadingTreasury, setIsLoadingTreasury] = useState(false);
  const [treasuryError, setTreasuryError] = useState("");
  const [fundingAmounts, setFundingAmounts] = useState<{[pollId: string]: string}>({});
  const [isApprovingPoll, setIsApprovingPoll] = useState<{[pollId: string]: boolean}>({});
  const [isRejectingPoll, setIsRejectingPoll] = useState<{[pollId: string]: boolean}>({});

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const fetchPolls = async () => {
    setIsLoadingPolls(true);
    setPollsError("");
    
    try {
      console.log("🔄 Admin: Fetching polls from blockchain...");
      const contractPolls = await pollsContract.getAllPolls();
      
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
          rewards: "0 MASSA",
          isActive: contractPoll.isActive,
          createdAt: contractPoll.createdAt,
          endTime: contractPoll.endTime,
          status: contractPoll.status,
          rewardPool: contractPoll.rewardPool || 0,
          fundingType: contractPoll.fundingType || 0,
          distributionMode: contractPoll.distributionMode || 0,
          distributionType: contractPoll.distributionType || 0,
          fixedRewardAmount: contractPoll.fixedRewardAmount || 0,
          fundingGoal: contractPoll.fundingGoal || 0,
          treasuryApproved: contractPoll.treasuryApproved || false,
          rewardsDistributed: contractPoll.rewardsDistributed || false
        };
      });
      
      setPolls(displayPolls);
      console.log(`📊 Admin: Retrieved ${displayPolls.length} polls`);
    } catch (error) {
      console.error("Admin: Failed to fetch polls:", error);
      setPollsError("Failed to load polls from blockchain. Please try again.");
    } finally {
      setIsLoadingPolls(false);
    }
  };

  const fetchAutonomousStatus = async () => {
    try {
      const enabled = await pollsContract.isAutonomousEnabled();
      const interval = await pollsContract.getAutonomousInterval();
      const lastRun = await pollsContract.getLastAutonomousRun();

      setAutonomousEnabled(enabled);
      setAutonomousInterval(interval);
      setLastAutonomousRun(lastRun);
      setNewInterval(interval.toString());
    } catch (error) {
      console.error("Failed to fetch autonomous status:", error);
    }
  };

  const toggleAutonomous = async () => {
    setIsTogglingAutonomous(true);
    setMessage("");
    setError("");

    try {
      if (autonomousEnabled) {
        await pollsContract.disableAutonomous();
        setMessage("Autonomous SC disabled successfully");
        setAutonomousEnabled(false);
      } else {
        await pollsContract.enableAutonomous();
        setMessage("Autonomous SC enabled successfully");
        setAutonomousEnabled(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle autonomous SC");
    } finally {
      setIsTogglingAutonomous(false);
    }
  };

  const updateInterval = async () => {
    const intervalSeconds = parseInt(newInterval);
    if (isNaN(intervalSeconds) || intervalSeconds < 60) {
      setError("Interval must be at least 60 seconds");
      return;
    }

    setIsUpdatingInterval(true);
    setMessage("");
    setError("");

    try {
      await pollsContract.setAutonomousInterval(intervalSeconds);
      setMessage(`Interval updated to ${intervalSeconds} seconds`);
      setAutonomousInterval(intervalSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update interval");
    } finally {
      setIsUpdatingInterval(false);
    }
  };

  // Treasury functions
  const fetchPendingTreasuryPolls = async () => {
    setIsLoadingTreasury(true);
    setTreasuryError("");
    try {
      const pendingPollIds = await pollsContract.getPendingTreasuryPolls();
      const allPolls = await pollsContract.getAllPolls();

      const treasuryPolls = allPolls.filter(poll =>
        pendingPollIds.includes(poll.id)
      ).map(poll => ({
        ...poll,
        id: parseInt(poll.id),
        votes: poll.votes,
        totalVotes: poll.votes.reduce((sum, v) => sum + v, 0),
        timeLeft: calculateTimeLeft(poll.endTime),
        rewards: (poll.rewardPool / 1e9).toFixed(3)
      }));

      setPendingTreasuryPolls(treasuryPolls);
    } catch (error) {
      console.error("Failed to fetch pending treasury polls:", error);
      setTreasuryError(error instanceof Error ? error.message : "Failed to load treasury polls");
    } finally {
      setIsLoadingTreasury(false);
    }
  };

  const approvePoll = async (pollId: number) => {
    setIsApprovingPoll(prev => ({ ...prev, [pollId]: true }));
    setMessage("");
    setError("");

    try {
      const fundingAmount = parseFloat(fundingAmounts[pollId] || "0");
      await pollsContract.approveTreasuryPoll(pollId.toString(), fundingAmount);
      setMessage(`Poll ${pollId} approved${fundingAmount > 0 ? ` with ${fundingAmount} MASSA funding` : ''}!`);

      // Refresh pending polls
      setTimeout(() => fetchPendingTreasuryPolls(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve poll");
    } finally {
      setIsApprovingPoll(prev => ({ ...prev, [pollId]: false }));
    }
  };

  const rejectPoll = async (pollId: number) => {
    setIsRejectingPoll(prev => ({ ...prev, [pollId]: true }));
    setMessage("");
    setError("");

    try {
      await pollsContract.rejectTreasuryPoll(pollId.toString());
      setMessage(`Poll ${pollId} rejected and closed!`);

      // Refresh pending polls
      setTimeout(() => fetchPendingTreasuryPolls(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject poll");
    } finally {
      setIsRejectingPoll(prev => ({ ...prev, [pollId]: false }));
    }
  };

  const calculateTimeLeft = (endTime: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diff = endTime - now;

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleEditPoll = (poll: Poll) => {
    setEditingPoll(poll);
    setShowEditModal(true);
  };

  const handleClosePoll = (poll: Poll) => {
    setPollToClose(poll);
    setShowCloseModal(true);
  };

  const confirmClosePoll = async () => {
    if (!pollToClose) return;
    
    try {
      setMessage("");
      setError("");
      
      const success = await pollsContract.closePoll(pollToClose.id.toString());
      
      if (success) {
        setMessage(`Poll "${pollToClose.title}" has been closed successfully.`);
        setShowCloseModal(false);
        setPollToClose(null);
        // Refresh polls to show updated status
        fetchPolls();
      }
    } catch (error) {
      console.error("Error closing poll:", error);
      setError(`Failed to close poll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const saveEditedPoll = async () => {
    if (!editingPoll) return;
    
    try {
      setMessage("");
      setError("");
      
      const success = await pollsContract.updatePoll(
        editingPoll.id.toString(),
        editingPoll.title,
        editingPoll.description
      );
      
      if (success) {
        setMessage(`Poll "${editingPoll.title}" has been updated successfully.`);
        setShowEditModal(false);
        setEditingPoll(null);
        // Refresh polls to show updated data
        fetchPolls();
      }
    } catch (error) {
      console.error("Error updating poll:", error);
      setError(`Failed to update poll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const checkAdminAccess = async () => {
    setIsLoading(true);
    try {
      const connected = await pollsContract.isWalletConnected();
      if (connected) {
        const address = await pollsContract.getWalletAddress();
        setWalletAddress(address || "");
        
        // Check if the connected wallet is the contract creator
        const isCreator = address === CONTRACT_CREATOR_ADDRESS;
        setIsAdmin(isCreator);
        
        if (!isCreator) {
          setError("Access denied. Only the contract creator can access the admin panel.");
        }
      } else {
        setError("Please connect your wallet to access the admin panel.");
      }
    } catch (err) {
      setError("Failed to verify admin access. Please try connecting your wallet.");
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      const connected = await pollsContract.connectWallet();
      if (connected) {
        await checkAdminAccess();
      } else {
        setError("Failed to connect wallet.");
      }
    } catch (err) {
      setError("Failed to connect wallet.");
    }
  };

  const fundContract = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      setError("Please enter a valid funding amount.");
      return;
    }

    setIsFunding(true);
    setMessage("");
    setError("");

    try {
      // Call the contract funding functionality
      const success = await pollsContract.fundContract(parseFloat(fundAmount));
      
      if (success) {
        setMessage(`Successfully funded contract with ${fundAmount} MASSA! The contract now has additional funds for storage costs.`);
        setFundAmount("1.0"); // Reset to default
      } else {
        setError("Failed to fund contract. Please try again.");
      }
    } catch (err) {
      console.error("Funding error:", err);
      setError("Failed to fund contract. Please check your wallet balance and try again.");
    } finally {
      setIsFunding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="loading-message">
            <h2>🔐 Verifying Admin Access...</h2>
            <p>Please wait while we verify your permissions.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <button className="back-btn" onClick={onBack}>
            ← Back to Polls
          </button>
          
          <div className="access-denied">
            <h1>🚫 Access Denied</h1>
            <p className="error-message">{error}</p>
            
            {!walletAddress && (
              <div className="connect-section">
                <p>Connect your wallet to verify admin access:</p>
                <button className="connect-wallet-btn" onClick={connectWallet}>
                  Connect Wallet
                </button>
              </div>
            )}
            
            {walletAddress && (
              <div className="wallet-info">
                <p><strong>Connected Wallet:</strong> {walletAddress}</p>
                <p><strong>Required Address:</strong> {CONTRACT_CREATOR_ADDRESS}</p>
                <p>Only the contract creator can access the admin panel.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <button className="back-btn" onClick={onBack}>
          ← Back to Polls
        </button>

        <div className="admin-content">
          <h1>⚙️ Admin Panel</h1>
          <p className="subtitle">Manage your Massa Polls contract</p>

          {/* Admin Status */}
          <div className="admin-status">
            <h3>👤 Admin Status</h3>
            <div className="status-info">
              <div className="status-item">
                <strong>✅ Authenticated:</strong> Contract Creator
              </div>
              <div className="status-item">
                <strong>📍 Your Address:</strong> {walletAddress}
              </div>
              <div className="status-item">
                <strong>📄 Contract:</strong> {pollsContract.getContractAddress()}
              </div>
            </div>
          </div>

          {/* Messages */}
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          {/* Tab Navigation */}
          <div className="admin-tabs">
            <button 
              className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              📊 Overview
            </button>
            <button 
              className={`tab-btn ${activeTab === "polls" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("polls");
                if (polls.length === 0) fetchPolls();
              }}
            >
              🗳️ Manage Polls
            </button>
            <button
              className={`tab-btn ${activeTab === "funding" ? "active" : ""}`}
              onClick={() => setActiveTab("funding")}
            >
              💰 Funding
            </button>
            <button
              className={`tab-btn ${activeTab === "autonomous" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("autonomous");
                fetchAutonomousStatus();
              }}
            >
              🤖 Autonomous SC
            </button>
            <button
              className={`tab-btn ${activeTab === "treasury" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("treasury");
                fetchPendingTreasuryPolls();
              }}
            >
              🏛️ Treasury Approval
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="tab-content">
              {/* Contract Information */}
              <div className="admin-section">
                <h3>📊 Contract Information</h3>
                <div className="contract-details">
                  <div className="detail-item">
                    <strong>Contract Address:</strong>
                    <span className="contract-address">{pollsContract.getContractAddress()}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Network:</strong>
                    <span>Massa Buildnet</span>
                  </div>
                  <div className="detail-item">
                    <strong>Explorer:</strong>
                    <a 
                      href={pollsContract.getExplorerUrl()}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="explorer-link"
                    >
                      View on Explorer 🔗
                    </a>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="admin-section">
                <h3>⚡ Quick Actions</h3>
                <div className="quick-actions">
                  <button 
                    className="action-btn"
                    onClick={() => window.open(pollsContract.getExplorerUrl(), '_blank')}
                  >
                    📊 View Contract on Explorer
                  </button>
                  <button 
                    className="action-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(pollsContract.getContractAddress());
                      setMessage("Contract address copied to clipboard!");
                      setTimeout(() => setMessage(""), 3000);
                    }}
                  >
                    📋 Copy Contract Address
                  </button>
                  <button 
                    className="action-btn"
                    onClick={() => setActiveTab("polls")}
                  >
                    🗳️ Manage Polls
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "polls" && (
            <div className="tab-content">
              <div className="admin-section">
                <div className="section-header">
                  <h3>🗳️ Poll Management</h3>
                  <button 
                    className="refresh-btn"
                    onClick={fetchPolls}
                    disabled={isLoadingPolls}
                  >
                    {isLoadingPolls ? "🔄 Loading..." : "🔄 Refresh Polls"}
                  </button>
                </div>

                {isLoadingPolls && (
                  <div className="loading-state">
                    <p>🔄 Loading polls from blockchain...</p>
                  </div>
                )}

                {pollsError && (
                  <div className="error-state">
                    <p>❌ {pollsError}</p>
                    <button onClick={fetchPolls}>Retry</button>
                  </div>
                )}

                {!isLoadingPolls && !pollsError && polls.length === 0 && (
                  <div className="empty-state">
                    <p>📊 No polls found on the blockchain.</p>
                  </div>
                )}

                {!isLoadingPolls && !pollsError && polls.length > 0 && (
                  <div className="polls-management">
                    <div className="polls-stats">
                      <div className="stat-item">
                        <strong>Total Polls:</strong> {polls.length}
                      </div>
                      <div className="stat-item">
                        <strong>Active:</strong> {polls.filter(p => p.isActive).length}
                      </div>
                      <div className="stat-item">
                        <strong>Ended:</strong> {polls.filter(p => !p.isActive).length}
                      </div>
                    </div>

                    <div className="polls-table">
                      <div className="table-header">
                        <div className="col-id">#</div>
                        <div className="col-title">Title</div>
                        <div className="col-status">Status</div>
                        <div className="col-votes">Votes</div>
                        <div className="col-actions">Actions</div>
                      </div>
                      
                      {polls.map(poll => (
                        <div key={poll.id} className="table-row">
                          <div className="col-id">#{poll.id}</div>
                          <div className="col-title">
                            <div className="poll-title">{poll.title}</div>
                            <div className="poll-description">{poll.description.slice(0, 50)}...</div>
                          </div>
                          <div className="col-status">
                            <span className={`status-badge ${poll.isActive ? 'active' : 'ended'}`}>
                              {poll.isActive ? '🟢 Active' : '🔴 Ended'}
                            </span>
                          </div>
                          <div className="col-votes">{poll.totalVotes}</div>
                          <div className="col-actions">
                            <button 
                              className="action-btn-small view-btn"
                              onClick={() => setSelectedPoll(poll)}
                            >
                              👁️ View
                            </button>
                            <button 
                              className="action-btn-small edit-btn"
                              onClick={() => handleEditPoll(poll)}
                            >
                              ✏️ Edit
                            </button>
                            <button 
                              className="action-btn-small close-btn"
                              onClick={() => handleClosePoll(poll)}
                              disabled={!poll.isActive}
                            >
                              🔒 Close
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "funding" && (
            <div className="tab-content">
              {/* Contract Funding */}
              <div className="admin-section">
                <h3>💰 Fund Contract</h3>
                <p className="section-description">
                  Add MASSA tokens to the contract so it can pay for storage costs when users create polls.
                  This is necessary for the contract to function properly.
                </p>
                
                <div className="funding-form">
                  <div className="form-group">
                    <label htmlFor="fundAmount">Amount (MASSA)</label>
                    <input
                      type="number"
                      id="fundAmount"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      min="0.001"
                      step="0.001"
                      placeholder="1.0"
                      disabled={isFunding}
                    />
                    <small>Recommended: 1.0 MASSA or more for multiple poll creations</small>
                  </div>

                  <button
                    className="fund-btn"
                    onClick={fundContract}
                    disabled={isFunding || !fundAmount || parseFloat(fundAmount) <= 0}
                  >
                    {isFunding ? "Funding Contract..." : `Fund Contract with ${fundAmount} MASSA`}
                  </button>
                </div>

                <div className="funding-info">
                  <h4>ℹ️ Why Fund the Contract?</h4>
                  <ul>
                    <li>Smart contracts need MASSA tokens to pay for storage costs</li>
                    <li>Each poll creation requires approximately 0.0084 MASSA for storage</li>
                    <li>Keeping the contract funded ensures smooth user experience</li>
                    <li>You can fund multiple times as needed</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Autonomous SC Tab */}
          {activeTab === "autonomous" && (
            <div className="tab-content">
              <div className="autonomous-section">
                <h2>🤖 Autonomous Smart Contract</h2>
                <p className="section-description">
                  Configure automatic reward distribution for polls with autonomous distribution type.
                  The smart contract will periodically check for ended polls and distribute rewards automatically.
                </p>

                {message && <div className="success-message">{message}</div>}
                {error && <div className="error-message">{error}</div>}

                {/* Status Section */}
                <div className="autonomous-status">
                  <h3>Status</h3>
                  <div className="status-grid">
                    <div className="status-item">
                      <span className="status-label">Autonomous Execution:</span>
                      <span className={`status-value ${autonomousEnabled ? 'enabled' : 'disabled'}`}>
                        {autonomousEnabled ? '✓ Enabled' : '✗ Disabled'}
                      </span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">Check Interval:</span>
                      <span className="status-value">{autonomousInterval} seconds ({Math.floor(autonomousInterval / 60)} minutes)</span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">Last Execution:</span>
                      <span className="status-value">
                        {lastAutonomousRun === 0 ? 'Never' : new Date(lastAutonomousRun * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Enable/Disable Section */}
                <div className="autonomous-controls">
                  <h3>Controls</h3>
                  <div className="control-group">
                    <button
                      className={`autonomous-toggle-btn ${autonomousEnabled ? 'disable' : 'enable'}`}
                      onClick={toggleAutonomous}
                      disabled={isTogglingAutonomous}
                    >
                      {isTogglingAutonomous
                        ? 'Processing...'
                        : autonomousEnabled
                          ? '❌ Disable Autonomous Execution'
                          : '✅ Enable Autonomous Execution'
                      }
                    </button>
                    <p className="control-hint">
                      {autonomousEnabled
                        ? 'Autonomous SC is currently running. Polls with autonomous distribution will be processed automatically.'
                        : 'Enable autonomous execution to automatically distribute rewards when polls end.'
                      }
                    </p>
                  </div>
                </div>

                {/* Interval Configuration */}
                <div className="autonomous-config">
                  <h3>Configuration</h3>
                  <div className="config-group">
                    <label htmlFor="autonomousInterval">Check Interval (seconds)</label>
                    <div className="interval-input-group">
                      <input
                        type="number"
                        id="autonomousInterval"
                        value={newInterval}
                        onChange={(e) => setNewInterval(e.target.value)}
                        min="60"
                        step="60"
                        placeholder="3600"
                        disabled={isUpdatingInterval}
                      />
                      <button
                        className="update-interval-btn"
                        onClick={updateInterval}
                        disabled={isUpdatingInterval || newInterval === autonomousInterval.toString()}
                      >
                        {isUpdatingInterval ? 'Updating...' : 'Update Interval'}
                      </button>
                    </div>
                    <small>Minimum: 60 seconds. Recommended: 3600 seconds (1 hour) or more to avoid high gas costs.</small>
                    <div className="interval-presets">
                      <span>Quick select:</span>
                      <button onClick={() => setNewInterval("300")}>5 min</button>
                      <button onClick={() => setNewInterval("1800")}>30 min</button>
                      <button onClick={() => setNewInterval("3600")}>1 hour</button>
                      <button onClick={() => setNewInterval("21600")}>6 hours</button>
                      <button onClick={() => setNewInterval("86400")}>24 hours</button>
                    </div>
                  </div>
                </div>

                {/* Information Section */}
                <div className="autonomous-info">
                  <h4>ℹ️ How Autonomous SC Works</h4>
                  <ul>
                    <li>The smart contract automatically checks for ended polls at the configured interval</li>
                    <li>Only polls with "Autonomous" distribution type are processed</li>
                    <li>Rewards are calculated and marked as distributed automatically</li>
                    <li>Gas costs are paid from the contract balance - ensure the contract is funded</li>
                    <li>Longer intervals reduce gas costs but may delay reward distribution</li>
                  </ul>
                </div>

                <div className="autonomous-warning">
                  <h4>⚠️ Important Notes</h4>
                  <ul>
                    <li>Keep the contract funded to ensure autonomous execution continues</li>
                    <li>Monitor the "Last Execution" timestamp to verify the system is working</li>
                    <li>You can manually trigger distribution for specific polls if needed</li>
                    <li>Disable autonomous execution during maintenance or testing</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Treasury Approval Tab */}
          {activeTab === "treasury" && (
            <div className="tab-content">
              <div className="treasury-section">
                <h2>🏛️ Treasury Poll Approval</h2>
                <p className="section-description">
                  Review and approve polls requesting treasury funding. You can approve with optional funding or reject polls that don't meet criteria.
                </p>

                {message && <div className="success-message">{message}</div>}
                {error && <div className="error-message">{error}</div>}
                {treasuryError && <div className="error-message">{treasuryError}</div>}

                <div className="pending-polls">
                  <div className="section-header">
                    <h3>Pending Treasury Polls</h3>
                    <button
                      className="refresh-btn"
                      onClick={fetchPendingTreasuryPolls}
                      disabled={isLoadingTreasury}
                    >
                      {isLoadingTreasury ? 'Loading...' : '🔄 Refresh'}
                    </button>
                  </div>

                  {isLoadingTreasury ? (
                    <div className="loading-message">Loading pending polls...</div>
                  ) : pendingTreasuryPolls.length === 0 ? (
                    <div className="no-polls-message">
                      <p>✓ No pending treasury polls awaiting approval</p>
                    </div>
                  ) : (
                    <div className="polls-grid">
                      {pendingTreasuryPolls.map((poll) => (
                        <div key={poll.id} className="treasury-poll-card">
                          <div className="poll-header">
                            <h4>{poll.title}</h4>
                            <span className="poll-id">#{poll.id}</span>
                          </div>

                          <div className="poll-description">{poll.description}</div>

                          <div className="poll-stats">
                            <div className="stat-item">
                              <span className="stat-label">Creator:</span>
                              <span className="stat-value">{poll.creator.slice(0, 10)}...{poll.creator.slice(-8)}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Options:</span>
                              <span className="stat-value">{poll.options.length} options</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Time Left:</span>
                              <span className="stat-value">{poll.timeLeft}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Votes:</span>
                              <span className="stat-value">{poll.totalVotes}</span>
                            </div>
                          </div>

                          <div className="funding-controls">
                            <div className="funding-input-group">
                              <label htmlFor={`funding-${poll.id}`}>Optional Funding (MASSA)</label>
                              <input
                                type="number"
                                id={`funding-${poll.id}`}
                                value={fundingAmounts[poll.id] || ""}
                                onChange={(e) => setFundingAmounts(prev => ({
                                  ...prev,
                                  [poll.id]: e.target.value
                                }))}
                                placeholder="0.00"
                                min="0"
                                step="0.001"
                                disabled={isApprovingPoll[poll.id] || isRejectingPoll[poll.id]}
                              />
                              <small>Leave empty to approve without funding</small>
                            </div>

                            <div className="action-buttons">
                              <button
                                className="approve-btn"
                                onClick={() => approvePoll(poll.id)}
                                disabled={isApprovingPoll[poll.id] || isRejectingPoll[poll.id]}
                              >
                                {isApprovingPoll[poll.id] ? 'Approving...' : '✓ Approve'}
                              </button>
                              <button
                                className="reject-btn"
                                onClick={() => rejectPoll(poll.id)}
                                disabled={isApprovingPoll[poll.id] || isRejectingPoll[poll.id]}
                              >
                                {isRejectingPoll[poll.id] ? 'Rejecting...' : '✗ Reject & Close'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="treasury-info">
                  <h4>ℹ️ Treasury Approval Process</h4>
                  <ul>
                    <li>Only polls with "Treasury-Funded" funding type appear here</li>
                    <li>Approving a poll allows it to receive treasury funding and be visible to voters</li>
                    <li>You can optionally fund the poll when approving by entering an amount</li>
                    <li>Rejecting a poll will close it and prevent any further activity</li>
                    <li>Make sure to review poll content and creator before approving</li>
                  </ul>
                </div>

                <div className="treasury-warning">
                  <h4>⚠️ Best Practices</h4>
                  <ul>
                    <li>Verify poll content aligns with community guidelines</li>
                    <li>Check that the poll creator has a good track record</li>
                    <li>Consider funding polls that benefit the community</li>
                    <li>Rejected polls cannot be reopened - make sure before rejecting</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Poll Detail Modal */}
        {selectedPoll && (
          <div className="modal-overlay" onClick={() => setSelectedPoll(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Poll Details: #{selectedPoll.id}</h3>
                <button className="close-btn" onClick={() => setSelectedPoll(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="poll-detail-info">
                  <h4>{selectedPoll.title}</h4>
                  <p>{selectedPoll.description}</p>
                  <div className="poll-meta">
                    <div><strong>Status:</strong> {selectedPoll.isActive ? 'Active' : 'Ended'}</div>
                    <div><strong>Total Votes:</strong> {selectedPoll.totalVotes}</div>
                    <div><strong>Creator:</strong> {selectedPoll.creator}</div>
                  </div>
                  <div className="poll-options">
                    <h5>Options & Votes:</h5>
                    {selectedPoll.options.map((option, index) => (
                      <div key={index} className="option-result">
                        <span>{option}: {selectedPoll.votes[index]} votes</span>
                        <div className="vote-bar">
                          <div 
                            className="vote-progress"
                            style={{ 
                              width: selectedPoll.totalVotes > 0 
                                ? `${(selectedPoll.votes[index] / selectedPoll.totalVotes) * 100}%` 
                                : '0%' 
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Poll Modal */}
        {showEditModal && editingPoll && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit Poll: #{editingPoll.id}</h3>
                <button className="close-btn" onClick={() => setShowEditModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="edit-poll-form">
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      value={editingPoll.title}
                      onChange={(e) => setEditingPoll({...editingPoll, title: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={editingPoll.description}
                      onChange={(e) => setEditingPoll({...editingPoll, description: e.target.value})}
                      rows={3}
                    />
                  </div>
                  <div className="notice">
                    <p>ℹ️ Note: Only the title and description can be updated. Poll options cannot be changed once created.</p>
                  </div>
                  <div className="modal-actions">
                    <button className="save-btn" onClick={saveEditedPoll}>Save Changes</button>
                    <button className="cancel-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Close Confirmation Modal */}
        {showCloseModal && pollToClose && (
          <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Close Poll: #{pollToClose.id}</h3>
                <button className="close-btn" onClick={() => setShowCloseModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="close-confirmation">
                  <p>Are you sure you want to close this poll?</p>
                  <div className="poll-info">
                    <strong>{pollToClose.title}</strong>
                    <p>{pollToClose.description}</p>
                  </div>
                  <div className="notice">
                    <p>⚠️ Closing a poll will prevent new votes from being cast. This action cannot be undone.</p>
                  </div>
                  <div className="modal-actions">
                    <button className="close-confirm-btn" onClick={confirmClosePoll}>Close Poll</button>
                    <button className="cancel-btn" onClick={() => setShowCloseModal(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;