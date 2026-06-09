// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract CrowdFund is ReentrancyGuard, Ownable, Pausable {

    enum Status { Active, Successful, Failed, Completed }

    struct Campaign {
        address creator;
        string  title;
        string  description;
        uint256 goal;
        uint256 raised;
        uint256 deadline;
        uint256 contributorCount;
        Status  status;
    }

    struct Milestone {
        string  title;
        uint256 amount;
        uint256 approvals;
        uint256 rejections;
        uint256 votingDeadline;
        bool    votingOpen;
        bool    completed;
    }

    uint256 public campaignCount;

    mapping(uint256 => Campaign)                                      public campaigns;
    mapping(uint256 => Milestone[])                                   public milestones;
    mapping(uint256 => mapping(address => uint256))                   public contributions;
    mapping(uint256 => address[])                                     public contributors;
    mapping(uint256 => mapping(address => bool))                      public isContributor;
    mapping(uint256 => mapping(uint256 => mapping(address => bool)))  public voted;
    mapping(uint256 => mapping(address => bool))                      public refunded;

    constructor() Ownable(msg.sender) {}

    // ── Campaigns ─────────────────────────────────────────────────────────────

    function createCampaign(
        string calldata _title,
        string calldata _desc,
        uint256 _goal,
        uint256 _days
    ) external whenNotPaused {
        require(bytes(_title).length > 0, "Title required");
        require(_goal > 0, "Goal must be > 0");
        require(_days > 0 && _days <= 365, "Duration: 1-365 days");

        uint256 id = campaignCount++;
        campaigns[id] = Campaign(
            msg.sender, _title, _desc, _goal, 0,
            block.timestamp + _days * 1 days, 0, Status.Active
        );
    }

    function finaliseCampaign(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(c.status == Status.Active && block.timestamp >= c.deadline, "Not ready");
        c.status = c.raised >= c.goal ? Status.Successful : Status.Failed;
    }

    // ── Funding ───────────────────────────────────────────────────────────────

    function contribute(uint256 id) external payable nonReentrant whenNotPaused {
        Campaign storage c = campaigns[id];
        require(c.status == Status.Active, "Not active");
        require(block.timestamp < c.deadline, "Campaign deadline passed");
        require(msg.value > 0, "Must send ETH");

        if (!isContributor[id][msg.sender]) {
            isContributor[id][msg.sender] = true;
            contributors[id].push(msg.sender);
            c.contributorCount++;
        }
        contributions[id][msg.sender] += msg.value;
        c.raised += msg.value;
    }

    // ── Refund ────────────────────────────────────────────────────────────────

    function claimRefund(uint256 id) external nonReentrant {
        Campaign storage c = campaigns[id];
        require(c.status == Status.Failed, "Campaign did not fail");
        require(isContributor[id][msg.sender], "Not a contributor");
        require(!refunded[id][msg.sender], "Refund already claimed");

        uint256 amt = contributions[id][msg.sender];
        require(amt > 0, "Nothing to refund");

        refunded[id][msg.sender] = true;
        contributions[id][msg.sender] = 0;

        (bool ok,) = payable(msg.sender).call{value: amt}("");
        require(ok, "Transfer failed");
    }

    // ── Milestones ────────────────────────────────────────────────────────────

    function addMilestone(uint256 id, string calldata _title, uint256 _amount) external {
        Campaign storage c = campaigns[id];
        require(msg.sender == c.creator, "Not campaign creator");
        require(c.status == Status.Active || c.status == Status.Successful, "Invalid status");
        require(_amount > 0, "Amount must be > 0");
        milestones[id].push(Milestone(_title, _amount, 0, 0, 0, false, false));
    }

    function requestMilestonePayout(uint256 id, uint256 idx) external {
        Campaign storage c = campaigns[id];
        Milestone storage m = milestones[id][idx];
        require(msg.sender == c.creator, "Not campaign creator");
        require(c.status == Status.Successful, "Not successful");
        require(!m.votingOpen && !m.completed, "Already open/done");
        require(c.raised >= m.amount, "Insufficient funds");

        m.votingOpen = true;
        m.votingDeadline = block.timestamp + 3 days;
    }

    // ── Voting ────────────────────────────────────────────────────────────────

    function vote(uint256 id, uint256 idx, bool approve) external {
        require(isContributor[id][msg.sender], "Not a contributor");
        Milestone storage m = milestones[id][idx];
        require(m.votingOpen, "Voting not open");
        require(block.timestamp <= m.votingDeadline, "Voting period ended");
        require(!voted[id][idx][msg.sender], "Already voted");

        voted[id][idx][msg.sender] = true;
        if (approve) m.approvals++; else m.rejections++;
    }

    function finaliseVoting(uint256 id, uint256 idx) external nonReentrant {
        Campaign storage c = campaigns[id];
        Milestone storage m = milestones[id][idx];
        require(m.votingOpen, "Voting not open");
        require(block.timestamp > m.votingDeadline, "Voting period still active");
        require(!m.completed, "Already finalised");

        m.votingOpen = false;

        if (m.approvals * 2 > c.contributorCount) {
            m.completed = true;
            c.raised -= m.amount;

            (bool ok,) = payable(c.creator).call{value: m.amount}("");
            require(ok, "Payout failed");

            // Mark campaign completed if all milestones are done
            bool allDone = true;
            for (uint256 i = 0; i < milestones[id].length; i++) {
                if (!milestones[id][i].completed) { allDone = false; break; }
            }
            if (allDone) c.status = Status.Completed;
        }
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    function getCampaign(uint256 id)   external view returns (Campaign memory)  { return campaigns[id]; }
    function getMilestones(uint256 id) external view returns (Milestone[] memory) { return milestones[id]; }
    function getContributors(uint256 id) external view returns (address[] memory) { return contributors[id]; }
    function getContribution(uint256 id, address who) external view returns (uint256) { return contributions[id][who]; }

    function getAllCampaigns() external view returns (Campaign[] memory all) {
        all = new Campaign[](campaignCount);
        for (uint256 i = 0; i < campaignCount; i++) all[i] = campaigns[i];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
