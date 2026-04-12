import { ethers } from "ethers";
import { KITE_TESTNET, SERVICE_REGISTRY_ABI } from "@pot/shared";

const PROOF_OF_THOUGHT_ABI = [
  "function completeTask(string calldata _taskId, string calldata _taskType, bytes32 _reasoningHash, string calldata _providerUsed, uint256 _costInMicroUSD) external returns (uint256)",
  "function depositForTask(string calldata _taskId, uint256 _amount) external",
  "function getAttestation(uint256 _id) external view returns (tuple(string taskId, string taskType, bytes32 reasoningHash, string providerUsed, uint256 costInMicroUSD, bytes32 paymentTxHash, uint256 timestamp, address agent))",
  "function getAttestationsByAgent(address _agent) external view returns (uint256[])",
  "function getAttestationCount() external view returns (uint256)",
  "function getEscrow(string calldata _taskId) external view returns (tuple(address depositor, uint256 amount, bool released))",
  "event AttestationCreated(uint256 indexed id, string taskId, string taskType, bytes32 reasoningHash, string providerUsed, uint256 costInMicroUSD, address indexed agent, uint256 timestamp)",
  "event EscrowDeposited(string taskId, address indexed depositor, uint256 amount)",
  "event PaymentReleased(string taskId, address indexed recipient, uint256 amount)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

export class KiteClient {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private usdtContract: ethers.Contract;
  private serviceRegistry: ethers.Contract;
  private contractAddress: string;

  constructor(privateKey: string, contractAddress: string) {
    this.provider = new ethers.JsonRpcProvider(KITE_TESTNET.rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, PROOF_OF_THOUGHT_ABI, this.wallet);
    this.contractAddress = contractAddress;
    this.usdtContract = new ethers.Contract(KITE_TESTNET.contracts.testUSDT, ERC20_ABI, this.wallet);
    this.serviceRegistry = new ethers.Contract(
      KITE_TESTNET.contracts.serviceRegistry,
      SERVICE_REGISTRY_ABI as unknown as string[],
      this.wallet
    );
  }

  getAddress(): string {
    return this.wallet.address;
  }

  async getUSDTBalance(): Promise<string> {
    const balance = await this.usdtContract.balanceOf(this.wallet.address);
    return ethers.formatUnits(balance, 6); // USDT has 6 decimals
  }

  async approveUSDT(amount: bigint): Promise<string> {
    const tx = await this.usdtContract.approve(this.contractAddress, amount);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async depositForTask(taskId: string, amount: bigint): Promise<{ txHash: string; blockNumber: number }> {
    // Approve first
    await this.approveUSDT(amount);

    // Then deposit
    const tx = await this.contract.depositForTask(taskId, amount);
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  async completeTask(
    taskId: string,
    taskType: string,
    reasoningHash: string,
    providerUsed: string,
    costInMicroUSD: number
  ): Promise<{ txHash: string; blockNumber: number }> {
    const tx = await this.contract.completeTask(
      taskId,
      taskType,
      reasoningHash,
      providerUsed,
      costInMicroUSD
    );

    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  async getAttestation(id: number) {
    return await this.contract.getAttestation(id);
  }

  async getAttestationCount(): Promise<number> {
    const count = await this.contract.getAttestationCount();
    return Number(count);
  }

  async getAttestationsByAgent(address?: string): Promise<number[]> {
    const addr = address || this.wallet.address;
    const ids = await this.contract.getAttestationsByAgent(addr);
    return ids.map((id: bigint) => Number(id));
  }

  async getEscrow(taskId: string) {
    return await this.contract.getEscrow(taskId);
  }

  async isRegisteredService(): Promise<boolean> {
    try {
      // Generate a deterministic serviceId from our agent address
      const serviceId = ethers.keccak256(
        ethers.solidityPacked(["string", "address"], ["pot-agent", this.wallet.address])
      );
      const service = await this.serviceRegistry.getService(serviceId);
      // If serviceOwner is non-zero, it's registered
      return service.serviceOwner !== ethers.ZeroAddress;
    } catch {
      return false;
    }
  }

  async registerAsService(): Promise<string | null> {
    try {
      // Check if we have the admin role needed to register
      const adminRole = await this.serviceRegistry.SERVICE_REGISTRY_ADMIN_ROLE();
      const hasRole = await this.serviceRegistry.hasRole(adminRole, this.wallet.address);

      if (!hasRole) {
        console.log("Kite Service Registry: agent lacks SERVICE_REGISTRY_ADMIN_ROLE — skipping registration");
        // Log version to confirm we can read from the contract
        try {
          const ver = await this.serviceRegistry.version();
          console.log(`Kite Service Registry reachable (version: ${ver})`);
        } catch {}
        return null;
      }

      const isRegistered = await this.isRegisteredService();
      if (isRegistered) {
        console.log("Agent already registered in Kite Service Registry");
        return null;
      }

      // Generate a deterministic serviceId
      const serviceId = ethers.keccak256(
        ethers.solidityPacked(["string", "address"], ["pot-agent", this.wallet.address])
      );

      // Provider bytes32 — keccak of agent name
      const providerHash = ethers.keccak256(ethers.toUtf8Bytes("proof-of-thought"));

      // Metadata — encode endpoint as bytes
      const endpoint = process.env.BACKEND_URL || "http://localhost:3002";
      const metadata = ethers.toUtf8Bytes(JSON.stringify({ endpoint, type: "ai-freelancer" }));

      const tx = await this.serviceRegistry.registerService(serviceId, {
        serviceOwner: this.wallet.address,
        priceModel: 0, // PriceModel enum — 0 likely = per-request
        unitPrice: ethers.parseUnits("0.01", 6), // 0.01 USDT per task
        provider: providerHash,
        metadata,
        name: "Proof of Thought Agent",
        isPublic: true,
      });

      const receipt = await tx.wait();
      console.log(`Registered in Kite Service Registry: ${receipt.hash}`);
      return receipt.hash;
    } catch (err) {
      console.warn("Service registry registration failed (non-blocking):", err instanceof Error ? err.message : err);
      return null;
    }
  }
}
