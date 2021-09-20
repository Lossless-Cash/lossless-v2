// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "hardhat/console.sol";

interface LERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    function getAdmin() external returns (address);
}

interface ILosslessController {
    function admin() external returns(address);
}

interface IGuardian {
    function protectionAdmin(address token) external returns (address);

    function setProtectedAddress(address token, address guardedAddress, address strategy) external;

    function removeProtectedAddresses(address token, address protectedAddress) external;
}

error NotAllowed(address sender, uint256 amount);

contract TreasuryProtectionStrategy {
    struct Whitelist {
        mapping(address => bool) whitelist;
    }

    struct Protection {
        mapping(address => Whitelist) protection; 
    }

    mapping(address => Protection) private protectedAddresses;
    IGuardian public guardian;
    ILosslessController public lossless;

    constructor(address _guardian, address _lossless) {
        guardian = IGuardian(_guardian);
        lossless = ILosslessController(_lossless);
    }

    modifier onlyGuardian() {
        require(msg.sender == address(guardian), "LOSSLESS: unauthorized");
        _;
    }

    modifier onlyProtectionAdmin(address token) {
        require(msg.sender == guardian.protectionAdmin(token), "LOSSLESS: unauthorized");
        _;
    }

    function setGuardian(address newGuardian) public {
        require(msg.sender == lossless.admin(), "LOSSLESS: unauthorized");
        guardian = IGuardian(newGuardian);
    }

    function setProtectedAddress(address token, address protectedAddress, address[] calldata whitelist) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < whitelist.length; i++) {
            protectedAddresses[token].protection[protectedAddress].whitelist[whitelist[i]] = true;
        }

        guardian.setProtectedAddress(token, protectedAddress, address(this));
    }

    function removeProtectedAddresses(address token, address[] calldata addressesToRemove) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < addressesToRemove.length; i++) {
            delete protectedAddresses[token].protection[addressesToRemove[i]];
            guardian.removeProtectedAddresses(token, addressesToRemove[i]);
        }
    }

    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external view {
        require(protectedAddresses[token].protection[sender].whitelist[recipient], "LOSSLESS: recipient not whitelisted");
    }
}