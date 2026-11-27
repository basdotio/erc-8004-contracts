import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";

import type { HardhatUserConfig } from "hardhat/config";

import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable } from "hardhat/config";

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
const bscScanApiKey = process.env.BSCSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.24",
        settings: {
          evmVersion: "shanghai",
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
          
        },
      },
      production: {
        version: "0.8.24",
        settings: {
          evmVersion: "shanghai",
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    bscTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://bsc-testnet.nodereal.io/v1/67474aba58b44063b80db0030176c887",
      chainId: 97,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
      gasPrice: 1000000000, // 1 gwei
    },
    bscMainnet: {
      type: "http",
      chainType: "l1",
      url: "https://bsc-mainnet.nodereal.io/v1/67474aba58b44063b80db0030176c887",
      chainId: 56,  
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
      gasPrice: 1000000000, // 1 gwei
    },
  },
};

export default config;
