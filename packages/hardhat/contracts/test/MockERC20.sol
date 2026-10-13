// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Local-only fixture. It can deliberately reject a transfer to test atomic payout rollback.
contract MockERC20 is ERC20 {
    address public blockedReceiver;

    constructor() ERC20("Mock Agora USD", "mAUSD") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setBlockedReceiver(address account) external {
        blockedReceiver = account;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(to != blockedReceiver, "blocked receiver");
        super._update(from, to, value);
    }
}
