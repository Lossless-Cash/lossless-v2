require('@nomiclabs/hardhat-waffle');

require('@openzeppelin/hardhat-upgrades');
// require('solidity-coverage');
require('hardhat-abi-exporter');
// require('@nomiclabs/hardhat-etherscan');
// require('@openzeppelin/hardhat-defender');
require('hardhat-gas-reporter');

const {
  ROPSTEN_PRIVATE_KEY,
  INFURA_KEY,
  ETHERSCAN_KEY,
  DEFENDER_KEY,
  DEFENDER_SECRET,
} = require('./config');

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  paths: {
    artifacts: './src/artifacts',
  },
  networks: {
    hardhat: {
      chainId: 1337,
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/WpZq7dbPsInJFOhzMtNSNXkib7dL7A1O`,
        blockNumber: 12644052,
      },
    },
    ropsten: {
      url:
        'https://speedy-nodes-nyc.moralis.io/6743a8ce6ffa15b496454e17/eth/ropsten',
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`],
    },
  },
  gasReporter: {
    currency: 'EUR',
    gasPrice: 21,
  },
  abiExporter: {
    path: './abi',
    clear: true,
    flat: true,
    spacing: 2,
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: ETHERSCAN_KEY,
  },
  defender: {
    apiKey: DEFENDER_KEY,
    apiSecret: DEFENDER_SECRET,
  },
};
