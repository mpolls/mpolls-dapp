import React, { useState, useEffect } from 'react';
import { swapContract } from './utils/swapContract';
import { pollsContract } from './utils/contractInteraction';
import { parseBlockchainError, logError } from './utils/errorHandling';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import './SwapPage.css';

interface SwapPageProps {
  onBack: () => void;
}

type SwapDirection = 'massa-to-mpolls' | 'mpolls-to-massa';

const SwapPage: React.FC<SwapPageProps> = ({ onBack }) => {
  const [swapDirection, setSwapDirection] = useState<SwapDirection>('massa-to-mpolls');
  const [inputAmount, setInputAmount] = useState<number>(1);
  const [outputAmount, setOutputAmount] = useState<number>(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [massaReserve, setMassaReserve] = useState<number>(0);
  const [mpollsReserve, setMpollsReserve] = useState<number>(0);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  const SPREAD_PERCENTAGE = 2.5;

  useEffect(() => {
    checkWalletConnection();
    loadPoolReserves();
  }, []);

  useEffect(() => {
    // Calculate quote when input amount or direction changes
    if (inputAmount > 0) {
      calculateQuote();
    } else {
      setOutputAmount(0);
    }
  }, [inputAmount, swapDirection]);

  const checkWalletConnection = async () => {
    const connected = await pollsContract.isWalletConnected();
    setIsWalletConnected(connected);
    if (connected) {
      // Sync wallet connection to swap contract
      await swapContract.syncWalletConnection();
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

  const loadPoolReserves = async () => {
    try {
      const reserves = await swapContract.getReserves();
      setMassaReserve(Number(reserves.massaReserve) / 1_000_000_000);
      setMpollsReserve(Number(reserves.mpollsReserve) / 1_000_000_000);
    } catch (err) {
      console.error('Error loading pool reserves:', err);
    }
  };

  const calculateQuote = async () => {
    setIsLoadingQuote(true);
    try {
      if (swapDirection === 'massa-to-mpolls') {
        const quote = await swapContract.getQuoteMassaToMpolls(inputAmount);
        setOutputAmount(quote);
      } else {
        const quote = await swapContract.getQuoteMpollsToMassa(inputAmount);
        setOutputAmount(quote);
      }
    } catch (err) {
      console.error('Error calculating quote:', err);
      setOutputAmount(0);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const executeSwap = async () => {
    setError('');
    setSuccess('');

    if (!isWalletConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (inputAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (swapDirection === 'mpolls-to-massa' && inputAmount > tokenBalance) {
      setError('Insufficient MPOLLS balance');
      return;
    }

    setIsSwapping(true);

    try {
      if (swapDirection === 'massa-to-mpolls') {
        await swapContract.swapMassaForMpolls(inputAmount);
        setSuccess(`Successfully swapped ${inputAmount} MASSA for ${outputAmount.toFixed(2)} MPOLLS!`);
      } else {
        await swapContract.swapMpollsForMassa(inputAmount);
        setSuccess(`Successfully swapped ${inputAmount} MPOLLS for ${outputAmount.toFixed(2)} MASSA!`);
      }

      setInputAmount(1);
      setOutputAmount(0);

      // Reload balances and reserves after swap
      setTimeout(() => {
        loadTokenBalance();
        loadPoolReserves();
      }, 3000);

    } catch (err) {
      logError(err, { action: 'swapping tokens' });
      const friendlyError = parseBlockchainError(err, { action: 'swapping tokens' });
      setError(`${friendlyError.message} ${friendlyError.suggestion}`);
    } finally {
      setIsSwapping(false);
    }
  };

  const switchDirection = () => {
    setSwapDirection(prev =>
      prev === 'massa-to-mpolls' ? 'mpolls-to-massa' : 'massa-to-mpolls'
    );
    setInputAmount(1);
    setOutputAmount(0);
  };

  const getInputLabel = () => swapDirection === 'massa-to-mpolls' ? 'MASSA' : 'MPOLLS';
  const getOutputLabel = () => swapDirection === 'massa-to-mpolls' ? 'MPOLLS' : 'MASSA';

  const getPriceImpact = () => {
    if (massaReserve === 0 || mpollsReserve === 0 || inputAmount === 0) return 0;

    const currentPrice = mpollsReserve / massaReserve;
    const effectivePrice = swapDirection === 'massa-to-mpolls'
      ? outputAmount / inputAmount
      : inputAmount / outputAmount;

    const priceImpact = swapDirection === 'massa-to-mpolls'
      ? ((currentPrice - effectivePrice) / currentPrice) * 100
      : ((effectivePrice - currentPrice) / currentPrice) * 100;

    return Math.abs(priceImpact);
  };

  return (
    <div className="swap-page">
      <div className="swap-container">
        <div className="page-header">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <h1>Swap Tokens</h1>
          <p className="page-subtitle">Trade MASSA and MPOLLS tokens with 2.5% spread</p>
        </div>

        {!isWalletConnected && (
          <div className="wallet-notice">
            <p>Please connect your wallet using the "Connect Wallet" button in the header to swap tokens.</p>
          </div>
        )}

        {isWalletConnected && (
          <>
            {/* Pool Info Card */}
            <div className="pool-info-card">
              <h3>Liquidity Pool</h3>
              <div className="pool-stats">
                <div className="pool-stat">
                  <span className="stat-label">MASSA Reserve:</span>
                  <span className="stat-value">{massaReserve.toLocaleString()}</span>
                </div>
                <div className="pool-stat">
                  <span className="stat-label">MPOLLS Reserve:</span>
                  <span className="stat-value">{mpollsReserve.toLocaleString()}</span>
                </div>
                <div className="pool-stat">
                  <span className="stat-label">Current Rate:</span>
                  <span className="stat-value">
                    {massaReserve > 0 ? `1 MASSA ≈ ${(mpollsReserve / massaReserve).toFixed(2)} MPOLLS` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance Card */}
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

            {/* Swap Form */}
            <div className="swap-form-card">
              <h2>Swap Tokens</h2>

              <div className="swap-info">
                <p><TrendingUpIcon sx={{ fontSize: 16, verticalAlign: 'middle' }} /> Spread: <strong>{SPREAD_PERCENTAGE}%</strong></p>
                <p>Formula: Constant Product AMM (x × y = k)</p>
              </div>

              {/* Input Section */}
              <div className="swap-input-section">
                <div className="form-group">
                  <label htmlFor="inputAmount">From: {getInputLabel()}</label>
                  <input
                    type="number"
                    id="inputAmount"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(parseFloat(e.target.value) || 0)}
                    min="0.001"
                    step="0.001"
                    placeholder={`Enter ${getInputLabel()} amount`}
                  />
                  <small>Minimum: 0.001 {getInputLabel()}</small>
                </div>

                {/* Switch Button */}
                <div className="swap-direction-switch">
                  <button
                    className="switch-btn"
                    onClick={switchDirection}
                    disabled={isSwapping}
                  >
                    <SwapHorizIcon sx={{ fontSize: 32 }} />
                  </button>
                </div>

                {/* Output Section */}
                <div className="form-group">
                  <label htmlFor="outputAmount">To: {getOutputLabel()}</label>
                  <input
                    type="number"
                    id="outputAmount"
                    value={outputAmount.toFixed(6)}
                    readOnly
                    placeholder="0.000000"
                    className="output-display"
                  />
                  {isLoadingQuote && <small className="loading-text">Calculating...</small>}
                </div>
              </div>

              {/* Price Impact */}
              {inputAmount > 0 && outputAmount > 0 && (
                <div className="price-impact">
                  <span>Price Impact:</span>
                  <span className={getPriceImpact() > 5 ? 'impact-high' : 'impact-low'}>
                    {getPriceImpact().toFixed(2)}%
                  </span>
                </div>
              )}

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
                className="swap-button"
                onClick={executeSwap}
                disabled={isSwapping || !isWalletConnected || inputAmount <= 0 || outputAmount <= 0}
              >
                {isSwapping ? 'Processing Swap...' : `Swap ${inputAmount} ${getInputLabel()} for ${outputAmount.toFixed(2)} ${getOutputLabel()}`}
              </button>

              <div className="info-section">
                <h3>How it works</h3>
                <ol>
                  <li>Select swap direction (MASSA → MPOLLS or MPOLLS → MASSA)</li>
                  <li>Enter the amount you want to swap</li>
                  <li>Review the output amount and price impact</li>
                  <li>Click "Swap" to execute the transaction</li>
                  <li>Tokens will be swapped instantly via the liquidity pool</li>
                </ol>
              </div>

              <div className="use-case-section">
                <h3>Why Use the Swap?</h3>
                <ul>
                  <li>💱 Decentralized token exchange</li>
                  <li>⚡ Instant swaps via AMM liquidity pool</li>
                  <li>📊 Transparent pricing with 2.5% spread</li>
                  <li>🔒 No intermediaries, fully on-chain</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SwapPage;
