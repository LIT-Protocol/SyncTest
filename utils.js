// const { ethers } = require("ethers");
const { ethers: ethersv5 } = require("ethers-v5");
const stakingContractABI = require("./abis/Staking.json");
const resolverContractABI = require("./abis/ContractResolver.json");
const fs = require("fs");

const rpcUrl = "https://lit-protocol.calderachain.xyz/replica-http";
const privateKey = process.env.LIT_PKP_PARALLEL_KEYGEN_PRIVATE_KEY;

const networks = {
  manzano: {
    stakingContractAddress: "0xBC7F8d7864002b6629Ab49781D5199C8dD1DDcE1",
    env: "dev",
  },
};

const getSigner = async (rpcUrl) => {
  //   const provider = new ethers.JsonRpcProvider(rpcUrl);
  //   const wallet = new ethers.Wallet(privateKey, provider);
  const provider = new ethersv5.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethersv5.Wallet(privateKey, provider);
  return wallet;
};

const envToEnum = (env) => {
  switch (env) {
    case "dev":
      return 0;
    case "staging":
      return 1;
    case "prod":
      return 2;
    default:
      throw new Error("ENV is invalid");
  }
};

const getNetworkInfo = async (selectedNetwork) => {
  console.log("Resolving network info from chain, 1 sec...");

  // resolve addresses
  const network = networks[selectedNetwork];
  const { env, stakingContractAddress } = network;

  // lookup resolver contract address from staking contract
  //   const provider = new ethers.JsonRpcProvider(rpcUrl);

  //   const stakingContract = new ethers.Contract(
  //     stakingContractAddress,
  //     stakingContractABI,
  //     provider
  //   );

  const provider = new ethersv5.providers.JsonRpcProvider(rpcUrl);

  const stakingContract = new ethersv5.Contract(
    stakingContractAddress,
    stakingContractABI,
    provider
  );

  const resolverContractAddress = await stakingContract.contractResolver();

  //   const resolverContract = new ethers.Contract(
  //     resolverContractAddress,
  //     resolverContractABI,
  //     provider
  //   );

  const resolverContract = new ethersv5.Contract(
    resolverContractAddress,
    resolverContractABI,
    provider
  );

  const contractContext = {
    resolverAddress: resolverContractAddress,
    abi: resolverContractABI,
    environment: envToEnum(env),
    provider: new ethersv5.providers.JsonRpcProvider(rpcUrl),
  };

  const networkInfo = {
    rpcUrl,
    stakingContractAddress,
    resolverContractAddress,
    env: network.env,
    contractContext,
  };

  networkInfo.pkpNftContractAddress = await resolverContract.getContract(
    await resolverContract.PKP_NFT_CONTRACT(),
    envToEnum(network.env)
  );

  networkInfo.pkpHelperContractAddress = await resolverContract.getContract(
    await resolverContract.PKP_HELPER_CONTRACT(),
    envToEnum(network.env)
  );

  networkInfo.pubkeyRouterContractAddress = await resolverContract.getContract(
    await resolverContract.PUB_KEY_ROUTER_CONTRACT(),
    envToEnum(network.env)
  );

  networkInfo.rateLimitNftAddress = await resolverContract.getContract(
    await resolverContract.RATE_LIMIT_NFT_CONTRACT(),
    envToEnum(network.env)
  );
  return networkInfo;
};

module.exports = {
  getNetworkInfo,
  getSigner,
  rpcUrl,
};
