// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

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
    function setGuardedAddress(address token, address guardedAddress, address strategy) external;

    function unfreezeAddresses(address token, address[] calldata unfreezelist) external;

    function admin() external returns(address);

    function getIsAddressFreezed(address token, address freezedAddress) external view returns (bool);

    function refund(address token, address freezedAddress, address refundAddress) external;
}

interface IStrategy {
    function setGuardedAddress(address token, address guardedAddress, uint256 threshold) external;
}

contract LosslessGuardian {
    mapping(address => address) public guardAdmins;
    mapping(address => address) public refundAdmins;
    mapping(bytes32 => uint256) public refundTimestamps;
    mapping(address => bool) public verifiedStrategies;
    ILosslessController public lossless;
    uint256 public timelockPeriod = 86400;

    constructor(address _lossless) {
        lossless = ILosslessController(_lossless);
    }

    modifier onlyGuardAdmin(address token) {
        require(msg.sender == guardAdmins[token], "LOSSLESS: unauthorized");
        _;
    }

    modifier onlyRefundAdmin(address token) {
        require(msg.sender == refundAdmins[token], "LOSSLESS: unauthorized");
        _;
    }

    function setAdmins(address token, address guardAdmin, address refundAdmin) public {
        require(LERC20(token).getAdmin() == msg.sender, "LOSSLESS: unauthorized");
        guardAdmins[token] = guardAdmin;
        refundAdmins[token] = refundAdmin;
    }

    // TODO: set a list of verified strategies;
    function verifyStrategies(address[] calldata strategies) public {
        require(msg.sender == lossless.admin(),"LOSSLESS: unauthorized");

        for(uint8 i = 0; i < strategies.length; i++) {
            verifiedStrategies[strategies[i]] = true;
        }
    }

    function removeStrategies(address[] calldata strategies) public {
        require(msg.sender == lossless.admin(),"LOSSLESS: unauthorized");

        for(uint8 i = 0; i < strategies.length; i++) {
            verifiedStrategies[strategies[i]] = false;
        }
    }

    function setTimelockPeriod(uint256 newTimelockPeriod) public {
        require(msg.sender == lossless.admin(), "LOSSLESS: unauthorized");
        timelockPeriod = newTimelockPeriod;
    }

    function setGuardedAddress(address token, address guardedAddress, address strategy) external {
        require(verifiedStrategies[msg.sender], "LOSSLESS: unauthorized");
        lossless.setGuardedAddress(token, guardedAddress, strategy);
    }

    function hashOperation(
        address token,
        address freezedAddress,
        address refundAddress,
        bytes32 salt
    ) public pure virtual returns (bytes32 hash) {
        return keccak256(abi.encode(token, freezedAddress, refundAddress, salt));
    }

    function unfreeze(address token, address[] calldata unfreezelist) public onlyGuardAdmin(token) {
        lossless.unfreezeAddresses(token, unfreezelist);
    }

    function proposeRefund(address token, address freezedAddress, address refundAddress, bytes32 salt) public onlyRefundAdmin(token) {
        bytes32 id = hashOperation(token, freezedAddress, refundAddress, salt);
        require(refundTimestamps[id] == 0, "LOSSLESS: refund already proposed");
        require(lossless.getIsAddressFreezed(token, freezedAddress), "LOSSLESS: address is not freezed");

        refundTimestamps[id] = block.timestamp + timelockPeriod;
    }

    function cancelRefundProposal(address token, address freezedAddress, address refundAddress, bytes32 salt) public onlyRefundAdmin(token) {
        bytes32 id = hashOperation(token, freezedAddress, refundAddress, salt);
        require(refundTimestamps[id] != 0, "LOSSLESS: refund does not exist");

        refundTimestamps[id] = 0;
    }

    function executeRefund(address token, address freezedAddress, address refundAddress, bytes32 salt) public onlyRefundAdmin(token) {
        bytes32 id = hashOperation(token, freezedAddress, refundAddress, salt);
        require(refundTimestamps[id] != 0, "LOSSLESS: refund does not exist");

        refundTimestamps[id] = 0;
        lossless.refund(token, freezedAddress, refundAddress);
    }
}