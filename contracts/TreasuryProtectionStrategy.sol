// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";
import "./StrategyBase.sol";

error NotAllowed(address sender, uint256 amount);

contract TreasuryProtectionStrategy is StrategyBase {
    struct Whitelist {
        mapping(address => bool) whitelist;
    }
    struct Protection {
        mapping(address => Whitelist) protection; 
    }
    mapping(address => Protection) private protectedAddresses;

    constructor(address _guardian, address _lossless) StrategyBase(_guardian, _lossless) {}

    // @dev Called by project owners. Sets a whitelist for protected address.
    function setProtectedAddress(address token, address protectedAddress, address[] calldata whitelist) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < whitelist.length; i++) {
            protectedAddresses[token].protection[protectedAddress].whitelist[whitelist[i]] = true;
        }

        guardian.setProtectedAddress(token, protectedAddress, address(this));
    }

    // @dev Remove whitelist for protected addresss.
    function removeProtectedAddresses(address token, address[] calldata addressesToRemove) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < addressesToRemove.length; i++) {
            delete protectedAddresses[token].protection[addressesToRemove[i]];
            guardian.removeProtectedAddresses(token, addressesToRemove[i]);
        }
    }

    // @dev Called by controller to check if transfer is allowed to happen.
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external view {
        require(isAddressWhitelisted(token, sender, recipient), "LOSSLESS: not whitelisted");
    }

    function isAddressWhitelisted(address token, address protectedAddress, address whitelistedAddress) public view returns(bool){
        return protectedAddresses[token].protection[protectedAddress].whitelist[whitelistedAddress];
    }
}