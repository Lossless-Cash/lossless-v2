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

    function setGuardAdmin(address token, address guardAdmin) public {
        require(LERC20(token).getAdmin() == msg.sender, "LOSSLESS: unauthorized");
        guardAdmins[token] = guardAdmin;
    }

    function setGuardedList(address token, address[] calldata guardlistAddition, uint256[] calldata thresholdlist) public {
        require(guardAdmins[token] == msg.sender, "LOSSLESS: unauthorized");

        for(uint8 i = 0; i < guardlistAddition.length; i++) {
            Guard storage guard = tokenGuards[token].guards[guardlistAddition[i]];
            guard.isTurnedOn = true;
            guard.threshold = thresholdlist[i];
        }
    }

    function isTransferAllowed(address token, address sender, uint256 amount) external view returns (bool) {
        if(tokenGuards[token].guards[sender].isTurnedOn && tokenGuards[token].guards[sender].threshold <= amount) {
            return false;
        }

        return true;
    }
}