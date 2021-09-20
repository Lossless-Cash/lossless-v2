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
let treasuryProtectionStrategy;
let losslessController;
let losslessControllerV1;
let erc20;
let guardian;

const name = 'My Token';
const symbol = 'MTKN';
const initialSupply = 1000000;

describe('ControllerProtection', () => {
  beforeEach(async () => {
    [
      initialHolder,
      anotherAccount,
      admin,
      lssAdmin,
      lssRecoveryAdmin,
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
  });

  describe('setGuardian', () => {
    describe('when sender is not admin', async () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(anotherAccount)
            .setGuardian(guardian.address),
        ).to.be.revertedWith('LOSSLESS: must be admin');
      });
    });

    describe('when sender is admin', async () => {
      it('should revert', async () => {
        await losslessController
          .connect(lssAdmin)
          .setGuardian(guardian.address);

        expect(await losslessController.guardian()).to.be.equal(
          guardian.address,
        );
      });
    });
  });

  describe('setProtectedAddress', () => {
    describe('when sender is not guardian', async () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(anotherAccount)
            .setProtectedAddress(
              erc20.address,
              anotherAccount.address,
              treasuryProtectionStrategy.address,
            ),
        ).to.be.revertedWith('LOSSLESS: sender is not guardian');
      });
    });
  });

  describe('removeProtectedAddress', () => {
    describe('when sender is not guardian', async () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(anotherAccount)
            .removeProtectedAddress(erc20.address, anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: sender is not guardian');
      });
    });
  });
});
