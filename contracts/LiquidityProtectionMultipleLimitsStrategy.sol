// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";
import "./StrategyBase.sol";

contract LiquidityProtectionMultipleLimitsStrategy is StrategyBase{
    struct Limit {
        uint32 periodInBlocks;
        uint32 lastCheckpoint;
        uint256 amountPerPeriod;
        uint256 amountLeft;
    }

    struct Protection {
        mapping(address => Limit[]) limits;
    }

    mapping(address => Protection) private protection;

    constructor(address _guardian, address _lossless) StrategyBase(_guardian, _lossless) {}

    // @param token Project token, the protection will be scoped inside of this token transfers.
    // @param protectedAddress Address to apply the limits to.
    // @param periodsInBlocks Limit period described in blocks. Each item in the list represents a different limit.
    // @param amountsPerPeriod A list of max amounts that can be transfered in the coressponding period.
    // @param startblocks A list of item that shows when each of the limits should be activated. Desribed in block.
    // @dev This method allows setting 0...N limits to 0...N addresses.
    // @dev Each item on the same index in periodsInBlocks, amountsPerPeriod, startblocks represents a different variable of the same limit.
    function setLimitsBatched(
        address token,
        address[] calldata protectedAddresses,
        uint32[] calldata periodsInBlocks,
        uint256[] calldata amountsPerPeriod,
        uint32[] calldata startblocks
    ) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < protectedAddresses.length; i++) {
            guardian.setProtectedAddress(token, protectedAddresses[i], address(this));
            saveLimit(token, protectedAddresses[i], periodsInBlocks, amountsPerPeriod, startblocks);
        }
    }

    // @dev params mostly as in batched
    // @dev This method allows setting 0...N limit to 1 address.
    // @dev Each item on the same index in periodsInBlocks, amountsPerPeriod, startblocks represents a different variable of the same limit.
    function setLimits(
        address token,
        address protectedAddress,
        uint32[] calldata periodsInBlocks,
        uint256[] calldata amountsPerPeriod,
        uint32[] calldata startblocks
    ) public onlyProtectionAdmin(token) {
        guardian.setProtectedAddress(token, protectedAddress, address(this));
        saveLimit(token, protectedAddress, periodsInBlocks, amountsPerPeriod, startblocks);
    }

    function saveLimit(     
        address token,   
        address protectedAddress,
        uint32[] calldata periodsInBlocks,
        uint256[] calldata amountsPerPeriod,
        uint32[] calldata startblocks
    ) internal {
        Limit[] storage limits = protection[token].limits[protectedAddress];
        for(uint8 j = 0; j < periodsInBlocks.length; j ++) {
            Limit memory limit;
            limit.periodInBlocks = periodsInBlocks[j];
            limit.amountPerPeriod = amountsPerPeriod[j];
            limit.lastCheckpoint = startblocks[j];
            limit.amountLeft = amountsPerPeriod[j];
            limits.push(limit);
        }
    }

    function removeLimits(address token, address[] calldata list) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < list.length; i++) {
            delete protection[token].limits[list[i]];
            guardian.removeProtectedAddresses(token, list[i]);
        }
    }

    // @dev Pausing is just adding a limit with amount 0 in the front on the limits array.
    // @dev We need to keep it at the front to reduce the gas costs of iterating through the array.
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

    // @dev Removing the first limit in the array in case it is 0.
    // @dev In case project sets a 0 limit as the first limit's array element, this would allow removing it.
    function unpause(address token, address protectedAddress) public onlyProtectionAdmin(token) { 
        require(lossless.isAddressProtected(token, protectedAddress), "LOSSLESS: not protected");
        Limit[] storage limits = protection[token].limits[protectedAddress];
        require(limits[0].amountPerPeriod == 0, "LOSSLESS: not paused");
        
        limits[0] = cloneLimit(limits.length - 1, limits);
        delete limits[limits.length - 1];
        limits.pop();

        emit Unpaused(token, protectedAddress);
    }

    // @dev Limit is reset every period.
    // @dev Every period has it's own amountLeft which gets decreased on every transfer.
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external {
        require(msg.sender == address(lossless), "LOSSLESS: not controller");
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
                limit.lastCheckpoint = calculateUpdatedCheckpoint(limit.lastCheckpoint, limit.periodInBlocks, uint32(block.number));
                limit.amountLeft = calculateAmountLeft(amount, limit.amountPerPeriod);
            }
            
            require(limit.amountLeft > 0, "LOSSLESS: limit reached");
        }
    }

    function calculateAmountLeft(uint256 amount, uint256 amountLeft) internal pure returns (uint256)  {
        if (amount >= amountLeft) {
            return 0;
        } else {
            return amountLeft - amount;
        }
    }

    function calculateUpdatedCheckpoint(uint32 lastCheckpoint, uint32 periodInBlocks, uint32 blockNumber) internal pure returns(uint32) {
        uint32 deltaBlocks = blockNumber - lastCheckpoint;
        uint32 periodsInDelta = deltaBlocks / periodInBlocks;
        return lastCheckpoint + (periodInBlocks * periodsInDelta);
    }

    function cloneLimit(uint256 indexFrom, Limit[] memory limits) internal pure returns (Limit memory limitCopy)  {
        limitCopy.periodInBlocks = limits[indexFrom].periodInBlocks;
        limitCopy.amountPerPeriod = limits[indexFrom].amountPerPeriod;
        limitCopy.lastCheckpoint = limits[indexFrom].lastCheckpoint;
        limitCopy.amountLeft = limits[indexFrom].amountLeft;
    }

    function getLimitsLength(address token, address protectedAddress) public view returns(uint256) {
        return protection[token].limits[protectedAddress].length;
    }

    function getLimit(address token, address protectedAddress, uint256 index) public view returns(Limit memory) {
        return protection[token].limits[protectedAddress][index];
    }
}