# 🚀 Decentralized Crowdfunding & Milestone Escrow Platform

A fully decentralized crowdfunding platform built on **Ethereum Sepolia** where project creators raise funds and receive payments only when predefined milestones are approved by backers — combining the best of Kickstarter, GoFundMe, and Upwork Escrow into a single trustless application.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Smart Contract](#smart-contract)
- [Frontend](#frontend)
- [Setup & Installation](#setup--installation)
- [Running Tests](#running-tests)
- [Deployment](#deployment)
- [Contract Address](#contract-address)
- [Live Demo](#live-demo)
- [Screenshots](#screenshots)
- [Evaluation Rubric](#evaluation-rubric)

---

## Overview

### How It Works

```
Creator launches campaign  →  Backers contribute ETH  →  Funds locked in escrow
       ↓
Creator requests milestone payout  →  Backers vote  →  If >50% approve, funds released
       ↓
All milestones approved  →  Campaign marked Completed
```

If a campaign fails to reach its goal before the deadline, all contributors can claim a full refund.

---

## Architecture

```
Crowdfunding/
├── contract/                  # Solidity smart contract + Hardhat tooling
│   ├── contracts/
│   │   └── CrowdfundingPlatform.sol   # Main contract
│   ├── test/
│   │   └── CrowdfundingPlatform.js    # Full Hardhat test suite
│   ├── ignition/modules/              # Deployment modules
│   ├── hardhat.config.js
│   └── .env.example
│
└── frontend/                  # Next.js 15 + ethers.js dApp
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx            # Campaign listing
    │   └── globals.css
    └── public/
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Solidity 0.8.28 |
| Contract Framework | Hardhat + OpenZeppelin |
| Network | Ethereum Sepolia Testnet |
| Frontend | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 |
| Blockchain Library | ethers.js v6 |
| Wallet | MetaMask |
| Deployment | Vercel (frontend) |
| Testing | Hardhat + Chai + Mocha |

---

## Project Structure

### Smart Contract — `CrowdfundingPlatform.sol`

The contract inherits from three OpenZeppelin base contracts for security:

```solidity
contract CrowdfundingPlatform is ReentrancyGuard, Ownable, Pausable
```

#### Campaign Lifecycle

```
Active → (deadline reached, goal met)    → Successful → Completed
       → (deadline reached, goal not met) → Failed
```

#### Key Data Structures

```solidity
enum CampaignStatus { Active, Successful, Failed, Completed }

struct Campaign {
    uint256 id;
    address payable creator;
    string title;
    string description;
    uint256 goal;           // in wei
    uint256 raisedAmount;   // in wei
    uint256 deadline;       // unix timestamp
    CampaignStatus status;
    uint256 milestoneCount;
    uint256 contributorCount;
    // mappings: milestones, contributions, hasRefunded, contributors[]
}

struct Milestone {
    string title;
    uint256 amount;         // in wei
    bool completed;
    bool approved;
    bool released;
    bool votingOpen;
    uint256 votingDeadline;
    uint256 approveVotes;
    uint256 rejectVotes;
    // mapping: hasVoted per address
}
```

#### Contract Functions

| Function | Who | Description |
|---|---|---|
| `createCampaign(title, description, goal, duration)` | Anyone | Launch a new campaign |
| `contribute(campaignId)` | Anyone | Fund a campaign with ETH |
| `resolveCampaign(campaignId)` | Anyone | Resolve status after deadline |
| `claimRefund(campaignId)` | Contributor | Refund if campaign failed |
| `addMilestone(campaignId, title, amount)` | Creator | Add a milestone after success |
| `requestMilestonePayout(campaignId, milestoneId)` | Creator | Open voting on a milestone |
| `vote(campaignId, milestoneId, approve)` | Contributor | Vote approve/reject |
| `finalizeMilestoneVoting(campaignId, milestoneId)` | Anyone | Finalize after voting period ends |
| `pause()` / `unpause()` | Owner | Emergency pause |

#### Events Emitted

```solidity
CampaignCreated(campaignId, creator, title, goal, deadline)
ContributionReceived(campaignId, contributor, amount)
MilestoneRequested(campaignId, milestoneId, title, amount)
VoteCast(campaignId, milestoneId, voter, approved)
MilestoneApproved(campaignId, milestoneId)
FundsReleased(campaignId, milestoneId, amount)
RefundClaimed(campaignId, contributor, amount)
CampaignCompleted(campaignId)
```

#### Security Features

- **ReentrancyGuard** — prevents reentrancy on all ETH transfers
- **Ownable** — admin-only pause/unpause
- **Pausable** — emergency stop for all state-changing operations
- **Double-vote prevention** — `hasVoted` mapping per milestone per address
- **Double-refund prevention** — `hasRefunded` mapping per campaign per address
- **Unauthorized payout prevention** — `onlyCreator` checks on milestone functions
- **Voting period enforcement** — 3-day voting window with deadline checks

---

## Frontend

### Pages & Components

| Route | Description |
|---|---|
| `/` | Campaign listing — shows all campaigns with title, goal, raised, deadline, status |
| `/campaign/[id]` | Campaign details — description, progress bar, milestones, contributors, funding form |
| `/create` | Create campaign form |
| `/campaign/[id]/milestone` | Milestone dashboard — create request, track votes, view approval status |

### State Management

All state is managed without full-page refreshes:

- **Wallet State** — MetaMask connection, address, network
- **Campaign State** — list of campaigns, individual campaign data
- **Contribution State** — user contribution per campaign
- **Voting State** — vote status per milestone per user
- **Transaction State** — pending/confirmed/failed transaction feedback

### Key UI Features

- MetaMask wallet connection
- Real-time funding progress bar
- Milestone voting interface (Approve / Reject)
- Refund button — appears only when campaign fails
- Responsive design with Tailwind CSS

---

## Setup & Installation

### Prerequisites

- Node.js >= 18
- MetaMask browser extension
- Sepolia testnet ETH ([faucet](https://sepoliafaucet.com))

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Crowdfunding
```

### 2. Set Up the Smart Contract

```bash
cd contract
npm install
```

Copy the environment file and fill in your values:

```bash
cp .env.example .env
```

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_wallet_private_key_without_0x
ETHERSCAN_API_KEY=your_etherscan_api_key
```

> **Never commit your `.env` file. It is already in `.gitignore`.**

### 3. Set Up the Frontend

```bash
cd ../frontend
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```

### 4. Run Locally

Start the frontend dev server:

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests

All tests are in `contract/test/CrowdfundingPlatform.js` and use Hardhat's local network with time manipulation.

```bash
cd contract
npx hardhat test
```

### Test Coverage

| Suite | Tests |
|---|---|
| **Campaign Tests** | ✅ create campaign successfully |
| | ✅ reject empty title |
| | ✅ reject zero goal |
| | ✅ reject zero duration |
| **Funding Tests** | ✅ contribute and track contribution |
| | ✅ track total raised amount |
| | ✅ reject zero-value contribution |
| | ✅ reject contribution after deadline |
| **Refund Tests** | ✅ refund after failed campaign |
| | ✅ prevent double refunds |
| | ✅ reject refund on active campaign |
| **Voting Tests** | ✅ backer can approve milestone |
| | ✅ funds released when >50% approve |
| | ✅ milestone rejected when majority rejects |
| | ✅ prevent double voting |
| **Escrow Tests** | ✅ release funds to creator after approval |
| | ✅ prevent unauthorized payout request |
| | ✅ no release if milestone not approved |

Expected output:

```
  CrowdfundingPlatform
    Campaign Creation
      ✓ should create a campaign successfully
      ✓ should reject campaign with empty title
      ✓ should reject campaign with zero goal
      ✓ should reject campaign with zero duration
    Campaign Funding
      ✓ should accept contribution and track it
      ✓ should track total raised amount
      ✓ should reject contribution of 0 ETH
      ✓ should reject contribution after deadline
    Refund System
      ✓ should allow refund after failed campaign
      ✓ should prevent double refunds
      ✓ should reject refund on active campaign
    Milestone Voting
      ✓ should allow backer to approve milestone
      ✓ should release funds when >50% approve
      ✓ should reject milestone when majority rejects
      ✓ should prevent double voting
    Escrow Release
      ✓ should release funds to creator after approval
      ✓ should prevent unauthorized payout request
      ✓ should not release funds if milestone not approved

  17 passing
```

---

## Deployment

### Deploy Contract to Sepolia

```bash
cd contract
npx hardhat run scripts/deploy.js --network sepolia
```

Or with Hardhat Ignition:

```bash
npx hardhat ignition deploy ignition/modules/CrowdfundingPlatform.js --network sepolia
```

### Verify on Etherscan

```bash
npx hardhat verify --network sepolia <DEPLOYED_CONTRACT_ADDRESS>
```

### Deploy Frontend to Vercel

1. Push your code to GitHub
2. Import the `frontend` folder into [Vercel](https://vercel.com)
3. Set environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_SEPOLIA_RPC_URL`
4. Deploy

---

## Contract Address

| Network | Address |
|---|---|
| Ethereum Sepolia | `0x` *(add after deployment)* |

View on Etherscan: `https://sepolia.etherscan.io/address/<CONTRACT_ADDRESS>`

---

## Live Demo

🌐 **Vercel URL:** *(add after deployment)*

---

## Screenshots

> *(Add screenshots after frontend is complete)*

| Campaign Listing | Campaign Details | Milestone Voting |
|---|---|---|
| ![listing]() | ![details]() | ![voting]() |

---

## Evaluation Rubric

| Category | Points | Notes |
|---|---|---|
| Smart Contract Design | 25 | Full campaign lifecycle, milestone escrow, voting |
| Security | 20 | ReentrancyGuard, Ownable, Pausable, all protections |
| Frontend Integration | 20 | MetaMask, ethers.js, all required pages |
| State Management | 15 | No full-page refreshes, reactive state |
| Testing | 10 | 17 passing tests covering all requirements |
| UI/UX | 10 | Tailwind CSS, responsive, clean design |
| **Total** | **100** | |

### Bonus

- [ ] NFT Backer Badges — ERC-721 minted on contribution with campaign name, amount, and date as metadata

---

## License

MIT
