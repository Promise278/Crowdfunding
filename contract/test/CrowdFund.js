const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrowdFund", function () {
  const E = (n) => ethers.parseEther(String(n));
  const DAY = 86400;

  async function deploy() {
    const [owner, creator, b1, b2, b3, stranger] = await ethers.getSigners();
    const cf = await (await ethers.getContractFactory("CrowdFund")).deploy();
    return { cf, owner, creator, b1, b2, b3, stranger };
  }

  // Campaign with 3 backers who fully fund it, then one milestone open for voting
  async function ready() {
    const base = await loadFixture(deploy);
    const { cf, creator, b1, b2, b3 } = base;
    await cf.connect(creator).createCampaign("P", "D", E(1), 7);
    await cf.connect(b1).contribute(0n, { value: E("0.4") });
    await cf.connect(b2).contribute(0n, { value: E("0.4") });
    await cf.connect(b3).contribute(0n, { value: E("0.2") });
    await time.increase(8 * DAY);
    await cf.finaliseCampaign(0n);
    await cf.connect(creator).addMilestone(0n, "M1", E("0.5"));
    await cf.connect(creator).requestMilestonePayout(0n, 0n);
    return { ...base, id: 0n };
  }

  // ── Campaign ──────────────────────────────────────────────────────────────
  describe("Campaign Creation", function () {
    it("stores correct data", async function () {
      const { cf, creator } = await loadFixture(deploy);
      await cf.connect(creator).createCampaign("T", "D", E(1), 7);
      const c = await cf.getCampaign(0n);
      expect(c.creator).to.equal(creator.address);
      expect(c.goal).to.equal(E(1));
      expect(c.status).to.equal(0n);
    });

    it("reverts: empty title / zero goal / bad duration", async function () {
      const { cf, creator } = await loadFixture(deploy);
      await expect(cf.connect(creator).createCampaign("", "D", E(1), 7)).to.be.revertedWith("Title required");
      await expect(cf.connect(creator).createCampaign("T", "D", 0n, 7)).to.be.revertedWith("Goal must be > 0");
      await expect(cf.connect(creator).createCampaign("T", "D", E(1), 0n)).to.be.revertedWith("Duration: 1-365 days");
    });
  });

  // ── Funding ───────────────────────────────────────────────────────────────
  describe("Funding", function () {
    it("records and accumulates contributions", async function () {
      const { cf, creator, b1 } = await loadFixture(deploy);
      await cf.connect(creator).createCampaign("T", "D", E(1), 7);
      await cf.connect(b1).contribute(0n, { value: E("0.3") });
      await cf.connect(b1).contribute(0n, { value: E("0.2") });
      expect(await cf.getContribution(0n, b1.address)).to.equal(E("0.5"));
    });

    it("reverts: after deadline / zero value", async function () {
      const { cf, creator, b1 } = await loadFixture(deploy);
      await cf.connect(creator).createCampaign("T", "D", E(1), 7);
      await time.increase(8 * DAY);
      await expect(cf.connect(b1).contribute(0n, { value: E("0.5") })).to.be.revertedWith("Campaign deadline passed");
      // reset – new campaign
      await cf.connect(creator).createCampaign("T2", "D", E(1), 7);
      await expect(cf.connect(b1).contribute(1n, { value: 0n })).to.be.revertedWith("Must send ETH");
    });
  });

  // ── Refunds ───────────────────────────────────────────────────────────────
  describe("Refunds", function () {
    async function failed() {
      const base = await loadFixture(deploy);
      const { cf, creator, b1 } = base;
      await cf.connect(creator).createCampaign("T", "D", E(1), 7);
      await cf.connect(b1).contribute(0n, { value: E("0.3") }); // under goal
      await time.increase(8 * DAY);
      await cf.finaliseCampaign(0n);
      return { ...base, id: 0n };
    }

    it("allows refund; prevents double refund", async function () {
      const { cf, b1, id } = await failed();
      // balance should increase after refund
      const before = await ethers.provider.getBalance(b1.address);
      await cf.connect(b1).claimRefund(id);
      expect(await ethers.provider.getBalance(b1.address)).to.be.gt(before);
      await expect(cf.connect(b1).claimRefund(id)).to.be.revertedWith("Refund already claimed");
    });

    it("reverts: non-contributor / campaign not failed", async function () {
      const { cf, stranger, b1, id } = await failed();
      await expect(cf.connect(stranger).claimRefund(id)).to.be.revertedWith("Not a contributor");
      // active campaign – not failed
      const { cf: cf2, creator, b1: bk } = await loadFixture(deploy);
      await cf2.connect(creator).createCampaign("T", "D", E(1), 7);
      await cf2.connect(bk).contribute(0n, { value: E("0.5") });
      await expect(cf2.connect(bk).claimRefund(0n)).to.be.revertedWith("Campaign did not fail");
    });
  });

  // ── Voting ────────────────────────────────────────────────────────────────
  describe("Voting", function () {
    it("approve and reject update counts", async function () {
      const { cf, b1, b2, id } = await ready();
      await cf.connect(b1).vote(id, 0n, true);
      await cf.connect(b2).vote(id, 0n, false);
      const ms = await cf.getMilestones(id);
      expect(ms[0].approvals).to.equal(1n);
      expect(ms[0].rejections).to.equal(1n);
    });

    it("reverts: double vote / non-contributor / after period", async function () {
      const { cf, b1, stranger, id } = await ready();
      await cf.connect(b1).vote(id, 0n, true);
      await expect(cf.connect(b1).vote(id, 0n, true)).to.be.revertedWith("Already voted");
      await expect(cf.connect(stranger).vote(id, 0n, true)).to.be.revertedWith("Not a contributor");
      await time.increase(4 * DAY);
      await expect(cf.connect(b1).vote(id, 0n, true)).to.be.revertedWith("Voting period ended");
    });
  });

  // ── Escrow ────────────────────────────────────────────────────────────────
  describe("Escrow", function () {
    it("releases funds on majority approval", async function () {
      const { cf, creator, b1, b2, id } = await ready();
      await cf.connect(b1).vote(id, 0n, true);
      await cf.connect(b2).vote(id, 0n, true);
      await time.increase(4 * DAY);
      const before = await ethers.provider.getBalance(creator.address);
      await cf.finaliseVoting(id, 0n);
      expect(await ethers.provider.getBalance(creator.address) - before).to.equal(E("0.5"));
    });

    it("holds funds when majority rejects", async function () {
      const { cf, b1, b2, b3, id } = await ready();
      await cf.connect(b1).vote(id, 0n, false);
      await cf.connect(b2).vote(id, 0n, false);
      await cf.connect(b3).vote(id, 0n, true);
      await time.increase(4 * DAY);
      await cf.finaliseVoting(id, 0n);
      // milestone should NOT be completed
      const ms = await cf.getMilestones(id);
      expect(ms[0].completed).to.equal(false);
    });

    it("reverts: before period ends / unauthorised request", async function () {
      const { cf, b1, stranger, id } = await ready();
      await cf.connect(b1).vote(id, 0n, true);
      await expect(cf.finaliseVoting(id, 0n)).to.be.revertedWith("Voting period still active");
      await expect(cf.connect(stranger).requestMilestonePayout(id, 0n)).to.be.revertedWith("Not campaign creator");
    });
  });
});
