# MPolls Architecture Documentation

This document provides a comprehensive overview of the MPolls platform architecture, including both high-level system design and detailed technical implementation.

## Table of Contents

1. [Overall System Architecture](#overall-system-architecture)
2. [Frontend Architecture](#frontend-architecture)
3. [Smart Contract Architecture](#smart-contract-architecture)
4. [Autonomous Distribution Architecture](#autonomous-distribution-architecture)
5. [Data Flow](#data-flow)
6. [Security Architecture](#security-architecture)
7. [Technology Stack](#technology-stack)

---

## Overall System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Web Browser  │  │ Massa Station│  │   Mobile     │          │
│  │   (Desktop)  │  │   Wallet     │  │   Browser    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │      React Frontend (dApp)          │
          │  ┌────────────────────────────────┐ │
          │  │  Component Layer               │ │
          │  │  - CreatePoll                  │ │
          │  │  - PollResults                 │ │
          │  │  - CreatorDashboard            │ │
          │  │  - DistributionTimePicker      │ │
          │  │  - DistributionCountdown       │ │
          │  └────────────┬───────────────────┘ │
          │               │                     │
          │  ┌────────────▼───────────────────┐ │
          │  │  Contract Interaction Layer    │ │
          │  │  contractInteraction.ts        │ │
          │  └────────────┬───────────────────┘ │
          └───────────────┼─────────────────────┘
                          │
                          │ Massa Web3 SDK
                          │ JSON-RPC Calls
                          │
          ┌───────────────▼─────────────────────┐
          │      Massa Blockchain Network       │
          │  ┌────────────────────────────────┐ │
          │  │   MPolls Smart Contract        │ │
          │  │   (AssemblyScript/WASM)        │ │
          │  │                                │ │
          │  │  ┌──────────────────────────┐ │ │
          │  │  │  Core Functions          │ │ │
          │  │  │  - createPoll()          │ │ │
          │  │  │  - vote()                │ │ │
          │  │  │  - closePoll()           │ │ │
          │  │  │  - distributeRewards()   │ │ │
          │  │  │  - claimReward()         │ │ │
          │  │  └──────────────────────────┘ │ │
          │  │                                │ │
          │  │  ┌──────────────────────────┐ │ │
          │  │  │  Storage Layer           │ │ │
          │  │  │  - Polls                 │ │ │
          │  │  │  - Votes                 │ │ │
          │  │  │  - Projects              │ │ │
          │  │  │  - Deferred Calls        │ │ │
          │  │  └──────────────────────────┘ │ │
          │  └────────────┬───────────────────┘ │
          │               │                     │
          │  ┌────────────▼───────────────────┐ │
          │  │   Massa Deferred Call System   │ │
          │  │   (Autonomous Distribution)    │ │
          │  │   - Slot Management            │ │
          │  │   - Period-based Scheduling    │ │
          │  │   - Automatic Execution        │ │
          │  └────────────────────────────────┘ │
          └─────────────────────────────────────┘
```

### Key Components

1. **User Layer**: Web browsers (desktop/mobile) with Massa Station wallet extension
2. **Frontend (dApp)**: React-based single-page application
3. **Smart Contract**: AssemblyScript contract deployed on Massa blockchain
4. **Blockchain Layer**: Massa blockchain with native deferred call support
5. **Autonomous System**: Massa's built-in deferred call mechanism for scheduled execution

---

## Frontend Architecture

### Component Hierarchy

```
App.tsx (Main Container)
│
├── Router
│   │
│   ├── Home (Landing Page)
│   │   ├── Featured Polls List
│   │   ├── Statistics Display
│   │   └── Call-to-Action Buttons
│   │
│   ├── Browse Polls
│   │   ├── Active Polls List
│   │   ├── Filter/Sort Controls
│   │   └── Poll Cards
│   │
│   ├── CreatePoll (Multi-step Form)
│   │   ├── Step 1: Poll Information
│   │   │   ├── Title Input (with validation)
│   │   │   ├── Description Textarea (with validation)
│   │   │   ├── End DateTime Picker (with validation)
│   │   │   └── Project Selector
│   │   │
│   │   ├── Step 2: Poll Options
│   │   │   ├── Options List (drag-to-reorder)
│   │   │   ├── Add Option Button
│   │   │   └── Remove Option Buttons
│   │   │
│   │   └── Step 3: Reward Configuration
│   │       ├── Reward Pool Input
│   │       ├── Distribution Type Selector
│   │       └── Token Selector (MASSA/MPOLLS)
│   │
│   ├── PollResults
│   │   ├── Poll Information Display
│   │   ├── Chart Visualization
│   │   │   ├── Bar Chart
│   │   │   ├── Pie Chart
│   │   │   └── Line Chart
│   │   ├── Results Table
│   │   ├── Vote Button (if active)
│   │   └── Distribution Countdown (if autonomous)
│   │
│   ├── CreatorDashboard
│   │   ├── Polls Statistics
│   │   ├── Created Polls List
│   │   ├── Poll Management Actions
│   │   │   ├── Close Poll
│   │   │   ├── Schedule Auto-Distribution
│   │   │   ├── Distribute Rewards (Manual Push)
│   │   │   └── View Distribution Status
│   │   ├── DistributionTimePicker Modal
│   │   │   └── Delay Configuration (32s to 44h)
│   │   └── Distribution Status Modal
│   │       └── Voters Table with Claim Status
│   │
│   └── MyWallet
│       ├── Wallet Balance
│       ├── Voted Polls List
│       ├── Claimable Rewards
│       └── Token Swap Interface
│
└── BottomNavigation
    ├── Home Button
    ├── Create Button
    ├── Dashboard Button
    └── Wallet Button
```

### State Management

```
Frontend State Architecture
│
├── React Hooks (useState, useEffect, useRef)
│   │
│   ├── Component-level State
│   │   ├── Form Data (CreatePoll)
│   │   ├── Loading States
│   │   ├── Error States
│   │   └── Field Validation Errors
│   │
│   ├── Account State
│   │   ├── Connected Wallet Address
│   │   ├── Account Balance
│   │   └── Authentication Status
│   │
│   └── Blockchain Data Cache
│       ├── Polls List
│       ├── Poll Details
│       ├── Vote Status
│       └── Claim Status
│
└── Massa Web3 Provider
    └── Account Context
        ├── Wallet Connection
        ├── Transaction Signing
        └── Balance Queries
```

### Contract Interaction Layer

Located in `src/utils/contractInteraction.ts`:

```typescript
Contract Interaction Layer
│
├── Configuration
│   ├── Contract Address (from .env.local)
│   ├── Provider Setup (JsonRpcProvider.buildnet())
│   └── Account Management
│
├── Write Functions (State-changing operations)
│   ├── createPoll()
│   │   └── Serializes poll data → Calls contract → Returns transaction
│   │
│   ├── vote()
│   │   └── Validates inputs → Calls contract → Emits events
│   │
│   ├── closePoll()
│   │   └── Calculates distribution time → Calls contract → Schedules deferred call
│   │
│   ├── distributeRewards()
│   │   └── Batch processes voters → Transfers rewards → Updates state
│   │
│   └── claimReward()
│       └── Validates eligibility → Calls contract → Transfers reward
│
├── Read Functions (View operations)
│   ├── getPoll()
│   ├── getAllPolls()
│   ├── getPollResults()
│   ├── hasVoted()
│   ├── getClaimStatus()
│   └── getProjectStatistics()
│
└── Event Listeners
    ├── Poll Created Events
    ├── Vote Cast Events
    ├── Poll Closed Events
    └── Distribution Events
```

### Frontend Data Flow

```
User Action → Component Handler → Contract Interaction Function
                                           ↓
                                  Massa Web3 SDK
                                           ↓
                                  Wallet Confirmation
                                           ↓
                                  Transaction Broadcast
                                           ↓
                                  Blockchain Execution
                                           ↓
                                  Event Emission
                                           ↓
                                  Frontend Update
                                           ↓
                                  UI Refresh
```

---

## Smart Contract Architecture

### Contract Structure

```
assembly/contracts/main.ts
│
├── Imports
│   ├── @massalabs/massa-as-sdk
│   │   ├── Storage, Context, Args
│   │   ├── Address, transferCoins
│   │   ├── deferredCallRegister, findCheapestSlot, deferredCallQuote
│   │   └── generateEvent, balance
│   │
│   └── @massalabs/as-types
│       └── Args, Result (serialization)
│
├── Data Structures
│   ├── Poll Class
│   │   ├── id: string
│   │   ├── title: string
│   │   ├── description: string
│   │   ├── options: Array<string>
│   │   ├── creator: Address
│   │   ├── startTime: u64
│   │   ├── endTime: u64
│   │   ├── isActive: boolean
│   │   ├── totalVotes: u64
│   │   ├── optionVotes: Array<u64>
│   │   ├── rewardPool: u64
│   │   ├── distributionType: DistributionType (enum)
│   │   ├── distributionTime: u64
│   │   ├── projectId: string
│   │   └── Methods: serialize(), deserialize(), isExpired(), close()
│   │
│   ├── Vote Class
│   │   ├── pollId: string
│   │   ├── voter: Address
│   │   ├── optionIndex: u32
│   │   ├── timestamp: u64
│   │   └── Methods: serialize(), deserialize()
│   │
│   ├── Project Class
│   │   ├── id: string
│   │   ├── name: string
│   │   ├── description: string
│   │   ├── creator: Address
│   │   ├── pollIds: Array<string>
│   │   └── Methods: serialize(), deserialize()
│   │
│   └── DistributionType Enum
│       ├── MANUAL_PULL = 0
│       ├── MANUAL_PUSH = 1
│       └── AUTONOMOUS = 2
│
├── Storage Keys
│   ├── POLL_PREFIX = "poll_"
│   ├── VOTE_PREFIX = "vote_"
│   ├── POLL_COUNTER = "poll_counter"
│   ├── PROJECT_PREFIX = "project_"
│   ├── CLAIM_PREFIX = "claim_"
│   └── DEFERRED_CALL_PREFIX = "deferred_call_"
│
├── Export Functions (Public Interface)
│   ├── createPoll(args)
│   │   ├── Deserialize arguments
│   │   ├── Validate inputs
│   │   ├── Create Poll object
│   │   ├── Store in blockchain storage
│   │   ├── Emit "Poll created" event
│   │   └── Return poll ID
│   │
│   ├── vote(args)
│   │   ├── Deserialize arguments
│   │   ├── Validate poll is active
│   │   ├── Check voter hasn't voted
│   │   ├── Create Vote object
│   │   ├── Update poll vote counts
│   │   ├── Store vote
│   │   └── Emit "Vote cast" event
│   │
│   ├── closePoll(args)
│   │   ├── Deserialize arguments
│   │   ├── Validate caller is creator
│   │   ├── Mark poll as inactive
│   │   ├── If AUTONOMOUS type:
│   │   │   ├── Calculate periods from distribution time
│   │   │   ├── Validate period range (2-10,000)
│   │   │   ├── Register deferred call
│   │   │   └── Store deferred call ID
│   │   └── Emit "Poll closed" event
│   │
│   ├── distributeRewards(args)
│   │   ├── Deserialize poll ID
│   │   ├── Load poll data
│   │   ├── Get all voters
│   │   ├── Calculate reward per voter
│   │   ├── For each voter (up to 50):
│   │   │   ├── Transfer reward
│   │   │   ├── Mark as claimed
│   │   │   └── Emit "Distributed" event
│   │   └── Emit completion event
│   │
│   ├── claimReward(args)
│   │   ├── Validate poll closed
│   │   ├── Validate MANUAL_PULL type
│   │   ├── Validate caller voted
│   │   ├── Validate not already claimed
│   │   ├── Calculate reward amount
│   │   ├── Transfer reward
│   │   ├── Mark as claimed
│   │   └── Emit "Reward claimed" event
│   │
│   ├── getPoll(args)
│   ├── getAllPolls()
│   ├── getPollResults(args)
│   ├── hasVoted(args)
│   └── getClaimStatus(args)
│
└── Internal Functions
    ├── registerDeferredDistribution(pollId, periodsFromNow)
    │   ├── Get current period
    │   ├── Calculate target period
    │   ├── Find cheapest slot
    │   ├── Quote deferred call cost
    │   ├── Check contract balance
    │   ├── Register deferred call
    │   └── Store call ID
    │
    ├── getVotersForPoll(pollId)
    │   └── Returns array of voter addresses
    │
    └── Helper functions for serialization/deserialization
```

### Storage Architecture

```
Massa Blockchain Storage (Key-Value Store)
│
├── Poll Storage
│   ├── Key: "poll_{id}"
│   ├── Value: Serialized Poll object
│   └── Example: "poll_1" → {id: "1", title: "...", options: [...], ...}
│
├── Vote Storage
│   ├── Key: "vote_{pollId}_{voterAddress}"
│   ├── Value: Serialized Vote object
│   └── Example: "vote_1_AU12..." → {pollId: "1", voter: "AU12...", optionIndex: 0}
│
├── Project Storage
│   ├── Key: "project_{id}"
│   ├── Value: Serialized Project object
│   └── Example: "project_abc" → {id: "abc", name: "...", pollIds: [...]}
│
├── Claim Status Storage
│   ├── Key: "claim_{pollId}_{voterAddress}"
│   ├── Value: boolean (serialized)
│   └── Example: "claim_1_AU12..." → true
│
├── Deferred Call Storage
│   ├── Key: "deferred_call_{pollId}"
│   ├── Value: string (call ID)
│   └── Example: "deferred_call_1" → "call_xyz123"
│
└── Counter Storage
    ├── Key: "poll_counter"
    └── Value: u64 (next poll ID)
```

---

## Autonomous Distribution Architecture

### Massa Deferred Call System Integration

```
Autonomous Distribution Flow
│
├── 1. Poll Closure with Scheduling
│   ├── User calls closePoll(pollId, distributionTime)
│   ├── Contract validates:
│   │   ├── Caller is poll creator
│   │   ├── Distribution type is AUTONOMOUS (2)
│   │   └── Distribution time is in future
│   │
│   ├── Period Calculation
│   │   ├── currentTime = Context.timestamp() [milliseconds]
│   │   ├── timeDifference = distributionTime - currentTime
│   │   ├── periodsFromNow = (timeDifference + 15999) / 16000 [ceiling division]
│   │   ├── Validate: 2 ≤ periodsFromNow ≤ 10,000
│   │   └── Result: Number of 16-second periods until execution
│   │
│   └── registerDeferredDistribution(pollId, periodsFromNow)
│
├── 2. Deferred Call Registration
│   ├── Calculate target period
│   │   └── targetPeriod = Context.currentPeriod() + periodsFromNow
│   │
│   ├── Find execution slot
│   │   ├── maxGas = 200,000,000 (200M gas)
│   │   ├── Prepare function arguments
│   │   ├── Call findCheapestSlot(targetPeriod, targetPeriod, maxGas, paramsSize)
│   │   └── Returns: Slot {period, thread}
│   │
│   ├── Calculate cost
│   │   ├── Call deferredCallQuote(slot, maxGas, paramsSize)
│   │   └── Returns: Cost in nanoMassa
│   │
│   ├── Verify contract balance
│   │   ├── contractBalance = balance()
│   │   ├── Assert: contractBalance ≥ cost
│   │   └── Typical cost: ~2 MASSA
│   │
│   ├── Register deferred call
│   │   ├── deferredCallRegister(
│   │   │     contractAddress,
│   │   │     "distributeRewards",
│   │   │     slot,
│   │   │     maxGas,
│   │   │     serializedArgs,
│   │   │     0 // coins to send
│   │   │   )
│   │   └── Returns: callId (unique identifier)
│   │
│   └── Store call ID
│       └── Storage.set("deferred_call_{pollId}", callId)
│
├── 3. Blockchain Scheduling
│   ├── Massa blockchain stores deferred call
│   ├── Marks slot {period, thread} for execution
│   ├── Deducts cost from contract balance
│   └── Waits for target period
│
├── 4. Automatic Execution (at scheduled time)
│   ├── Massa blockchain reaches target period
│   ├── Executes distributeRewards(pollId) automatically
│   ├── No external trigger needed
│   └── Emits event: "⏰ Deferred call triggered"
│
└── 5. Reward Distribution
    ├── Load poll data
    ├── Get all voters
    ├── Calculate reward per voter = rewardPool / totalVoters
    ├── Batch process (up to 50 voters per call)
    ├── For each voter:
    │   ├── transferCoins(voterAddress, rewardAmount)
    │   ├── Mark as claimed: Storage.set("claim_{pollId}_{voter}", true)
    │   └── Emit: "Distributed {amount} to {voter}"
    └── Emit: "✅ All rewards distributed"
```

### Period Calculation Details

```
Massa Blockchain Period System
│
├── Period Definition
│   ├── Duration: 16 seconds (16,000 milliseconds)
│   ├── Sequential numbering: 0, 1, 2, 3, ...
│   └── Current period: Context.currentPeriod()
│
├── Time to Period Conversion (Ceiling Division)
│   │
│   ├── Formula: periodsFromNow = (timeDifferenceMs + 15999) / 16000
│   │
│   ├── Why ceiling division?
│   │   ├── Integer division in AssemblyScript truncates
│   │   ├── Must round UP to ensure future execution
│   │   └── Adding (divisor - 1) before dividing achieves ceiling
│   │
│   └── Examples:
│       ├── 30,000 ms (30s)
│       │   └── (30,000 + 15,999) / 16,000 = 45,999 / 16,000 = 2.87 → 2 periods
│       ├── 16,000 ms (16s)
│       │   └── (16,000 + 15,999) / 16,000 = 31,999 / 16,000 = 1.99 → 1 period
│       ├── 3,600,000 ms (1 hour)
│       │   └── (3,600,000 + 15,999) / 16,000 = 225 periods
│       └── 158,400,000 ms (44 hours)
│           └── (158,400,000 + 15,999) / 16,000 = 9,900 periods
│
├── Constraints
│   ├── Minimum: 2 periods (32 seconds)
│   │   └── Ensures deferred call is in future, not current period
│   ├── Maximum: 10,000 periods (44 hours, 26 minutes, 40 seconds)
│   │   └── Massa blockchain limit for deferred calls
│   └── Validation: assert(2 ≤ periodsFromNow ≤ 10,000)
│
└── Execution Accuracy
    ├── Scheduled for specific period + thread
    ├── Executes within that period (16-second window)
    ├── Actual execution time: ±16-32 seconds from scheduled timestamp
    └── Depends on blockchain block production timing
```

### Cost Management

```
Deferred Call Cost Architecture
│
├── Cost Components
│   ├── Base fee for deferred call registration
│   ├── Gas reservation (200M gas)
│   ├── Storage cost for call data
│   └── Slot availability premium
│
├── Cost Calculation
│   ├── Function: deferredCallQuote(slot, maxGas, paramsSize)
│   ├── Inputs:
│   │   ├── slot: {period, thread}
│   │   ├── maxGas: 200,000,000
│   │   └── paramsSize: Length of serialized arguments
│   └── Output: Cost in nanoMassa (1 MASSA = 10^9 nanoMassa)
│
├── Contract Balance Management
│   ├── Required: Contract must have sufficient balance
│   ├── Typical cost: ~2 MASSA per deferred call
│   ├── Recommended balance: 10+ MASSA
│   ├── Deployment: Contract funded with 10 MASSA
│   └── Top-up: npm run fund-contract (sends 10 MASSA)
│
└── Balance Verification
    ├── Check before registration: balance() ≥ cost
    ├── Assert fails if insufficient
    └── Error: "Insufficient balance for deferred call"
```

---

## Data Flow

### Poll Creation Flow

```
User → CreatePoll Component
    │
    ├── 1. Form Input & Validation
    │   ├── Step 1: Title, Description, End Time, Project
    │   ├── Step 2: Options (min 2)
    │   └── Step 3: Reward Pool, Distribution Type
    │
    ├── 2. Form Submission
    │   └── handleSubmit()
    │
    ├── 3. Contract Interaction
    │   ├── contractInteraction.createPoll()
    │   ├── Serialize arguments with Args
    │   └── account.call(CONTRACT_ADDRESS, "createPoll", serialized)
    │
    ├── 4. Wallet Confirmation
    │   └── Massa Station shows transaction preview
    │
    ├── 5. Blockchain Execution
    │   ├── Transaction broadcast to Massa network
    │   ├── Contract.createPoll() executes
    │   ├── Poll stored: Storage.set("poll_{id}", poll)
    │   ├── Counter incremented
    │   └── Event emitted: "Poll created: {id} - {title}"
    │
    └── 6. Frontend Update
        ├── Transaction success callback
        ├── Redirect to poll results page
        └── Display success message
```

### Voting Flow

```
User → PollResults Component
    │
    ├── 1. View Poll Details
    │   ├── Fetch poll: contractInteraction.getPoll(pollId)
    │   ├── Check vote status: contractInteraction.hasVoted(pollId, address)
    │   └── Display options and current results
    │
    ├── 2. Select Option & Click Vote
    │   └── handleVote(optionIndex)
    │
    ├── 3. Contract Interaction
    │   ├── contractInteraction.vote(pollId, optionIndex)
    │   ├── Serialize arguments
    │   └── account.call(CONTRACT_ADDRESS, "vote", serialized)
    │
    ├── 4. Blockchain Execution
    │   ├── Contract.vote() executes
    │   ├── Validate:
    │   │   ├── Poll is active
    │   │   ├── User hasn't voted
    │   │   └── Option index is valid
    │   ├── Store vote: Storage.set("vote_{pollId}_{voter}", vote)
    │   ├── Update poll vote counts
    │   └── Event emitted: "Vote cast: Poll {id}, Option {index}"
    │
    └── 5. Frontend Update
        ├── Refresh poll results
        ├── Update vote counts and percentages
        ├── Disable voting button
        └── Display success message
```

### Autonomous Distribution Flow

```
Poll Creator → CreatorDashboard
    │
    ├── 1. Close Poll with Auto-Distribution
    │   ├── Click "Schedule Auto-Distribution"
    │   ├── DistributionTimePicker Modal opens
    │   └── Set delay: 1-44 hours (or 32 seconds to 44 hours)
    │
    ├── 2. Calculate Distribution Time
    │   ├── Frontend calculates: timestamp = now + delayMs
    │   ├── Display scheduled time
    │   └── User confirms
    │
    ├── 3. Close Poll Transaction
    │   ├── contractInteraction.closePoll(pollId, distributionTime)
    │   └── account.call(CONTRACT_ADDRESS, "closePoll", serialized)
    │
    ├── 4. Contract Execution - closePoll()
    │   ├── Validate caller is creator
    │   ├── Mark poll as inactive
    │   ├── Store distribution time
    │   │
    │   ├── Period Calculation
    │   │   ├── currentTime = Context.timestamp()
    │   │   ├── timeDiff = distributionTime - currentTime
    │   │   ├── periodsFromNow = (timeDiff + 15999) / 16000
    │   │   └── Validate: 2 ≤ periodsFromNow ≤ 10,000
    │   │
    │   └── Call registerDeferredDistribution(pollId, periodsFromNow)
    │
    ├── 5. Deferred Call Registration
    │   ├── Find slot: findCheapestSlot(targetPeriod, targetPeriod, 200M, size)
    │   ├── Quote cost: deferredCallQuote(slot, 200M, size)
    │   ├── Verify balance: balance() ≥ cost
    │   ├── Register: deferredCallRegister(...)
    │   ├── Store call ID: Storage.set("deferred_call_{pollId}", callId)
    │   └── Event: "✅ Deferred call registered for poll {id}"
    │
    ├── 6. Frontend Update
    │   ├── Poll marked as "Closed"
    │   ├── DistributionCountdown component shows countdown
    │   ├── Status: "Pending Distribution"
    │   └── Countdown updates every second
    │
    ├── 7. Wait Period (Blockchain Scheduling)
    │   ├── Massa blockchain waits for target period
    │   ├── Countdown timer approaches zero
    │   └── User can monitor status
    │
    ├── 8. Automatic Execution (at scheduled time)
    │   ├── Blockchain reaches target period
    │   ├── distributeRewards(pollId) executes automatically
    │   ├── Event: "⏰ Deferred call triggered: Distributing rewards"
    │   │
    │   ├── Load poll and voters
    │   ├── Calculate reward per voter
    │   ├── For each voter (up to 50):
    │   │   ├── transferCoins(voter, reward)
    │   │   ├── Storage.set("claim_{pollId}_{voter}", true)
    │   │   └── Event: "Distributed {amount} to {voter}"
    │   │
    │   └── Event: "✅ All rewards distributed for poll {id}"
    │
    └── 9. Frontend Detection
        ├── Auto-refresh polls data
        ├── DistributionCountdown shows "Distributed"
        ├── Distribution Status modal updates
        ├── All voters marked as "✓ Distributed"
        └── Creator sees completion in dashboard
```

### Manual Push Distribution Flow

```
Poll Creator → CreatorDashboard
    │
    ├── 1. Close Poll (without scheduling)
    │   ├── Click "Close Poll"
    │   ├── Confirm closure
    │   └── Poll marked as closed
    │
    ├── 2. Manual Distribution Trigger
    │   ├── Click "Distribute Rewards" button
    │   ├── Confirm distribution
    │   └── contractInteraction.distributeRewards(pollId)
    │
    ├── 3. Contract Execution
    │   ├── Load poll and voters
    │   ├── Batch process (up to 50 voters)
    │   ├── Transfer rewards to each voter
    │   ├── Mark as claimed
    │   └── Emit distribution events
    │
    └── 4. Frontend Update
        ├── Transaction success
        ├── Update distribution status
        ├── Show all voters as "✓ Distributed"
        └── Display success message
```

### Manual Pull Claiming Flow

```
Voter → MyWallet Component
    │
    ├── 1. View Claimable Rewards
    │   ├── Fetch voted polls
    │   ├── Check claim status for each poll
    │   └── Display claimable amounts
    │
    ├── 2. Claim Reward
    │   ├── Click "Claim" button
    │   ├── Confirm transaction
    │   └── contractInteraction.claimReward(pollId)
    │
    ├── 3. Contract Execution
    │   ├── Validate:
    │   │   ├── Poll is closed
    │   │   ├── Distribution type is MANUAL_PULL
    │   │   ├── Caller voted
    │   │   └── Not already claimed
    │   ├── Calculate reward amount
    │   ├── transferCoins(caller, reward)
    │   ├── Storage.set("claim_{pollId}_{caller}", true)
    │   └── Event: "Reward claimed: {amount} by {caller}"
    │
    └── 4. Frontend Update
        ├── Remove from claimable list
        ├── Update wallet balance
        ├── Show claim confirmation
        └── Update statistics
```

---

## Security Architecture

### Access Control

```
Security Layers
│
├── Poll Creation
│   ├── Anyone can create polls
│   └── Creator address stored in poll
│
├── Voting
│   ├── Only one vote per address per poll
│   ├── Check: hasVoted(pollId, voter)
│   ├── Validation: Poll must be active
│   └── Validation: Option index must be valid
│
├── Poll Closure
│   ├── Only poll creator can close their poll
│   ├── Validation: Context.caller() == poll.creator
│   └── Cannot close already closed poll
│
├── Distribution (Manual Push)
│   ├── Only poll creator can trigger
│   ├── Validation: Context.caller() == poll.creator
│   └── Poll must be closed
│
├── Claiming (Manual Pull)
│   ├── Only voters can claim their own rewards
│   ├── Validation: Caller must have voted
│   ├── Validation: Not already claimed
│   └── Validation: Distribution type is MANUAL_PULL
│
└── Deferred Call Execution
    ├── Only blockchain can trigger (automatic)
    ├── No external access to deferred execution
    └── Scheduled at registration time
```

### Input Validation

```
Validation Architecture
│
├── Frontend Validation
│   ├── Form field validation
│   │   ├── Required fields
│   │   ├── Length constraints
│   │   ├── Format validation (email, dates)
│   │   └── Real-time error display
│   │
│   ├── Business logic validation
│   │   ├── Minimum 2 options
│   │   ├── End time in future
│   │   ├── Distribution delay constraints (32s to 44h)
│   │   └── Sufficient wallet balance
│   │
│   └── Auto-focus on errors
│       └── Scroll to first invalid field
│
├── Smart Contract Validation
│   ├── Argument deserialization checks
│   ├── Address validation
│   ├── Timestamp validation
│   │   ├── End time > current time
│   │   └── Distribution time > current time
│   ├── Period range validation (2-10,000)
│   ├── Option index bounds checking
│   ├── Balance sufficiency checks
│   └── State consistency checks
│
└── Error Handling
    ├── Throw assertions with descriptive messages
    ├── Emit debug events for troubleshooting
    └── Return Result types for query functions
```

### Balance Protection

```
Balance Security
│
├── Reward Pool Validation
│   ├── Check pool amount > 0 (if set)
│   ├── Ensure sufficient pool for distribution
│   └── Prevent over-distribution
│
├── Contract Balance
│   ├── Check before deferred call registration
│   ├── Ensure: balance() ≥ deferredCallQuote()
│   └── Assert fails if insufficient
│
├── Transfer Safety
│   ├── Calculate reward per voter
│   ├── Verify: rewardPerVoter ≤ rewardPool / totalVoters
│   ├── transferCoins() with exact amounts
│   └── Track distributed amounts
│
└── Claim Prevention
    ├── One claim per voter per poll
    ├── Storage flag: "claim_{pollId}_{voter}" = true
    ├── Check before every claim/distribution
    └── Prevent double-spending
```

### Reentrancy Protection

```
Reentrancy Prevention
│
├── State Updates Before External Calls
│   ├── Pattern: Checks-Effects-Interactions
│   ├── Update Storage BEFORE transferCoins
│   │   └── Storage.set("claim_...", true) → transferCoins(...)
│   └── Prevents recursive claim attempts
│
├── Event Emission Order
│   ├── Emit events after state changes
│   ├── Events are read-only, safe
│   └── Audit trail for all operations
│
└── Batch Processing Limits
    ├── Maximum 50 voters per distribution call
    ├── Prevents gas exhaustion attacks
    └── Allows completion tracking
```

---

## Technology Stack

### Frontend (dApp)

```
Frontend Stack
│
├── Core Framework
│   ├── React 18.x
│   ├── TypeScript 5.x
│   ├── Vite (build tool)
│   └── React Router (routing)
│
├── UI Components
│   ├── Material-UI (MUI)
│   ├── Custom CSS (App.css, CreatePoll.css, etc.)
│   └── Responsive design (mobile-first)
│
├── Charts & Visualization
│   ├── Recharts library
│   ├── Bar charts, Pie charts, Line charts
│   └── Real-time data updates
│
├── Blockchain Integration
│   ├── @massalabs/massa-web3 (v4.x)
│   ├── @massalabs/wallet-provider
│   ├── JsonRpcProvider (Buildnet)
│   └── Account management
│
└── State Management
    ├── React Hooks (useState, useEffect, useRef, useCallback)
    ├── Component-level state
    └── Provider pattern for wallet context
```

### Smart Contract

```
Smart Contract Stack
│
├── Programming Language
│   ├── AssemblyScript (TypeScript subset)
│   ├── Compiles to WebAssembly (WASM)
│   └── Optimized for blockchain execution
│
├── SDK & Libraries
│   ├── @massalabs/massa-as-sdk
│   │   ├── Storage, Context, Args
│   │   ├── Address, transferCoins
│   │   ├── Deferred calls API
│   │   └── Event emission
│   │
│   └── @massalabs/as-types
│       ├── Serialization (Args, Result)
│       └── Type definitions
│
├── Blockchain Platform
│   ├── Massa Blockchain
│   ├── Buildnet (testnet)
│   ├── Native deferred calls
│   └── 16-second periods
│
└── Development Tools
    ├── AssemblyScript compiler
    ├── Massa Web3 SDK (deployment)
    ├── Node.js scripts (deploy, test, monitor)
    └── TypeScript (deployment scripts)
```

### Development & Deployment

```
DevOps Stack
│
├── Version Control
│   └── Git / GitHub
│
├── Package Management
│   └── npm
│
├── Build Tools
│   ├── Vite (frontend bundling)
│   ├── AssemblyScript compiler (contract)
│   └── TypeScript compiler
│
├── Environment Configuration
│   ├── .env.local (frontend)
│   ├── .env (contract)
│   └── Configuration files
│
├── Deployment
│   ├── Frontend: Static hosting (Vercel, Netlify, etc.)
│   ├── Contract: Massa Buildnet
│   └── Automated deployment scripts
│
└── Monitoring
    ├── Contract events (blockchain explorer)
    ├── Distribution status script
    └── Balance checking script
```

### Network Architecture

```
Network Layer
│
├── Massa Buildnet
│   ├── RPC Endpoint: https://buildnet.massa.net/api/v2
│   ├── Chain ID: 77658377
│   ├── Period: 16 seconds
│   └── Currency: MASSA (testnet)
│
├── JSON-RPC Communication
│   ├── Frontend → RPC Provider
│   ├── Read operations (getPoll, etc.)
│   ├── Write operations (vote, createPoll, etc.)
│   └── Event fetching
│
└── Wallet Integration
    ├── Massa Station browser extension
    ├── Transaction signing
    ├── Account management
    └── Balance queries
```

---

## Deployment Architecture

### Contract Deployment Flow

```
Contract Deployment
│
├── 1. Build Contract
│   ├── npm run build (in mpolls-contract)
│   ├── AssemblyScript → WebAssembly
│   └── Output: build/main.wasm
│
├── 2. Deployment Script
│   ├── src/deploy.ts
│   ├── Load compiled bytecode
│   ├── Create deployment transaction
│   └── Configure:
│       ├── coins: 10 MASSA (contract funding)
│       └── fee: 0.01 MASSA
│
├── 3. Blockchain Deployment
│   ├── Deploy to Massa Buildnet
│   ├── Contract address generated
│   └── Initial balance: 10 MASSA
│
└── 4. Configuration Update
    ├── Update .env: CONTRACT_ADDRESS=AS12...
    ├── Update frontend .env.local
    └── Contract ready for use
```

### Frontend Deployment Flow

```
Frontend Deployment
│
├── 1. Build Frontend
│   ├── npm run build (in mpolls-dapp)
│   ├── Vite bundles React app
│   ├── Optimize assets
│   └── Output: dist/ directory
│
├── 2. Environment Configuration
│   ├── Set VITE_POLLS_CONTRACT_ADDRESS
│   └── Configure RPC endpoint (optional)
│
├── 3. Deploy to Hosting
│   ├── Upload dist/ to static host
│   ├── Options: Vercel, Netlify, GitHub Pages
│   └── Configure domain (optional)
│
└── 4. Access dApp
    └── Users access via URL with Massa Station wallet
```

---

## Performance Considerations

### Frontend Optimization

- Code splitting for reduced initial bundle size
- Lazy loading of chart components
- Efficient state updates (useCallback, useMemo)
- Debounced search and filter operations
- Optimistic UI updates for better UX

### Smart Contract Optimization

- Efficient storage key design
- Batch processing (50 voters per call)
- Minimal storage operations
- Optimized serialization/deserialization
- Event-driven architecture for frontend sync

### Blockchain Optimization

- Deferred calls reduce manual intervention
- Automatic execution at scheduled time
- Gas optimization for distribution
- Efficient slot finding algorithm
- Minimal on-chain data storage

---

## Future Architecture Enhancements

### Potential Improvements

1. **Multi-token Support**: Native integration with multiple token standards
2. **Quadratic Voting**: Weight votes based on stake
3. **Privacy Features**: Zero-knowledge proofs for anonymous voting
4. **Cross-chain Bridge**: Integration with other blockchains
5. **DAO Governance**: Decentralized platform governance
6. **Advanced Analytics**: Machine learning for poll insights
7. **Scalability**: Layer 2 solutions for higher throughput
8. **Mobile App**: Native iOS/Android applications

---

## Conclusion

The MPolls architecture demonstrates a comprehensive integration of modern web technologies with blockchain capabilities. The autonomous distribution system, powered by Massa's native deferred calls, provides a unique fully-automated reward distribution mechanism that sets it apart from traditional polling platforms.

Key architectural strengths:
- **Decentralization**: Fully on-chain poll storage and execution
- **Automation**: No external triggers needed for scheduled operations
- **Security**: Multiple validation layers and access controls
- **User Experience**: Intuitive multi-step forms with real-time validation
- **Scalability**: Batch processing and efficient storage patterns
- **Transparency**: Event-driven architecture with full audit trail

For further details, refer to the individual documentation files and source code.
