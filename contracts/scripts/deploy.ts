import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("RSK Yield Agent - Contract Deployment");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} RBTC`);
  console.log("-".repeat(60));

  // 1. Deploy Vault
  console.log("\n[1/5] Deploying Vault...");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`  Vault deployed at: ${vaultAddress}`);

  // 2. Deploy SovrynAdapter (mock mode on testnet)
  console.log("\n[2/5] Deploying SovrynAdapter...");
  const SOVRYN_LOAN_TOKEN = process.env.SOVRYN_LOAN_TOKEN || ethers.ZeroAddress;
  const WRBTC = process.env.WRBTC_ADDRESS || "0x69FE5cEC81D5eF92600c1A0dB1F11986AB3758Ab";
  const SovrynAdapter = await ethers.getContractFactory("SovrynAdapter");
  const sovrynAdapter = await SovrynAdapter.deploy(SOVRYN_LOAN_TOKEN, WRBTC);
  await sovrynAdapter.waitForDeployment();
  const sovrynAddress = await sovrynAdapter.getAddress();
  console.log(`  SovrynAdapter deployed at: ${sovrynAddress}`);
  console.log(`  Mock mode: ${SOVRYN_LOAN_TOKEN === ethers.ZeroAddress}`);

  // 3. Deploy TropykusAdapter (mock mode on testnet)
  console.log("\n[3/5] Deploying TropykusAdapter...");
  const TROPYKUS_CTOKEN = process.env.TROPYKUS_CTOKEN || ethers.ZeroAddress;
  const TropykusAdapter = await ethers.getContractFactory("TropykusAdapter");
  const tropykusAdapter = await TropykusAdapter.deploy(TROPYKUS_CTOKEN);
  await tropykusAdapter.waitForDeployment();
  const tropykusAddress = await tropykusAdapter.getAddress();
  console.log(`  TropykusAdapter deployed at: ${tropykusAddress}`);
  console.log(`  Mock mode: ${TROPYKUS_CTOKEN === ethers.ZeroAddress}`);

  // 4. Deploy MOCAdapter (mock mode on testnet)
  console.log("\n[4/5] Deploying MOCAdapter...");
  const MOC_PROXY = process.env.MOC_PROXY || ethers.ZeroAddress;
  const MOCAdapter = await ethers.getContractFactory("MOCAdapter");
  const mocAdapter = await MOCAdapter.deploy(MOC_PROXY);
  await mocAdapter.waitForDeployment();
  const mocAddress = await mocAdapter.getAddress();
  console.log(`  MOCAdapter deployed at: ${mocAddress}`);
  console.log(`  Mock mode: ${MOC_PROXY === ethers.ZeroAddress}`);

  // 5. Deploy YieldRouter
  console.log("\n[5/5] Deploying YieldRouter...");
  const YieldRouter = await ethers.getContractFactory("YieldRouter");
  const router = await YieldRouter.deploy();
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`  YieldRouter deployed at: ${routerAddress}`);

  // Configure contracts
  console.log("\n" + "-".repeat(60));
  console.log("Configuring contracts...");

  console.log("  Setting router on Vault...");
  await (await vault.setRouter(routerAddress)).wait();

  console.log("  Setting vault on Router...");
  await (await router.setVault(vaultAddress)).wait();

  console.log("  Setting Sovryn adapter...");
  await (await router.setAdapter("sovryn", sovrynAddress)).wait();

  console.log("  Setting Tropykus adapter...");
  await (await router.setAdapter("tropykus", tropykusAddress)).wait();

  console.log("  Setting MOC adapter...");
  await (await router.setAdapter("moneyonchain", mocAddress)).wait();

  console.log("  Setting RBTC as supported asset...");
  await (await vault.setSupportedAsset(ethers.ZeroAddress, true)).wait();

  // Set agent wallet as authorized keeper
  const AGENT_KEEPER = process.env.AGENT_KEEPER_ADDRESS || "0x1234567890abcdef1234567890abcdef12345678";
  console.log(`  Setting keeper: ${AGENT_KEEPER}...`);
  await (await router.setKeeper(AGENT_KEEPER, true)).wait();

  // Save deployments
  const deployments = {
    network: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      Vault: vaultAddress,
      YieldRouter: routerAddress,
      SovrynAdapter: sovrynAddress,
      TropykusAdapter: tropykusAddress,
      MOCAdapter: mocAddress,
    },
  };

  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\nDeployments saved to: ${deploymentsPath}`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Vault:            ${vaultAddress}`);
  console.log(`  YieldRouter:      ${routerAddress}`);
  console.log(`  SovrynAdapter:    ${sovrynAddress}`);
  console.log(`  TropykusAdapter:  ${tropykusAddress}`);
  console.log(`  MOCAdapter:       ${mocAddress}`);
  console.log("=".repeat(60));
  console.log("Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
