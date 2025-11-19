import { useState, useEffect } from 'react';
import { pollsContract } from '../utils/contractInteraction';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

interface PollFundingProps {
  pollId: string;
  fundingType: number; // 0=SELF_FUNDED, 1=COMMUNITY_FUNDED, 2=TREASURY_FUNDED
  fundingGoal: number; // In MASSA
  currentPool: number; // In MASSA
  isActive: boolean;
  creator: string;
}

const PollFunding = ({
  pollId,
  fundingType,
  fundingGoal,
  currentPool,
  isActive,
  creator
}: PollFundingProps) => {
  const [amount, setAmount] = useState<string>('');
  const [isFunding, setIsFunding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [poolBalance, setPoolBalance] = useState(currentPool);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    checkWalletConnection();
    loadPoolBalance();
  }, [pollId]);

  const checkWalletConnection = async () => {
    const connected = await pollsContract.isWalletConnected();
    setIsWalletConnected(connected);
    if (connected) {
      const address = await pollsContract.getWalletAddress();
      setWalletAddress(address || '');
    }
  };

  const loadPoolBalance = async () => {
    try {
      const balance = await pollsContract.getPoolBalance(pollId);
      setPoolBalance(balance);
    } catch (err) {
      console.error('Error loading pool balance:', err);
    }
  };

  const fundPoll = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!isWalletConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsFunding(true);
    setError('');
    setSuccess('');

    try {
      const amountInMassa = parseFloat(amount);
      await pollsContract.fundPoll(pollId, amountInMassa);

      setSuccess(`Successfully funded poll with ${amountInMassa} MASSA!`);
      setAmount('');

      // Reload pool balance
      setTimeout(() => {
        loadPoolBalance();
      }, 3000);
    } catch (err) {
      console.error('Error funding poll:', err);
      setError(err instanceof Error ? err.message : 'Failed to fund poll');
    } finally {
      setIsFunding(false);
    }
  };

  const getFundingTypeLabel = () => {
    switch (fundingType) {
      case 0: return 'Self-Funded';
      case 1: return 'Community-Funded';
      case 2: return 'Treasury-Funded';
      default: return 'Unknown';
    }
  };

  const getFundingTypeDescription = () => {
    switch (fundingType) {
      case 0: return 'Only the creator can fund this poll';
      case 1: return 'Anyone can contribute to this poll';
      case 2: return 'Requires admin approval for funding';
      default: return '';
    }
  };

  const canFund = () => {
    if (!isActive) return false;
    if (fundingType === 2) return false; // Treasury-funded can't be funded by users
    if (fundingType === 0) {
      // Self-funded: only creator can fund
      return walletAddress === creator;
    }
    // Community-funded: anyone can fund
    return true;
  };

  const fundingProgress = fundingGoal > 0 ? (poolBalance / fundingGoal) * 100 : 0;

  return (
    <div className="poll-funding">
      <div className="funding-header">
        <h3>
          <AttachMoneyIcon sx={{ fontSize: 22, marginRight: 0.5, verticalAlign: 'middle' }} />
          Reward Pool
        </h3>
        <span className="funding-type-badge">{getFundingTypeLabel()}</span>
      </div>

      <div className="funding-info">
        <div className="pool-balance">
          <AccountBalanceWalletIcon sx={{ fontSize: 20, marginRight: 0.5 }} />
          <div>
            <div className="balance-label">Current Pool</div>
            <div className="balance-amount">{poolBalance.toFixed(4)} MASSA</div>
          </div>
        </div>

        {fundingType === 1 && fundingGoal > 0 && (
          <div className="funding-goal">
            <PeopleIcon sx={{ fontSize: 20, marginRight: 0.5 }} />
            <div>
              <div className="goal-label">Funding Goal</div>
              <div className="goal-amount">{fundingGoal.toFixed(4)} MASSA</div>
            </div>
          </div>
        )}
      </div>

      {fundingType === 1 && fundingGoal > 0 && (
        <div className="funding-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(fundingProgress, 100)}%` }}
            />
          </div>
          <div className="progress-text">
            {fundingProgress.toFixed(1)}% funded ({poolBalance.toFixed(2)} / {fundingGoal.toFixed(2)} MASSA)
          </div>
        </div>
      )}

      <p className="funding-description">{getFundingTypeDescription()}</p>

      {canFund() && (
        <div className="funding-actions">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="funding-input-group">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount in MASSA"
              min="0"
              step="0.001"
              disabled={isFunding}
            />
            <button
              onClick={fundPoll}
              disabled={isFunding || !isWalletConnected || !amount}
              className="fund-button"
            >
              {isFunding ? 'Funding...' : 'Fund Poll'}
            </button>
          </div>

          {fundingType === 0 && (
            <small className="funding-hint">
              As the creator, you can add more funds to the reward pool anytime
            </small>
          )}
          {fundingType === 1 && (
            <small className="funding-hint">
              Help fund this poll - all contributions go to the reward pool
            </small>
          )}
        </div>
      )}

      {!isActive && poolBalance > 0 && (
        <div className="funding-ended">
          <p>Poll has ended. Rewards are being distributed to voters.</p>
        </div>
      )}

      {fundingType === 2 && (
        <div className="treasury-notice">
          <p>This poll is treasury-funded and awaiting admin approval.</p>
        </div>
      )}
    </div>
  );
};

export default PollFunding;
