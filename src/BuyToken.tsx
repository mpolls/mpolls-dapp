import React, { useState, useEffect } from 'react';
import { pollsContract } from './utils/contractInteraction';
import { parseBlockchainError, logError } from './utils/errorHandling';

interface BuyTokenProps {
  onBack: () => void;
}

const BuyToken: React.FC<BuyTokenProps> = ({ onBack }) => {
  const [massaAmount, setMassaAmount] = useState<number>(1);
  const [isBuying, setIsBuying] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Exchange rate: 1 MASSA = 100 MPOLLS
  const EXCHANGE_RATE = 100;

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    const connected = await pollsContract.isWalletConnected();
    setIsWalletConnected(connected);
    if (connected) {
      loadTokenBalance();
    }
  };

  const loadTokenBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const balance = await pollsContract.getMyTokenBalance();
      setTokenBalance(balance);
    } catch (err) {
      console.error('Error loading token balance:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const buyTokens = async () => {
    setError('');
    setSuccess('');

    if (!isWalletConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (massaAmount <= 0) {
      setError('Please enter a valid amount of MASSA');
      return;
    }

    setIsBuying(true);

    try {
      const tokensReceived = massaAmount * EXCHANGE_RATE;

      await pollsContract.buyTokens(massaAmount);

      setSuccess(`Successfully purchased ${tokensReceived} MPOLLS tokens for ${massaAmount} MASSA!`);
      setMassaAmount(1); // Reset to default

      // Reload balance after purchase
      setTimeout(() => {
        loadTokenBalance();
      }, 3000);

    } catch (err) {
      logError(err, { action: 'buying tokens' });
      const friendlyError = parseBlockchainError(err, { action: 'buying tokens' });
      setError(`${friendlyError.message} ${friendlyError.suggestion}`);
    } finally {
      setIsBuying(false);
    }
  };

  const calculateTokenAmount = () => {
    return massaAmount * EXCHANGE_RATE;
  };

  return (
    <div className="buy-token-page">
      <div className="buy-token-container">
        <div className="page-header">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <h1>Buy MPOLLS Tokens</h1>
          <p className="page-subtitle">Purchase MPOLLS tokens to fund poll rewards</p>
        </div>

        {!isWalletConnected && (
          <div className="wallet-notice">
            <p>Please connect your wallet using the "Connect Wallet" button in the header to buy tokens.</p>
          </div>
        )}

        {isWalletConnected && (
          <>
            {/* Token Balance Card */}
            <div className="balance-card">
              <h3>Your MPOLLS Balance</h3>
              <div className="balance-amount">
                {isLoadingBalance ? (
                  <span className="loading-text">Loading...</span>
                ) : (
                  <span className="balance-value">{tokenBalance.toLocaleString()} MPOLLS</span>
                )}
              </div>
              <button
                className="refresh-btn"
                onClick={loadTokenBalance}
                disabled={isLoadingBalance}
              >
                {isLoadingBalance ? 'Refreshing...' : 'Refresh Balance'}
              </button>
            </div>

            {/* Buy Form */}
            <div className="buy-form-card">
              <h2>Purchase Tokens</h2>

              <div className="exchange-rate-info">
                <p>Exchange Rate: <strong>1 MASSA = {EXCHANGE_RATE} MPOLLS</strong></p>
              </div>

              <div className="form-group">
                <label htmlFor="massaAmount">MASSA Amount</label>
                <input
                  type="number"
                  id="massaAmount"
                  value={massaAmount}
                  onChange={(e) => setMassaAmount(parseFloat(e.target.value) || 0)}
                  min="0.001"
                  step="0.001"
                  placeholder="Enter MASSA amount"
                />
                <small>Minimum: 0.001 MASSA</small>
              </div>

              <div className="conversion-preview">
                <div className="conversion-arrow">↓</div>
                <div className="token-amount">
                  <span className="label">You will receive:</span>
                  <span className="amount">{calculateTokenAmount().toLocaleString()} MPOLLS</span>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {success && (
                <div className="success-message">
                  {success}
                </div>
              )}

              <button
                className="buy-button"
                onClick={buyTokens}
                disabled={isBuying || !isWalletConnected || massaAmount <= 0}
              >
                {isBuying ? 'Processing Purchase...' : `Buy ${calculateTokenAmount()} MPOLLS Tokens`}
              </button>

              <div className="info-section">
                <h3>How it works</h3>
                <ol>
                  <li>Enter the amount of MASSA you want to spend</li>
                  <li>Review the MPOLLS tokens you'll receive</li>
                  <li>Click "Buy" to complete the transaction</li>
                  <li>Tokens will be added to your wallet immediately</li>
                </ol>
              </div>

              <div className="use-case-section">
                <h3>Use MPOLLS Tokens For:</h3>
                <ul>
                  <li>💰 Funding poll reward pools</li>
                  <li>🎁 Rewarding poll respondents</li>
                  <li>🚀 Incentivizing feedback collection</li>
                  <li>📊 Building engaged communities</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BuyToken;
