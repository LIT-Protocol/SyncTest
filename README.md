# Running

Make sure you have a private key with funds in the `LIT_PKP_PARALLEL_KEYGEN_PRIVATE_KEY` env var.

Run `npm i` to install the dependencies.

There are two scripts:

- Simple: This script uses a lot of ethers built in methods to sign and send the transaction. Use `npm run simple` to run this script. Note this script has a flag to use manual polling or ethers txn.wait() to wait for the transaction to be confirmed. You can use `npm run simple -- --txnconf polling` to use polling. The default is to use txn.wait().
- Advanced: This script uses some ethers built in methods but uses axios to send and poll for the transaction receipt. Use `npm run start` to run this script.
