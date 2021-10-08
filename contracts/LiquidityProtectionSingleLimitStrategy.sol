// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./StrategyBase.sol";

contract LiquidityProtectionSingleLimitStrategy is StrategyBase {
    mapping(address => Protection) private protection;

    // @dev using uint32 for gas savings
    struct Limit {
        uint32 periodInBlocks;  
        uint32 lastCheckpointBlock; 
        uint256 amountPerPeriod;
        uint256 amountLeftInCurrentPeriod;
    }

    struct Protection {
        mapping(address => Limit) limits;
    }

    constructor(Guardian _guardian, LosslessController _controller) StrategyBase(_guardian, _controller) {}

    // --- VIEWS ---

    function getLimit(address token, address protectedAddress) public view returns(Limit memory) {
        return protection[token].limits[protectedAddress];
    }

    // --- METHODS ---

    // @param token Project token, the protection will be scoped inside of this token's transfers.
    // @param protectedAddress Address to apply the limits to.
    // @param periodInBlocks Limit period in blocks.
    // @param amountPerPeriod Max amount that can be transfered in period.
    // @param startblock Shows when limit should be activated.
    // @dev This method allows setting 1 limit to 0...N addresses.
    function setLimitBatched(
        address token,
        address[] calldata protectedAddresses,
        uint32 periodInBlocks,
        uint256 amountPerPeriod,
        uint32 startBlock
    ) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < protectedAddresses.length; i++) {
            saveLimit(token, protectedAddresses[i], periodInBlocks, amountPerPeriod, startBlock);
            guardian.setProtectedAddress(token, protectedAddresses[i]);
        }
    }

    // @dev params pretty much the same as in batched
    // @dev This method allows setting 1 limit 1 address.
    function setLimit(
        address token,
        address protectedAddress,
        uint32 periodInBlocks,
        uint256 amountPerPeriod,
        uint32 startBlock
    ) public onlyProtectionAdmin(token) {
        saveLimit(token, protectedAddress, periodInBlocks, amountPerPeriod, startBlock);
        guardian.setProtectedAddress(token, protectedAddress);
    }

    function removeLimits(address token, address[] calldata protectedAddresses) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < protectedAddresses.length; i++) {
            delete protection[token].limits[protectedAddresses[i]];
            guardian.removeProtectedAddresses(token, protectedAddresses[i]);
        }
    }

    // @dev Pausing is just adding a limit with amount 0.
    // @dev amountLeftInCurrentPeriod never resets because of the lastCheckpointBlock
    // @dev This approach uses less gas than having a separate isPaused flag.
    function pause(address token, address protectedAddress) public onlyProtectionAdmin(token) {
        require(controller.isAddressProtected(token, protectedAddress), "LOSSLESS: not protected");
        Limit storage limit = protection[token].limits[protectedAddress];
        limit.amountLeftInCurrentPeriod = 0;
        limit.lastCheckpointBlock = type(uint32).max - limit.periodInBlocks;
        emit Paused(token, protectedAddress);
    }

    // @dev Limit is reset every period.
    // @dev Every period has it's own amountLeft which gets decreased on every transfer.
    // @dev This method modifies state so should be callable only by the trusted address!
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external {
        require(msg.sender == address(controller), "LOSSLESS: not controller");
        Limit storage limit = protection[token].limits[sender];

        // Is transfer is in the same period ?
        if (limit.lastCheckpointBlock + limit.periodInBlocks > block.number) { 
            limit.amountLeftInCurrentPeriod = calculateAmountLeft(amount, limit.amountLeftInCurrentPeriod);
        }
        // New period started, update checkpoint and reset amount
        else {
            limit.lastCheckpointBlock = calculateUpdatedCheckpoint(limit.lastCheckpointBlock, limit.periodInBlocks);
            limit.amountLeftInCurrentPeriod = calculateAmountLeft(amount, limit.amountPerPeriod);
        }
        
        require(limit.amountLeftInCurrentPeriod > 0, "LOSSLESS: limit reached");
    }

    // --- INTERNAL METHODS ---

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
        limit.lastCheckpointBlock = startblock;
        limit.amountLeftInCurrentPeriod = amountPerPeriod;
    }

    function calculateAmountLeft(uint256 amount, uint256 amountLeft) internal pure returns (uint256)  {
        if (amount >= amountLeft) {
            return 0;
        } else {
            return amountLeft - amount;
        }
    }

    function calculateUpdatedCheckpoint(uint32 lastCheckpoint, uint32 periodInBlocks) internal view returns(uint32) {
        return lastCheckpoint + (periodInBlocks * ((uint32(block.number) - lastCheckpoint) / periodInBlocks));
    }
}