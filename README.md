# Running

Make sure you have a private key with funds in the `LIT_PKP_PARALLEL_KEYGEN_PRIVATE_KEY` env var.

Run `npm i` to install the dependencies.

There are two scripts:

- Simple: This script uses a lot of ethers built in methods to sign and send the transaction. Use `npm run simple` to run this script.
- Advanced: This script uses some ethers built in methods but uses axios to send and poll for the transaction receipt. Use `npm run start` to run this script.
