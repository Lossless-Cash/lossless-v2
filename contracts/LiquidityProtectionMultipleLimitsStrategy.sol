// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./StrategyBase.sol";

contract LiquidityProtectionMultipleLimitsStrategy is StrategyBase{
    mapping(address => Protection) private protection;

    struct Limit {
        uint32 periodInBlocks;
        uint32 lastCheckpointBlock;
        uint256 amountPerPeriod;
        uint256 amountLeftInCurrentPeriod;
    }

    struct Protection {
        mapping(address => Limit[]) limits;
    }

    constructor(Guardian _guardian, LosslessController _controller)  StrategyBase(_guardian, _controller) {}

    // --- METHODS ---

    // @dev params mostly as in batched
    // @dev This method allows setting 0...N limit to 1 address.
    // @dev Each item on the same index in periodsInBlocks, amountsPerPeriod, startBlocks represents a different variable of the same limit.
    function setLimits(
        address token,
        address protectedAddress,
        uint32[] calldata periodsInBlocks,
        uint256[] calldata amountsPerPeriod,
        uint32[] calldata startBlocks
    ) public onlyProtectionAdmin(token) {
        guardian.setProtectedAddress(token, protectedAddress);
        saveLimits(token, protectedAddress, periodsInBlocks, amountsPerPeriod, startBlocks);
    }

    // @param token Project token, the protection will be scoped inside of this token's transfers.
    // @param protectedAddress Address to apply the limits to.
    // @param periodsInBlocks Limit period described in blocks. Each item in the list represents a different limit.
    // @param amountsPerPeriod A list of max amounts that can be transfered in the coressponding period.
    // @param startBlocks A list of item that shows when each of the limits should be activated. Desribed in block.
    // @dev This method allows setting 0...N limits to 0...N addresses.
    // @dev Each item on the same index in periodsInBlocks, amountsPerPeriod, startBlocks represents a different variable of the same limit.
    function setLimitsBatched(
        address token,
        address[] calldata protectedAddresses,
        uint32[] calldata periodsInBlocks,
        uint256[] calldata amountsPerPeriod,
        uint32[] calldata startBlocks
    ) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < protectedAddresses.length; i++) {
            guardian.setProtectedAddress(token, protectedAddresses[i]);
            saveLimits(token, protectedAddresses[i], periodsInBlocks, amountsPerPeriod, startBlocks);
        }
    }

    function removeLimits(address token, address[] calldata protectedAddresses) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < protectedAddresses.length; i++) {
            delete protection[token].limits[protectedAddresses[i]];
            guardian.removeProtectedAddresses(token, protectedAddresses[i]);
        }
    }

    // @dev Pausing is just adding a limit with amount 0 in the front on the limits array.
    // @dev We need to keep it at the front to reduce the gas costs of iterating through the array.
    function pause(address token, address protectedAddress) public onlyProtectionAdmin(token) {
        require(controller.isAddressProtected(token, protectedAddress), "LOSSLESS: not protected");
        Limit[] storage limits = protection[token].limits[protectedAddress];
        Limit storage firstLimit = limits[0];
        uint32 maxPossibleCheckpointBlock = type(uint32).max - firstLimit.periodInBlocks;
        require(firstLimit.lastCheckpointBlock != maxPossibleCheckpointBlock, "LOSSLESS: already paused");

        limits.push(cloneLimit(0, limits));

        // Set first element to have zero amount left and make it so it never enters new period
        firstLimit.amountLeftInCurrentPeriod = 0;
        firstLimit.lastCheckpointBlock = maxPossibleCheckpointBlock;

        emit Paused(token, protectedAddress);
    }

    // @dev Removing the first limit in the array in case it is 0.
    // @dev In case project sets a 0 limit as the first limit's array element, this would allow removing it.
    function unpause(address token, address protectedAddress) public onlyProtectionAdmin(token) { 
        require(controller.isAddressProtected(token, protectedAddress), "LOSSLESS: not protected");
        Limit[] storage limits = protection[token].limits[protectedAddress];
        uint32 maxPossibleCheckpointBlock = type(uint32).max - limits[0].periodInBlocks;
        require(limits[0].lastCheckpointBlock == maxPossibleCheckpointBlock, "LOSSLESS: not paused");
        
        limits[0] = cloneLimit(limits.length - 1, limits);
        delete limits[limits.length - 1];
        limits.pop();

        emit Unpaused(token, protectedAddress);
    }

    // @dev Limit is reset every period.
    // @dev Every period has it's own amountLeftInCurrentPeriod which gets decreased on every transfer.
    // @dev This method modifies state so should be callable only by the trusted address!
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external {
        require(msg.sender == address(controller), "LOSSLESS: not controller");
        Limit[] storage limits = protection[token].limits[sender];
        
        for(uint8 i = 0; i < limits.length; i++) {
            Limit storage limit = limits[i];

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
    }

    // --- INTERNAL METHODS ---

    function saveLimits(     
        address token,   
        address protectedAddress,
        uint32[] calldata periodsInBlocks,
        uint256[] calldata amountsPerPeriod,
        uint32[] calldata startBlocks
    ) internal {
        Limit[] storage limits = protection[token].limits[protectedAddress];
        for(uint8 i = 0; i < periodsInBlocks.length; i ++) {
            Limit memory limit;
            limit.periodInBlocks = periodsInBlocks[i];
            limit.amountPerPeriod = amountsPerPeriod[i];
            limit.lastCheckpointBlock = startBlocks[i];
            limit.amountLeftInCurrentPeriod = amountsPerPeriod[i];
            limits.push(limit);
        }
    }

    function calculateAmountLeft(uint256 amount, uint256 amountLeftInCurrentPeriod) internal pure returns (uint256)  {
        if (amount >= amountLeftInCurrentPeriod) {
            return 0;
        } else {
            return amountLeftInCurrentPeriod - amount;
        }
    }

    function calculateUpdatedCheckpoint(uint32 lastCheckpointBlock, uint32 periodInBlocks) internal view returns(uint32) {
        return lastCheckpointBlock + (periodInBlocks * ((uint32(block.number) - lastCheckpointBlock) / periodInBlocks));
    }

    function cloneLimit(uint256 indexFrom, Limit[] memory limits) internal pure returns (Limit memory limitCopy)  {
        limitCopy.periodInBlocks = limits[indexFrom].periodInBlocks;
        limitCopy.amountPerPeriod = limits[indexFrom].amountPerPeriod;
        limitCopy.lastCheckpointBlock = limits[indexFrom].lastCheckpointBlock;
        limitCopy.amountLeftInCurrentPeriod = limits[indexFrom].amountLeftInCurrentPeriod;
    }

    // --- VIEWS ---

    function getLimitsLength(address token, address protectedAddress) public view returns(uint256) {
        return protection[token].limits[protectedAddress].length;
    }

    function getLimit(address token, address protectedAddress, uint256 index) public view returns(Limit memory) {
        return protection[token].limits[protectedAddress][index];
    }
}