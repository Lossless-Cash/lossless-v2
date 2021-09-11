const { time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

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

let losslessController;
let losslessControllerV1;
let erc20;
let anotherErc20;
let guardian;

const name = 'My Token';
const symbol = 'MTKN';
const initialSupply = 1000000;
const stakeAmount = 5000;
const reportLifetime = time.duration.days(1);

describe.only('LosslessGuardian', () => {
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
  });

  describe('setGuardAdmin', () => {
    describe('when sender is not token admin', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(anotherAccount)
            .setGuardAdmin(erc20.address, guardianAdmin.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is token admin', () => {
      it('should succeed', async () => {
        await guardian
          .connect(admin)
          .setGuardAdmin(erc20.address, guardianAdmin.address);
        expect(await guardian.guardAdmins(erc20.address)).to.be.equal(
          guardianAdmin.address,
        );
      });
    });
  });

  describe('LosslessController.setGuardian', () => {
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

  describe('LosslessController.setGuardian', () => {
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

  describe('LosslessController.setGuardedAddress', () => {
    describe('when sender is not guardian', async () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(anotherAccount)
            .setGuardedAddress(erc20.address, anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: sender is not guardian');
      });
    });
  });

  describe('setGuardedList', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setGuardAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(anotherAccount)
            .setGuardedList(
              erc20.address,
              [oneMoreAccount.address, initialHolder.address],
              [10, 100],
            ),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is guard admin', () => {
      it('should succeed', async () => {
        await guardian
          .connect(guardianAdmin)
          .setGuardedList(
            erc20.address,
            [oneMoreAccount.address, initialHolder.address],
            [10, 100],
          );
      });
    });
  });

  describe('LERC20.transfer', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setGuardAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(guardianAdmin)
        .setGuardedList(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [10, 100],
        );
    });

    describe('when transfering below limit', async () => {
      it('should not freeze', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 10);
        await erc20.connect(recipient).transfer(anotherAccount.address, 10);
        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(10);
      });
    });

    describe('when transfering above limit', async () => {
      it('should freeze', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 101);
        await expect(
          erc20.connect(recipient).transfer(anotherAccount.address, 10),
        ).to.be.revertedWith('LOSSLESS: sender is freezed');
      });
    });
  });

  describe.only('unfreeze', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setGuardAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(guardianAdmin)
        .setGuardedList(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [10, 100],
        );

      await erc20.connect(initialHolder).transfer(recipient.address, 101);
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(anotherAccount)
            .unfreeze(erc20.address, [recipient.address]),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is guard admin', () => {
      it('should revert', async () => {
        await guardian
          .connect(guardianAdmin)
          .unfreeze(erc20.address, [initialHolder.address]);

        await guardian
          .connect(guardianAdmin)
          .unfreeze(erc20.address, [recipient.address]);

        await erc20.connect(recipient).transfer(anotherAccount.address, 10);
        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(10);
      });
    });
  });
});
