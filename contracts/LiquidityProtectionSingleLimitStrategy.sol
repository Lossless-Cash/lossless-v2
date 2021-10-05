// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";
import "./StrategyBase.sol";

contract LiquidityProtectionSingleLimitStrategy is StrategyBase {
    struct Limit {
        uint32 periodInBlocks;
        uint32 lastCheckpoint;
        uint256 amountPerPeriod;
        uint256 amountLeft;
    }
    struct Protection {
        mapping(address => Limit) limits;
    }
    mapping(address => Protection) private protection;

    constructor(address _guardian, address _lossless) StrategyBase(_guardian, _lossless) {}

    // @param token Project token, the protection will be scoped inside of this token transfers.
    // @param protectedAddress Address to apply the limits to.
    // @param periodInBlocks Limit period in blocks.
    // @param amountPerPeriod Max amount that can be transfered in the coressponding period.
    // @param startblock Shows when each of the limits should be activated. Desribed in blocks.
    // @dev This method allows setting 1 limit to 0...N addresses.
    // @dev Each item on the same index in periodsInBlocks, amountsPerPeriod, startblocks represents a different variable of the same limit.
    function setLimitBatched(
        address token,
        address[] calldata protectedAddresses,
        uint32 periodInBlocks,
        uint256 amountPerPeriod,
        uint32 startblock
    ) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < protectedAddresses.length; i++) {
            saveLimit(token, protectedAddresses[i], periodInBlocks, amountPerPeriod, startblock);
            guardian.setProtectedAddress(token, protectedAddresses[i], address(this));
        }
    }

    // @dev params pretty much the same as in batched
    // @dev This method allows setting 1 limit 1 address.
    // @dev Each item on the same index in periodsInBlocks, amountsPerPeriod, startblocks represents a different variable of the same limit.
    function setLimit(
        address token,
        address protectedAddress,
        uint32 periodInBlocks,
        uint256 amountPerPeriod,
        uint32 startblock
    ) public onlyProtectionAdmin(token) {
        saveLimit(token, protectedAddress, periodInBlocks, amountPerPeriod, startblock);
        guardian.setProtectedAddress(token, protectedAddress, address(this));
    }

    function saveLimit(
         address token,
        address protectedAddress,
        uint32 periodInBlocks,
        uint256 amountPerPeriod,
        uint32 startblock
    ) internal {
        Limit storage limit = protection[token].limits[protectedAddress];
        limit.periodInBlocks = periodInBlocks;
        limit.amountPerPeriod = amountPerPeriod;
        limit.lastCheckpoint = startblock;
        limit.amountLeft = amountPerPeriod;
    }

    function removeLimits(address token, address[] calldata list) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < list.length; i++) {
            delete protection[token].limits[list[i]];
            guardian.removeProtectedAddresses(token, list[i]);
        }
    }

    // @dev pausing is just adding a limit with amount 0 in the front on the limits array.
    // @dev we need to keep it at the front to reduce the gas costs of iterating through the array.
    function pause(address token, address protectedAddress) public onlyProtectionAdmin(token) {
        require(lossless.isAddressProtected(token, protectedAddress), "LOSSLESS: not protected");
        Limit storage limit = protection[token].limits[protectedAddress];
        limit.amountLeft = 0;
        limit.lastCheckpoint = type(uint32).max - limit.periodInBlocks;
        emit Paused(token, protectedAddress);
    }

    // @dev Limit is reset every period.
    // @dev Every period has it's own amountLeft which gets decreased on every transfer.
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external {
        require(msg.sender == address(lossless), "LOSSLESS: not controller");
        Limit storage limit = protection[token].limits[sender];

        // Time period based limits checks
        // Is transfer is in the same period ?
        if (limit.lastCheckpoint + limit.periodInBlocks > block.number) {
            limit.amountLeft = calculateAmountLeft(amount, limit.amountLeft);
        }
        // New period started, update checkpoint and reset amount
        else {
            limit.lastCheckpoint = calculateUpdatedCheckpoint(limit.lastCheckpoint, limit.periodInBlocks, uint32(block.number));
            limit.amountLeft = calculateAmountLeft(amount, limit.amountPerPeriod);
        }
        
        require(limit.amountLeft > 0, "LOSSLESS: limit reached");
    }

    // --- HELPERS ---

    function calculateAmountLeft(uint256 amount, uint256 amountLeft) internal pure returns (uint256)  {
        if (amount >= amountLeft) {
            return 0;
        } else {
            return amountLeft - amount;
        }
    }

    function calculateUpdatedCheckpoint(uint32 lastCheckpoint, uint32 periodInBlocks, uint32 blockNumber) internal pure returns(uint32) {
        return lastCheckpoint + (periodInBlocks * ((blockNumber - lastCheckpoint) / periodInBlocks));
    }

    function cloneLimit(uint256 indexFrom, Limit[] memory limits) internal pure returns (Limit memory limitCopy)  {
        limitCopy.periodInBlocks = limits[indexFrom].periodInBlocks;
        limitCopy.amountPerPeriod = limits[indexFrom].amountPerPeriod;
        limitCopy.lastCheckpoint = limits[indexFrom].lastCheckpoint;
        limitCopy.amountLeft = limits[indexFrom].amountLeft;
    }

    // --- VIEWS ---

    function getLimit(address token, address protectedAddress) public view returns(Limit memory) {
        return protection[token].limits[protectedAddress];
    }
}