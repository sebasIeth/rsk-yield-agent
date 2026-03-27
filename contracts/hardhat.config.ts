import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    rskTestnet: {
      url: process.env.RSK_RPC_URL_TESTNET || "https://public-node.testnet.rsk.co",
      chainId: 31,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 60000000,
    },
    rskMainnet: {
      url: process.env.RSK_RPC_URL_MAINNET || "https://public-node.rsk.co",
      chainId: 30,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 60000000,
    },
  },
};

export default config;
