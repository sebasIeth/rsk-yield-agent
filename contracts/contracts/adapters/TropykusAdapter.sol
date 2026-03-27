// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAdapter.sol";

interface ICToken {
    function mint() external payable;
    function redeem(uint256 redeemTokens) external returns (uint256);
    function supplyRatePerBlock() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function exchangeRateCurrent() external returns (uint256);
}

contract TropykusAdapter is BaseAdapter {
    // kRBTC Testnet
    address public cToken;

    constructor(address _cToken)
        BaseAdapter(_cToken == address(0), 380)
    {
        cToken = _cToken;
    }

    function _liveDeposit(address asset, uint256 amount) internal override returns (uint256) {
        if (asset == address(0)) {
            uint256 balBefore = ICToken(cToken).balanceOf(address(this));
            ICToken(cToken).mint{value: msg.value}();
            uint256 balAfter = ICToken(cToken).balanceOf(address(this));
            uint256 minted = balAfter - balBefore;
            _balances[msg.sender] += minted;
            emit DepositExecuted(msg.sender, asset, minted);
            return minted;
        }
        revert("TropykusAdapter: unsupported asset");
    }

    function _liveWithdraw(address asset, uint256 amount) internal override returns (uint256) {
        _balances[msg.sender] -= amount;
        uint256 result = ICToken(cToken).redeem(amount);
        (bool success, ) = payable(msg.sender).call{value: result}("");
        require(success, "TropykusAdapter: transfer failed");
        emit WithdrawExecuted(msg.sender, asset, result);
        return result;
    }

    function _liveGetAPY(address) internal view override returns (uint256) {
        uint256 ratePerBlock = ICToken(cToken).supplyRatePerBlock();
        // 1051200 blocks per year on RSK (~30s/block)
        return (ratePerBlock * BLOCKS_PER_YEAR) / 1e18;
    }
}
