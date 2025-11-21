import { useEffect, useState } from "react";
import { MassaLogo } from "@massalabs/react-ui-kit";
import PollsApp from './PollsApp';
import ProjectsPage from './ProjectsPage';
import TokenPage from './TokenPage';
import SwapPage from './SwapPage';
import CreatorDashboard from './CreatorDashboard';
import ParticipantDashboard from './ParticipantDashboard';
import PollResults from './PollResults';
import Navigation from './components/Navigation';
import { pollsContract, ContractPoll } from './utils/contractInteraction';
import { ToastProvider } from './components/ToastContainer';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import CreateIcon from '@mui/icons-material/Create';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import TableChartIcon from '@mui/icons-material/TableChart';
import RefreshIcon from '@mui/icons-material/Refresh';
import './App.css';

type PageType = 'home' | 'polls' | 'create' | 'admin' | 'projects' | 'token' | 'swap' | 'creator' | 'participant' | 'results';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [featuredPolls, setFeaturedPolls] = useState<ContractPoll[]>([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [walletName, setWalletName] = useState<string>('');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [selectedPollId, setSelectedPollId] = useState<string>('');
  const [statistics, setStatistics] = useState({
    totalPolls: 0,
    totalResponses: 0,
    totalRewardsDistributed: 0,
    activePolls: 0
  });

  // Check wallet connection on mount
  useEffect(() => {
    const checkWallet = async () => {
      try {
        const connected = await pollsContract.isWalletConnected();
        setIsWalletConnected(connected);
        if (connected) {
          const address = await pollsContract.getWalletAddress();
          const name = pollsContract.getWalletName();
          setWalletAddress(address || '');
          setWalletName(name || '');
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    };
    checkWallet();
  }, []);

  const handleWalletConnect = (address: string, name: string) => {
    setWalletAddress(address);
    setWalletName(name);
    setIsWalletConnected(true);
  };

  // Fetch statistics from contract
  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        console.log('📊 App.tsx: Fetching platform statistics...');
        const stats = await pollsContract.getStatistics();
        console.log('📊 App.tsx: Raw statistics received:', stats);
        console.log('📊 App.tsx: Statistics breakdown:');
        console.log('  - Total Polls:', stats.totalPolls);
        console.log('  - Total Responses:', stats.totalResponses);
        console.log('  - Total Rewards Distributed (nanoMASSA):', stats.totalRewardsDistributed);
        console.log('  - Total Rewards Distributed (MASSA):', stats.totalRewardsDistributed / 1e9);
        console.log('  - Active Polls:', stats.activePolls);
        setStatistics(stats);
        console.log('📊 App.tsx: Statistics state updated');
      } catch (error) {
        console.error('📊 App.tsx: Failed to fetch statistics:', error);
      }
    };

    fetchStatistics();
  }, []);

  // Fetch featured polls from contract
  useEffect(() => {
    const fetchFeaturedPolls = async () => {
      setIsLoadingPolls(true);
      try {
        console.log('🏠 App.tsx: Fetching featured polls from contract...');
        const contractPolls = await pollsContract.getAllPolls();

        // Filter only active polls that users can vote on
        const activePolls = contractPolls.filter(poll => poll.status === 'active');

        // Take the first 8 active polls for featured section (or all if less than 8)
        const featured = activePolls.slice(0, 8);
        setFeaturedPolls(featured);

        console.log(`🏠 App.tsx: Successfully loaded ${featured.length} active featured polls (out of ${contractPolls.length} total polls)`);
      } catch (error) {
        console.error('🏠 App.tsx: Failed to fetch featured polls:', error);
        setFeaturedPolls([]);
      } finally {
        setIsLoadingPolls(false);
      }
    };

    fetchFeaturedPolls();
  }, []);

  const handleNavigation = (page: PageType, pollId?: string) => {
    setCurrentPage(page);
    if (pollId) {
      setSelectedPollId(pollId);
    }
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Render different pages based on current page
  if (currentPage === 'results') {
    return (
      <ToastProvider>
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
          onWalletConnect={handleWalletConnect}
        />
        <PollResults
          pollId={selectedPollId}
          onBack={() => handleNavigation('polls')}
        />
      </ToastProvider>
    );
  }

  if (currentPage === 'swap') {
    return (
      <ToastProvider>
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
          onWalletConnect={handleWalletConnect}
        />
        <SwapPage
          onBack={() => handleNavigation('home')}
        />
      </ToastProvider>
    );
  }

  if (currentPage === 'token') {
    return (
      <ToastProvider>
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
          onWalletConnect={handleWalletConnect}
        />
        <TokenPage
          onBack={() => handleNavigation('home')}
          isWalletConnected={isWalletConnected}
          walletAddress={walletAddress}
          onNavigateToSwap={() => handleNavigation('swap')}
        />
      </ToastProvider>
    );
  }

  if (currentPage === 'projects') {
    return (
      <ToastProvider>
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
          onWalletConnect={handleWalletConnect}
        />
        <ProjectsPage
          onBack={() => handleNavigation('home')}
          onCreatePoll={(projectId) => {
            // Navigate to create page with project ID stored
            if (projectId) {
              sessionStorage.setItem('selectedProjectId', projectId.toString());
            }
            handleNavigation('create');
          }}
        />
      </ToastProvider>
    );
  }

  if (currentPage === 'creator') {
    return (
      <ToastProvider>
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
          onWalletConnect={handleWalletConnect}
        />
        <CreatorDashboard
          onBack={() => handleNavigation('polls')}
          onViewPoll={(pollId) => {
            // Navigate to results page to view poll results
            handleNavigation('results', pollId.toString());
          }}
        />
      </ToastProvider>
    );
  }

  if (currentPage === 'participant') {
    return (
      <ToastProvider>
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
          onWalletConnect={handleWalletConnect}
        />
        <ParticipantDashboard
          onBack={() => handleNavigation('polls')}
          onViewPoll={(pollId) => {
            // Navigate to results page to view poll results
            handleNavigation('results', pollId.toString());
          }}
        />
      </ToastProvider>
    );
  }

  if (currentPage === 'polls' || currentPage === 'create' || currentPage === 'admin') {
    return (
      <ToastProvider>
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
          onWalletConnect={handleWalletConnect}
        />
        <PollsApp initialView={currentPage} onNavigate={handleNavigation} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="landing-page">
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
          onScrollToSection={scrollToSection}
          onWalletConnect={handleWalletConnect}
        />

      <header className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-icon">🔒</span>
            Decentralized & Transparent Polling
          </div>
          <h1 className="hero-title">
            Create Polls That Matter
          </h1>
          <p className="hero-subtitle">
            Build transparent, tamper-proof surveys and polls using blockchain technology.<br />
            Get authentic responses with complete data integrity and user privacy protection.
          </p>
          <div className="hero-cta">
            <button className="cta-primary" onClick={() => handleNavigation('create')}>
              Get Started
            </button>
            <button className="cta-secondary" onClick={() => handleNavigation('polls')}>
              Browse Polls
            </button>
          </div>
          <div className="hero-features">
            <div className="feature-item">
              <span className="feature-icon">✓</span> No registration required
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span> Tamper-proof results
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span> Real-time analytics
            </div>
          </div>
        </div>
      </header>

      <section className="platform-statistics">
        <div className="stats-container">
          <div className="stat-box">
            <div className="stat-icon-wrapper" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
              <HowToVoteIcon sx={{ fontSize: 28, color: 'white' }} />
            </div>
            <div className="stat-content">
              <div className="stat-number">{statistics.totalPolls.toLocaleString()}</div>
              <div className="stat-label">Polls Created</div>
              <div className="stat-subtitle">Active community engagement</div>
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-icon-wrapper" style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
              <TableChartIcon sx={{ fontSize: 28, color: 'white' }} />
            </div>
            <div className="stat-content">
              <div className="stat-number">{statistics.totalResponses.toLocaleString()}</div>
              <div className="stat-label">Total Responses</div>
              <div className="stat-subtitle">Community contributed</div>
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-icon-wrapper" style={{background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'}}>
              <span style={{fontSize: '28px', color: 'white'}}>💰</span>
            </div>
            <div className="stat-content">
              <div className="stat-number">{(statistics.totalRewardsDistributed / 1e9).toFixed(2)} MASSA</div>
              <div className="stat-label">Funds Delivered</div>
              <div className="stat-subtitle">Rewards distributed</div>
            </div>
          </div>
        </div>
      </section>

      <section id="role-selection" className="role-selection">
        <h2>Choose Your Path</h2>
        <div className="roles-grid">
          <div className="role-card" onClick={() => handleNavigation('polls')}>
            <div className="role-icon">
              <HowToVoteIcon sx={{ fontSize: 80 }} />
            </div>
            <h3>Participant</h3>
            <p>Browse and vote on active polls</p>
            <button className="role-btn">Get Started</button>
          </div>

          <div className="role-card" onClick={() => handleNavigation('create')}>
            <div className="role-icon">
              <CreateIcon sx={{ fontSize: 80 }} />
            </div>
            <h3>Creator</h3>
            <p>Browse projects, create polls and contests</p>
            <button className="role-btn">Start Creating</button>
          </div>

          <div className="role-card" onClick={() => handleNavigation('admin')}>
            <div className="role-icon">
              <AdminPanelSettingsIcon sx={{ fontSize: 80 }} />
            </div>
            <h3>Administrator</h3>
            <p>Administer projects and polls</p>
            <button className="role-btn">Manage</button>
          </div>
        </div>
      </section>

      <section id="featured-polls" className="featured-polls">
        <h2>Featured Polls</h2>
        {isLoadingPolls ? (
          <div className="loading-state">
            <p><RefreshIcon sx={{ fontSize: 20, marginRight: 0.5, verticalAlign: 'middle' }} /> Loading polls from blockchain...</p>
          </div>
        ) : featuredPolls.length === 0 ? (
          <div className="empty-state">
            <p><TableChartIcon sx={{ fontSize: 20, marginRight: 0.5, verticalAlign: 'middle' }} /> No polls found on the blockchain yet.</p>
            <button className="create-poll-btn" onClick={() => handleNavigation('create')}>
              Create First Poll
            </button>
          </div>
        ) : (
          <div className="polls-grid">
            {featuredPolls.map(poll => {
              const totalVotes = poll.votes.reduce((sum, votes) => sum + votes, 0);
              const timeLeft = poll.status === 'active' ? 'Active' : 'Ended';
              
              return (
                <div key={poll.id} className="poll-card">
                  <h3>{poll.title}</h3>
                  <div className="poll-stats">
                    <span className="votes">{totalVotes} votes</span>
                    <span className="time-left">{timeLeft}</span>
                  </div>
                  <div className="poll-description">
                    {poll.description.length > 60 
                      ? `${poll.description.substring(0, 60)}...` 
                      : poll.description
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button className="view-all-btn" onClick={() => handleNavigation('polls')}>
          View All Polls
        </button>
      </section>

      <section id="why-create" className="why-create">
        <h2>Why Choose Massa Polls?</h2>
        <p className="section-subtitle">Experience the future of polling with blockchain-powered transparency and security</p>
        <div className="benefits">
          <div className="benefit">
            <div className="benefit-icon" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
              <span style={{fontSize: '28px'}}>🔒</span>
            </div>
            <h3>Tamper-Proof Results</h3>
            <p>Every vote is recorded on the blockchain, ensuring complete transparency and preventing any manipulation of results.</p>
          </div>
          <div className="benefit">
            <div className="benefit-icon" style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
              <span style={{fontSize: '28px'}}>🎭</span>
            </div>
            <h3>Anonymous & Private</h3>
            <p>Protect respondent privacy with zero-knowledge proofs while maintaining vote authenticity and preventing duplicates.</p>
          </div>
          <div className="benefit">
            <div className="benefit-icon" style={{background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'}}>
              <span style={{fontSize: '28px'}}>⚡</span>
            </div>
            <h3>Instant Results</h3>
            <p>Get real-time analytics and results as votes come in, with automatic verification and transparent counting.</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <h2>How It Works</h2>
        <p className="section-subtitle">Create and deploy your poll in minutes with our simple three-step process</p>
        <div className="process-steps">
          <div className="process-step">
            <div className="step-number">1</div>
            <h3>Create Your Poll</h3>
            <p>Enter your question and customize your poll options. Choose from multiple question types and design templates.</p>
          </div>
          <div className="process-step">
            <div className="step-number">2</div>
            <h3>Deploy on Blockchain</h3>
            <p>Your poll is automatically deployed on the blockchain, creating an immutable and transparent voting system.</p>
          </div>
          <div className="process-step">
            <div className="step-number">3</div>
            <h3>Share & Collect</h3>
            <p>Share your poll link and watch real-time results come in. All votes are verified and counted transparently.</p>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="final-cta-content">
          <h2>Ready to Create Your First Poll?</h2>
          <p>Join thousands using Massa Polls for transparent, secure polling</p>
          <div className="cta-buttons">
            <button className="cta-primary-large" onClick={() => handleNavigation('create')}>
              Start Polling
            </button>
          </div>
          <div className="cta-features">
            <span>✓ No credit card required</span>
            <span>✓ Deploy in seconds</span>
            <span>✓ Blockchain verified</span>
          </div>
        </div>
      </section>
    </div>
    </ToastProvider>
  );
}

export default App;



