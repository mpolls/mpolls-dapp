# MPolls - Decentralized Polling Platform on Massa

A comprehensive decentralized polling and rewards distribution system built on the Massa blockchain. Create polls, distribute rewards to participants, and organize projects - all with seamless blockchain integration.

## 🎯 Key Features

### Poll Creation & Management
- **Multi-step Poll Creation Form**: Intuitive wizard-style interface with validation
  - Basic poll information (title, description, end time)
  - Add multiple voting options with drag-to-reorder
  - Configure reward pools and distribution settings
  - Organize polls into projects
- **Real-time Form Validation**: Field-level error messages with auto-focus on invalid inputs
- **Three Distribution Types**:
  - **Manual Pull**: Voters claim their rewards manually
  - **Manual Push**: Poll creator distributes rewards to all voters at once
  - **Autonomous**: Scheduled automatic distribution using Massa's deferred calls

### Autonomous Distribution
- **Massa Deferred Calls Integration**: Native blockchain-based scheduled execution
- **Flexible Scheduling**: Set distribution delay from 32 seconds to 44 hours
- **Live Countdown Timer**: Real-time tracking of distribution execution
- **Automatic Reward Distribution**: No manual intervention required once scheduled

### Project Organization
- **Project Management**: Group related polls together
- **Project Statistics**: Aggregate metrics across all polls in a project
- **Project Filtering**: Easily navigate between different project collections

### Token Integration
- **MPOLLS Token**: Native token for the platform with swap functionality
- **Token Swaps**: Exchange between MASSA and MPOLLS tokens
- **Reward Pool Funding**: Support for both MASSA and MPOLLS token rewards

### Visualization & Analytics
- **Multiple Chart Types**: Bar charts, pie charts, and line charts for results
- **Real-time Statistics**: Live updates of poll performance and voting metrics
- **Distribution Status Tracking**: Monitor reward claims and distributions
- **Creator Dashboard**: Comprehensive view of all created polls with statistics

### User Experience
- **Wallet Integration**: Seamless connection with Massa Station wallet
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Bottom Navigation**: Easy access to key features (Home, Create, Dashboard, Wallet)
- **Loading States**: Clear feedback during blockchain operations
- **Error Handling**: User-friendly error messages and recovery

## 📁 Project Structure

```
mpolls-dapp/
├── src/
│   ├── components/
│   │   ├── DistributionTimePicker.tsx    # Schedule auto-distribution UI
│   │   ├── DistributionCountdown.tsx     # Live countdown display
│   │   └── BottomNavigation.tsx          # Bottom navigation bar
│   ├── utils/
│   │   └── contractInteraction.ts        # Smart contract interface
│   ├── App.tsx                           # Main application component
│   ├── CreatePoll.tsx                    # Multi-step poll creation form
│   ├── CreatorDashboard.tsx              # Poll creator dashboard
│   ├── PollResults.tsx                   # Results visualization
│   └── main.tsx                          # Application entry point
├── public/
├── .env.local                            # Environment configuration
└── package.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js (>= 18)
- npm or yarn
- Massa Station wallet browser extension
- Some MASSA tokens for transaction fees

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/mpolls/mpolls-dapp.git
cd mpolls-dapp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
Create a `.env.local` file in the project root:
```env
VITE_POLLS_CONTRACT_ADDRESS=AS12GGXCyVYTH2Lc7hRfCcSFpiSU4zCgguQCFY8Z47BkXdN3siVSz
```

4. **Start the development server:**
```bash
npm run dev
```

5. **Open in browser:**
Navigate to `http://localhost:5173` (or the port shown in terminal)

## 📋 Environment Configuration

The `.env.local` file should contain:

```env
# Deployed polls contract address on Massa Buildnet
VITE_POLLS_CONTRACT_ADDRESS=AS12GGXCyVYTH2Lc7hRfCcSFpiSU4zCgguQCFY8Z47BkXdN3siVSz

# Optional: Custom RPC endpoint
# VITE_MASSA_RPC_URL=https://buildnet.massa.net/api/v2
```

## 🎮 Usage Guide

### Creating a Poll

1. Click "Create Poll" in the bottom navigation
2. **Step 1: Poll Information**
   - Enter poll title (required)
   - Add description (required)
   - Set end date/time (required)
   - Select or create a project (optional)
3. **Step 2: Poll Options**
   - Add voting options (minimum 2 required)
   - Drag to reorder options
   - Remove unwanted options
4. **Step 3: Reward Pool**
   - Enter reward pool amount (optional)
   - Configure distribution type:
     - **Manual Pull**: Voters claim rewards themselves
     - **Manual Push**: You distribute rewards manually
     - **Autonomous**: Automatic scheduled distribution
5. Submit the poll and confirm the blockchain transaction

### Scheduling Autonomous Distribution

When creating a poll with "Autonomous" distribution:
1. Set the distribution delay (32 seconds to 44 hours after poll closes)
2. The system will display the scheduled distribution time
3. After the poll closes, rewards will be automatically distributed
4. Monitor distribution status in the Creator Dashboard

### Voting on a Poll

1. Browse active polls on the home page
2. Click on a poll to view details
3. Select your preferred option
4. Click "Vote" and confirm the transaction
5. View results immediately after voting

### Claiming Rewards (Manual Pull)

1. Navigate to "My Wallet" in the bottom navigation
2. Find polls where you voted and rewards are available
3. Click "Claim" for each poll
4. Confirm the blockchain transaction

### Managing Your Polls (Creator Dashboard)

1. Click "Dashboard" in the bottom navigation
2. View all your created polls with statistics
3. Actions available:
   - **Close Poll Early**: End voting before scheduled time
   - **Schedule Auto-Distribution**: Set up autonomous distribution
   - **Distribute Rewards**: Push rewards to all voters (Manual Push)
   - **View Distribution Status**: Check claim/distribution progress

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

## 📊 Distribution Types Explained

### Manual Pull (Type 0)
- **How it works**: Voters claim their rewards individually
- **Best for**: Polls where you want voters to opt-in to claiming
- **Creator action**: None required after poll closes
- **Voter action**: Each voter must claim their reward

### Manual Push (Type 1)
- **How it works**: Poll creator distributes rewards to all voters at once
- **Best for**: Polls where you want to ensure all voters receive rewards
- **Creator action**: Click "Distribute Rewards" in Creator Dashboard
- **Voter action**: None - rewards are automatically sent

### Autonomous (Type 2)
- **How it works**: Scheduled automatic distribution using Massa deferred calls
- **Best for**: Polls where you want fully automated distribution
- **Creator action**: Schedule distribution time when closing poll
- **Voter action**: None - rewards are automatically distributed
- **Timing**: 32 seconds to 44 hours after poll closes
- **Technical**: Uses Massa's native blockchain scheduling (deferred calls)

## ⏱️ Understanding Autonomous Distribution

Autonomous distribution uses **Massa's deferred calls**, a native blockchain feature for scheduled execution:

- **Minimum delay**: 32 seconds (2 blockchain periods)
- **Maximum delay**: 44 hours (10,000 blockchain periods)
- **Period length**: 16 seconds per period on Massa blockchain
- **Accuracy**: Execution occurs within 16-32 seconds of scheduled time
- **Cost**: Contract must be funded with MASSA to pay for execution

The countdown timer shows approximate time until distribution. Actual execution depends on blockchain period boundaries.

## 🔗 Additional Documentation

- **[Architecture Documentation](./ARCHITECTURE.md)** - Comprehensive system architecture, data flow, and technical implementation details
- **[Project Summary](./PROJECT_SUMMARY.md)** - Detailed project overview and features
- **[Token Minting Guide](./TOKEN_MINTING_GUIDE.md)** - Instructions for MPOLLS token creation
- **[Contract Analysis](./CONTRACT_ANALYSIS.md)** - Smart contract implementation details
- **[Swap Setup Guide](./SWAP_SETUP.md)** - Token swap configuration and usage
- **[Poll Inactive Issue Resolution](./POLL_INACTIVE_ISSUE_RESOLUTION.md)** - Troubleshooting guide
- **[Test Documentation](./test/README.md)** - Testing procedures and scripts

## 🏗️ Smart Contract

The frontend interacts with the MPolls smart contract deployed on Massa Buildnet. For contract details, deployment, and monitoring:

- See the [contract repository](../mpolls-contract/README.md)
- Current deployed address: `AS12GGXCyVYTH2Lc7hRfCcSFpiSU4zCgguQCFY8Z47BkXdN3siVSz`

## 🎨 UI/UX Features

### Responsive Design
- Desktop, tablet, and mobile optimized layouts
- Touch-friendly controls for mobile devices
- Bottom navigation bar for easy mobile access

### Visual Feedback
- Loading spinners during blockchain operations
- Success/error toast notifications
- Real-time countdown timers for distributions
- Progress bars for poll results
- Color-coded status badges (Active, Closed, Distributed)

### Accessibility
- Keyboard navigation support
- Clear error messages with auto-focus
- Tooltips for complex features
- High contrast color scheme

## 🔒 Security Considerations

- All blockchain operations require wallet confirmation
- Input validation on both frontend and smart contract
- Protection against common vulnerabilities (XSS, injection)
- Secure random number generation for polling
- One vote per address per poll enforcement

## 🐛 Troubleshooting

### Wallet Connection Issues
- Ensure Massa Station extension is installed and unlocked
- Check that you're connected to Buildnet network
- Try refreshing the page and reconnecting

### Transaction Failures
- Ensure you have sufficient MASSA for gas fees
- Check that poll is still active (not expired)
- Verify you haven't already voted on the poll

### Distribution Not Executing
- Check that contract has sufficient MASSA balance (minimum 10 MASSA)
- Verify distribution time is within valid range (32 seconds to 44 hours)
- Monitor distribution status in Creator Dashboard

## 📈 Performance

- Optimized bundle size with code splitting
- Lazy loading of components
- Efficient state management with React hooks
- Minimal blockchain calls with intelligent caching

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For questions and support:
- Join the [Massa Discord](https://discord.gg/massa)
- Review the [Massa documentation](https://docs.massa.net/)
- Open an issue in this repository
- Check our troubleshooting documentation

## 🔗 Resources

- [Massa Official Website](https://massa.net/)
- [Massa Documentation](https://docs.massa.net/)
- [Massa Web3 SDK](https://github.com/massalabs/massa-web3)
- [Massa Station Wallet](https://station.massa.net/)
- [AssemblyScript Documentation](https://www.assemblyscript.org/)

---

Built with ❤️ on Massa blockchain
