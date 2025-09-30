import React from 'react';
import { MassaLogo } from "@massalabs/react-ui-kit";
import HomeIcon from '@mui/icons-material/Home';
import PollIcon from '@mui/icons-material/Poll';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SettingsIcon from '@mui/icons-material/Settings';

interface NavigationProps {
  onNavigate: (page: 'home' | 'polls' | 'create' | 'admin') => void;
  currentPage: 'home' | 'polls' | 'create' | 'admin';
  onScrollToSection?: (sectionId: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ onNavigate, currentPage, onScrollToSection }) => {
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
          </div>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="bottom-nav-container">
          <button
            className={`bottom-nav-item ${currentPage === 'home' ? 'active' : ''}`}
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
    </>
  );
};

export default Navigation;
