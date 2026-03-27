// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IProtocol {
    function deposit(address asset, uint256 amount) external payable returns (uint256);
    function withdraw(address asset, uint256 amount) external returns (uint256);
    function getAPY(address asset) external view returns (uint256); // APY en bps (10000 = 100%)
    function balanceOf(address user, address asset) external view returns (uint256);
}
