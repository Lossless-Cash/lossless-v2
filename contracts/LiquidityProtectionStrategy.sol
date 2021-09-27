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

    modifier onlyProtectionAdmin(address token) {
        require(msg.sender == guardian.protectionAdmin(token), "LOSSLESS: not protection admin");
        _;
    }

    // @dev In case guardian is changed, this allows not to redeploy strategy and just update it.
    function setGuardian(address newGuardian) public {
        require(msg.sender == lossless.admin(), "LOSSLESS: not lossless admin");
        guardian = IGuardian(newGuardian);
        emit GuardianSet(newGuardian);
    }

    // @param token Project token, the protection will be scoped inside of this token transfers.
    // @param protectedAddress Address to apply the limits to.
    // @param periodsInBlocks Limit period described in blocks. Each item in the list represents a different limit.
    // @param amountsPerPeriod A list of max amounts that can be transfered in the coressponding period.
    // @param startblocks A list of item that shows when each of the limits should be activated. Desribed in block.
    // @dev This method allows setting 0...N limits to 0...N addresses.
    // @dev Each item on the same index in periodsInBlocks, amountsPerPeriod, startblocks represents a different variable of the same limit.
    function setLimits(
        address token,
        address[] calldata protectedAddress,
        uint256[] calldata periodsInBlocks,
        uint256[] calldata amountsPerPeriod,
        uint256[] calldata startblocks
    ) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < protectedAddress.length; i++) {
            Limit[] storage limits = protection[token].limits[protectedAddress[i]];
            guardian.setProtectedAddress(token, protectedAddress[i], address(this));

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

    // @dev pausing is just adding a limit with amount 0 in the front on the limits array.
    // @dev we need to keep it at the front to reduce the gas costs of iterating through the array.
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

    // @dev removing the first limit in the array in case it is 0.
    // @dev in case project sets a 0 limit as the first limit's array element, this would allow removing it.
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
        require(msg.sender == address(lossless), "LOSSLESS: not lossless controller");
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