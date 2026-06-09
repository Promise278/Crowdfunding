const { ethers, run } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ── Deploy ────────────────────────────────────────────────────────────────
  console.log("Deploying CrowdFund...");
  const CrowdFund = await ethers.getContractFactory("CrowdFund");
  const cf        = await CrowdFund.deploy();

  await cf.waitForDeployment();
  const address = await cf.getAddress();

  console.log("rowdFund deployed to:", address);
  console.log("   Tx hash:", cf.deploymentTransaction().hash);

  // ── Verify on Etherscan ───────────────────────────────────────────────────
  // Wait a few blocks so Etherscan indexes the contract before verifying
  console.log("\nWaiting 30s for Etherscan to index the contract...");
  await new Promise(r => setTimeout(r, 30_000));

  try {
    await run("verify:verify", {
      address,
      constructorArguments: [],
    });
    console.log("Contract verified on Etherscan");
  } catch (e) {
    if (e.message.includes("Already Verified")) {
      console.log("ℹAlready verified");
    } else {
      console.error("Verification failed:", e.message);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────");
  console.log("Contract address :", address);
  console.log("Sepolia explorer :", `https://sepolia.etherscan.io/address/${address}`);
  console.log("\nAdd this to frontend/.env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log("─────────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
