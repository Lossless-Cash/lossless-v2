// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface LERC20 {
    function getAdmin() external returns (address);
}

interface ILosslessController {
    function setProtectedAddress(address token, address guardedAddress, address strategy) external;

    function removeProtectedAddress(address token, address guardedAddress) external;

    function admin() external returns(address);
}

interface IStrategy {
    function setGuardedAddress(address token, address guardedAddress, uint256 threshold) external;
}

contract LosslessGuardian {
    mapping(address => address) public protectionAdmin;
    mapping(address => bool) public verifiedStrategies;
    mapping(address => bool) public verifiedTokens;
    ILosslessController public lossless;

    constructor(address _lossless) {
        lossless = ILosslessController(_lossless);
    }

    modifier onlyLosslessAdmin() {
        require(msg.sender == lossless.admin(),"LOSSLESS: unauthorized");
        _;
    }

    modifier onlyVerifiedStrategy() {
        require(verifiedStrategies[msg.sender], "LOSSLESS: unauthorized");
        _;
    }

    modifier onlyVerifiedToken(address token) {
        require(verifiedTokens[token], "LOSSLESS: unauthorized");
        _;
    }

    function verifyToken(address token) public onlyLosslessAdmin {
        verifiedTokens[token] = true;
    }

    function removeVerifiedToken(address token) public onlyLosslessAdmin {
        verifiedTokens[token] = false;
    }

    function setProtectionAdmin(address token, address admin) public onlyVerifiedToken(token) {
        require(LERC20(token).getAdmin() == msg.sender, "LOSSLESS: unauthorized");
        protectionAdmin[token] = admin;
    }

    function verifyStrategies(address[] calldata strategies) public onlyLosslessAdmin {
        for(uint8 i = 0; i < strategies.length; i++) {
            verifiedStrategies[strategies[i]] = true;
        }
    }

    function removeStrategies(address[] calldata strategies) public onlyLosslessAdmin {
        for(uint8 i = 0; i < strategies.length; i++) {
            verifiedStrategies[strategies[i]] = false;
        }
    }

    function setProtectedAddress(address token, address guardedAddress, address strategy) external onlyVerifiedStrategy {
        lossless.setProtectedAddress(token, guardedAddress, strategy);
    }

    function removeProtectedAddresses(address token, address protectedAddress) external onlyVerifiedStrategy {
        lossless.removeProtectedAddress(token, protectedAddress);
    }
}