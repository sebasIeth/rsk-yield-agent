// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IProtocol.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract BaseAdapter is IProtocol, Ownable {
    bool public mockMode;
    uint256 public mockAPY;
    uint256 internal constant BLOCKS_PER_YEAR = 1051200;

    mapping(address => uint256) internal _balances;

    event MockMode(bool active);
    event DepositExecuted(address indexed user, address asset, uint256 amount);
    event WithdrawExecuted(address indexed user, address asset, uint256 amount);

    constructor(bool _mockMode, uint256 _defaultAPY) Ownable(msg.sender) {
        mockMode = _mockMode;
        mockAPY = _defaultAPY;
        if (_mockMode) emit MockMode(true);
    }

    function deposit(address asset, uint256 amount) external payable override returns (uint256) {
        if (mockMode) return _mockDeposit(asset, amount);
        return _liveDeposit(asset, amount);
    }

    function withdraw(address asset, uint256 amount) external override returns (uint256) {
        require(_balances[msg.sender] >= amount, "Adapter: insufficient balance");
        if (mockMode) return _mockWithdraw(asset, amount);
        return _liveWithdraw(asset, amount);
    }

    function getAPY(address asset) external view override returns (uint256) {
        if (mockMode) return mockAPY;
        return _liveGetAPY(asset);
    }

    function balanceOf(address user, address) external view override returns (uint256) {
        return _balances[user];
    }

    function setMockAPY(uint256 _apy) external onlyOwner { mockAPY = _apy; }
    function setMockMode(bool _mock) external onlyOwner { mockMode = _mock; emit MockMode(_mock); }

    function _mockDeposit(address asset, uint256 amount) internal virtual returns (uint256) {
        uint256 depositAmount = msg.value > 0 ? msg.value : amount;
        _balances[msg.sender] += depositAmount;
        emit DepositExecuted(msg.sender, asset, depositAmount);
        return depositAmount;
    }

    function _mockWithdraw(address asset, uint256 amount) internal virtual returns (uint256) {
        _balances[msg.sender] -= amount;
        if (asset == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "Adapter: transfer failed");
        }
        emit WithdrawExecuted(msg.sender, asset, amount);
        return amount;
    }

    function _liveDeposit(address asset, uint256 amount) internal virtual returns (uint256);
    function _liveWithdraw(address asset, uint256 amount) internal virtual returns (uint256);
    function _liveGetAPY(address asset) internal view virtual returns (uint256);

    receive() external payable {}
}
