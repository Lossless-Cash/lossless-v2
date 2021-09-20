/* eslint-disable no-await-in-loop */
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
let losslessController;
let losslessControllerV1;
let liquidityProtectionStrategy;
let erc20;
let guardian;

const name = 'My Token';
const symbol = 'MTKN';
const initialSupply = 1000000;

async function mineBlocks(count) {
  for (let i = 0; i < count; i += 1) {
    await ethers.provider.send('evm_mine');
  }
}

describe.only('LiquidityProtectionStrategy', () => {
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

    const LiquidityProtectionStrategy = await ethers.getContractFactory(
      'LiquidityProtectionStrategy',
    );
    liquidityProtectionStrategy = await LiquidityProtectionStrategy.deploy(
      guardian.address,
      losslessController.address,
    );
  });

  describe('addLimitsToGuard', () => {
    beforeEach(async () => {
      await guardian.connect(lssAdmin).verifyToken(erc20.address);

      await guardian
        .connect(admin)
        .setProtectionAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([liquidityProtectionStrategy.address]);
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        const blockNumBefore = await ethers.provider.getBlockNumber();

        await expect(
          liquidityProtectionStrategy
            .connect(anotherAccount)
            .addLimitsToGuard(
              erc20.address,
              [oneMoreAccount.address, initialHolder.address],
              [100, 300],
              [10, 25],
              [blockNumBefore, blockNumBefore],
            ),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
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
        .verifyStrategies([liquidityProtectionStrategy.address]);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      await liquidityProtectionStrategy
        .connect(guardianAdmin)
        .addLimitsToGuard(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [5, 10],
          [10, 15],
          [blockNumBefore + 2, blockNumBefore + 2],
        );
    });

    describe('when transfering below limit', async () => {
      it('should not freeze', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(recipient).transfer(anotherAccount.address, 3);
        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(3);
      });
    });

    describe('when transfering above first limit', async () => {
      it('should revert', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 4);
        await erc20.connect(initialHolder).transfer(recipient.address, 4);
        await expect(
          erc20.connect(initialHolder).transfer(recipient.address, 4),
        ).to.be.revertedWith('LOSSLESS: limit reached');
      });
    });

    describe('when transfering much more that the first limit', async () => {
      it('should revert', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 4);

        await expect(
          erc20.connect(initialHolder).transfer(recipient.address, 400),
        ).to.be.revertedWith('LOSSLESS: limit reached');
      });
    });

    describe('when transfering above second limit', async () => {
      it('should revert', async () => {
        const blockNumBefore = await ethers.provider.getBlockNumber();

        await liquidityProtectionStrategy
          .connect(guardianAdmin)
          .addLimitsToGuard(
            erc20.address,
            [oneMoreAccount.address, initialHolder.address],
            [5, 10],
            [10, 15],
            [blockNumBefore + 2, blockNumBefore + 2],
          );

        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);

        await expect(
          erc20.connect(initialHolder).transfer(recipient.address, 2),
        ).to.be.revertedWith('LOSSLESS: limit reached');
      });
    });

    describe('when transfering much more than the second limit', async () => {
      it('should revert', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);

        await expect(
          erc20.connect(initialHolder).transfer(recipient.address, 200),
        ).to.be.revertedWith('LOSSLESS: limit reached');
      });
    });

    describe('when limit is reset after some time', async () => {
      it('should not freeze', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 9);
        await mineBlocks(11);
        await erc20.connect(initialHolder).transfer(recipient.address, 9);
        await erc20.connect(recipient).transfer(anotherAccount.address, 1);
        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(1);
      });
    });

    describe('when limit is reset after some time and reached again', async () => {
      it('should revert', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 9);
        await mineBlocks(10);
        await erc20.connect(initialHolder).transfer(recipient.address, 9);
        await expect(
          erc20.connect(initialHolder).transfer(recipient.address, 9),
        ).to.be.revertedWith('LOSSLESS: limit reached');
      });
    });

    describe('when limit is reset after some time and second limit is reached', async () => {
      it('should revert', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 9);
        await mineBlocks(20);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);

        await expect(
          erc20.connect(initialHolder).transfer(recipient.address, 4),
        ).to.be.revertedWith('LOSSLESS: limit reached');
      });
    });

    describe('when limit is reset two times', async () => {
      it('should suceed', async () => {
        await erc20.connect(initialHolder).transfer(recipient.address, 9);
        await mineBlocks(11);
        await erc20.connect(initialHolder).transfer(recipient.address, 9);
        await mineBlocks(11);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        expect(await erc20.balanceOf(recipient.address)).to.be.equal(22);
      });
    });

    describe('when limit is reset two times and reached then', async () => {
      it('should revert', async () => {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        await liquidityProtectionStrategy
          .connect(guardianAdmin)
          .addLimitsToGuard(
            erc20.address,
            [oneMoreAccount.address, initialHolder.address],
            [5, 10],
            [10, 15],
            [blockNumBefore + 2, blockNumBefore + 2],
          );

        await erc20.connect(initialHolder).transfer(recipient.address, 1);
        await mineBlocks(11);

        await erc20.connect(initialHolder).transfer(recipient.address, 2);
        await mineBlocks(11);

        await erc20.connect(initialHolder).transfer(recipient.address, 9);
        await expect(
          erc20.connect(initialHolder).transfer(recipient.address, 2),
        ).to.be.revertedWith('LOSSLESS: limit reached');
      });
    });

    describe('when limit is reached', async () => {
      it('should be reset after some time', async () => {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        await liquidityProtectionStrategy
          .connect(guardianAdmin)
          .addLimitsToGuard(
            erc20.address,
            [oneMoreAccount.address, initialHolder.address],
            [5, 10],
            [10, 15],
            [blockNumBefore + 2, blockNumBefore + 2],
          );

        await erc20.connect(initialHolder).transfer(recipient.address, 9);
        await expect(
          erc20.connect(initialHolder).transfer(anotherAccount.address, 2),
        ).to.be.revertedWith('LOSSLESS: limit reached');
        await mineBlocks(100);

        await erc20.connect(initialHolder).transfer(anotherAccount.address, 2);
        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(2);
      });
    });
  });

  describe('setGuardian', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          liquidityProtectionStrategy
            .connect(anotherAccount)
            .setGuardian(anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succeed', async () => {
        await liquidityProtectionStrategy
          .connect(lssAdmin)
          .setGuardian(anotherAccount.address);

        expect(await liquidityProtectionStrategy.guardian()).to.be.equal(
          anotherAccount.address,
        );
      });
    });
  });

  describe('removeLimits', () => {
    beforeEach(async () => {
      await guardian.connect(lssAdmin).verifyToken(erc20.address);
      await guardian
        .connect(admin)
        .setProtectionAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([liquidityProtectionStrategy.address]);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      await liquidityProtectionStrategy
        .connect(guardianAdmin)
        .addLimitsToGuard(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [5, 10],
          [10, 15],
          [blockNumBefore, blockNumBefore],
        );
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          liquidityProtectionStrategy
            .connect(anotherAccount)
            .removeLimits(erc20.address, [
              oneMoreAccount.address,
              initialHolder.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is admin', () => {
      it('should succeed', async () => {
        await liquidityProtectionStrategy
          .connect(guardianAdmin)
          .removeLimits(erc20.address, [
            oneMoreAccount.address,
            initialHolder.address,
          ]);

        await erc20.connect(initialHolder).transfer(recipient.address, 100);
        await erc20.connect(recipient).transfer(anotherAccount.address, 100);
        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(100);
      });
    });
  });

  describe('pause', () => {
    beforeEach(async () => {
      await guardian.connect(lssAdmin).verifyToken(erc20.address);
      await guardian
        .connect(admin)
        .setProtectionAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([liquidityProtectionStrategy.address]);
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          liquidityProtectionStrategy
            .connect(anotherAccount)
            .pause(erc20.address, initialHolder.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is admin', () => {
      describe('when address is not protected', () => {
        it('should revert', async () => {
          await expect(
            liquidityProtectionStrategy
              .connect(guardianAdmin)
              .pause(erc20.address, initialHolder.address),
          ).to.be.revertedWith('LOSSLESS: not protected');
        });
      });

      describe('when address is protected', () => {
        beforeEach(async () => {
          const blockNumBefore = await ethers.provider.getBlockNumber();
          await liquidityProtectionStrategy
            .connect(guardianAdmin)
            .addLimitsToGuard(
              erc20.address,
              [oneMoreAccount.address, initialHolder.address],
              [5, 10],
              [10, 15],
              [blockNumBefore, blockNumBefore],
            );
        });

        describe('when address is already paused', () => {
          beforeEach(async () => {
            await liquidityProtectionStrategy
              .connect(guardianAdmin)
              .pause(erc20.address, initialHolder.address);
          });

          it('should revert', async () => {
            await expect(
              liquidityProtectionStrategy
                .connect(guardianAdmin)
                .pause(erc20.address, initialHolder.address),
            ).to.be.revertedWith('LOSSLESS: already paused');
          });
        });

        describe('when address is not already paused', () => {
          it('should succeed', async () => {
            await liquidityProtectionStrategy
              .connect(guardianAdmin)
              .pause(erc20.address, initialHolder.address);

            await expect(
              erc20.connect(initialHolder).transfer(recipient.address, 1),
            ).to.be.revertedWith('LOSSLESS: limit reached');
          });
        });
      });
    });
  });

  describe('unpause', () => {
    beforeEach(async () => {
      await guardian.connect(lssAdmin).verifyToken(erc20.address);
      await guardian
        .connect(admin)
        .setProtectionAdmin(erc20.address, guardianAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([liquidityProtectionStrategy.address]);
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          liquidityProtectionStrategy
            .connect(anotherAccount)
            .unpause(erc20.address, initialHolder.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is admin', () => {
      describe('when address is not protected', () => {
        it('should revert', async () => {
          await expect(
            liquidityProtectionStrategy
              .connect(guardianAdmin)
              .unpause(erc20.address, initialHolder.address),
          ).to.be.revertedWith('LOSSLESS: not protected');
        });
      });

      describe('when address is protected', () => {
        beforeEach(async () => {
          const blockNumBefore = await ethers.provider.getBlockNumber();
          await liquidityProtectionStrategy
            .connect(guardianAdmin)
            .addLimitsToGuard(
              erc20.address,
              [oneMoreAccount.address, initialHolder.address],
              [5, 10],
              [10, 15],
              [blockNumBefore, blockNumBefore],
            );
        });

        describe('when address is paused', () => {
          beforeEach(async () => {
            await liquidityProtectionStrategy
              .connect(guardianAdmin)
              .pause(erc20.address, initialHolder.address);
          });

          it('should succeed', async () => {
            await expect(
              erc20.connect(initialHolder).transfer(recipient.address, 1),
            ).to.be.revertedWith('LOSSLESS: limit reached');

            await liquidityProtectionStrategy
              .connect(guardianAdmin)
              .unpause(erc20.address, initialHolder.address);

            await erc20.connect(initialHolder).transfer(recipient.address, 1);
            expect(await erc20.balanceOf(recipient.address)).to.be.equal(1);
          });
        });

        describe('when address is not paused', () => {
          it('should succeed', async () => {
            await await expect(
              liquidityProtectionStrategy
                .connect(guardianAdmin)
                .unpause(erc20.address, initialHolder.address),
            ).to.be.revertedWith('LOSSLESS: not paused');
          });
        });
      });
    });
  });
});
