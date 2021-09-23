// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface ILERC20 {
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
    struct VerifiedAddress {
        mapping(address => bool) verified;
    }

    mapping(address => address) public protectionAdmin;
    mapping(address => bool) public verifiedStrategies;
    mapping(address => bool) public verifiedTokens;
    mapping(address => VerifiedAddress) private verifiedAddresses;
    ILosslessController public lossless;

    event TokenVerified(address indexed token);
    event TokenVerificationRemoved(address indexed token);
    event AddressVerified(address indexed token, address indexed verifiedAddress, bool value);
    event ProtectionAdminSet(address indexed token, address indexed admin);
    event StrategyVerified(address indexed strategy);
    event StrategyRemoved(address indexed strategy);

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

    modifier onlyVerifiedAddress(address token, address addressToCheck) {
        require(verifiedAddresses[token].verified[addressToCheck], "LOSSLESS: not verified");
        _;
    }

    // --- VIEWS ---

    function isAddressVerified(address token, address verifiedAddress) public view returns(bool) {
        return verifiedAddresses[token].verified[verifiedAddress];
    }

    // --- MUTATIONS ---

    function verifyToken(address token) public onlyLosslessAdmin {
        verifiedTokens[token] = true;
        emit TokenVerified(token);
    }

    function removeVerifiedToken(address token) public onlyLosslessAdmin {
        verifiedTokens[token] = false;
        emit TokenVerificationRemoved(token);
    }

    function verifyAddress(address token, address verifiedAddress, bool value) public onlyLosslessAdmin {
        verifiedAddresses[token].verified[verifiedAddress] = value;
        emit AddressVerified(token, verifiedAddress, value);
    }

    function setProtectionAdmin(address token, address admin) public onlyVerifiedToken(token) {
        require(ILERC20(token).getAdmin() == msg.sender, "LOSSLESS: unauthorized");
        protectionAdmin[token] = admin;
        emit ProtectionAdminSet(token, admin);
    }

    function verifyStrategies(address[] calldata strategies) public onlyLosslessAdmin {
        for(uint8 i = 0; i < strategies.length; i++) {
            verifiedStrategies[strategies[i]] = true;
            emit StrategyVerified(strategies[i]);
        }
    }

    function removeStrategies(address[] calldata strategies) public onlyLosslessAdmin {
        for(uint8 i = 0; i < strategies.length; i++) {
            verifiedStrategies[strategies[i]] = false;
            emit StrategyRemoved(strategies[i]);
        }
    }

    function setProtectedAddress(address token, address guardedAddress, address strategy) external onlyVerifiedStrategy onlyVerifiedAddress(token, guardedAddress) {
        lossless.setProtectedAddress(token, guardedAddress, strategy);
    }

    function removeProtectedAddresses(address token, address protectedAddress) external onlyVerifiedStrategy {
        lossless.removeProtectedAddress(token, protectedAddress);
    }
}