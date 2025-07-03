import { useEffect, useState } from "react";
import { MassaLogo } from "@massalabs/react-ui-kit";
import PollsApp from './PollsApp';
import './App.css';

function App() {
  const [currentText, setCurrentText] = useState(0);
  const [showPolls, setShowPolls] = useState(false);
  const [email, setEmail] = useState('');

  const dynamicTexts = ['business', 'surveys', 'art contests', 'debates'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentText((prev) => (prev + 1) % dynamicTexts.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [dynamicTexts.length]);

  const featuredPolls = [
    { id: 1, title: 'Best Logo Design Contest', votes: 1247, timeLeft: '2 days' },
    { id: 2, title: 'Customer Service Survey', votes: 843, timeLeft: '5 days' },
    { id: 3, title: 'NFT Art Competition', votes: 2156, timeLeft: '1 day' },
    { id: 4, title: 'Product Feature Poll', votes: 567, timeLeft: '3 days' },
    { id: 5, title: 'Community Event Ideas', votes: 1089, timeLeft: '1 week' },
    { id: 6, title: 'Brand Name Vote', votes: 734, timeLeft: '4 days' },
    { id: 7, title: 'Music Contest Finals', votes: 1892, timeLeft: '6 hours' },
    { id: 8, title: 'Policy Feedback Survey', votes: 456, timeLeft: '2 weeks' }
  ];

  const companies = ['TechCorp', 'InnovateCo', 'StartupX', 'BigBrand', 'CreativeStudio'];

  if (showPolls) {
    return <PollsApp />;
  }

  return (
    <div className="landing-page">
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

      <section className="featured-polls">
        <h2>Featured Polls</h2>
        <div className="polls-grid">
          {featuredPolls.map(poll => (
            <div key={poll.id} className="poll-card">
              <h3>{poll.title}</h3>
              <div className="poll-stats">
                <span className="votes">{poll.votes} votes</span>
                <span className="time-left">{poll.timeLeft} left</span>
              </div>
            </div>
          ))}
        </div>
        <button className="view-all-btn" onClick={() => setShowPolls(true)}>
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

      <section className="why-create">
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

      <section className="how-it-works">
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
        
        <button className="final-cta-btn" onClick={() => setShowPolls(true)}>
          View Polls
        </button>
      </section>
    </div>
  );
}

export default App;



