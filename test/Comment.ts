import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, toHex } from "viem";

describe("Comment", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const COMMENT_SCHEMA = keccak256(toHex("comment"));
  const REPLY_SCHEMA = keccak256(toHex("commentReply"));

  async function deployFixture() {
    const identityRegistry = await viem.deployContract("IdentityRegistry");
    const bas = await viem.deployContract("MockBAS");
    const comment = await viem.deployContract("Comment");
    await comment.write.initialize([identityRegistry.address, bas.address, COMMENT_SCHEMA, REPLY_SCHEMA]);

    const txHash = await identityRegistry.write.register(["ipfs://QmAgent"]);
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    const registered = receipt.logs.find(
      (log) => log.topics[0] === keccak256(toHex("Registered(uint256,string,address)"))
    );
    if (!registered || !registered.topics[1]) {
      throw new Error("Registered event not found");
    }
    return { comment, bas, agentId: BigInt(registered.topics[1]) };
  }

  for (const score of [1, 50, 100]) {
    it(`Should accept a comment with score ${score}`, async function () {
      const { comment, bas, agentId } = await deployFixture();

      await comment.write.comment([agentId, "works well", score]);

      assert.equal(await bas.read.attestCount(), 1n);
    });
  }

  for (const score of [0, 101, 65535]) {
    it(`Should reject a comment with score ${score}`, async function () {
      const { comment, bas, agentId } = await deployFixture();

      await assert.rejects(comment.write.comment([agentId, "out of range", score]), /invalid score/);

      assert.equal(await bas.read.attestCount(), 0n);
    });
  }
});
