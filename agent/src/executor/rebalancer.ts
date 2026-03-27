import { ethers } from "ethers";
import { StrategyProposal } from "../ai/prompts";

const VAULT_ABI = [
  "function balances(address) view returns (uint256)",
  "function executeRebalance(address user, address[] calldata protocols, uint256[] calldata amounts, address[] calldata assets) external",
  "function withdrawFromProtocol(address adapter, uint256 amount) external",
  "function protocolBalances(address, address) view returns (uint256)",
];

export interface RebalanceResult {
  strategyId: string;
  status: "pending" | "approved" | "executed" | "failed";
  txHash?: string;
  gasEstimate?: string;
  error?: string;
}

async function getUserBalance(
  vaultAddress: string,
  userAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<bigint> {
  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, provider);
  return vault.balances(userAddress) as Promise<bigint>;
}

function allocationToAmounts(
  newAllocation: StrategyProposal["new_allocation"],
  balance: bigint
): { protocols: string[]; amounts: bigint[]; assets: string[] } {
  const protocols = newAllocation.map((a) => a.protocol);
  const assets = newAllocation.map(() => ethers.ZeroAddress); // RBTC for now

  // Calculate all but last, assign remainder to last to avoid dust/precision loss
  const amounts: bigint[] = [];
  let totalSent = 0n;
  for (let i = 0; i < newAllocation.length; i++) {
    if (i === newAllocation.length - 1) {
      amounts.push(balance - totalSent); // Last gets remainder
    } else {
      const amount = (balance * BigInt(Math.round(newAllocation[i].percent * 100))) / 10000n;
      amounts.push(amount);
      totalSent += amount;
    }
  }

  return { protocols, amounts, assets };
}

export async function prepareRebalance(
  userAddress: string,
  strategy: StrategyProposal,
  vaultAddress: string,
  _routerAddress: string,
  rpcUrl: string,
  agentPrivateKey: string
): Promise<RebalanceResult> {
  const strategyId = ethers.id(
    `${userAddress}-${Date.now()}-${JSON.stringify(strategy.new_allocation)}`
  ).slice(0, 18);

  console.log(`[${new Date().toISOString()}] [Rebalancer] Preparing rebalance for ${userAddress}`);
  console.log(`[${new Date().toISOString()}] [Rebalancer] Strategy ID: ${strategyId}`);

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const keeper = new ethers.Wallet(agentPrivateKey, provider);
    const vault = new ethers.Contract(vaultAddress, VAULT_ABI, keeper);

    const balance = await getUserBalance(vaultAddress, userAddress, provider);
    const { protocols, amounts, assets } = allocationToAmounts(strategy.new_allocation, balance);

    // Estimate gas but don't execute
    const nonce = await keeper.getNonce();
    const gasEstimate = await vault.executeRebalance.estimateGas(
      userAddress,
      protocols,
      amounts,
      assets,
      { nonce }
    ).catch(() => BigInt(300000)); // fallback estimate

    console.log(`[${new Date().toISOString()}] [Rebalancer] Gas estimate: ${gasEstimate.toString()}`);

    // Save as pending — user must approve from frontend
    return {
      strategyId,
      status: "pending",
      gasEstimate: gasEstimate.toString(),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log(`[${new Date().toISOString()}] [Rebalancer] Error preparing rebalance: ${errMsg}`);
    return {
      strategyId,
      status: "failed",
      gasEstimate: "300000",
      error: errMsg,
    };
  }
}

export async function approveAndExecute(
  userAddress: string,
  strategy: StrategyProposal,
  vaultAddress: string,
  _routerAddress: string,
  rpcUrl: string,
  agentPrivateKey: string
): Promise<RebalanceResult> {
  const strategyId = ethers.id(`${userAddress}-${Date.now()}`).slice(0, 18);

  console.log(`[${new Date().toISOString()}] [Rebalancer] Executing approved rebalance for ${userAddress}`);

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const keeper = new ethers.Wallet(agentPrivateKey, provider);
    const vault = new ethers.Contract(vaultAddress, VAULT_ABI, keeper);

    const balance = await getUserBalance(vaultAddress, userAddress, provider);
    const { protocols, amounts, assets } = allocationToAmounts(strategy.new_allocation, balance);

    const nonce = await keeper.getNonce();
    const tx = await vault.executeRebalance(userAddress, protocols, amounts, assets, {
      gasPrice: 60000000n,
      nonce,
    });

    console.log(`[${new Date().toISOString()}] [Rebalancer] TX submitted: ${tx.hash}`);

    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction failed — receipt status: ${receipt?.status ?? "null"}`);
    }

    console.log(`[${new Date().toISOString()}] [Rebalancer] TX confirmed in block ${receipt.blockNumber}`);

    return {
      strategyId,
      status: "executed",
      txHash: tx.hash,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log(`[${new Date().toISOString()}] [Rebalancer] Execution failed: ${errMsg}`);
    return {
      strategyId,
      status: "failed",
      error: errMsg,
    };
  }
}
