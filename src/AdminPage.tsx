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
  const [activeTab, setActiveTab] = useState<"overview" | "polls" | "funding">("overview");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);
  const [pollsError, setPollsError] = useState("");
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [pollToClose, setPollToClose] = useState<Poll | null>(null);

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
          status: contractPoll.status
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