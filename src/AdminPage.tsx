import { useState, useEffect } from "react";
import { pollsContract } from "./utils/contractInteraction";

interface AdminPageProps {
  onBack: () => void;
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

  useEffect(() => {
    checkAdminAccess();
  }, []);

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

          {/* Messages */}
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;