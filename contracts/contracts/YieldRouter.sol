// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IVault.sol";

contract YieldRouter is Ownable, ReentrancyGuard {
    address public vault;
    mapping(string => address) public adapters;
    mapping(address => bool) public authorizedKeepers;

    event AdapterSet(string name, address adapter);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event Rebalanced(address indexed user, string[] protocols, uint256[] amounts);
    event KeeperUpdated(address indexed keeper, bool authorized);

    constructor() Ownable(msg.sender) {}

    modifier onlyAuthorized() {
        require(msg.sender == owner() || authorizedKeepers[msg.sender], "YieldRouter: not authorized");
        _;
    }

    function setKeeper(address keeper, bool authorized) external onlyOwner {
        authorizedKeepers[keeper] = authorized;
        emit KeeperUpdated(keeper, authorized);
    }

    function setAdapter(string calldata name, address adapter) external onlyOwner {
        require(adapter != address(0), "YieldRouter: zero address");
        adapters[name] = adapter;
        emit AdapterSet(name, adapter);
    }

    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "YieldRouter: zero address");
        address oldVault = vault;
        vault = _vault;
        emit VaultUpdated(oldVault, _vault);
    }

    function rebalance(
        address user,
        string[] calldata protocolNames,
        uint256[] calldata basisPoints,
        address[] calldata assets
    ) external onlyAuthorized nonReentrant {
        require(protocolNames.length > 0, "YieldRouter: empty protocols");
        require(protocolNames.length == basisPoints.length, "YieldRouter: length mismatch");
        require(protocolNames.length == assets.length, "YieldRouter: length mismatch");

        uint256 totalBps = 0;
        for (uint256 i = 0; i < basisPoints.length; i++) {
            totalBps += basisPoints[i];
        }
        require(totalBps == 10000, "YieldRouter: basis points must sum to 10000");

        uint256 userBalance = IVault(vault).balances(user);
        require(userBalance > 0, "YieldRouter: user has no balance");

        // Resolve adapter addresses
        address[] memory adapterAddresses = new address[](protocolNames.length);
        for (uint256 i = 0; i < protocolNames.length; i++) {
            adapterAddresses[i] = adapters[protocolNames[i]];
            require(adapterAddresses[i] != address(0), "YieldRouter: adapter not found");
        }

        // Calculate amounts with dust collection: assign remainder to last protocol
        uint256[] memory amounts = new uint256[](protocolNames.length);
        uint256 totalSent = 0;
        for (uint256 i = 0; i < amounts.length - 1; i++) {
            amounts[i] = (userBalance * basisPoints[i]) / 10000;
            totalSent += amounts[i];
        }
        amounts[amounts.length - 1] = userBalance - totalSent;

        // Delegate fund movement to Vault
        IVault(vault).executeRebalance(user, adapterAddresses, amounts, assets);

        emit Rebalanced(user, protocolNames, amounts);
    }
}
