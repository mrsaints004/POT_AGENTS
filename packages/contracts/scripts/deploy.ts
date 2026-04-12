import { ethers } from "hardhat";

const TEST_USDT_ADDRESS = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";

async function main() {
  console.log("Deploying ProofOfThought contract to Kite Testnet...");
  console.log(`Using Test USDT address: ${TEST_USDT_ADDRESS}`);

  const ProofOfThought = await ethers.getContractFactory("ProofOfThought");
  const contract = await ProofOfThought.deploy(TEST_USDT_ADDRESS);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`ProofOfThought deployed to: ${address}`);
  console.log(`View on explorer: https://testnet.kitescan.ai/address/${address}`);
  console.log(`\nAdd to your .env file:`);
  console.log(`PROOF_OF_THOUGHT_CONTRACT=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
