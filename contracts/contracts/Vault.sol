// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IProtocol.sol";

contract Vault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public router;

    // RBTC balances
    mapping(address => uint256) public balances;
    // ERC20 balances: user => token => amount
    mapping(address => mapping(address => uint256)) public tokenBalances;
    // Per-user protocol positions: user => adapter => amount
    mapping(address => mapping(address => uint256)) public protocolBalances;
    // Supported assets
    mapping(address => bool) public supportedAssets;

    event Deposited(address indexed user, uint256 amount);
    event DepositedToken(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event WithdrawnToken(address indexed user, address indexed token, uint256 amount);
    event RebalanceExecuted(address indexed user, bytes32 strategyId, uint256 timestamp);
    event ProtocolDeposit(address indexed protocol, address indexed asset, uint256 inputAmount, uint256 mintedAmount);
    event ProtocolWithdraw(address indexed user, address indexed protocol, uint256 requestedAmount, uint256 returnedAmount);
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);

    modifier onlyRouter() {
        require(msg.sender == router, "Vault: caller is not the router");
        _;
    }

    constructor() Ownable(msg.sender) {
        supportedAssets[address(0)] = true; // RBTC supported by default
    }

    function setSupportedAsset(address asset, bool supported) external onlyOwner {
        supportedAssets[asset] = supported;
    }

    function deposit() external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Vault: zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function depositToken(address token, uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Vault: zero deposit");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenBalances[msg.sender][token] += amount;
        emit DepositedToken(msg.sender, token, amount);
    }

    function withdraw(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Vault: zero amount");
        require(balances[msg.sender] >= amount, "Vault: insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Vault: RBTC transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawToken(address token, uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Vault: zero amount");
        require(tokenBalances[msg.sender][token] >= amount, "Vault: insufficient token balance");
        tokenBalances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit WithdrawnToken(msg.sender, token, amount);
    }

    function executeRebalance(
        address user,
        address[] calldata protocols,
        uint256[] calldata amounts,
        address[] calldata assets
    ) external onlyRouter whenNotPaused nonReentrant {
        require(protocols.length > 0, "Vault: empty protocols array");
        require(protocols.length == amounts.length, "Vault: length mismatch");
        require(protocols.length == assets.length, "Vault: length mismatch");

        // Calculate total amount to rebalance
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        require(balances[user] >= totalAmount, "Vault: insufficient user balance");

        // Deduct from user balance
        balances[user] -= totalAmount;

        bytes32 strategyId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, protocols.length)
        );

        for (uint256 i = 0; i < protocols.length; i++) {
            require(supportedAssets[assets[i]] || assets[i] == address(0), "Vault: unsupported asset");
            uint256 minted;
            if (assets[i] == address(0)) {
                // Native RBTC — Vault sends directly to adapter
                minted = IProtocol(protocols[i]).deposit{value: amounts[i]}(address(0), amounts[i]);
            } else {
                IERC20(assets[i]).forceApprove(protocols[i], amounts[i]);
                minted = IProtocol(protocols[i]).deposit(assets[i], amounts[i]);
                // Revoke leftover allowance
                IERC20(assets[i]).forceApprove(protocols[i], 0);
            }
            require(minted > 0, "Vault: protocol deposit returned zero");

            // Track per-user protocol position
            protocolBalances[user][protocols[i]] += minted;

            emit ProtocolDeposit(protocols[i], assets[i], amounts[i], minted);
        }

        emit RebalanceExecuted(user, strategyId, block.timestamp);
    }

    function withdrawFromProtocol(address adapter, uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Vault: zero amount");
        require(protocolBalances[msg.sender][adapter] >= amount, "Vault: insufficient protocol balance");

        protocolBalances[msg.sender][adapter] -= amount;

        uint256 balanceBefore = address(this).balance;
        IProtocol(adapter).withdraw(address(0), amount);
        uint256 returned = address(this).balance - balanceBefore;

        // Credit returned RBTC back to user's vault balance
        balances[msg.sender] += returned;

        emit ProtocolWithdraw(msg.sender, adapter, amount, returned);
    }

    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "Vault: zero address");
        address oldRouter = router;
        router = _router;
        emit RouterUpdated(oldRouter, _router);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}
}
