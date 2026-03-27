// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVault {
    function balances(address user) external view returns (uint256);
    function protocolBalances(address user, address adapter) external view returns (uint256);
    function executeRebalance(
        address user,
        address[] calldata protocols,
        uint256[] calldata amounts,
        address[] calldata assets
    ) external;
    function withdrawFromProtocol(address adapter, uint256 amount) external;
}
