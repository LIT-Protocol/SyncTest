const { ethers } = require("ethers");

const { getSigner, getNetworkInfo } = require("./utils.js");

const pkpHelperABI = require("./abis/PKPHelper.json");
const pkpABI = require("./abis/PKPNFT.json");

const litNetwork = "manzano";
const howManyToMint = 100;

async function main() {
  const network = await getNetworkInfo(litNetwork);
  const { pkpHelperContractAddress, pkpNftContractAddress, rpcUrl } = network;

  const signer = await getSigner(rpcUrl);
  const signerAddress = await signer.getAddress();

  const pkpHelper = new ethers.Contract(
    pkpHelperContractAddress,
    pkpHelperABI,
    signer
  );
  const pkp = new ethers.Contract(pkpNftContractAddress, pkpABI, signer);

  const allTimings = [];

  console.log("getting mint cost...");
  const mintCost = await pkp.mintCost();
  console.log("mintCost is ", mintCost.toString());
  for (let i = 0; i < howManyToMint; i++) {
    console.log(`minting pubkey ${i}`);
    const timings = {};
    try {
      // get txn count
      // let now = Date.now();
      // const nonce = await signer.getTransactionCount();
      // let elapsed = Date.now() - now;
      // timings["getNonce"] = elapsed;
      // mint and let the signerAddress use it
      let now = Date.now();
      const mintTx = await pkpHelper.mintNextAndAddAuthMethods(
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
      timings["sendTx"] = elapsed;
      console.log("mintTx hash", mintTx.hash);
      now = Date.now();
      const receipt = await mintTx.wait();
      elapsed = Date.now() - now;
      timings["waitForTxConfirmation"] = elapsed;
      const publicKey = receipt.logs[2].data.substr(130, 130);
      const tokenId = ethers.keccak256("0x" + publicKey);
      console.log(
        `Success on number ${i}: ${JSON.stringify(timings, null, 2)}`
      );
      allTimings.push(timings);
    } catch (e) {
      console.log(`error minting pkp ${i}`, e);
    }
  }

  const sendTxTimes = allTimings.map((t) => t.sendTx);
  const waitForTxConfirmationTimes = allTimings.map(
    (t) => t.waitForTxConfirmation
  );

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

  const sendTxStats = calculateStats(sendTxTimes);
  const waitForTxConfirmationStats = calculateStats(waitForTxConfirmationTimes);

  //   console.log(`All timings: ${JSON.stringify(allTimings, null, 2)}`);

  console.log(
    `SendTx Times - Min: ${sendTxStats.min}, Max: ${sendTxStats.max}, Median: ${sendTxStats.median}, Average: ${sendTxStats.average}`
  );
  console.log(
    `WaitForTxConfirmation Times - Min: ${waitForTxConfirmationStats.min}, Max: ${waitForTxConfirmationStats.max}, Median: ${waitForTxConfirmationStats.median}, Average: ${waitForTxConfirmationStats.average}`
  );

  const successPercentage = parseFloat(
    ((allTimings.length / howManyToMint) * 100).toFixed(2)
  );
  console.log(
    `${successPercentage}% success rate: ${allTimings.length} successes out of ${howManyToMint} attempts.`
  );
  process.exit(0);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.log("main error handler triggered.  error below:");
  console.error(error);
  process.exitCode = 1;
});
