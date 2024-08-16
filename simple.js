// const { ethers } = require("ethers");
const { ethers: ethersv5 } = require("ethers-v5");
const args = require("args");
args.option(
  "txnconf",
  'The txn confirmation strategy.  Either "wait" or "polling"',
  "wait"
);
const flags = args.parse(process.argv);

const { getSigner, getNetworkInfo } = require("./utils.js");

const pkpHelperABI = require("./abis/PKPHelper.json");
const pkpABI = require("./abis/PKPNFT.json");

const litNetwork = "datilDev";
const howManyToMint = 100;

async function main() {
  const network = await getNetworkInfo(litNetwork);
  const { pkpHelperContractAddress, pkpNftContractAddress, rpcUrl } = network;

  const provider = new ethersv5.providers.JsonRpcProvider(rpcUrl);
  const signer = await getSigner(rpcUrl);
  const signerAddress = await signer.getAddress();

  const pkpHelper = new ethersv5.Contract(
    pkpHelperContractAddress,
    pkpHelperABI,
    signer
  );
  const pkp = new ethersv5.Contract(pkpNftContractAddress, pkpABI, signer);

  const allTimings = [];
  const allTxHashes = [];
  const reverts = [];

  console.log("getting mint cost...");
  const mintCost = await pkp.mintCost();
  console.log("mintCost is ", mintCost.toString());
  mainLoop: for (let i = 0; i < howManyToMint; i++) {
    console.log(`minting pubkey ${i}`);

    try {
      const timings = {};
      const totalTimeStart = Date.now();
      let now = Date.now();
      let mintTxData =
        await pkpHelper.populateTransaction.mintNextAndAddAuthMethods(
          2,
          [1],
          [signerAddress],
          ["0x00"],
          [[1]],
          false,
          false,
          { value: mintCost }
        );
      let elapsed = Date.now() - now;
      timings["createTxData"] = elapsed;

      now = Date.now();
      mintTxData = await signer.populateTransaction(mintTxData);
      elapsed = Date.now() - now;
      timings["populateTxData"] = elapsed;
      //   console.log("mintTxData", mintTxData);
      // add 10% bump using bignumber
      mintTxData.gasLimit = mintTxData.gasLimit.mul(110).div(100);

      now = Date.now();
      const serializedTxn = await signer.signTransaction(mintTxData);
      elapsed = Date.now() - now;
      timings["signTx"] = elapsed;

      let params = [serializedTxn];
      //   console.log(`params: ${JSON.stringify(params, null, 2)}`);
      now = Date.now();
      const mintTx = await provider.sendTransaction(serializedTxn);

      elapsed = Date.now() - now;
      timings["sendTx"] = elapsed;
      console.log("mintTx hash", mintTx.hash);
      if (!mintTx.hash) {
        console.log("mintTx hash is null, skipping");
        continue;
      }
      allTxHashes.push(mintTx.hash);
      //   blockNumber = await signer.provider.getBlockNumber();
      //   console.log("blockNumber after minting", blockNumber);
      now = Date.now();
      let receipt = null;
      if (flags.txnconf === "wait") {
        receipt = await mintTx.wait();
      } else {
        while (!receipt) {
          receipt = await provider.getTransactionReceipt(mintTx.hash);
          // wait 100ms
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      elapsed = Date.now() - now;
      timings["waitForTxConfirmation"] = elapsed;
      elapsed = Date.now() - totalTimeStart;
      timings["totalTime"] = elapsed;

      console.log(
        `Success on number ${i}: ${JSON.stringify(timings, null, 2)}`
      );
      allTimings.push(timings);
    } catch (e) {
      console.log(`error minting pkp ${i}`, e);
    }
  }

  const timingKeys = Object.keys(allTimings[0]);
  const timingStats = {};

  const calculateStats = (times) => {
    times.sort((a, b) => a - b);
    const min = times[0];
    const max = times[times.length - 1];
    const median =
      times.length % 2 === 0
        ? (times[times.length / 2 - 1] + times[times.length / 2]) / 2
        : times[Math.floor(times.length / 2)];
    const average = times.reduce((acc, curr) => acc + curr, 0) / times.length;
    return {
      min: parseFloat((min / 1000).toFixed(2)),
      max: parseFloat((max / 1000).toFixed(2)),
      median: parseFloat((median / 1000).toFixed(2)),
      average: parseFloat((average / 1000).toFixed(2)),
    };
  };

  timingKeys.forEach((key) => {
    const times = allTimings.map((t) => t[key]);
    timingStats[key] = calculateStats(times);
  });

  timingKeys.forEach((key) => {
    console.log(
      `${key} Times - Min: ${timingStats[key].min}, Max: ${timingStats[key].max}, Median: ${timingStats[key].median}, Average: ${timingStats[key].average}`
    );
  });

  const successPercentage = parseFloat(
    ((allTimings.length / howManyToMint) * 100).toFixed(2)
  );
  console.log(
    `${successPercentage}% success rate: ${allTimings.length} successes out of ${howManyToMint} attempts.`
  );
  console.log("all txn hashes: ", JSON.stringify(allTxHashes, null, 2));
  console.log("reverts: ", JSON.stringify(reverts, null, 2));

  process.exit(0);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.log("main error handler triggered.  error below:");
  console.error(error);
  process.exitCode = 1;
});
