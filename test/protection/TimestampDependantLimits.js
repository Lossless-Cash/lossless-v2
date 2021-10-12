const { expect } = require('chai');
const {
  setupControllerAndTokens,
  deployProtection,
  mineBlocks,
} = require('../utils');

const { time } = require('@openzeppelin/test-helpers');

let vars;
let protection;

describe('LiquidityProtectionMultipleLimitsStrategy', () => {
    beforeEach(async () => {
      vars = await setupControllerAndTokens();
      protection = await deployProtection(vars.losslessController);
    });

    describe('LERC20.transfer', () => {
        beforeEach(async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyToken(vars.erc20s[0].address, true);
          await protection.guardian
            .connect(vars.admin)
            .setProtectionAdmin(vars.erc20s[0].address, vars.guardianAdmin.address);
    
          await vars.losslessController
            .connect(vars.lssAdmin)
            .setGuardian(protection.guardian.address);
    
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyStrategies(
              [protection.liquidityProtectionMultipleLimitsStrategy.address],
              true,
            );
    
          const timestampBefore = await ethers.provider.getBlock();
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              true,
            );
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              true,
            );
          await protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.guardianAdmin)
            .setLimitsBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [300, 600],
              [10, 15],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            );
        });
    
        describe('when transfering below limit', async () => {
          it('should not freeze', async () => {
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 1);
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 1);
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 1);
            await vars.erc20s[0]
              .connect(vars.recipient)
              .transfer(vars.anotherAccount.address, 3);
            expect(
              await vars.erc20s[0].balanceOf(vars.anotherAccount.address),
            ).to.be.equal(3);
          });
        });
    
        describe('when transfering above first limit', async () => {
          it('should revert', async () => {
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 4);
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 4);
            await expect(
              vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 3),
            ).to.be.revertedWith('LOSSLESS: limit reached');
          });
        });

        describe('when limit gets reset', async () => {
            it('should revert', async () => {
              await vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 4);
              await vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 4);
              await expect(
                vars.erc20s[0]
                  .connect(vars.initialHolder)
                  .transfer(vars.recipient.address, 3),
              ).to.be.revertedWith('LOSSLESS: limit reached');

              await ethers.provider.send('evm_increaseTime', [
                Number(time.duration.seconds(600)),
              ]);

              console.log('Both periods Resets')
              await expect(
                vars.erc20s[0]
                  .connect(vars.initialHolder)
                  .transfer(vars.recipient.address, 3),
              ).to.not.be.reverted;

              await expect(
                vars.erc20s[0]
                  .connect(vars.initialHolder)
                  .transfer(vars.recipient.address, 10),
              ).to.not.be.reverted;

              await expect(
                vars.erc20s[0]
                  .connect(vars.initialHolder)
                  .transfer(vars.recipient.address, 7),
              ).to.be.revertedWith('LOSSLESS: limit reached');

            });
          });
    });
});

describe.only('LiquidityProtectionSingleLimitStrategy', () => {
    beforeEach(async () => {
      vars = await setupControllerAndTokens();
      protection = await deployProtection(vars.losslessController);
    });
    describe('LERC20.transfer', () => {
        beforeEach(async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyToken(vars.erc20s[0].address, true);
    
          await protection.guardian
            .connect(vars.admin)
            .setProtectionAdmin(vars.erc20s[0].address, vars.guardianAdmin.address);
          await vars.losslessController
            .connect(vars.lssAdmin)
            .setGuardian(protection.guardian.address);
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyStrategies(
              [protection.liquidityProtectionSingleLimitStrategy.address],
              true,
            );
    
          const timeNumBefore = await ethers.provider.getBlock();
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              true,
            );
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              true,
            );
          await protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.guardianAdmin)
            .setLimitBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              300,
              10,
              timeNumBefore.timestamp + 2,
            );
        });
    
        describe('when transfering below limit', async () => {
          it('should not freeze', async () => {
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 1);
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 1);
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 1);
            await vars.erc20s[0]
              .connect(vars.recipient)
              .transfer(vars.anotherAccount.address, 3);
            expect(
              await vars.erc20s[0].balanceOf(vars.anotherAccount.address),
            ).to.be.equal(3);
          });
        });
    
        describe('when transfering above limit', async () => {
          it('should revert', async () => {
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 4);
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 4);
            await expect(
              vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 3),
            ).to.be.revertedWith('LOSSLESS: limit reached');
          });
        });

        describe('when transfering the exact limit', async () => {
            it('should revert', async () => {
              await vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 4);
              await vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 4);
              await expect(
                vars.erc20s[0]
                  .connect(vars.initialHolder)
                  .transfer(vars.recipient.address, 2),
              ).to.not.be.reverted;
            });
          });

          describe('when transfering limit resets', async () => {
            it('should revert', async () => {
              await vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 4);
              await vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 4);
              await expect(
                vars.erc20s[0]
                  .connect(vars.initialHolder)
                  .transfer(vars.recipient.address, 3),
              ).to.be.revertedWith('LOSSLESS: limit reached');

              await ethers.provider.send('evm_increaseTime', [
                Number(time.duration.seconds(303)),
              ]);
              await expect(
                vars.erc20s[0]
                  .connect(vars.initialHolder)
                  .transfer(vars.recipient.address, 10),
              ).to.not.be.reverted

              await expect(
                vars.erc20s[0]
                  .connect(vars.initialHolder)
                  .transfer(vars.recipient.address, 2),
              ).to.be.revertedWith('LOSSLESS: limit reached');

            });
          });
    });    
});