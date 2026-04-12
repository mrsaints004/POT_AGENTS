import { expect } from "chai";
import { ethers } from "hardhat";

describe("ProofOfThought", function () {
  async function deployFixture() {
    const [owner, agent1, agent2] = await ethers.getSigners();
    const ProofOfThought = await ethers.getContractFactory("ProofOfThought");
    const contract = await ProofOfThought.deploy();
    return { contract, owner, agent1, agent2 };
  }

  it("should create an attestation", async function () {
    const { contract, agent1 } = await deployFixture();

    const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes("test reasoning"));
    const paymentTxHash = ethers.keccak256(ethers.toUtf8Bytes("test payment"));

    const tx = await contract.connect(agent1).createAttestation(
      "task-1",
      "text-generation",
      reasoningHash,
      "gemini-pro",
      5000, // $0.005 in micro-USD
      paymentTxHash
    );

    await expect(tx).to.emit(contract, "AttestationCreated");

    const attestation = await contract.getAttestation(0);
    expect(attestation.taskId).to.equal("task-1");
    expect(attestation.taskType).to.equal("text-generation");
    expect(attestation.providerUsed).to.equal("gemini-pro");
    expect(attestation.agent).to.equal(agent1.address);
  });

  it("should track attestations by agent", async function () {
    const { contract, agent1, agent2 } = await deployFixture();

    const hash = ethers.keccak256(ethers.toUtf8Bytes("test"));

    await contract.connect(agent1).createAttestation("t1", "translation", hash, "gemini-flash", 1000, hash);
    await contract.connect(agent1).createAttestation("t2", "code-review", hash, "gemini-pro", 5000, hash);
    await contract.connect(agent2).createAttestation("t3", "summarization", hash, "gemini-flash", 1000, hash);

    const agent1Attestations = await contract.getAttestationsByAgent(agent1.address);
    const agent2Attestations = await contract.getAttestationsByAgent(agent2.address);

    expect(agent1Attestations.length).to.equal(2);
    expect(agent2Attestations.length).to.equal(1);
    expect(await contract.getAttestationCount()).to.equal(3);
  });

  it("should revert for non-existent attestation", async function () {
    const { contract } = await deployFixture();
    await expect(contract.getAttestation(999)).to.be.revertedWith("Attestation does not exist");
  });
});
