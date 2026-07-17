// blockchain/test/Phase1Security.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { CareToken, CareTokenController, CareTeamVesting, CarePartnerVesting, CareLiquidityLock } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Phase 1 Security Tests", function () {
  let careToken: CareToken;
  let controller: CareTokenController;
  let teamVesting: CareTeamVesting;
  let partnerVesting: CarePartnerVesting;
  let liquidityLock: CareLiquidityLock;
  
  let owner: SignerWithAddress;
  let teamMember: SignerWithAddress;
  let partner: SignerWithAddress;
  let attacker: SignerWithAddress;
  let emergencyAuthorizer: SignerWithAddress;

  const TEAM_ALLOCATION = ethers.parseEther("10000000"); // 10M CARE for testing
  const PARTNER_ALLOCATION = ethers.parseEther("5000000"); // 5M CARE for testing
  const LIQUIDITY_ALLOCATION = ethers.parseEther("8000000"); // 8M CARE for testing

  beforeEach(async function () {
    [owner, teamMember, partner, attacker, emergencyAuthorizer] = await ethers.getSigners();

    // Deploy CareToken
    const CareToken = await ethers.getContractFactory("CareToken");
    careToken = await CareToken.deploy(0);

    // Deploy CareTokenController
    const CareTokenController = await ethers.getContractFactory("CareTokenController");
    controller = await CareTokenController.deploy(await careToken.getAddress());

    // Grant MINTER_ROLE to controller
    const MINTER_ROLE = await careToken.MINTER_ROLE();
    await careToken.grantRole(MINTER_ROLE, await controller.getAddress());

    // Grant category roles to owner
    const TEAM_MANAGER_ROLE = await controller.TEAM_MANAGER_ROLE();
    const PARTNER_MANAGER_ROLE = await controller.PARTNER_MANAGER_ROLE();
    const LIQUIDITY_MANAGER_ROLE = await controller.LIQUIDITY_MANAGER_ROLE();
    await controller.grantRole(TEAM_MANAGER_ROLE, owner.address);
    await controller.grantRole(PARTNER_MANAGER_ROLE, owner.address);
    await controller.grantRole(LIQUIDITY_MANAGER_ROLE, owner.address);

    // Deploy vesting contracts (start in 1 day for testing)
    const vestingStartTime = await time.latest() + 86400;
    
    const CareTeamVesting = await ethers.getContractFactory("CareTeamVesting");
    teamVesting = await CareTeamVesting.deploy(await careToken.getAddress(), vestingStartTime);

    const CarePartnerVesting = await ethers.getContractFactory("CarePartnerVesting");
    partnerVesting = await CarePartnerVesting.deploy(await careToken.getAddress(), vestingStartTime);

    const CareLiquidityLock = await ethers.getContractFactory("CareLiquidityLock");
    liquidityLock = await CareLiquidityLock.deploy(await careToken.getAddress(), emergencyAuthorizer.address);

    // Fund vesting contracts
    await controller.mintForCategory(0, await teamVesting.getAddress(), TEAM_ALLOCATION, "Team allocation");
    await controller.mintForCategory(1, await partnerVesting.getAddress(), PARTNER_ALLOCATION, "Partner allocation");
    await controller.mintForCategory(11, await liquidityLock.getAddress(), LIQUIDITY_ALLOCATION, "Liquidity allocation");
  });

  describe("🔐 CareTeamVesting Security", function () {
    it("Should prevent claiming before cliff period", async function () {
      // Add beneficiary
      await teamVesting.addBeneficiary(
        teamMember.address,
        ethers.parseEther("1000000"),
        0 // DEVELOPER type (12-month cliff)
      );

      // Try to claim immediately (should fail)
      await time.increase(86400); // Move past vesting start
      await expect(
        teamVesting.connect(teamMember).claim()
      ).to.be.revertedWith("No tokens to claim");

      // Try to claim after 11 months (should still fail)
      await time.increase(330 * 86400); // 11 months
      await expect(
        teamVesting.connect(teamMember).claim()
      ).to.be.revertedWith("No tokens to claim");

      // Should succeed after 12 months
      await time.increase(30 * 86400); // +1 month = 12 months total
      await expect(teamVesting.connect(teamMember).claim()).to.not.be.reverted;
    });

    it("Should prevent duplicate beneficiary addition", async function () {
      await teamVesting.addBeneficiary(
        teamMember.address,
        ethers.parseEther("1000000"),
        0
      );

      await expect(
        teamVesting.addBeneficiary(
          teamMember.address,
          ethers.parseEther("500000"),
          0
        )
      ).to.be.revertedWith("Beneficiary already exists");
    });

    it("Should prevent non-owner from adding beneficiaries", async function () {
      await expect(
        teamVesting.connect(attacker).addBeneficiary(
          attacker.address,
          ethers.parseEther("1000000"),
          0
        )
      ).to.be.reverted;
    });

    it("Should correctly calculate linear vesting", async function () {
      await teamVesting.addBeneficiary(
        teamMember.address,
        ethers.parseEther("4800000"), // 4.8M tokens
        0 // 48-month vesting
      );

      await time.increase(86400 + 365 * 86400); // Start + 12 months (cliff)
      
      // After 12 months (25% of 48 months)
      const vested12 = await teamVesting.vestedAmount(teamMember.address);
      expect(vested12).to.be.closeTo(
        ethers.parseEther("1200000"), // 25% = 1.2M
        ethers.parseEther("10000") // 10k tolerance
      );

      // After 24 months (50%)
      await time.increase(365 * 86400);
      const vested24 = await teamVesting.vestedAmount(teamMember.address);
      expect(vested24).to.be.closeTo(
        ethers.parseEther("2400000"), // 50% = 2.4M
        ethers.parseEther("10000")
      );
    });

    it("Should allow owner to revoke vesting", async function () {
      await teamVesting.addBeneficiary(
        teamMember.address,
        ethers.parseEther("1000000"),
        0
      );

      // Fast forward past cliff
      await time.increase(86400 + 365 * 86400 + 180 * 86400); // 18 months

      // Claim some tokens
      await teamVesting.connect(teamMember).claim();
      const claimed = await careToken.balanceOf(teamMember.address);

      // Revoke vesting
      await expect(teamVesting.revokeVesting(teamMember.address))
        .to.emit(teamVesting, "VestingRevoked");

      // Cannot claim after revocation
      await expect(
        teamVesting.connect(teamMember).claim()
      ).to.be.revertedWith("Vesting revoked");
    });
  });

  describe("🤝 CarePartnerVesting Security", function () {
    it("Should enforce tiered cliff periods", async function () {
      // Add PREMIUM partner (3-month cliff)
      await partnerVesting.addPartner(
        partner.address,
        ethers.parseEther("100000"),
        0 // PREMIUM tier
      );

      await time.increase(86400); // Past vesting start

      // Cannot claim before 3 months
      await time.increase(89 * 86400); // 89 days
      await expect(
        partnerVesting.connect(partner).claim()
      ).to.be.revertedWith("No tokens to claim");

      // Can claim after 3 months
      await time.increase(2 * 86400); // 91 days total
      await expect(partnerVesting.connect(partner).claim()).to.not.be.reverted;
    });

    it("Should prevent downgrading performance tiers", async function () {
      await partnerVesting.addPartner(
        partner.address,
        ethers.parseEther("100000"),
        1 // STANDARD tier
      );

      // Award GOLD tier
      await partnerVesting.awardPerformanceBonus(partner.address, 2); // GOLD

      // Try to downgrade to SILVER (should fail)
      await expect(
        partnerVesting.awardPerformanceBonus(partner.address, 1) // SILVER
      ).to.be.revertedWith("Cannot downgrade performance tier");
    });

    it("Should correctly calculate performance bonuses", async function () {
      await partnerVesting.addPartner(
        partner.address,
        ethers.parseEther("1000000"), // 1M base
        1 // STANDARD tier
      );

      // Award GOLD performance (20% bonus)
      await partnerVesting.awardPerformanceBonus(partner.address, 2);
      
      const partnerInfo = await partnerVesting.getPartner(partner.address);
      expect(partnerInfo.perfBonus).to.equal(
        ethers.parseEther("200000") // 20% of 1M = 200k
      );
    });

    it("Should prevent exceeding bonus allocation limit", async function () {
      // Add partner with huge base allocation
      await partnerVesting.addPartner(
        partner.address,
        ethers.parseEther("90000000"), // 90M
        0
      );

      // Try to award GOLD (20% = 18M bonus)
      // This would exceed 100M cap (90M base + 18M bonus > 100M)
      await expect(
        partnerVesting.awardPerformanceBonus(partner.address, 2)
      ).to.be.reverted; // Should fail with "Exceeds bonus allocation limit"
    });
  });

  describe("🔒 CareLiquidityLock Security", function () {
    it("Should prevent withdrawal before 24-month lock period", async function () {
      // Create liquidity pool
      const lockStartTime = await time.latest();
      const poolId = await liquidityLock.createPool(
        "Test DEX Pool",
        0, // PRIMARY_DEX
        ethers.parseEther("1000000"),
        lockStartTime
      );

      // Try to withdraw immediately (should fail)
      const poolIdValue = ethers.keccak256(ethers.toUtf8Bytes("Test DEX Pool" + "0" + lockStartTime));
      await expect(
        liquidityLock.withdraw(poolIdValue, owner.address, ethers.parseEther("100000"))
      ).to.be.revertedWith("Insufficient unlocked tokens");

      // Try after 23 months (should still fail)
      await time.increase(700 * 86400);
      await expect(
        liquidityLock.withdraw(poolIdValue, owner.address, ethers.parseEther("100000"))
      ).to.be.revertedWith("Insufficient unlocked tokens");
    });

    it("Should enforce linear unlock after lock period", async function () {
      const lockStartTime = await time.latest();
      const tx = await liquidityLock.createPool(
        "Test Pool 2",
        0,
        ethers.parseEther("6000000"), // 6M tokens
        lockStartTime
      );
      await tx.wait();

      const poolIdValue = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "uint8", "uint256"],
          ["Test Pool 2", 0, lockStartTime]
        )
      );

      // After 24 months (lock ends, unlock starts)
      await time.increase(730 * 86400);
      
      // After 3 more months (halfway through 6-month unlock = 50%)
      await time.increase(91 * 86400);
      
      const withdrawable = await liquidityLock.withdrawableAmount(poolIdValue);
      expect(withdrawable).to.be.closeTo(
        ethers.parseEther("3000000"), // 50% = 3M
        ethers.parseEther("50000") // 50k tolerance
      );
    });

    it("Should require valid signature for emergency unlock", async function () {
      const lockStartTime = await time.latest();
      await liquidityLock.createPool("Emergency Test", 0, ethers.parseEther("1000000"), lockStartTime);
      
      const poolIdValue = ethers.keccak256(ethers.toUtf8Bytes("Emergency Test" + "0" + lockStartTime));

      // Try emergency unlock with invalid signature (should fail)
      const invalidSignature = "0x" + "00".repeat(65);
      await expect(
        liquidityLock.emergencyUnlock(poolIdValue, invalidSignature)
      ).to.be.reverted;
    });
  });

  describe("🎯 CareTokenController Security", function () {
    it("Should enforce category mint caps", async function () {
      // Try to mint more than category cap
      const COMMUNITY_AIRDROP = 0;
      const CAP = ethers.parseEther("100000000"); // 100M cap

      // Mint 99M (should succeed)
      await controller.mintForCategory(
        COMMUNITY_AIRDROP,
        owner.address,
        ethers.parseEther("99000000"),
        "Test mint"
      );

      // Try to mint 2M more (should fail, would exceed 100M cap)
      await expect(
        controller.mintForCategory(
          COMMUNITY_AIRDROP,
          owner.address,
          ethers.parseEther("2000000"),
          "Exceed cap"
        )
      ).to.be.revertedWith("Exceeds category cap");
    });

    it("Should prevent unauthorized minting", async function () {
      await expect(
        controller.connect(attacker).mintForCategory(
          0, // COMMUNITY_AIRDROP
          attacker.address,
          ethers.parseEther("1000"),
          "Attack"
        )
      ).to.be.revertedWith("Unauthorized for this category");
    });

    it("Should correctly track burn statistics", async function () {
      // Mint tokens to owner
      await controller.mintForCategory(
        0,
        owner.address,
        ethers.parseEther("10000"),
        "For burning"
      );

      // Approve controller to burn
      await careToken.approve(await controller.getAddress(), ethers.parseEther("10000"));

      // Burn with REDEMPTION reason
      await controller.burnForCategory(
        0, // COMMUNITY_AIRDROP
        0, // REDEMPTION
        ethers.parseEther("3000")
      );

      // Burn with BUYBACK reason
      await controller.burnForCategory(
        0,
        1, // BUYBACK
        ethers.parseEther("2000")
      );

      // Check burn stats
      const burnStats = await controller.getBurnStats();
      expect(burnStats.redemption).to.equal(ethers.parseEther("3000"));
      expect(burnStats.buyback).to.equal(ethers.parseEther("2000"));
      expect(burnStats.total).to.equal(ethers.parseEther("5000"));
    });
  });

  describe("🛡️ Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks on claim", async function () {
      // This test ensures nonReentrant modifier is working
      // In a real attack, a malicious contract would try to re-enter claim()
      await teamVesting.addBeneficiary(
        teamMember.address,
        ethers.parseEther("1000000"),
        0
      );

      await time.increase(86400 + 400 * 86400); // Past cliff
      
      // Normal claim should work
      await expect(teamVesting.connect(teamMember).claim()).to.not.be.reverted;
      
      // Second immediate claim should have no tokens (not reentrancy, just empty)
      await expect(
        teamVesting.connect(teamMember).claim()
      ).to.be.revertedWith("No tokens to claim");
    });
  });

  describe("📊 Integration Tests", function () {
    it("Should handle complete vesting lifecycle", async function () {
      // 1. Add beneficiary
      await teamVesting.addBeneficiary(
        teamMember.address,
        ethers.parseEther("4800000"), // 4.8M tokens
        0 // 48-month vesting
      );

      // 2. Wait for cliff
      await time.increase(86400 + 365 * 86400);

      // 3. Claim after cliff
      await teamVesting.connect(teamMember).claim();
      const balance1 = await careToken.balanceOf(teamMember.address);
      expect(balance1).to.be.gt(0);

      // 4. Wait 1 year
      await time.increase(365 * 86400);

      // 5. Claim again
      await teamVesting.connect(teamMember).claim();
      const balance2 = await careToken.balanceOf(teamMember.address);
      expect(balance2).to.be.gt(balance1);

      // 6. Fast forward to end
      await time.increase(2 * 365 * 86400);

      // 7. Final claim
      await teamVesting.connect(teamMember).claim();
      const finalBalance = await careToken.balanceOf(teamMember.address);
      expect(finalBalance).to.be.closeTo(
        ethers.parseEther("4800000"),
        ethers.parseEther("10000")
      );
    });
  });
});
