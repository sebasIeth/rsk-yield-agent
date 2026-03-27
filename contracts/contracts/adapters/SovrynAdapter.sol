// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAdapter.sol";

interface ILoanToken {
    function mint(address receiver, uint256 depositAmount) external payable returns (uint256);
    function burn(address receiver, uint256 burnAmount) external returns (uint256);
    function supplyInterestRate() external view returns (uint256);
    function totalAssetSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

interface IWRBTC {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract SovrynAdapter is BaseAdapter {
    // Sovryn Testnet iRBTC
    address public loanToken;
    // WRBTC Testnet
    address public wrbtc;

    constructor(address _loanToken, address _wrbtc)
        BaseAdapter(_loanToken == address(0), 420)
    {
        loanToken = _loanToken;
        wrbtc = _wrbtc;
    }

    function _liveDeposit(address asset, uint256 amount) internal override returns (uint256) {
        if (asset == address(0)) {
            // Wrap RBTC to WRBTC then deposit
            IWRBTC(wrbtc).deposit{value: msg.value}();
            require(IWRBTC(wrbtc).approve(loanToken, msg.value), "SovrynAdapter: approve failed");
            uint256 minted = ILoanToken(loanToken).mint(address(this), msg.value);
            _balances[msg.sender] += minted;
            emit DepositExecuted(msg.sender, asset, minted);
            return minted;
        }
        revert("SovrynAdapter: unsupported asset");
    }

    function _liveWithdraw(address asset, uint256 amount) internal override returns (uint256) {
        _balances[msg.sender] -= amount;
        uint256 received = ILoanToken(loanToken).burn(address(this), amount);
        IWRBTC(wrbtc).withdraw(received);
        (bool success, ) = payable(msg.sender).call{value: received}("");
        require(success, "SovrynAdapter: transfer failed");
        emit WithdrawExecuted(msg.sender, asset, received);
        return received;
    }

    function _liveGetAPY(address) internal view override returns (uint256) {
        uint256 rate = ILoanToken(loanToken).supplyInterestRate();
        // Convert from per-block rate to annual bps
        return (rate * BLOCKS_PER_YEAR) / 1e18;
    }
}
