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
    function setGuardedAddress(address token, address guardedAddress) external;

    function unfreezeAddresses(address token, address[] calldata unfreezelist) external;

    function admin() external returns(address);

    function getIsAddressFreezed(address token, address freezedAddress) external view returns (bool);

    function refund(address token, address freezedAddress, address refundAddress) external;
}

interface IGuardian {
    function guardAdmins(address token) external returns (address);
}

contract LiquidityProtectionStrategy {
    struct Limit {
        uint256 periodInBlocks;
        uint256 amountPerPeriod;

        int256 leftAmount;
        uint256 lastCheckpoint;
    }

    struct Guard {
        bool isTurnedOn;
        Limit[] limits;
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

    // TODO: set guardian

    function setGuardedAddress(address token, address guardedAddress, uint256 threshold) external onlyGuardian {
        Guard storage guard = tokenGuards[token].guards[guardedAddress];
        guard.isTurnedOn = true;
    }

    function addLimitToGuard(address token, address[] calldata guardlist, uint256[] calldata periodsInBlocks, uint256[] calldata amountsPerPeriod) public {
        require(msg.sender == IGuardian(guardian).guardAdmins(token), "LOSSLESS: unauthorized");
        
        for(uint8 i = 0; i < guardlist.length; i++) {
            Guard storage guard = tokenGuards[token].guards[guardlist[i]];
            require(guard.isTurnedOn, "LOSSLESS: address is not guarded");

            for(uint8 j = 0; j < periodsInBlocks.length; j ++) {
                Limit memory limit;
                limit.periodInBlocks = periodsInBlocks[j];
                limit.amountPerPeriod = amountsPerPeriod[j];
                limit.lastCheckpoint = block.timestamp;
                limit.leftAmount = int256(amountsPerPeriod[j]);
                guard.limits.push(limit);
            }
        }
    }

    function isTransferAllowed(address token, address sender, uint256 amount) external returns (bool) {
        require(msg.sender == address(lossless), "LOSSLESS: unauthorized");
        Guard storage guard = tokenGuards[token].guards[sender];
        if (!guard.isTurnedOn) {
            return true;
        }

        // Time period based limits checks
        for(uint256 i = 0; i < guard.limits.length; i++) {
            Limit storage limit = guard.limits[i];

            // Are still in the same period ?
            if (limit.lastCheckpoint + limit.periodInBlocks > block.timestamp) {
                limit.leftAmount = limit.leftAmount - int256(amount);
            } 
            // New period entered, 
            // Update checkpoint and reset amount
            else {
                uint256 deltaBlocks = block.timestamp - limit.lastCheckpoint;
                uint256 periodsInDelta = deltaBlocks / limit.periodInBlocks;
                limit.lastCheckpoint = limit.lastCheckpoint + (limit.periodInBlocks * periodsInDelta);
                limit.leftAmount = int256(limit.amountPerPeriod) - int256(amount);
            }


            if (limit.leftAmount <= 0) {
                return false;
            }
        }

        return true;
    }
}