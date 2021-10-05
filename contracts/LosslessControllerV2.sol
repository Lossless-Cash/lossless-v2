// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

interface IProtectionStrategy {
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external;
}

contract LosslessControllerV2 is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    // --- V2 VARIABLES ---
    struct Protection {
        bool isProtected;
        address strategy;
    }
    struct Protections {
        mapping(address => Protection) protections;
    }
    address public guardian;
    mapping(address => Protections) private tokenProtections;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);

    event GuardianSet(address indexed oldGuardian, address indexed newGuardian);
    event ProtectedAddressSet(address indexed token, address indexed protectedAddress, address indexed strategy);
    event RemovedProtectedAddress(address indexed token, address indexed protectedAddress);

    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(msg.sender == recoveryAdmin, "LOSSLESS: must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(admin == msg.sender, "LOSSLESS: must be admin");
        _;
    }

    modifier onlyGuardian() {
        require(msg.sender == address(guardian), "LOSSLESS: sender is not guardian");
        _;
    }

    // --- VIEWS ---

    function getVersion() public pure returns (uint256) {
        return 2;
    }

    function isAddressProtected(address token, address protectedAddress) public view returns (bool) {
        return tokenProtections[token].protections[protectedAddress].isProtected;
    }

    function getProtectedAddressStrategy(address token, address protectedAddress) public view returns (address) {
        return tokenProtections[token].protections[protectedAddress].strategy;
    }

    // --- ADMINISTRATION ---

    function pause() public {
        require(msg.sender == pauseAdmin, "LOSSLESS: Must be pauseAdmin");
        _pause();
    }    
    
    function unpause() public {
        require(msg.sender == pauseAdmin, "LOSSLESS: Must be pauseAdmin");
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

    // --- GUARD ---

    // @notice Set a guardian contract.
    // @dev guardian contract must be trusted as it has some access rights and can modify controller's state.
    function setGuardian(address newGuardian) public onlyLosslessAdmin whenNotPaused {
        emit GuardianSet(guardian, newGuardian);
        guardian = newGuardian;
    }

    // @notice Sets protection for an address with the choosen strategy.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function setProtectedAddress(address token, address protectedAddresss, address strategy) external onlyGuardian whenNotPaused {
        Protection storage protection = tokenProtections[token].protections[protectedAddresss];
        protection.isProtected = true;
        protection.strategy = strategy;
        emit ProtectedAddressSet(token, protectedAddresss, strategy);
    }

    // @notice Remove the protectio from the address.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function removeProtectedAddress(address token, address protectedAddresss) external onlyGuardian whenNotPaused {
        delete tokenProtections[token].protections[protectedAddresss];
        emit RemovedProtectedAddress(token, protectedAddresss);
    }

    // --- BEFORE HOOKS ---

    // @notice If address is protected, transfer validation rules have to be run inside the strategy.
    // @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    function beforeTransfer(address sender, address recipient, uint256 amount) external {
        if (tokenProtections[msg.sender].protections[sender].isProtected) {
            IProtectionStrategy(tokenProtections[msg.sender].protections[sender].strategy)
                .isTransferAllowed(msg.sender , sender, recipient, amount);
        }
    }

    // @notice If address is protected, transfer validation rules have to be run inside the strategy.
    // @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {
        if (tokenProtections[msg.sender].protections[sender].isProtected) {
            IProtectionStrategy(tokenProtections[msg.sender].protections[sender].strategy)
                .isTransferAllowed(msg.sender, sender, recipient, amount);
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