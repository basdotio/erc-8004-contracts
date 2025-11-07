import "dotenv/config";
import hre from "hardhat";
import { encodeFunctionData, isAddress } from "viem";

type Address = `0x${string}`;
type Bytes32 = `0x${string}`;

interface DeployConfig {
  identityRegistry: Address;
  bas: Address;
  commentSchema: Bytes32;
  commentReplySchema: Bytes32;
}

function ensureAddress(value: string | undefined, name: string): Address {
  if (!value || value.trim() === "") {
    throw new Error(`${name} 环境变量未设置`);
  }
  if (!isAddress(value)) {
    throw new Error(`${name} 必须是合法的以 0x 开头的以太坊地址`);
  }
  return value as Address;
}

function ensureOptionalAddress(value: string | undefined, name: string): Address | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }
  return ensureAddress(value, name);
}

function ensureBytes32(value: string | undefined, name: string): Bytes32 {
  if (!value || value.trim() === "") {
    throw new Error(`${name} 环境变量未设置`);
  }
  const normalized = value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`${name} 必须是 32 字节的十六进制字符串 (0x 开头，长度 66)`);
  }
  return normalized as Bytes32;
}

function loadDeployConfig(): DeployConfig {
  return {
    identityRegistry: ensureAddress(process.env.COMMENT_IDENTITY_REGISTRY, "COMMENT_IDENTITY_REGISTRY"),
    bas: ensureAddress(process.env.COMMENT_BAS_ADDRESS, "COMMENT_BAS_ADDRESS"),
    commentSchema: ensureBytes32(process.env.COMMENT_SCHEMA_UID, "COMMENT_SCHEMA_UID"),
    commentReplySchema: ensureBytes32(process.env.COMMENT_REPLY_SCHEMA_UID, "COMMENT_REPLY_SCHEMA_UID"),
  };
}

async function deployCommentContract(viem: any, config: DeployConfig) {
  console.log("开始部署 Comment 合约 (可升级)...");
  console.log("================================");

  console.log("1. 部署 Comment 实现合约...");
  const commentImpl = await viem.deployContract("Comment");
  console.log("   实现合约地址:", commentImpl.address);

  console.log("2. 生成初始化 calldata...");
  const commentArtifact = await hre.artifacts.readArtifact("Comment");
  const initCalldata = encodeFunctionData({
    abi: commentArtifact.abi,
    functionName: "initialize",
    args: [config.identityRegistry, config.bas, config.commentSchema, config.commentReplySchema],
  }) as `0x${string}`;

  console.log("3. 部署 ERC1967Proxy 并初始化 Comment...");
  const commentProxy = await viem.deployContract("ERC1967Proxy", [
    commentImpl.address,
    initCalldata,
  ]);
  console.log("   代理合约地址:", commentProxy.address);

  console.log("4. 验证部署...");
  const comment = await viem.getContractAt("Comment", commentProxy.address);
  const owner = await comment.read.owner();
  const identityRegistry = await comment.read._identityRegistry();
  const bas = await comment.read._bas();
  const commentSchema = await comment.read._commentSchema();
  const commentReplySchema = await comment.read._commentReplySchema();

  console.log("   所有者:", owner);
  console.log("   IdentityRegistry:", identityRegistry);
  console.log("   BAS:", bas);
  console.log("   Comment Schema:", commentSchema);
  console.log("   Comment Reply Schema:", commentReplySchema);
  console.log("");

  console.log("部署完成 ✅");
  console.log("--------------------");
  console.log("代理地址:", commentProxy.address);
  console.log("实现地址:", commentImpl.address);
  console.log("");

  return {
    proxy: commentProxy.address,
    implementation: commentImpl.address,
  };
}

async function upgradeCommentContract(
  viem: any,
  proxyAddress: Address
) {
  console.log("检测到 COMMENT_PROXY_ADDRESS，进入升级流程");
  console.log("=====================================");

  console.log("1. 部署新的 Comment 实现合约...");
  const newImpl = await viem.deployContract("Comment");
  console.log("   新实现地址:", newImpl.address);

  console.log("2. 使用代理执行 upgradeTo...");
  const proxy = await viem.getContractAt("ERC1967Proxy", proxyAddress);
  const upgradeTx = await proxy.write.upgradeTo([newImpl.address]);
  console.log("   升级交易哈希:", upgradeTx);

  const publicClient = await viem.getPublicClient();
  console.log("   等待升级交易确认...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash: upgradeTx });
  console.log("   升级已在区块", receipt.blockNumber, "确认");

  console.log("3. 验证升级结果...");
  const comment = await viem.getContractAt("Comment", proxyAddress);
  const owner = await comment.read.owner();
  const currentImplSlot = await publicClient.getStorageAt({
    address: proxyAddress,
    slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  });

  console.log("   当前 owner:", owner);
  console.log("   EIP-1967 实现槽数据:", currentImplSlot);
  console.log("");

  console.log("升级完成 ✅");
  console.log("--------------------");
  console.log("代理地址:", proxyAddress);
  console.log("新实现地址:", newImpl.address);
  console.log("");
}

async function main() {
  const { viem } = await hre.network.connect();
  const walletClients = await viem.getWalletClients();

  if (!walletClients || walletClients.length === 0) {
    const hasPk = !!(process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY);
    throw new Error(
      `未检测到可用的钱包客户端。` +
      `请在环境变量中配置 DEPLOYER_PRIVATE_KEY 或 PRIVATE_KEY，` +
      `并确认 hardhat.config.ts 中目标网络的 accounts 配置。` +
      (hasPk ? `检测到私钥但未创建钱包客户端，请检查 ${"bscTestnet"} 或相关网络配置。` : `当前未设置任何私钥环境变量。`)
    );
  }

  const [deployer] = walletClients;
  console.log("使用部署者:", deployer.account.address);
  console.log("");

  const proxyAddress = ensureOptionalAddress(process.env.COMMENT_PROXY_ADDRESS, "COMMENT_PROXY_ADDRESS");

  if (proxyAddress) {
    await upgradeCommentContract(viem, proxyAddress);
  } else {
    const config = loadDeployConfig();
    await deployCommentContract(viem, config);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

