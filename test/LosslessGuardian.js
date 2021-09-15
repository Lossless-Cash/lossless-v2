const { time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { utils } = require('ethers');

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
let liquidityProtectionStrategy;
let erc20;
let anotherErc20;
let guardian;
let refundAdmin;

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
      refundAdmin,
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

  describe('setGuardAdmin', () => {
    describe('when sender is not token admin', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(anotherAccount)
            .setAdmins(
              erc20.address,
              guardianAdmin.address,
              refundAdmin.address,
            ),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is token admin', () => {
      it('should succeed', async () => {
        await guardian
          .connect(admin)
          .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);
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
            .setGuardedAddress(
              erc20.address,
              anotherAccount.address,
              treasuryProtectionStrategy.address,
            ),
        ).to.be.revertedWith('LOSSLESS: sender is not guardian');
      });
    });
  });

  describe('setGuardedList', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([
          treasuryProtectionStrategy.address,
          liquidityProtectionStrategy.address,
        ]);
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        await expect(
          treasuryProtectionStrategy
            .connect(anotherAccount)
            .setGuardedList(
              erc20.address,
              [oneMoreAccount.address, initialHolder.address],
              [10, 100],
              [
                treasuryProtectionStrategy.address,
                treasuryProtectionStrategy.address,
              ],
            ),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is guard admin', () => {
      it('should succeed', async () => {
        await treasuryProtectionStrategy
          .connect(guardianAdmin)
          .setGuardedList(
            erc20.address,
            [oneMoreAccount.address, initialHolder.address],
            [10, 100],
            [
              treasuryProtectionStrategy.address,
              treasuryProtectionStrategy.address,
            ],
          );
      });
    });
  });

  describe('unfreeze', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([
          treasuryProtectionStrategy.address,
          liquidityProtectionStrategy.address,
        ]);

      await treasuryProtectionStrategy
        .connect(guardianAdmin)
        .setGuardedList(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [10, 100],
          [
            treasuryProtectionStrategy.address,
            treasuryProtectionStrategy.address,
          ],
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

  describe('setTimelockPeriod', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          guardian.connect(anotherAccount).setTimelockPeriod(100),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should revert', async () => {
        expect(await guardian.timelockPeriod()).to.be.equal(86400);
        await guardian.connect(lssAdmin).setTimelockPeriod(100);
        expect(await guardian.timelockPeriod()).to.be.equal(100);
      });
    });
  });

  describe('proposeRefund', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([
          treasuryProtectionStrategy.address,
          liquidityProtectionStrategy.address,
        ]);

      await treasuryProtectionStrategy
        .connect(guardianAdmin)
        .setGuardedList(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [10, 100],
          [
            treasuryProtectionStrategy.address,
            treasuryProtectionStrategy.address,
          ],
        );

      await erc20.connect(initialHolder).transfer(recipient.address, 110);
    });

    describe('when sender is not refund admin', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(anotherAccount)
            .proposeRefund(
              erc20.address,
              oneMoreAccount.address,
              anotherAccount.address,
              utils.formatBytes32String('TEST'),
            ),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is refund admin', () => {
      it('should succeed', async () => {
        const id = await guardian.hashOperation(
          erc20.address,
          recipient.address,
          oneMoreAccount.address,
          utils.formatBytes32String('TEST'),
        );

        expect((await guardian.refundTimestamps(id)) > 0).to.be.equal(false);

        await guardian
          .connect(refundAdmin)
          .proposeRefund(
            erc20.address,
            recipient.address,
            oneMoreAccount.address,
            utils.formatBytes32String('TEST'),
          );

        expect((await guardian.refundTimestamps(id)) > 0).to.be.equal(true);
      });

      describe('when refund already proposed', () => {
        it('should revert', async () => {
          await guardian
            .connect(refundAdmin)
            .proposeRefund(
              erc20.address,
              recipient.address,
              anotherAccount.address,
              utils.formatBytes32String('TEST'),
            );

          await expect(
            guardian
              .connect(refundAdmin)
              .proposeRefund(
                erc20.address,
                recipient.address,
                anotherAccount.address,
                utils.formatBytes32String('TEST'),
              ),
          ).to.be.revertedWith('LOSSLESS: refund already proposed');
        });
      });

      describe('when freezed address is not actually freezed', () => {
        it('should revert', async () => {
          await expect(
            guardian
              .connect(refundAdmin)
              .proposeRefund(
                erc20.address,
                oneMoreAccount.address,
                anotherAccount.address,
                utils.formatBytes32String('TEST'),
              ),
          ).to.be.revertedWith('LOSSLESS: address is not freezed');
        });
      });
    });
  });

  describe('cancelRefundProposal', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([
          treasuryProtectionStrategy.address,
          liquidityProtectionStrategy.address,
        ]);

      await treasuryProtectionStrategy
        .connect(guardianAdmin)
        .setGuardedList(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [10, 100],
          [
            treasuryProtectionStrategy.address,
            treasuryProtectionStrategy.address,
          ],
        );

      await erc20.connect(initialHolder).transfer(recipient.address, 110);
    });

    describe('when sender is not refund admin', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(anotherAccount)
            .cancelRefundProposal(
              erc20.address,
              oneMoreAccount.address,
              anotherAccount.address,
              utils.formatBytes32String('TEST'),
            ),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is refund admin', () => {
      it('should succeed', async () => {
        await guardian
          .connect(refundAdmin)
          .proposeRefund(
            erc20.address,
            recipient.address,
            oneMoreAccount.address,
            utils.formatBytes32String('TEST'),
          );

        const id = await guardian.hashOperation(
          erc20.address,
          recipient.address,
          oneMoreAccount.address,
          utils.formatBytes32String('TEST'),
        );

        expect((await guardian.refundTimestamps(id)) > 0).to.be.equal(true);

        await guardian
          .connect(refundAdmin)
          .cancelRefundProposal(
            erc20.address,
            recipient.address,
            oneMoreAccount.address,
            utils.formatBytes32String('TEST'),
          );

        expect((await guardian.refundTimestamps(id)) > 0).to.be.equal(false);
      });

      describe('when refund is not proposed', () => {
        it('should revert', async () => {
          await expect(
            guardian
              .connect(refundAdmin)
              .cancelRefundProposal(
                erc20.address,
                recipient.address,
                anotherAccount.address,
                utils.formatBytes32String('TEST'),
              ),
          ).to.be.revertedWith('LOSSLESS: refund does not exist');
        });
      });
    });
  });

  describe('executeRefund', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([
          treasuryProtectionStrategy.address,
          liquidityProtectionStrategy.address,
        ]);

      await treasuryProtectionStrategy
        .connect(guardianAdmin)
        .setGuardedList(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [10, 100],
          [
            treasuryProtectionStrategy.address,
            treasuryProtectionStrategy.address,
          ],
        );

      await erc20.connect(initialHolder).transfer(recipient.address, 110);
    });

    describe('when sender is not refund admin', () => {
      it('should revert', async () => {
        await expect(
          guardian
            .connect(anotherAccount)
            .executeRefund(
              erc20.address,
              oneMoreAccount.address,
              anotherAccount.address,
              utils.formatBytes32String('TEST'),
            ),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is refund admin', () => {
      it('should succeed', async () => {
        await guardian
          .connect(refundAdmin)
          .proposeRefund(
            erc20.address,
            recipient.address,
            oneMoreAccount.address,
            utils.formatBytes32String('TEST'),
          );

        const id = await guardian.hashOperation(
          erc20.address,
          recipient.address,
          oneMoreAccount.address,
          utils.formatBytes32String('TEST'),
        );

        expect((await guardian.refundTimestamps(id)) > 0).to.be.equal(true);
        expect(await erc20.balanceOf(recipient.address)).to.be.equal(110);

        await guardian
          .connect(refundAdmin)
          .executeRefund(
            erc20.address,
            recipient.address,
            oneMoreAccount.address,
            utils.formatBytes32String('TEST'),
          );

        expect(await erc20.balanceOf(recipient.address)).to.be.equal(0);
        expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.equal(110);
        expect((await guardian.refundTimestamps(id)) > 0).to.be.equal(false);
      });

      describe('when refund is not proposed', () => {
        it('should revert', async () => {
          await expect(
            guardian
              .connect(refundAdmin)
              .executeRefund(
                erc20.address,
                recipient.address,
                anotherAccount.address,
                utils.formatBytes32String('TEST'),
              ),
          ).to.be.revertedWith('LOSSLESS: refund does not exist');
        });
      });
    });
  });

  describe('addLimitsToGuard', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([
          treasuryProtectionStrategy.address,
          liquidityProtectionStrategy.address,
        ]);

      await treasuryProtectionStrategy
        .connect(guardianAdmin)
        .setGuardedList(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [10, 100],
          [
            liquidityProtectionStrategy.address,
            liquidityProtectionStrategy.address,
          ],
        );
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        await expect(
          liquidityProtectionStrategy
            .connect(anotherAccount)
            .addLimitsToGuard(
              erc20.address,
              [oneMoreAccount.address, initialHolder.address],
              [100, 300],
              [10, 25],
            ),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });
  });

  describe('LERC20.transfer', () => {
    describe('when simple threshold is set', () => {
      beforeEach(async () => {
        await guardian
          .connect(admin)
          .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

        await losslessController
          .connect(lssAdmin)
          .setGuardian(guardian.address);

        await guardian
          .connect(lssAdmin)
          .verifyStrategies([
            treasuryProtectionStrategy.address,
            liquidityProtectionStrategy.address,
          ]);

        await treasuryProtectionStrategy
          .connect(guardianAdmin)
          .setGuardedList(
            erc20.address,
            [oneMoreAccount.address, initialHolder.address, admin.address],
            [10, 100, 0],
            [
              treasuryProtectionStrategy.address,
              treasuryProtectionStrategy.address,
              treasuryProtectionStrategy.address,
            ],
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

      describe('when limit is zero', async () => {
        it('should freeze', async () => {
          await erc20.connect(initialHolder).transfer(admin.address, 1);
          await erc20.connect(admin).transfer(recipient.address, 1);

          await expect(
            erc20.connect(recipient).transfer(anotherAccount.address, 1),
          ).to.be.revertedWith('LOSSLESS: sender is freezed');
        });
      });
    });

    describe('when limits are set', () => {
      beforeEach(async () => {
        await guardian
          .connect(admin)
          .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

        await losslessController
          .connect(lssAdmin)
          .setGuardian(guardian.address);

        await guardian
          .connect(lssAdmin)
          .verifyStrategies([
            treasuryProtectionStrategy.address,
            liquidityProtectionStrategy.address,
          ]);

        await treasuryProtectionStrategy
          .connect(guardianAdmin)
          .setGuardedList(
            erc20.address,
            [oneMoreAccount.address, initialHolder.address],
            [10000, 10000],
            [
              liquidityProtectionStrategy.address,
              liquidityProtectionStrategy.address,
            ],
          );

        await liquidityProtectionStrategy
          .connect(guardianAdmin)
          .addLimitsToGuard(
            erc20.address,
            [oneMoreAccount.address, initialHolder.address],
            [5, 10],
            [10, 15],
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
        it('should freeze', async () => {
          await erc20.connect(initialHolder).transfer(recipient.address, 4);
          await erc20.connect(initialHolder).transfer(recipient.address, 4);
          await erc20.connect(initialHolder).transfer(recipient.address, 4);

          await expect(
            erc20.connect(recipient).transfer(anotherAccount.address, 1),
          ).to.be.revertedWith('LOSSLESS: sender is freezed');
        });
      });

      describe('when transfering above second limit', async () => {
        it('should freeze', async () => {
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);

          await expect(
            erc20.connect(recipient).transfer(anotherAccount.address, 1),
          ).to.be.revertedWith('LOSSLESS: sender is freezed');
        });
      });

      describe('when limit is reset after some time', async () => {
        it('should not freeze', async () => {
          await erc20.connect(initialHolder).transfer(recipient.address, 9);
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(1)),
          ]);
          await erc20.connect(initialHolder).transfer(recipient.address, 9);

          await erc20.connect(recipient).transfer(anotherAccount.address, 1);
          expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(1);
        });
      });

      describe('when limit is reset after some time and reached again', async () => {
        it('should freeze', async () => {
          await erc20.connect(initialHolder).transfer(recipient.address, 9);
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(1)),
          ]);

          await erc20.connect(initialHolder).transfer(recipient.address, 9);
          await erc20.connect(initialHolder).transfer(recipient.address, 9);

          await expect(
            erc20.connect(recipient).transfer(anotherAccount.address, 1),
          ).to.be.revertedWith('LOSSLESS: sender is freezed');
        });
      });

      describe('when limit is reset after some time and second limit is reached again', async () => {
        it('should freeze', async () => {
          await erc20.connect(initialHolder).transfer(recipient.address, 9);
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(1)),
          ]);

          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);

          await expect(
            erc20.connect(recipient).transfer(anotherAccount.address, 1),
          ).to.be.revertedWith('LOSSLESS: sender is freezed');
        });
      });

      describe('when limit is reset two times', async () => {
        it('should suceed', async () => {
          await erc20.connect(initialHolder).transfer(recipient.address, 9);
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(1)),
          ]);

          await erc20.connect(initialHolder).transfer(recipient.address, 9);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(10)),
          ]);

          await erc20.connect(initialHolder).transfer(recipient.address, 2);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);

          await erc20.connect(recipient).transfer(anotherAccount.address, 1);
          expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(1);
        });
      });

      describe('when limit is reset two times and reached then', async () => {
        it('should suceed', async () => {
          await erc20.connect(initialHolder).transfer(recipient.address, 9);
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(1)),
          ]);

          await erc20.connect(initialHolder).transfer(recipient.address, 9);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(10)),
          ]);

          await erc20.connect(initialHolder).transfer(recipient.address, 9);
          await erc20.connect(initialHolder).transfer(recipient.address, 2);

          await expect(
            erc20.connect(recipient).transfer(anotherAccount.address, 1),
          ).to.be.revertedWith('LOSSLESS: sender is freezed');
        });
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

  describe('setGuardian', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert in treasuryProtectionStrategy', async () => {
        await expect(
          treasuryProtectionStrategy
            .connect(anotherAccount)
            .setGuardian(anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });

      it('should revert in liquidityProtectionStrategy', async () => {
        await expect(
          liquidityProtectionStrategy
            .connect(anotherAccount)
            .setGuardian(anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succeed in treasuryProtectionStrategy', async () => {
        await treasuryProtectionStrategy
          .connect(lssAdmin)
          .setGuardian(anotherAccount.address);

        expect(await treasuryProtectionStrategy.guardian()).to.be.equal(
          anotherAccount.address,
        );
      });

      it('should succeed in liquidityProtectionStrategy', async () => {
        await liquidityProtectionStrategy
          .connect(lssAdmin)
          .setGuardian(anotherAccount.address);

        expect(await liquidityProtectionStrategy.guardian()).to.be.equal(
          anotherAccount.address,
        );
      });
    });
  });

  describe('LiquidityProtectionStrategy.removeLimits', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([liquidityProtectionStrategy.address]);

      await liquidityProtectionStrategy
        .connect(guardianAdmin)
        .addLimitsToGuard(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [5, 10],
          [10, 15],
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

  describe('TreasuryProtectionStrategy.removeGuards', () => {
    beforeEach(async () => {
      await guardian
        .connect(admin)
        .setAdmins(erc20.address, guardianAdmin.address, refundAdmin.address);

      await losslessController.connect(lssAdmin).setGuardian(guardian.address);

      await guardian
        .connect(lssAdmin)
        .verifyStrategies([treasuryProtectionStrategy.address]);

      await treasuryProtectionStrategy
        .connect(guardianAdmin)
        .setGuardedList(
          erc20.address,
          [oneMoreAccount.address, initialHolder.address],
          [10000, 10000],
          [
            treasuryProtectionStrategy.address,
            treasuryProtectionStrategy.address,
          ],
        );
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          treasuryProtectionStrategy
            .connect(anotherAccount)
            .removeGuards(erc20.address, [
              oneMoreAccount.address,
              initialHolder.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: unauthorized');
      });
    });

    describe('when sender is admin', () => {
      it('should succeed', async () => {
        await treasuryProtectionStrategy
          .connect(guardianAdmin)
          .removeGuards(erc20.address, [
            oneMoreAccount.address,
            initialHolder.address,
          ]);

        await erc20.connect(initialHolder).transfer(recipient.address, 10001);
        await erc20.connect(recipient).transfer(anotherAccount.address, 10001);
        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(
          10001,
        );
      });
    });
  });
});
