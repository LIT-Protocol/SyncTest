// const { ethers } = require("ethers");
const { ethers: ethersv5 } = require("ethers-v5");
const axios = require("axios");

const { getSigner, getNetworkInfo } = require("./utils.js");

const pkpHelperABI = require("./abis/PKPHelper.json");
const pkpABI = require("./abis/PKPNFT.json");

const litNetwork = "datilDev";
const howManyToMint = 100;

async function main() {
  const network = await getNetworkInfo(litNetwork);
  const { pkpHelperContractAddress, pkpNftContractAddress, rpcUrl } = network;

  const signer = await getSigner(rpcUrl);
  const signerAddress = await signer.getAddress();

  //   const pkpHelper = new ethers.Contract(
  //     pkpHelperContractAddress,
  //     pkpHelperABI,
  //     signer
  //   );
  //   const pkp = new ethers.Contract(pkpNftContractAddress, pkpABI, signer);

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
      //   let blockNumber = await signer.provider.getBlockNumber();
      //   console.log("blockNumber before minting", blockNumber);
      // mint and let the signerAddress use it
      //   const mintTx = await pkpHelper.mintNextAndAddAuthMethods(
      //     2,
      //     [1],
      //     [signerAddress],
      //     ["0x00"],
      //     [[1]],
      //     false,
      //     false,
      //     { value: mintCost }
      //   );
      let now = Date.now();
      const mintTxData =
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
      //   console.log("mintTxData", mintTxData);

      now = Date.now();
      let nonce = await signer.getTransactionCount("pending");
      elapsed = Date.now() - now;
      timings["getNonce"] = elapsed;
      mintTxData.nonce = nonce;

      now = Date.now();
      const gasLimit = await signer.estimateGas(mintTxData);
      elapsed = Date.now() - now;
      timings["estimateGas"] = elapsed;
      mintTxData.gasLimit = gasLimit;

      now = Date.now();
      const feeData = await signer.getFeeData();
      elapsed = Date.now() - now;
      timings["getFeeData"] = elapsed;
      //   console.log("feeData", feeData);
      mintTxData.gasPrice = feeData.gasPrice;
      mintTxData.type = 0;

      now = Date.now();
      const txnWithGas = await signer.populateTransaction(mintTxData);
      elapsed = Date.now() - now;
      timings["populateTxWithGas"] = elapsed;

      now = Date.now();
      const serializedTxn = await signer.signTransaction(txnWithGas);
      elapsed = Date.now() - now;
      timings["signTx"] = elapsed;

      let params = [serializedTxn];
      //   console.log(`params: ${JSON.stringify(params, null, 2)}`);
      now = Date.now();
      const { data } = await axios.post(
        rpcUrl,
        {
          jsonrpc: "2.0",
          method: "eth_sendRawTransaction",
          params: params,
          id: 1,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );
      //   console.log("data", data);
      elapsed = Date.now() - now;
      const mintTx = { hash: data.result };
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
      //   const receipt = await mintTx.wait();
      params = [mintTx.hash];
      let receipt = false;
      let attempts = 1;
      while (!receipt) {
        try {
          const { data } = await axios.post(
            rpcUrl,
            {
              jsonrpc: "2.0",
              method: "eth_getTransactionReceipt",
              params: params,
              id: attempts++,
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
              timeout: 60000,
            }
          );
          //   console.log("data", data);
          if (data.result) {
            if (data.result.status == "0x1") {
              receipt = data.result;
            } else {
              // the tx failed for some reason.  skip and continue.  we won't mark it as successful.
              reverts.push(mintTx.hash);
              continue mainLoop;
            }
          } else {
            console.log("waiting for tx confirmation, attempt ", attempts);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (e) {
          console.log("error getting receipt", e);
        }
      }
      elapsed = Date.now() - now;
      timings["waitForTxConfirmation"] = elapsed;
      //   blockNumber = await signer.provider.getBlockNumber();
      //   console.log("blockNumber after mintTx.wait()", blockNumber);
      const publicKey = receipt.logs[2].data.substr(130, 130);
      //   const tokenId = ethers.keccak256("0x" + publicKey);
      //   const tokenId = ethersv5.utils.keccak256("0x" + publicKey);
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
