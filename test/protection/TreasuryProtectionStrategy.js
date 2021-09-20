const { time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ethers } = require('hardhat');

let initialHolder;
let recipient;
let anotherAccount;
let admin;
let adminBackup;
let lssAdmin;
let lssRecoveryAdmin;
let oneMoreAccount;
let pauseAdmin;
let guardianAdmin;
let treasuryProtectionStrategy;
let losslessController;
let losslessControllerV1;
let erc20;
let guardian;

const name = 'My Token';
const symbol = 'MTKN';
const initialSupply = 1000000;

describe('TreasuryProtectionStrategy', () => {
  beforeEach(async () => {
    [
      initialHolder,
      recipient,
      anotherAccount,
      admin,
      lssAdmin,
      lssRecoveryAdmin,
      guardianAdmin,
      pauseAdmin,
      adminBackup,
      oneMoreAccount,
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

  describe('setProtectedAddress', () => {
    beforeEach(async () => {
      await guardian.connect(lssAdmin).verifyToken(erc20.address);
      await guardian
        .connect(admin)
        .setProtectionAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([treasuryProtectionStrategy.address]);
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        await expect(
          treasuryProtectionStrategy
            .connect(anotherAccount)
            .setProtectedAddress(erc20.address, initialHolder.address, [
              recipient.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is guard admin', () => {
      it('should succeed', async () => {
        expect(
          await losslessController.isAddressProtected(
            erc20.address,
            initialHolder.address,
          ),
        ).to.be.equal(false);

        await treasuryProtectionStrategy
          .connect(guardianAdmin)
          .setProtectedAddress(erc20.address, initialHolder.address, [
            recipient.address,
          ]);

        expect(
          await losslessController.isAddressProtected(
            erc20.address,
            initialHolder.address,
          ),
        ).to.be.equal(true);
      });
    });
  });

  describe('removeProtectedAddresses', () => {
    beforeEach(async () => {
      await guardian.connect(lssAdmin).verifyToken(erc20.address);
      await guardian
        .connect(admin)
        .setProtectionAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([treasuryProtectionStrategy.address]);

      await treasuryProtectionStrategy
        .connect(guardianAdmin)
        .setProtectedAddress(erc20.address, oneMoreAccount.address, [
          recipient.address,
        ]);
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          treasuryProtectionStrategy
            .connect(anotherAccount)
            .removeProtectedAddresses(erc20.address, [
              oneMoreAccount.address,
              initialHolder.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is admin', () => {
      it('should succeed', async () => {
        expect(
          await losslessController.isAddressProtected(
            erc20.address,
            oneMoreAccount.address,
          ),
        ).to.be.equal(true);

        await treasuryProtectionStrategy
          .connect(guardianAdmin)
          .removeProtectedAddresses(erc20.address, [
            oneMoreAccount.address,
            initialHolder.address,
          ]);

        await erc20.connect(initialHolder).transfer(recipient.address, 10001);
        await erc20.connect(recipient).transfer(anotherAccount.address, 10001);
        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(
          10001,
        );
        expect(
          await losslessController.isAddressProtected(
            erc20.address,
            oneMoreAccount.address,
          ),
        ).to.be.equal(false);
      });
    });
  });

  describe('LERC20.transfer', () => {
    beforeEach(async () => {
      await guardian.connect(lssAdmin).verifyToken(erc20.address);
      await guardian
        .connect(admin)
        .setProtectionAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([treasuryProtectionStrategy.address]);

      await treasuryProtectionStrategy
        .connect(guardianAdmin)
        .setProtectedAddress(erc20.address, initialHolder.address, [
          recipient.address,
        ]);
    });

    describe('when transfering to whitelisted', async () => {
      it('should suceed', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 10);
        await erc20.connect(recipient).transfer(anotherAccount.address, 10);
        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(10);
      });
    });

    describe('when transfering not to whitelisted', async () => {
      it('should revert', async () => {
        await expect(
          erc20.connect(initialHolder).transfer(anotherAccount.address, 101),
        ).to.be.revertedWith('LOSSLESS: recipient not whitelisted');
      });
    });
  });

  describe('setGuardian', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          treasuryProtectionStrategy
            .connect(anotherAccount)
            .setGuardian(anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succeed', async () => {
        await treasuryProtectionStrategy
          .connect(lssAdmin)
          .setGuardian(anotherAccount.address);

        expect(await treasuryProtectionStrategy.guardian()).to.be.equal(
          anotherAccount.address,
        );
      });
    });
  });
});
