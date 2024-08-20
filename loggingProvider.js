const { ethers: ethersv5 } = require("ethers-v5");

class LoggingProvider extends ethersv5.providers.JsonRpcProvider {
    send(method, parameters) {
        console.log(">>>", method, parameters);
        return super.send(method, parameters).then((result) => {
            console.log("<<<", method, parameters, result);
            return result;
        });
    }    
}

module.exports = LoggingProvider
