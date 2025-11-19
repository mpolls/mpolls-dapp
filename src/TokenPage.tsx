import { useState, useEffect } from 'react';
import { TokenContract, TokenInfo } from './utils/tokenContract';
import { useToast } from './components/ToastContainer';
import SendIcon from '@mui/icons-material/Send';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import './TokenPage.css';

// Create token contract instance (will get address from env)
const tokenContractAddress = import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS || '';
const tokenContract = tokenContractAddress ? new TokenContract(tokenContractAddress) : null;

interface TokenPageProps {
  onBack: () => void;
  isWalletConnected?: boolean;
  walletAddress?: string | null;
  onNavigateToSwap?: () => void;
}

const TokenPage: React.FC<TokenPageProps> = ({ onBack, isWalletConnected = false, walletAddress = null, onNavigateToSwap }) => {
  const toast = useToast();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isMinter, setIsMinter] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [mintTo, setMintTo] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [burnAmount, setBurnAmount] = useState('');
  const [grantMinterAddress, setGrantMinterAddress] = useState('');
  const [buyMassaAmount, setBuyMassaAmount] = useState('1');

  // Exchange rate constant
  const EXCHANGE_RATE = 100; // 1 MASSA = 100 MPOLLS

  useEffect(() => {
    if (tokenContract) {
      fetchTokenInfo();
    }
  }, []);

  useEffect(() => {
    const syncWallet = async () => {
      if (isWalletConnected && walletAddress && tokenContract) {
        // Sync wallet connection from the global wallet state
        await tokenContract.syncWalletConnection();
        refreshBalance();
        checkMinterStatus();
      }
    };
    syncWallet();
  }, [isWalletConnected, walletAddress]);

  const fetchTokenInfo = async () => {
    if (!tokenContract) return;

    try {
      const info = await tokenContract.getTokenInfo();
      setTokenInfo(info);
    } catch (error) {
      console.error('Error fetching token info:', error);
    }
  };

  const refreshBalance = async () => {
    if (!tokenContract || !isWalletConnected) return;

    try {
      const bal = await tokenContract.getMyBalance();
      setBalance(bal);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const checkMinterStatus = async () => {
    if (!tokenContract || !walletAddress) return;

    try {
      const minterStatus = await tokenContract.isMinter(walletAddress);
      setIsMinter(minterStatus);
    } catch (error) {
      console.error('Error checking minter status:', error);
    }
  };

  const handleMint = async () => {
    if (!tokenContract) {
      toast.error('Token contract not initialized');
      return;
    }

    if (!mintTo || !mintAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!isMinter) {
      toast.error('You do not have minter role');
      return;
    }

    setLoading(true);
    try {
      const amountInSmallestUnit = tokenContract.parseTokenAmount(mintAmount, tokenInfo?.decimals || 9);
      await tokenContract.mint(mintTo, amountInSmallestUnit);
      toast.success(`Successfully minted ${mintAmount} MPOLLS tokens!`);
      setMintTo('');
      setMintAmount('');
      await refreshBalance();
      await fetchTokenInfo();
    } catch (error) {
      console.error('Error minting tokens:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to mint tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyTokens = async () => {
    if (!tokenContract) {
      toast.error('Token contract not initialized');
      return;
    }

    const massaAmount = parseFloat(buyMassaAmount);
    if (!massaAmount || massaAmount <= 0) {
      toast.error('Please enter a valid MASSA amount');
      return;
    }

    setLoading(true);
    try {
      await tokenContract.buyTokens(massaAmount);
      const tokensReceived = massaAmount * EXCHANGE_RATE;
      toast.success(`Successfully purchased ${tokensReceived} MPOLLS tokens for ${massaAmount} MASSA!`);
      setBuyMassaAmount('1'); // Reset to default
      await refreshBalance();
      await fetchTokenInfo();
    } catch (error) {
      console.error('Error buying tokens:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to buy tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!tokenContract) {
      toast.error('Token contract not initialized');
      return;
    }

    if (!transferTo || !transferAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const amountInSmallestUnit = tokenContract.parseTokenAmount(transferAmount, tokenInfo?.decimals || 9);
      await tokenContract.transfer(transferTo, amountInSmallestUnit);
      toast.success(`Successfully transferred ${transferAmount} MPOLLS tokens!`);
      setTransferTo('');
      setTransferAmount('');
      await refreshBalance();
    } catch (error) {
      console.error('Error transferring tokens:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to transfer tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleBurn = async () => {
    if (!tokenContract) {
      toast.error('Token contract not initialized');
      return;
    }

    if (!burnAmount) {
      toast.error('Please enter an amount to burn');
      return;
    }

    setLoading(true);
    try {
      const amountInSmallestUnit = tokenContract.parseTokenAmount(burnAmount, tokenInfo?.decimals || 9);
      await tokenContract.burn(amountInSmallestUnit);
      toast.success(`Successfully burned ${burnAmount} MPOLLS tokens!`);
      setBurnAmount('');
      await refreshBalance();
      await fetchTokenInfo();
    } catch (error) {
      console.error('Error burning tokens:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to burn tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleGrantMinterRole = async () => {
    if (!tokenContract) {
      toast.error('Token contract not initialized');
      return;
    }

    if (!grantMinterAddress) {
      toast.error('Please enter an address');
      return;
    }

    setLoading(true);
    try {
      await tokenContract.grantMinterRole(grantMinterAddress);
      toast.success(`Successfully granted minter role to ${grantMinterAddress}`);
      setGrantMinterAddress('');
    } catch (error) {
      console.error('Error granting minter role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to grant minter role');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const formatBalance = () => {
    if (!tokenInfo) return '0';
    return tokenContract?.formatTokenAmount(balance, tokenInfo.decimals) || '0';
  };

  const formatTotalSupply = () => {
    if (!tokenInfo) return '0';
    return tokenContract?.formatTokenAmount(tokenInfo.totalSupply, tokenInfo.decimals) || '0';
  };

  if (!tokenContract) {
    return (
      <div className="token-page">
        <div className="token-container">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <div className="error-message">
            <h2>Token Contract Not Configured</h2>
            <p>Please set VITE_TOKEN_CONTRACT_ADDRESS in your .env.local file</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="token-page">
      <div className="token-container">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>

        <div className="token-header">
          <h1>🪙 MPOLLS Token Manager</h1>
          <p className="token-subtitle">Mint and manage MPOLLS reward tokens</p>
          {!isWalletConnected && (
            <p className="wallet-connect-hint">Please connect your wallet using the header button to manage tokens</p>
          )}
        </div>

        {/* Token Info */}
        {isWalletConnected && tokenInfo && (
          <div className="token-info-section card">
            <div className="section-header">
              <h2>Token Information</h2>
              <button
                className="refresh-btn"
                onClick={() => {
                  refreshBalance();
                  fetchTokenInfo();
                }}
                disabled={loading}
              >
                <RefreshIcon sx={{ fontSize: 20 }} />
              </button>
            </div>
            <div className="token-stats">
              <div className="stat-item">
                <span className="stat-label">Token Name</span>
                <span className="stat-value">{tokenInfo.name}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Symbol</span>
                <span className="stat-value">{tokenInfo.symbol}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Your Balance</span>
                <span className="stat-value highlight">{formatBalance()} {tokenInfo.symbol}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Supply</span>
                <span className="stat-value">{formatTotalSupply()} {tokenInfo.symbol}</span>
              </div>
            </div>
          </div>
        )}

        {/* Swap Tokens Section */}
        {isWalletConnected && (
          <div className="action-section card buy-tokens-section">
            <h2>
              💱 Swap Tokens
            </h2>
            <p className="section-description">Trade MASSA and MPOLLS tokens via the decentralized swap pool</p>

            <div className="exchange-rate-banner">
              <strong>Note:</strong> The swap uses an AMM pool with 2.5% spread
            </div>

            <div className="swap-info-box">
              <p>Use the Swap page to trade MASSA for MPOLLS or vice versa using our decentralized AMM liquidity pool.</p>
              <ul>
                <li>✓ Trade in both directions (MASSA ↔ MPOLLS)</li>
                <li>✓ Real-time pricing based on liquidity</li>
                <li>✓ Transparent 2.5% spread</li>
                <li>✓ No intermediaries needed</li>
              </ul>
            </div>

            <button
              className="action-button buy-button"
              onClick={() => {
                if (onNavigateToSwap) {
                  onNavigateToSwap();
                }
              }}
            >
              Open Swap Page
            </button>
          </div>
        )}

        {/* Mint Section */}
        {isWalletConnected && isMinter && (
          <div className="action-section card">
            <h2>
              <AddCircleIcon /> Mint Tokens
            </h2>
            <p className="section-description">Create new MPOLLS tokens and send to an address</p>
            <div className="form-group">
              <label>Recipient Address</label>
              <input
                type="text"
                placeholder="AU..."
                value={mintTo}
                onChange={(e) => setMintTo(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Amount (MPOLLS)</label>
              <input
                type="number"
                placeholder="100"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                disabled={loading}
                step="0.000000001"
                min="0"
              />
            </div>
            <button
              className="action-btn mint-btn"
              onClick={handleMint}
              disabled={loading || !mintTo || !mintAmount}
            >
              {loading ? 'Minting...' : 'Mint Tokens'}
            </button>
          </div>
        )}

        {/* Transfer Section */}
        {isWalletConnected && (
          <div className="action-section card">
            <h2>
              <SendIcon /> Transfer Tokens
            </h2>
            <p className="section-description">Send your MPOLLS tokens to another address</p>
            <div className="form-group">
              <label>Recipient Address</label>
              <input
                type="text"
                placeholder="AU..."
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Amount (MPOLLS)</label>
              <input
                type="number"
                placeholder="10"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                disabled={loading}
                step="0.000000001"
                min="0"
              />
            </div>
            <button
              className="action-btn transfer-btn"
              onClick={handleTransfer}
              disabled={loading || !transferTo || !transferAmount}
            >
              {loading ? 'Transferring...' : 'Transfer Tokens'}
            </button>
          </div>
        )}

        {/* Burn Section */}
        {isWalletConnected && (
          <div className="action-section card">
            <h2>
              <LocalFireDepartmentIcon /> Burn Tokens
            </h2>
            <p className="section-description">Permanently remove tokens from circulation</p>
            <div className="form-group">
              <label>Amount to Burn (MPOLLS)</label>
              <input
                type="number"
                placeholder="10"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                disabled={loading}
                step="0.000000001"
                min="0"
              />
            </div>
            <button
              className="action-btn burn-btn"
              onClick={handleBurn}
              disabled={loading || !burnAmount}
            >
              {loading ? 'Burning...' : 'Burn Tokens'}
            </button>
          </div>
        )}

        {/* Grant Minter Role (Owner only) */}
        {isWalletConnected && (
          <div className="action-section card">
            <h2>👑 Grant Minter Role</h2>
            <p className="section-description">Grant minting permission to an address (Owner only)</p>
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                placeholder="AU... or contract address"
                value={grantMinterAddress}
                onChange={(e) => setGrantMinterAddress(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              className="action-btn grant-btn"
              onClick={handleGrantMinterRole}
              disabled={loading || !grantMinterAddress}
            >
              {loading ? 'Granting...' : 'Grant Minter Role'}
            </button>
          </div>
        )}

        {/* Contract Info */}
        <div className="contract-info card">
          <h3>Contract Information</h3>
          <div className="info-row">
            <span className="label">Contract Address:</span>
            <span className="value address-value">
              {tokenContract.getContractAddress()}
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(tokenContract.getContractAddress())}
                title="Copy contract address"
              >
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </button>
            </span>
          </div>
          <div className="info-row">
            <span className="label">Network:</span>
            <span className="value">Massa Buildnet</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenPage;
