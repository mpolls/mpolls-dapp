import { useEffect, useState } from "react";
import { MassaLogo } from "@massalabs/react-ui-kit";
import PollsApp from './PollsApp';
import ProjectsPage from './ProjectsPage';
import Navigation from './components/Navigation';
import { pollsContract, ContractPoll } from './utils/contractInteraction';
import { ToastProvider } from './components/ToastContainer';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import CreateIcon from '@mui/icons-material/Create';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import TableChartIcon from '@mui/icons-material/TableChart';
import RefreshIcon from '@mui/icons-material/Refresh';
import './App.css';

type PageType = 'home' | 'polls' | 'create' | 'admin' | 'projects';

function App() {
  const [currentText, setCurrentText] = useState(0);
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [email, setEmail] = useState('');
  const [featuredPolls, setFeaturedPolls] = useState<ContractPoll[]>([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(true);

  const dynamicTexts = ['business', 'surveys', 'art contests', 'debates'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentText((prev) => (prev + 1) % dynamicTexts.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [dynamicTexts.length]);

  // Fetch featured polls from contract
  useEffect(() => {
    const fetchFeaturedPolls = async () => {
      setIsLoadingPolls(true);
      try {
        console.log('🏠 App.tsx: Fetching featured polls from contract...');
        const contractPolls = await pollsContract.getAllPolls();

        // Filter only active polls that users can vote on
        const activePolls = contractPolls.filter(poll => poll.isActive);

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

  const companies = ['TechCorp', 'InnovateCo', 'StartupX', 'BigBrand', 'CreativeStudio'];

  const handleNavigation = (page: PageType) => {
    setCurrentPage(page);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Render different pages based on current page
  if (currentPage === 'projects') {
    return (
      <ToastProvider>
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
        />
        <ProjectsPage onBack={() => handleNavigation('home')} />
      </ToastProvider>
    );
  }

  if (currentPage === 'polls' || currentPage === 'create' || currentPage === 'admin') {
    return (
      <ToastProvider>
        <Navigation
          onNavigate={handleNavigation}
          currentPage={currentPage}
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
        />

      <header className="hero-section">
        <div className="hero-content">
          <div className="logo-container">
            <MassaLogo className="dpolls-logo" size={80} />
            <h1 className="brand-name">Massa Polls</h1>
          </div>
          <h2 className="hero-title">
            polls for <span className="dynamic-text">{dynamicTexts[currentText]}</span>
          </h2>
          <p className="hero-subtitle">Create engaging polls, contests, and surveys on the blockchain</p>
        </div>
      </header>

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
              const timeLeft = poll.isActive ? 'Active' : 'Ended';
              
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

      <section className="used-by">
        <h2>As Used By</h2>
        <div className="company-logos">
          {companies.map(company => (
            <div key={company} className="company-logo">
              {company}
            </div>
          ))}
        </div>
      </section>

      <section id="why-create" className="why-create">
        <h2>Why Create Polls with Massa Polls?</h2>
        <div className="benefits">
          <div className="benefit">
            <h3>Make a contest, make money</h3>
            <p>We split all charges 70 (you) / 30 (us)</p>
          </div>
          <div className="benefit">
            <h3>Flexible voting options</h3>
            <p>Let anyone vote—or allowlist. The choice is yours, and it's anti-bot.</p>
          </div>
          <div className="benefit">
            <h3>Create rewards pool</h3>
            <p>Create a rewards pool for winners</p>
          </div>
          <div className="benefit">
            <h3>Keep or reinvest</h3>
            <p>Keep the money you earn, or put it back into rewards pool</p>
          </div>
          <div className="benefit">
            <h3>Onchain rewards</h3>
            <p>Give players rewards, points, credentials—all data is onchain</p>
          </div>
        </div>
        
        <div className="email-signup">
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="email-input"
          />
          <button className="signup-btn">Get Started</button>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <h2>How It Works</h2>
        <div className="process">
          <h3>To create a contest:</h3>
          <ul>
            <li>Pick your contest type: who can enter? who can vote?</li>
            <li>Pick a gallery view or text view</li>
            <li>Set duration for entry and voting periods</li>
            <li>Set charges for entering and voting</li>
            <li>Bonus: add a rewards pool. Fund it yourself—or with money you earn from the contest.</li>
            <li>And it's free. You just pay the cost to deploy (often just cents).</li>
          </ul>
        </div>
        
        <button className="final-cta-btn" onClick={() => handleNavigation('polls')}>
          View Polls
        </button>
      </section>
    </div>
    </ToastProvider>
  );
}

export default App;



