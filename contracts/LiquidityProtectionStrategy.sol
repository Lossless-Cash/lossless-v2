// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface ILosslessController {
    function admin() external returns(address);

    function isAddressProtected(address token, address protectedAddress) external view returns (bool);
}

interface IGuardian {
    function protectionAdmin(address token) external returns (address);

    function setProtectedAddress(address token, address guardedAddress, address strategy) external;

    function removeProtectedAddresses(address token, address protectedAddress) external;
}

error NotAllowed(address sender, uint256 amount);

contract LiquidityProtectionStrategy {
    struct Limit {
        uint256 periodInBlocks;
        uint256 amountPerPeriod;

        uint256 amountLeft;
        uint256 lastCheckpoint;
    }

    struct Protection {
        mapping(address => Limit[]) limits;
    }

    mapping(address => Protection) private protection;
    IGuardian public guardian;
    ILosslessController public lossless;

    event GuardianSet(address indexed newGuardian);
    event Paused(address indexed token, address indexed protectedAddress);
    event Unpaused(address indexed token, address indexed protectedAddress);

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
        emit GuardianSet(newGuardian);
    }

    function setLimits(
        address token,
        address[] calldata guardlist,
        uint256[] calldata periodsInBlocks,
        uint256[] calldata amountsPerPeriod,
        uint256[] calldata startblocks
    ) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < guardlist.length; i++) {
            Limit[] storage limits = protection[token].limits[guardlist[i]];
            guardian.setProtectedAddress(token, guardlist[i], address(this));

            for(uint8 j = 0; j < periodsInBlocks.length; j ++) {
                Limit memory limit;
                limit.periodInBlocks = periodsInBlocks[j];
                limit.amountPerPeriod = amountsPerPeriod[j];
                limit.lastCheckpoint = startblocks[i];
                limit.amountLeft = amountsPerPeriod[j];
                limits.push(limit);
            }
        }
    }

    function removeLimits(address token, address[] calldata list) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < list.length; i++) {
            delete protection[token].limits[list[i]];
            guardian.removeProtectedAddresses(token, list[i]);
        }
    }

    function pause(address token, address protectedAddress) public onlyProtectionAdmin(token) {
        require(lossless.isAddressProtected(token, protectedAddress), "LOSSLESS: not protected");
        Limit[] storage limits = protection[token].limits[protectedAddress];
        require(limits[0].amountPerPeriod != 0, "LOSSLESS: already paused");

        limits.push(cloneLimit(0, limits));
        // Set first element to be have 0 limit
        limits[0].amountPerPeriod = 0;
        limits[0].amountLeft = 0;

        emit Paused(token, protectedAddress);
    }

    function unpause(address token, address protectedAddress) public onlyProtectionAdmin(token) { 
        require(lossless.isAddressProtected(token, protectedAddress), "LOSSLESS: not protected");
        Limit[] storage limits = protection[token].limits[protectedAddress];
        require(limits[0].amountPerPeriod == 0, "LOSSLESS: not paused");
        
        limits[0] = cloneLimit(limits.length - 1, limits);
        delete limits[limits.length - 1];
        limits.pop();

        emit Unpaused(token, protectedAddress);
    }

    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external {
        require(msg.sender == address(lossless), "LOSSLESS: unauthorized");
        Limit[] storage limits = protection[token].limits[sender];
        
        // Time period based limits checks
        for(uint256 i = 0; i < limits.length; i++) {
            Limit storage limit = limits[i];

            // Is transfer is in the same period ?
            if (limit.lastCheckpoint + limit.periodInBlocks > block.number) {
                limit.amountLeft = calculateAmountLeft(amount, limit.amountLeft);
            }
            // New period started, update checkpoint and reset amount
            else {
                limit.lastCheckpoint = calculateUpdatedCheckpoint(limit.lastCheckpoint, limit.periodInBlocks, block.number);
                limit.amountLeft = calculateAmountLeft(amount, limit.amountPerPeriod);
            }
            
            require(limit.amountLeft > 0, "LOSSLESS: limit reached");
        }
    }

    // --- HELPERS ---

    function calculateAmountLeft(uint256 amount, uint256 amountLeft) internal pure returns (uint256)  {
        if (amount >= amountLeft) {
            return 0;
        } else {
            return amountLeft - amount;
        }
    }

    function calculateUpdatedCheckpoint(uint256 lastCheckpoint, uint256 periodInBlocks, uint256 blockNumber) internal pure returns(uint256) {
        uint256 deltaBlocks = blockNumber - lastCheckpoint;
        uint256 periodsInDelta = deltaBlocks / periodInBlocks;
        return lastCheckpoint + (periodInBlocks * periodsInDelta);
    }

    function cloneLimit(uint256 indexFrom, Limit[] memory limits) internal pure returns (Limit memory limitCopy)  {
        limitCopy.periodInBlocks = limits[indexFrom].periodInBlocks;
        limitCopy.amountPerPeriod = limits[indexFrom].amountPerPeriod;
        limitCopy.lastCheckpoint = limits[indexFrom].lastCheckpoint;
        limitCopy.amountLeft = limits[indexFrom].amountLeft;
    }

    // --- VIEWS ---

    function getLimitsLength(address token, address protectedAddress) public view returns(uint256) {
        return protection[token].limits[protectedAddress].length;
    }

    function getLimit(address token, address protectedAddress, uint256 index) public view returns(Limit memory) {
        return protection[token].limits[protectedAddress][index];
    }
}