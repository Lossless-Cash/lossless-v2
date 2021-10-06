// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";

interface ILERC20 {
    function getAdmin() external returns (address);
}

interface ILosslessController {
    function setProtectedAddress(address token, address guardedAddress, address strategy) external;

    function removeProtectedAddress(address token, address guardedAddress) external;

    function admin() external returns(address);

    function pauseAdmin() external returns(address);
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

    event TokenVerified(address indexed token, bool value);
    event AddressVerified(address indexed token, address indexed verifiedAddress, bool value);
    event ProtectionAdminSet(address indexed token, address indexed admin);
    event StrategyVerified(address indexed strategy, bool value);

    constructor(address _lossless) {
        lossless = ILosslessController(_lossless);
    }

    modifier onlyLosslessAdmin() {
        require(msg.sender == lossless.admin(),"LOSSLESS: not lossless admin");
        _;
    }

    modifier onlyVerifiedStrategy() {
        require(verifiedStrategies[msg.sender], "LOSSLESS: strategy not verified");
        _;
    }

    modifier onlyVerifiedToken(address token) {
        require(verifiedTokens[token], "LOSSLESS: token not verified");
        _;
    }

    modifier onlyVerifiedAddress(address token, address addressToCheck) {
        require(verifiedAddresses[token].verified[addressToCheck], "LOSSLESS: address not verified");
        _;
    }

    function isAddressVerified(address token, address verifiedAddress) public view returns(bool) {
        return verifiedAddresses[token].verified[verifiedAddress];
    }

    // @dev strategies are where all the protection implementation logic lives.
    function verifyStrategies(address[] calldata strategies, bool value) public onlyLosslessAdmin {
        for(uint8 i = 0; i < strategies.length; i++) {
            verifiedStrategies[strategies[i]] = value;
            emit StrategyVerified(strategies[i], value);
        }
    }

    // @dev Lossless team has to verify projects that can use protection functionality.
    function verifyToken(address token, bool value) public onlyLosslessAdmin {
        verifiedTokens[token] = value;
        emit TokenVerified(token, value);
    }

    // @dev Lossless team has to verify addresses that projects want to protect.
    function verifyAddress(address token, address verifiedAddress, bool value) public onlyLosslessAdmin onlyVerifiedToken(token) {
        verifiedAddresses[token].verified[verifiedAddress] = value;
        emit AddressVerified(token, verifiedAddress, value);
    }   

    // @notice Token admin sets up another admin that is responsible for managing protection.
    function setProtectionAdmin(address token, address admin) public onlyVerifiedToken(token) {
        require(ILERC20(token).getAdmin() == msg.sender, "LOSSLESS: not token admin");
        protectionAdmin[token] = admin;
        emit ProtectionAdminSet(token, admin);
    }

    // @dev This is called from strategy conctract and forwards that call to the controller.
    function setProtectedAddress(address token, address guardedAddress) external onlyVerifiedStrategy onlyVerifiedAddress(token, guardedAddress) {
        lossless.setProtectedAddress(token, guardedAddress, msg.sender);
    }
    
    // @dev This is called from strategy conctract or protection admin and forwards that call to the controller.
    function removeProtectedAddresses(address token, address protectedAddress) external {
        require(verifiedStrategies[msg.sender] || msg.sender == protectionAdmin[token], "LOSSLESS: unauthorized");
        lossless.removeProtectedAddress(token, protectedAddress);
    }
}