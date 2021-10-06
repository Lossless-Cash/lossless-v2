// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";

interface ILosslessController {
    function admin() external returns(address);

    function isAddressProtected(address token, address protectedAddress) external view returns (bool);
}

interface IGuardian {
    function protectionAdmin(address token) external returns (address);

    function setProtectedAddress(address token, address guardedAddress) external;

    function removeProtectedAddresses(address token, address protectedAddress) external;
}

abstract contract StrategyBase {
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
}