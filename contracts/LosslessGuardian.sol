// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
}

contract LosslessGuardian {
    struct Guard {
        bool isTurnedOn;
        uint256 threshold;
    }

    struct AddressGuard {
        mapping(address => Guard) guards; 
    }

    mapping(address => address) public guardAdmins;
    mapping(address => AddressGuard) private tokenGuards;

    ILosslessController public lossless; 

    constructor(address _lossless) {
        lossless = ILosslessController(_lossless);
    }

    modifier onlyGuardAdmin(address token) {
        require(msg.sender == guardAdmins[token], "LOSSLESS: unauthorized");
        _;
    }

    function setGuardAdmin(address token, address guardAdmin) public {
        require(LERC20(token).getAdmin() == msg.sender, "LOSSLESS: unauthorized");
        guardAdmins[token] = guardAdmin;
    }

    function setGuardedList(address token, address[] calldata guardlistAddition, uint256[] calldata thresholdlist) public onlyGuardAdmin(token) {
        require(guardAdmins[token] == msg.sender, "LOSSLESS: unauthorized");

        for(uint8 i = 0; i < guardlistAddition.length; i++) {
            Guard storage guard = tokenGuards[token].guards[guardlistAddition[i]];
            guard.isTurnedOn = true;
            guard.threshold = thresholdlist[i];
            lossless.setGuardedAddress(token, guardlistAddition[i]);
        }
    }

    function isTransferAllowed(address token, address sender, uint256 amount) external view returns  (bool) {
        if(tokenGuards[token].guards[sender].isTurnedOn && tokenGuards[token].guards[sender].threshold <= amount) {
            return false;
        }

        return true;
    }

    function unfreeze(address token, address[] calldata unfreezelist) public {
        require(guardAdmins[token] == msg.sender, "LOSSLESS: unauthorized");
        lossless.unfreezeAddresses(token, unfreezelist);
    }

    // TODO: unfreeze
    // TODO: refund
    // TODO: cummulativeThreshold


}