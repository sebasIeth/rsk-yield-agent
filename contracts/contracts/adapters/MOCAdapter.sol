// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAdapter.sol";

contract MOCAdapter is BaseAdapter {
    // MoneyOnChain Proxy (mainnet): 0xf773B590aF754D597770937Fa8ea7AbDf2668370
    address public mocProxy;

    constructor(address _mocProxy)
        BaseAdapter(_mocProxy == address(0), 620)
    {
        mocProxy = _mocProxy;
    }

    function _liveDeposit(address asset, uint256 amount) internal override returns (uint256) {
        // Mainnet: interact with MoC proxy
        (bool success, ) = mocProxy.call{value: msg.value}(
            abi.encodeWithSignature("mintDoc(uint256)", amount)
        );
        require(success, "MOCAdapter: deposit failed");
        _balances[msg.sender] += amount;
        emit DepositExecuted(msg.sender, asset, amount);
        return amount;
    }

    function _liveWithdraw(address asset, uint256 amount) internal override returns (uint256) {
        _balances[msg.sender] -= amount;
        (bool success, bytes memory result) = mocProxy.call(
            abi.encodeWithSignature("redeemDoc(uint256)", amount)
        );
        require(success, "MOCAdapter: withdraw failed");
        uint256 redeemed = abi.decode(result, (uint256));
        if (asset == address(0)) {
            (bool sent, ) = payable(msg.sender).call{value: redeemed}("");
            require(sent, "MOCAdapter: RBTC transfer failed");
        }
        emit WithdrawExecuted(msg.sender, asset, redeemed);
        return redeemed;
    }

    function _liveGetAPY(address) internal view override returns (uint256) {
        // No live source available for MOC
        return mockAPY;
    }
}
