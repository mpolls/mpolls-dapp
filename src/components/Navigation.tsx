import React, { useState, useEffect, useRef } from 'react';
import { MassaLogo } from "@massalabs/react-ui-kit";
import HomeIcon from '@mui/icons-material/Home';
import PollIcon from '@mui/icons-material/Poll';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderIcon from '@mui/icons-material/Folder';
import TokenIcon from '@mui/icons-material/Token';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LogoutIcon from '@mui/icons-material/Logout';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { pollsContract } from '../utils/contractInteraction';

interface NavigationProps {
  onNavigate: (page: 'home' | 'polls' | 'create' | 'admin' | 'projects' | 'token' | 'swap') => void;
  currentPage: 'home' | 'polls' | 'create' | 'admin' | 'projects' | 'token' | 'swap';
  onScrollToSection?: (sectionId: string) => void;
  onWalletConnect?: (address: string, name: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ onNavigate, currentPage, onScrollToSection, onWalletConnect }) => {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletName, setWalletName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check wallet connection on mount
  useEffect(() => {
    checkWalletConnection();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const checkWalletConnection = async () => {
    try {
      const connected = await pollsContract.isWalletConnected();
      setIsWalletConnected(connected);

      if (connected) {
        const address = await pollsContract.getWalletAddress();
        const name = pollsContract.getWalletName();
        setWalletAddress(address || '');
        setWalletName(name || '');
      }
    } catch (err) {
      console.error('Error checking wallet connection:', err);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      await pollsContract.connectWallet();
      const connected = await pollsContract.isWalletConnected();
      setIsWalletConnected(connected);

      if (connected) {
        const address = await pollsContract.getWalletAddress();
        const name = pollsContract.getWalletName();
        setWalletAddress(address || '');
        setWalletName(name || '');

        // Notify parent component if callback provided
        if (onWalletConnect && address) {
          onWalletConnect(address, name || '');
        }
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setIsWalletConnected(false);
    setWalletAddress('');
    setWalletName('');
    setShowDropdown(false);
    // Note: Actual wallet disconnection would need to be implemented in the wallet provider
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const copyAddressToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setIsCopied(true);

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleNavClick = (action: string) => {
    if (currentPage === 'home' && onScrollToSection) {
      // If we're on home page, scroll to section
      onScrollToSection(action);
    } else {
      // If we're on other pages, navigate to home first
      onNavigate('home');
      // Then scroll to section after a brief delay
      setTimeout(() => {
        const element = document.getElementById(action);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  return (
    <>
      {/* Header Navigation */}
      <nav className="header-nav">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => onNavigate('home')}>
            <MassaLogo className="nav-logo-icon" size={32} />
            <span className="nav-brand-name">Massa Polls</span>
          </div>
          
          <div className="nav-links">
            <button className="nav-link" onClick={() => handleNavClick('featured-polls')}>
              Featured Polls
            </button>
            <button className="nav-link" onClick={() => handleNavClick('how-it-works')}>
              How It Works
            </button>
            <button className="nav-link" onClick={() => handleNavClick('why-create')}>
              Benefits
            </button>
          </div>
          
          <div className="nav-actions">
            <button className="nav-btn secondary" onClick={() => onNavigate('polls')}>
              Browse Polls
            </button>
            <button className="nav-btn primary" onClick={() => onNavigate('create')}>
              Create Poll
            </button>

            {/* Wallet Connection */}
            {!isWalletConnected ? (
              <button
                className="nav-btn wallet-btn"
                onClick={connectWallet}
                disabled={isConnecting}
              >
                <AccountBalanceWalletIcon sx={{ fontSize: 20, marginRight: '8px' }} />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : (
              <div className="wallet-dropdown-container" ref={dropdownRef}>
                <button
                  className="nav-btn wallet-btn connected"
                  onClick={toggleDropdown}
                >
                  <AccountBalanceWalletIcon sx={{ fontSize: 20, marginRight: '8px' }} />
                  {walletAddress && walletAddress.length > 10
                    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
                    : walletAddress || 'Connected'}
                  <KeyboardArrowDownIcon sx={{ fontSize: 18, marginLeft: '4px' }} />
                </button>

                {showDropdown && (
                  <div className="wallet-dropdown">
                    <div className="wallet-dropdown-header">
                      <AccountBalanceWalletIcon sx={{ fontSize: 20 }} />
                      <span className="wallet-dropdown-title">Wallet Info</span>
                    </div>
                    <div className="wallet-dropdown-content">
                      <div className="wallet-dropdown-item">
                        <span className="wallet-dropdown-label">Provider:</span>
                        <span className="wallet-dropdown-value">{walletName}</span>
                      </div>
                      <div className="wallet-dropdown-item">
                        <span className="wallet-dropdown-label">Address:</span>
                        <button
                          className="wallet-address-copy-btn"
                          onClick={copyAddressToClipboard}
                          title="Click to copy address"
                        >
                          <span className="wallet-address-full">
                            {walletAddress}
                          </span>
                          <span className="copy-icon">
                            {isCopied ? (
                              <CheckIcon sx={{ fontSize: 18, color: '#4ade80' }} />
                            ) : (
                              <ContentCopyIcon sx={{ fontSize: 18 }} />
                            )}
                          </span>
                        </button>
                        {isCopied && (
                          <span className="copied-indicator">
                            Copied to clipboard!
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="wallet-dropdown-footer">
                      <button className="disconnect-btn" onClick={disconnectWallet}>
                        <LogoutIcon sx={{ fontSize: 18, marginRight: '6px' }} />
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Bottom Navigation - Hidden on home page */}
      {currentPage !== 'home' && (
        <nav className="bottom-nav">
        <div className="bottom-nav-container">
          <button
            className="bottom-nav-item"
            onClick={() => onNavigate('home')}
          >
            <div className="bottom-nav-icon">
              <HomeIcon sx={{ fontSize: 24 }} />
            </div>
            <span className="bottom-nav-label">Home</span>
          </button>

          <button
            className={`bottom-nav-item ${currentPage === 'polls' ? 'active' : ''}`}
            onClick={() => onNavigate('polls')}
          >
            <div className="bottom-nav-icon">
              <PollIcon sx={{ fontSize: 24 }} />
            </div>
            <span className="bottom-nav-label">Polls</span>
          </button>

          <button
            className={`bottom-nav-item ${currentPage === 'projects' ? 'active' : ''}`}
            onClick={() => onNavigate('projects')}
          >
            <div className="bottom-nav-icon">
              <FolderIcon sx={{ fontSize: 24 }} />
            </div>
            <span className="bottom-nav-label">Projects</span>
          </button>

          <button
            className={`bottom-nav-item ${currentPage === 'create' ? 'active' : ''}`}
            onClick={() => onNavigate('create')}
          >
            <div className="bottom-nav-icon">
              <AddCircleIcon sx={{ fontSize: 24 }} />
            </div>
            <span className="bottom-nav-label">Create</span>
          </button>

          <button
            className={`bottom-nav-item ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            <div className="bottom-nav-icon">
              <SettingsIcon sx={{ fontSize: 24 }} />
            </div>
            <span className="bottom-nav-label">Admin</span>
          </button>
        </div>
      </nav>
      )}
    </>
  );
};

export default Navigation;
