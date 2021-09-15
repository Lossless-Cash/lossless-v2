// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
    function setGuardedAddress(address token, address guardedAddress, address strategy) external;

    function unfreezeAddresses(address token, address[] calldata unfreezelist) external;

    function admin() external returns(address);

    function getIsAddressFreezed(address token, address freezedAddress) external view returns (bool);

    function refund(address token, address freezedAddress, address refundAddress) external;
}

interface IGuardian {
    function guardAdmins(address token) external returns (address);

    function setGuardedAddress(address token, address guardedAddress, address strategy) external;
}

contract TreasuryProtectionStrategy {
    struct Guard {
        bool isTurnedOn;
        uint256 threshold;
    }

    struct AddressGuard {
        mapping(address => Guard) guards; 
    }

    mapping(address => address) public guardAdmins;
    mapping(address => address) public refundAdmins;
    mapping(address => AddressGuard) private tokenGuards;
    mapping(bytes32 => uint256) public refundTimestamps;
    address public guardian;
    ILosslessController public lossless;
    uint256 public timelockPeriod = 86400;

    constructor(address _guardian, address _lossless) {
        guardian = _guardian;
        lossless = ILosslessController(_lossless);
    }

    modifier onlyGuardian() {
        require(msg.sender == guardian, "LOSSLESS: unauthorized");
        _;
    }

    function setGuardian(address newGuardian) public {
        require(msg.sender == lossless.admin(), "LOSSLESS: unauthorized");
        guardian = newGuardian;
    }

    function setGuardedList(address token, address[] calldata guardlistAddition, uint256[] calldata thresholdlist, address[] calldata strategies) public {
        require(msg.sender == IGuardian(guardian).guardAdmins(token), "LOSSLESS: unauthorized");
        
        for(uint8 i = 0; i < guardlistAddition.length; i++) {
            Guard storage guard = tokenGuards[token].guards[guardlistAddition[i]];
            guard.isTurnedOn = true;
            guard.threshold = thresholdlist[i];
            IGuardian(guardian).setGuardedAddress(token, guardlistAddition[i], strategies[i]);
        }
    }

    function removeGuards(address token, address[] calldata guardlistAddition) public {
        require(msg.sender == IGuardian(guardian).guardAdmins(token), "LOSSLESS: unauthorized");
        
        for(uint8 i = 0; i < guardlistAddition.length; i++) {
            Guard storage guard = tokenGuards[token].guards[guardlistAddition[i]];
            guard.isTurnedOn = false;
            guard.threshold = 0;
        }
    }

    function isTransferAllowed(address token, address sender, uint256 amount) external view returns (bool) {
        require(msg.sender == address(lossless), "LOSSLESS: unauthorized");
        Guard storage guard = tokenGuards[token].guards[sender];
        if (!guard.isTurnedOn) {
            return true;
        }

        // Simple threshold check
        if(guard.threshold <= amount) {
            return false;
        }

        return true;
    }
}