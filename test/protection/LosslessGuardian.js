const { time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ethers } = require('hardhat');

let initialHolder;
let anotherAccount;
let admin;
let adminBackup;
let lssAdmin;
let lssRecoveryAdmin;
let pauseAdmin;
let guardianAdmin;
let treasuryProtectionStrategy;
let losslessController;
let losslessControllerV1;
let liquidityProtectionStrategy;
let erc20;
let guardian;
const name = 'My Token';
const symbol = 'MTKN';
const initialSupply = 1000000;

describe('LosslessGuardian', () => {
  beforeEach(async () => {
    [
      initialHolder,
      anotherAccount,
      admin,
      lssAdmin,
      lssRecoveryAdmin,
      guardianAdmin,
      pauseAdmin,
      adminBackup,
    ] = await ethers.getSigners();

    const LosslessController = await ethers.getContractFactory(
      'LosslessControllerV1',
    );

    const LosslessControllerV2 = await ethers.getContractFactory(
      'LosslessControllerV2',
    );

    losslessControllerV1 = await upgrades.deployProxy(LosslessController, [
      lssAdmin.address,
      lssRecoveryAdmin.address,
      pauseAdmin.address,
    ]);

    losslessController = await upgrades.upgradeProxy(
      losslessControllerV1.address,
      LosslessControllerV2,
    );

    const LERC20Mock = await ethers.getContractFactory('LERC20Mock');

    erc20 = await LERC20Mock.deploy(
      0,
      name,
      symbol,
      initialHolder.address,
      initialSupply,
      losslessController.address,
      admin.address,
      adminBackup.address,
      Number(time.duration.days(1)),
    );

    const LosslessGuardian = await ethers.getContractFactory(
      'LosslessGuardian',
    );
    guardian = await LosslessGuardian.deploy(losslessController.address);

    const TreasuryProtectionStrategy = await ethers.getContractFactory(
      'TreasuryProtectionStrategy',
    );
    treasuryProtectionStrategy = await TreasuryProtectionStrategy.deploy(
      guardian.address,
      losslessController.address,
    );

    const LiquidityProtectionStrategy = await ethers.getContractFactory(
      'LiquidityProtectionStrategy',
    );
    liquidityProtectionStrategy = await LiquidityProtectionStrategy.deploy(
      guardian.address,
      losslessController.address,
    );
  });

  describe('setProtectionAdmin', () => {
    describe('when token is not verified', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(anotherAccount)
            .setProtectionAdmin(erc20.address, guardianAdmin.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is not token admin', () => {
      it('should revert', async () => {
        await guardian.connect(lssAdmin).verifyToken(erc20.address);

        await expect(
          guardian
            .connect(anotherAccount)
            .setProtectionAdmin(erc20.address, guardianAdmin.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is token admin', () => {
      it('should succeed', async () => {
        await guardian.connect(lssAdmin).verifyToken(erc20.address);

        await guardian
          .connect(admin)
          .setProtectionAdmin(erc20.address, guardianAdmin.address);

        expect(await guardian.protectionAdmin(erc20.address)).to.be.equal(
          guardianAdmin.address,
        );
      });
    });
  });

  describe('verifyStrategies', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(guardianAdmin)
            .verifyStrategies([
              treasuryProtectionStrategy.address,
              liquidityProtectionStrategy.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succedd', async () => {
        await guardian
          .connect(lssAdmin)
          .verifyStrategies([
            treasuryProtectionStrategy.address,
            liquidityProtectionStrategy.address,
          ]);

        expect(
          await guardian.verifiedStrategies(treasuryProtectionStrategy.address),
        ).to.be.equal(true);
        expect(
          await guardian.verifiedStrategies(
            liquidityProtectionStrategy.address,
          ),
        ).to.be.equal(true);
      });

      describe('when sending empty array', () => {
        it('should succedd', async () => {
          await guardian.connect(lssAdmin).verifyStrategies([]);

          expect(
            await guardian.verifiedStrategies(
              treasuryProtectionStrategy.address,
            ),
          ).to.be.equal(false);
          expect(
            await guardian.verifiedStrategies(
              liquidityProtectionStrategy.address,
              [],
            ),
          ).to.be.equal(false);
        });
      });
    });
  });

  describe('removeStrategies', () => {
    beforeEach(async () => {
      await guardian
        .connect(lssAdmin)
        .verifyStrategies([
          treasuryProtectionStrategy.address,
          liquidityProtectionStrategy.address,
        ]);
    });

    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(guardianAdmin)
            .removeStrategies([
              treasuryProtectionStrategy.address,
              liquidityProtectionStrategy.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succedd', async () => {
        await guardian
          .connect(lssAdmin)
          .removeStrategies([
            treasuryProtectionStrategy.address,
            liquidityProtectionStrategy.address,
          ]);

        expect(
          await guardian.verifiedStrategies(treasuryProtectionStrategy.address),
        ).to.be.equal(false);
        expect(
          await guardian.verifiedStrategies(
            liquidityProtectionStrategy.address,
          ),
        ).to.be.equal(false);
      });

      describe('when sending empty array', () => {
        it('should succedd', async () => {
          await guardian.connect(lssAdmin).removeStrategies([]);

          expect(
            await guardian.verifiedStrategies(
              treasuryProtectionStrategy.address,
            ),
          ).to.be.equal(true);
          expect(
            await guardian.verifiedStrategies(
              liquidityProtectionStrategy.address,
              [],
            ),
          ).to.be.equal(true);
        });
      });
    });
  });

  describe('verifyToken', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          guardian.connect(guardianAdmin).verifyToken(erc20.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succedd', async () => {
        expect(await guardian.verifiedTokens(erc20.address)).to.be.equal(false);
        await guardian.connect(lssAdmin).verifyToken(erc20.address);
        expect(await guardian.verifiedTokens(erc20.address)).to.be.equal(true);
      });
    });
  });

  describe('removeVerifiedToken', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          guardian.connect(guardianAdmin).removeVerifiedToken(erc20.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succedd', async () => {
        await guardian.connect(lssAdmin).verifyToken(erc20.address);
        expect(await guardian.verifiedTokens(erc20.address)).to.be.equal(true);
        await guardian.connect(lssAdmin).removeVerifiedToken(erc20.address);
        expect(await guardian.verifiedTokens(erc20.address)).to.be.equal(false);
      });
    });
  });
});
