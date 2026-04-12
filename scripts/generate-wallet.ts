import { ethers } from "ethers";

function main() {
  const wallet = ethers.Wallet.createRandom();

  console.log("=== New Kite Testnet Wallet ===\n");
  console.log(`Address:     ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log(`\n=== Next Steps ===`);
  console.log(`1. Go to https://faucet.gokite.ai`);
  console.log(`2. Paste your address: ${wallet.address}`);
  console.log(`3. Request testnet tokens`);
  console.log(`4. Add to your .env file:`);
  console.log(`   PRIVATE_KEY=${wallet.privateKey}`);
  console.log(`\n=== Verify on Explorer ===`);
  console.log(`https://testnet.kitescan.ai/address/${wallet.address}`);
}

main();
