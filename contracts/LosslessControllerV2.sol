// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

interface LERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    function getAdmin() external returns (address);

    function transferOutBlacklistedFunds(address[] calldata from) external;
}

interface IProtectionStrategy {
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external;
}

contract LosslessControllerV2 is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    address public guardian;

    struct Protection {
        bool isProtected;
        address strategy;
    }

    struct Protections {
        mapping(address => Protection) protections;
    }

    mapping(address => Protections) tokenProtections;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);

    event ReportSubmitted(address indexed token, address indexed account, uint256 reportId);
    event AnotherReportSubmitted(address indexed token, address indexed account, uint256 reportId);
    event Staked(address indexed token, address indexed account, uint256 reportId);
    event GuardianSet(address indexed oldGuardian, address indexed newGuardian);

    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(_msgSender() == recoveryAdmin, "LOSSLESS: must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(admin == _msgSender(), "LOSSLESS: must be admin");
        _;
    }

    modifier onlyGuardian() {
        require(_msgSender() == address(guardian), "LOSSLESS: sender is not guardian");
        _;
    }

    // --- ADMIN STUFF ---

    function pause() public {
        require(_msgSender() == pauseAdmin, "LOSSLESS: Must be pauseAdmin");
        _pause();
    }    
    
    function unpause() public {
        require(_msgSender() == pauseAdmin, "LOSSLESS: Must be pauseAdmin");
        _unpause();
    }

    function setAdmin(address newAdmin) public onlyLosslessRecoveryAdmin {
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    function setRecoveryAdmin(address newRecoveryAdmin) public onlyLosslessRecoveryAdmin {
        emit RecoveryAdminChanged(recoveryAdmin, newRecoveryAdmin);
        recoveryAdmin = newRecoveryAdmin;
    }

    function setPauseAdmin(address newPauseAdmin) public onlyLosslessRecoveryAdmin {
        emit PauseAdminChanged(pauseAdmin, newPauseAdmin);
        pauseAdmin = newPauseAdmin;
    }


    // --- GETTERS ---

    function getVersion() public pure returns (uint256) {
        return 2;
    }

    function isAddressProtected(address token, address protectedAddress) public view returns (bool) {
        return tokenProtections[token].protections[protectedAddress].isProtected;
    }

    // GUARD ADMINISTRATION

    function setGuardian(address newGuardian) public onlyLosslessAdmin {
        emit GuardianSet(address(guardian), newGuardian);
        guardian = newGuardian;
    }   

    function setProtectedAddress(address token, address protectedAddresss, address strategy) external onlyGuardian {
        Protection storage protection = tokenProtections[token].protections[protectedAddresss];
        protection.isProtected = true;
        protection.strategy = strategy;
    }

    function removeProtectedAddress(address token, address guardedAddress) external onlyGuardian {
        delete tokenProtections[token].protections[guardedAddress];
    }

    // --- BEFORE HOOKS ---

    function beforeTransfer(address sender, address recipient, uint256 amount) external {
        if (tokenProtections[_msgSender()].protections[sender].isProtected) {
            IProtectionStrategy(tokenProtections[_msgSender()].protections[sender].strategy)
                .isTransferAllowed(_msgSender(), sender, recipient, amount);
        }
    }

    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {
        if (tokenProtections[_msgSender()].protections[sender].isProtected) {
            IProtectionStrategy(tokenProtections[_msgSender()].protections[sender].strategy)
                .isTransferAllowed(_msgSender(), sender, recipient, amount);
        }
    }

    function beforeApprove(address sender, address spender, uint256 amount) external {}

    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external {}

    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external {}

    // --- AFTER HOOKS ---

    function afterApprove(address sender, address spender, uint256 amount) external {}

    function afterTransfer(address sender, address recipient, uint256 amount) external {}

    function afterTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {}

    function afterIncreaseAllowance(address sender, address spender, uint256 addedValue) external {}

    function afterDecreaseAllowance(address sender, address spender, uint256 subtractedValue) external {}
}