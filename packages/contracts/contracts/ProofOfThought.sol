// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ProofOfThought {
    struct Attestation {
        string taskId;
        string taskType;
        bytes32 reasoningHash;
        string providerUsed;
        uint256 costInMicroUSD; // cost in micro-USD (6 decimals)
        bytes32 paymentTxHash;
        uint256 timestamp;
        address agent;
    }

    struct Escrow {
        address depositor;
        uint256 amount;
        bool released;
    }

    IERC20 public immutable usdtToken;

    mapping(uint256 => Attestation) public attestations;
    mapping(address => uint256[]) public agentAttestations;
    uint256 public attestationCount;

    mapping(bytes32 => Escrow) public escrows;

    event AttestationCreated(
        uint256 indexed id,
        string taskId,
        string taskType,
        bytes32 reasoningHash,
        string providerUsed,
        uint256 costInMicroUSD,
        address indexed agent,
        uint256 timestamp
    );

    event EscrowDeposited(
        string taskId,
        address indexed depositor,
        uint256 amount
    );

    event PaymentReleased(
        string taskId,
        address indexed recipient,
        uint256 amount
    );

    constructor(address _usdtToken) {
        usdtToken = IERC20(_usdtToken);
    }

    function depositForTask(string calldata _taskId, uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        bytes32 taskHash = keccak256(abi.encodePacked(_taskId));
        require(escrows[taskHash].amount == 0, "Escrow already exists");

        require(usdtToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        escrows[taskHash] = Escrow({
            depositor: msg.sender,
            amount: _amount,
            released: false
        });

        emit EscrowDeposited(_taskId, msg.sender, _amount);
    }

    function completeTask(
        string calldata _taskId,
        string calldata _taskType,
        bytes32 _reasoningHash,
        string calldata _providerUsed,
        uint256 _costInMicroUSD
    ) external returns (uint256) {
        // Record attestation
        uint256 id = attestationCount;
        bytes32 taskHash = keccak256(abi.encodePacked(_taskId));

        attestations[id] = Attestation({
            taskId: _taskId,
            taskType: _taskType,
            reasoningHash: _reasoningHash,
            providerUsed: _providerUsed,
            costInMicroUSD: _costInMicroUSD,
            paymentTxHash: bytes32(0),
            timestamp: block.timestamp,
            agent: msg.sender
        });
        agentAttestations[msg.sender].push(id);
        attestationCount++;

        emit AttestationCreated(
            id,
            _taskId,
            _taskType,
            _reasoningHash,
            _providerUsed,
            _costInMicroUSD,
            msg.sender,
            block.timestamp
        );

        // Release escrowed USDT if exists
        Escrow storage escrow = escrows[taskHash];
        if (escrow.amount > 0 && !escrow.released) {
            escrow.released = true;
            uint256 payment = escrow.amount;

            // Transfer payment to agent (msg.sender)
            require(usdtToken.transfer(msg.sender, payment), "Payment transfer failed");

            emit PaymentReleased(_taskId, msg.sender, payment);
        }

        return id;
    }

    function getAttestation(uint256 _id) external view returns (Attestation memory) {
        require(_id < attestationCount, "Attestation does not exist");
        return attestations[_id];
    }

    function getAttestationsByAgent(address _agent) external view returns (uint256[] memory) {
        return agentAttestations[_agent];
    }

    function getAttestationCount() external view returns (uint256) {
        return attestationCount;
    }

    function getEscrow(string calldata _taskId) external view returns (Escrow memory) {
        bytes32 taskHash = keccak256(abi.encodePacked(_taskId));
        return escrows[taskHash];
    }
}
