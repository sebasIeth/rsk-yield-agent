import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Vault", function () {
  async function deployVaultFixture() {
    const [owner, user, router, attacker] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();
    await vault.waitForDeployment();

    await vault.setRouter(router.address);

    return { vault, owner, user, router, attacker };
  }

  describe("Deposit", function () {
    it("should accept RBTC deposits and update balance", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      const amount = ethers.parseEther("0.01");

      await vault.connect(user).deposit({ value: amount });

      expect(await vault.balances(user.address)).to.equal(amount);
    });

    it("should emit Deposited event", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      const amount = ethers.parseEther("0.01");

      await expect(vault.connect(user).deposit({ value: amount }))
        .to.emit(vault, "Deposited")
        .withArgs(user.address, amount);
    });

    it("should revert on zero deposit", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user).deposit({ value: 0 })
      ).to.be.revertedWith("Vault: zero deposit");
    });

    it("should accumulate multiple deposits", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      const amount = ethers.parseEther("0.01");

      await vault.connect(user).deposit({ value: amount });
      await vault.connect(user).deposit({ value: amount });

      expect(await vault.balances(user.address)).to.equal(amount * 2n);
    });
  });

  describe("Withdraw", function () {
    it("should allow withdrawal of deposited funds", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      const amount = ethers.parseEther("0.01");

      await vault.connect(user).deposit({ value: amount });

      const balanceBefore = await ethers.provider.getBalance(user.address);
      const tx = await vault.connect(user).withdraw(amount);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user.address);

      expect(balanceAfter + gasUsed - balanceBefore).to.equal(amount);
      expect(await vault.balances(user.address)).to.equal(0);
    });

    it("should revert when withdrawing more than balance", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      const depositAmount = ethers.parseEther("0.01");
      const withdrawAmount = ethers.parseEther("0.02");

      await vault.connect(user).deposit({ value: depositAmount });

      await expect(
        vault.connect(user).withdraw(withdrawAmount)
      ).to.be.revertedWith("Vault: insufficient balance");
    });

    it("should revert on zero withdrawal", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user).withdraw(0)
      ).to.be.revertedWith("Vault: zero amount");
    });
  });

  describe("DepositToken / WithdrawToken", function () {
    async function deployWithMockERC20() {
      const fixture = await deployVaultFixture();
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20.deploy("MockToken", "MTK");
      await token.waitForDeployment();
      return { ...fixture, token };
    }

    it("should accept ERC20 deposits and update tokenBalances", async function () {
      const { vault, user, token } = await loadFixture(deployWithMockERC20);
      const amount = ethers.parseEther("100");

      await token.mint(user.address, amount);
      await token.connect(user).approve(await vault.getAddress(), amount);
      await vault.connect(user).depositToken(await token.getAddress(), amount);

      expect(await vault.tokenBalances(user.address, await token.getAddress())).to.equal(amount);
    });

    it("should emit DepositedToken event", async function () {
      const { vault, user, token } = await loadFixture(deployWithMockERC20);
      const amount = ethers.parseEther("50");
      const tokenAddr = await token.getAddress();

      await token.mint(user.address, amount);
      await token.connect(user).approve(await vault.getAddress(), amount);

      await expect(vault.connect(user).depositToken(tokenAddr, amount))
        .to.emit(vault, "DepositedToken")
        .withArgs(user.address, tokenAddr, amount);
    });

    it("should revert on zero token deposit", async function () {
      const { vault, user, token } = await loadFixture(deployWithMockERC20);

      await expect(
        vault.connect(user).depositToken(await token.getAddress(), 0)
      ).to.be.revertedWith("Vault: zero deposit");
    });

    it("should allow ERC20 withdrawal", async function () {
      const { vault, user, token } = await loadFixture(deployWithMockERC20);
      const amount = ethers.parseEther("100");
      const tokenAddr = await token.getAddress();

      await token.mint(user.address, amount);
      await token.connect(user).approve(await vault.getAddress(), amount);
      await vault.connect(user).depositToken(tokenAddr, amount);

      await vault.connect(user).withdrawToken(tokenAddr, amount);

      expect(await vault.tokenBalances(user.address, tokenAddr)).to.equal(0);
      expect(await token.balanceOf(user.address)).to.equal(amount);
    });

    it("should revert on zero token withdrawal", async function () {
      const { vault, user, token } = await loadFixture(deployWithMockERC20);

      await expect(
        vault.connect(user).withdrawToken(await token.getAddress(), 0)
      ).to.be.revertedWith("Vault: zero amount");
    });

    it("should revert when withdrawing more tokens than balance", async function () {
      const { vault, user, token } = await loadFixture(deployWithMockERC20);
      const tokenAddr = await token.getAddress();

      await expect(
        vault.connect(user).withdrawToken(tokenAddr, ethers.parseEther("1"))
      ).to.be.revertedWith("Vault: insufficient token balance");
    });
  });

  describe("Access Control", function () {
    it("should revert executeRebalance if not called by router", async function () {
      const { vault, attacker } = await loadFixture(deployVaultFixture);

      // Deploy a mock adapter so we have a non-empty array
      const MOCAdapter = await ethers.getContractFactory("MOCAdapter");
      const adapter = await MOCAdapter.deploy(ethers.ZeroAddress);
      await adapter.waitForDeployment();
      const adapterAddr = await adapter.getAddress();

      await expect(
        vault.connect(attacker).executeRebalance(
          attacker.address,
          [adapterAddr],
          [ethers.parseEther("0.01")],
          [ethers.ZeroAddress]
        )
      ).to.be.revertedWith("Vault: caller is not the router");
    });

    it("should revert executeRebalance with empty protocols array", async function () {
      const { vault, router, user } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(router).executeRebalance(user.address, [], [], [])
      ).to.be.revertedWith("Vault: empty protocols array");
    });

    it("should only allow owner to set router", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user).setRouter(user.address)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Supported Assets", function () {
    it("should have RBTC (address(0)) supported by default", async function () {
      const { vault } = await loadFixture(deployVaultFixture);
      expect(await vault.supportedAssets(ethers.ZeroAddress)).to.equal(true);
    });

    it("should allow owner to set supported assets", async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);
      const fakeToken = "0x0000000000000000000000000000000000000001";

      await vault.connect(owner).setSupportedAsset(fakeToken, true);
      expect(await vault.supportedAssets(fakeToken)).to.equal(true);

      await vault.connect(owner).setSupportedAsset(fakeToken, false);
      expect(await vault.supportedAssets(fakeToken)).to.equal(false);
    });

    it("should revert setSupportedAsset from non-owner", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user).setSupportedAsset(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pause", function () {
    it("should prevent deposits when paused", async function () {
      const { vault, owner, user } = await loadFixture(deployVaultFixture);

      await vault.connect(owner).pause();

      await expect(
        vault.connect(user).deposit({ value: ethers.parseEther("0.01") })
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("should prevent withdrawals when paused", async function () {
      const { vault, owner, user } = await loadFixture(deployVaultFixture);
      const amount = ethers.parseEther("0.01");

      await vault.connect(user).deposit({ value: amount });
      await vault.connect(owner).pause();

      await expect(
        vault.connect(user).withdraw(amount)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("should allow operations after unpause", async function () {
      const { vault, owner, user } = await loadFixture(deployVaultFixture);

      await vault.connect(owner).pause();
      await vault.connect(owner).unpause();

      await expect(
        vault.connect(user).deposit({ value: ethers.parseEther("0.01") })
      ).to.not.be.reverted;
    });

    it("should only allow owner to pause/unpause", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user).pause()
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Reentrancy Protection", function () {
    it("should not allow attacker to drain more than their balance", async function () {
      const { vault, owner, user } = await loadFixture(deployVaultFixture);

      // Deploy attacker contract
      const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await AttackerFactory.deploy(await vault.getAddress());
      await attacker.waitForDeployment();
      const attackerAddr = await attacker.getAddress();

      // User deposits into vault so there are extra funds
      await vault.connect(user).deposit({ value: ethers.parseEther("1.0") });

      // Attacker deposits a smaller amount
      await attacker.attack({ value: ethers.parseEther("0.01") });

      const vaultBalanceBefore = await ethers.provider.getBalance(await vault.getAddress());

      // Attacker withdraws -- reentrancy guard prevents double withdrawal
      await attacker.withdrawAttack();

      const attackerBalance = await ethers.provider.getBalance(attackerAddr);
      const vaultBalanceAfter = await ethers.provider.getBalance(await vault.getAddress());

      // Vault should only have lost the attacker's deposit (0.01), not more
      const vaultLoss = vaultBalanceBefore - vaultBalanceAfter;
      expect(vaultLoss).to.equal(ethers.parseEther("0.01"));

      // Attacker's vault balance should be 0
      expect(await vault.balances(attackerAddr)).to.equal(0);
    });
  });
});

describe("YieldRouter", function () {
  async function deployRouterFixture() {
    const [owner, user, keeper] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();
    await vault.waitForDeployment();

    const YieldRouter = await ethers.getContractFactory("YieldRouter");
    const router = await YieldRouter.deploy();
    await router.waitForDeployment();

    const vaultAddr = await vault.getAddress();
    const routerAddr = await router.getAddress();

    await vault.setRouter(routerAddr);
    await router.setVault(vaultAddr);

    // Deploy a mock adapter (MOCAdapter in mock mode)
    const MOCAdapter = await ethers.getContractFactory("MOCAdapter");
    const adapter = await MOCAdapter.deploy(ethers.ZeroAddress);
    await adapter.waitForDeployment();
    const adapterAddr = await adapter.getAddress();

    await router.setAdapter("moc", adapterAddr);

    return { vault, router, adapter, owner, user, keeper, vaultAddr, routerAddr, adapterAddr };
  }

  it("should set adapter correctly", async function () {
    const { router, adapterAddr } = await loadFixture(deployRouterFixture);
    expect(await router.adapters("moc")).to.equal(adapterAddr);
  });

  it("should set vault correctly", async function () {
    const { router, vaultAddr } = await loadFixture(deployRouterFixture);
    expect(await router.vault()).to.equal(vaultAddr);
  });

  it("should revert rebalance if not called by owner or keeper", async function () {
    const { router, user } = await loadFixture(deployRouterFixture);

    await expect(
      router.connect(user).rebalance(user.address, ["moc"], [10000], [ethers.ZeroAddress])
    ).to.be.revertedWith("YieldRouter: not authorized");
  });

  it("should revert setAdapter from non-owner", async function () {
    const { router, user } = await loadFixture(deployRouterFixture);

    await expect(
      router.connect(user).setAdapter("test", user.address)
    ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
  });

  it("should revert setVault with zero address", async function () {
    const { router } = await loadFixture(deployRouterFixture);

    await expect(
      router.setVault(ethers.ZeroAddress)
    ).to.be.revertedWith("YieldRouter: zero address");
  });

  it("should revert setAdapter with zero address", async function () {
    const { router } = await loadFixture(deployRouterFixture);

    await expect(
      router.setAdapter("test", ethers.ZeroAddress)
    ).to.be.revertedWith("YieldRouter: zero address");
  });

  it("should revert rebalance with empty protocols", async function () {
    const { router, user } = await loadFixture(deployRouterFixture);

    await expect(
      router.rebalance(user.address, [], [], [])
    ).to.be.revertedWith("YieldRouter: empty protocols");
  });

  it("should revert rebalance if basis points do not sum to 10000", async function () {
    const { router, vault, user } = await loadFixture(deployRouterFixture);

    // User deposits first
    await vault.connect(user).deposit({ value: ethers.parseEther("1.0") });

    await expect(
      router.rebalance(user.address, ["moc"], [5000], [ethers.ZeroAddress])
    ).to.be.revertedWith("YieldRouter: basis points must sum to 10000");
  });

  it("should revert rebalance if user has no balance", async function () {
    const { router, user } = await loadFixture(deployRouterFixture);

    await expect(
      router.rebalance(user.address, ["moc"], [10000], [ethers.ZeroAddress])
    ).to.be.revertedWith("YieldRouter: user has no balance");
  });

  describe("Keeper Authorization", function () {
    it("should allow owner to set a keeper", async function () {
      const { router, keeper } = await loadFixture(deployRouterFixture);

      await expect(router.setKeeper(keeper.address, true))
        .to.emit(router, "KeeperUpdated")
        .withArgs(keeper.address, true);

      expect(await router.authorizedKeepers(keeper.address)).to.equal(true);
    });

    it("should allow keeper to call rebalance", async function () {
      const { router, vault, keeper, user } = await loadFixture(deployRouterFixture);

      // Authorize keeper
      await router.setKeeper(keeper.address, true);

      // User deposits
      await vault.connect(user).deposit({ value: ethers.parseEther("1.0") });

      // Keeper calls rebalance -- should not revert
      await expect(
        router.connect(keeper).rebalance(user.address, ["moc"], [10000], [ethers.ZeroAddress])
      ).to.not.be.reverted;
    });

    it("should allow owner to revoke keeper", async function () {
      const { router, keeper } = await loadFixture(deployRouterFixture);

      await router.setKeeper(keeper.address, true);
      await router.setKeeper(keeper.address, false);

      expect(await router.authorizedKeepers(keeper.address)).to.equal(false);
    });

    it("should revert rebalance from revoked keeper", async function () {
      const { router, vault, keeper, user } = await loadFixture(deployRouterFixture);

      await router.setKeeper(keeper.address, true);
      await router.setKeeper(keeper.address, false);

      await vault.connect(user).deposit({ value: ethers.parseEther("1.0") });

      await expect(
        router.connect(keeper).rebalance(user.address, ["moc"], [10000], [ethers.ZeroAddress])
      ).to.be.revertedWith("YieldRouter: not authorized");
    });

    it("should revert setKeeper from non-owner", async function () {
      const { router, user, keeper } = await loadFixture(deployRouterFixture);

      await expect(
        router.connect(user).setKeeper(keeper.address, true)
      ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
    });
  });
});

describe("Integration: Deposit -> Rebalance -> Withdraw", function () {
  async function deployFullFixture() {
    const [owner, user] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();
    await vault.waitForDeployment();

    const YieldRouter = await ethers.getContractFactory("YieldRouter");
    const router = await YieldRouter.deploy();
    await router.waitForDeployment();

    const vaultAddr = await vault.getAddress();
    const routerAddr = await router.getAddress();

    await vault.setRouter(routerAddr);
    await router.setVault(vaultAddr);

    // Deploy two mock adapters
    const MOCAdapter = await ethers.getContractFactory("MOCAdapter");
    const moc = await MOCAdapter.deploy(ethers.ZeroAddress);
    await moc.waitForDeployment();

    const TropykusAdapter = await ethers.getContractFactory("TropykusAdapter");
    const tropykus = await TropykusAdapter.deploy(ethers.ZeroAddress);
    await tropykus.waitForDeployment();

    const mocAddr = await moc.getAddress();
    const tropykusAddr = await tropykus.getAddress();

    await router.setAdapter("moc", mocAddr);
    await router.setAdapter("tropykus", tropykusAddr);

    return { vault, router, moc, tropykus, owner, user, vaultAddr, routerAddr, mocAddr, tropykusAddr };
  }

  it("should deposit, rebalance to single protocol, and withdraw back", async function () {
    const { vault, router, moc, user, mocAddr } = await loadFixture(deployFullFixture);
    const depositAmount = ethers.parseEther("1.0");

    // Step 1: User deposits RBTC into Vault
    await vault.connect(user).deposit({ value: depositAmount });
    expect(await vault.balances(user.address)).to.equal(depositAmount);

    // Step 2: Owner triggers rebalance (100% to MOC)
    await router.rebalance(user.address, ["moc"], [10000], [ethers.ZeroAddress]);

    // User balance in vault should be 0 (moved to protocol)
    expect(await vault.balances(user.address)).to.equal(0);
    // Protocol balance should reflect the deposit
    expect(await vault.protocolBalances(user.address, mocAddr)).to.equal(depositAmount);

    // Step 3: User withdraws from protocol back to vault
    await vault.connect(user).withdrawFromProtocol(mocAddr, depositAmount);

    // User vault balance should be restored
    expect(await vault.balances(user.address)).to.equal(depositAmount);
    expect(await vault.protocolBalances(user.address, mocAddr)).to.equal(0);
  });

  it("should rebalance across multiple protocols and track positions", async function () {
    const { vault, router, user, mocAddr, tropykusAddr } = await loadFixture(deployFullFixture);
    const depositAmount = ethers.parseEther("1.0");

    await vault.connect(user).deposit({ value: depositAmount });

    // 60% MOC, 40% Tropykus
    await router.rebalance(
      user.address,
      ["moc", "tropykus"],
      [6000, 4000],
      [ethers.ZeroAddress, ethers.ZeroAddress]
    );

    const mocBalance = await vault.protocolBalances(user.address, mocAddr);
    const tropykusBalance = await vault.protocolBalances(user.address, tropykusAddr);

    expect(mocBalance + tropykusBalance).to.equal(depositAmount);
    expect(await vault.balances(user.address)).to.equal(0);

    // Withdraw from both protocols
    await vault.connect(user).withdrawFromProtocol(mocAddr, mocBalance);
    await vault.connect(user).withdrawFromProtocol(tropykusAddr, tropykusBalance);

    expect(await vault.balances(user.address)).to.equal(depositAmount);
  });

  it("should handle dust correctly via remainder assignment to last protocol", async function () {
    const { vault, router, user, mocAddr, tropykusAddr } = await loadFixture(deployFullFixture);

    // Use an amount that creates rounding issues with basis points
    // 3333 bps of 1 ether = 0.3333 ether, 6667 bps = 0.6667 ether
    // (1 ether * 3333) / 10000 = 333300000000000000 (0.3333 ether)
    // remainder = 1 ether - 333300000000000000 = 666700000000000000 (0.6667 ether)
    // Total = 1 ether exactly
    const depositAmount = ethers.parseEther("1.0");
    await vault.connect(user).deposit({ value: depositAmount });

    await router.rebalance(
      user.address,
      ["moc", "tropykus"],
      [3333, 6667],
      [ethers.ZeroAddress, ethers.ZeroAddress]
    );

    const mocBalance = await vault.protocolBalances(user.address, mocAddr);
    const tropykusBalance = await vault.protocolBalances(user.address, tropykusAddr);

    // Total should equal the exact deposit amount (no dust lost)
    expect(mocBalance + tropykusBalance).to.equal(depositAmount);
    expect(await vault.balances(user.address)).to.equal(0);
  });

  it("should revert withdrawFromProtocol with zero amount", async function () {
    const { vault, user, mocAddr } = await loadFixture(deployFullFixture);

    await expect(
      vault.connect(user).withdrawFromProtocol(mocAddr, 0)
    ).to.be.revertedWith("Vault: zero amount");
  });

  it("should revert withdrawFromProtocol with insufficient protocol balance", async function () {
    const { vault, user, mocAddr } = await loadFixture(deployFullFixture);

    await expect(
      vault.connect(user).withdrawFromProtocol(mocAddr, ethers.parseEther("1.0"))
    ).to.be.revertedWith("Vault: insufficient protocol balance");
  });
});
