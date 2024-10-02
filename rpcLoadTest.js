const { ethers: ethersv5 } = require("ethers-v5");
const { default: PQueue } = require("p-queue");

const concurrency = 300;
const totalRequests = 500;

async function main() {
  const queue = new PQueue({ concurrency });
  const provider = new ethersv5.providers.JsonRpcProvider(
    "<insert rpc url here>"
  );

  let successCount = 0;
  let errorCount = 0;
  for (let i = 0; i < totalRequests; i++) {
    queue.add(async () => {
      try {
        const txnCount = await provider.getTransactionCount(
          "0x50e2dac5e78B5905CB09495547452cEE64426db2"
        );
        console.log(`txnCount: ${txnCount}`);
        successCount++;
      } catch (e) {
        console.log(`Error: ${e}`);
        errorCount++;
      }
    });
  }

  await queue.onIdle();

  console.log(`Success count: ${successCount}`);
  console.log(`Error count: ${errorCount}`);

  process.exit(0);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.log("main error handler triggered.  error below:");
  console.error(error);
  process.exitCode = 1;
});
