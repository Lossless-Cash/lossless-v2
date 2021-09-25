const { expect } = require('chai');
const { setupControllerAndTokens, deployProtection } = require('../utils');

let vars;
let protection;

describe('LosslessGuardian', () => {
  beforeEach(async () => {
    vars = await setupControllerAndTokens();
    protection = await deployProtection(vars.losslessController);
  });

  describe('setProtectionAdmin', () => {
    describe('when token is not verified', () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.anotherAccount)
            .setProtectionAdmin(
              vars.erc20s[0].address,
              vars.guardianAdmin.address,
            ),
        ).to.be.revertedWith('LOSSLESS: token not verified');
      });
    });

    describe('when sender is not token admin', () => {
      it('should revert', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[0].address);

        await expect(
          protection.guardian
            .connect(vars.anotherAccount)
            .setProtectionAdmin(
              vars.erc20s[0].address,
              vars.guardianAdmin.address,
            ),
        ).to.be.revertedWith('LOSSLESS: not token admin');
      });
    });

    describe('when sender is token admin', () => {
      beforeEach(async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[0].address);
      });

      it('should succeed', async () => {
        await protection.guardian
          .connect(vars.admin)
          .setProtectionAdmin(
            vars.erc20s[0].address,
            vars.guardianAdmin.address,
          );

        expect(
          await protection.guardian.protectionAdmin(vars.erc20s[0].address),
        ).to.be.equal(vars.guardianAdmin.address);
      });

      it('should succeed', async () => {
        await expect(
          protection.guardian
            .connect(vars.admin)
            .setProtectionAdmin(
              vars.erc20s[0].address,
              vars.guardianAdmin.address,
            ),
        )
          .to.emit(protection.guardian, 'ProtectionAdminSet')
          .withArgs(vars.erc20s[0].address, vars.guardianAdmin.address);
      });
    });
  });

  describe('verifyStrategies', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.guardianAdmin)
            .verifyStrategies([
              protection.treasuryProtectionStrategy.address,
              protection.liquidityProtectionStrategy.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: not lossless admin');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succedd', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyStrategies([
            protection.treasuryProtectionStrategy.address,
            protection.liquidityProtectionStrategy.address,
          ]);

        expect(
          await protection.guardian.verifiedStrategies(
            protection.treasuryProtectionStrategy.address,
          ),
        ).to.be.equal(true);
        expect(
          await protection.guardian.verifiedStrategies(
            protection.liquidityProtectionStrategy.address,
          ),
        ).to.be.equal(true);
      });

      it('should emit StrategyVerified events', async () => {
        await expect(
          protection.guardian
            .connect(vars.lssAdmin)
            .verifyStrategies([
              protection.treasuryProtectionStrategy.address,
              protection.liquidityProtectionStrategy.address,
            ]),
        )
          .to.emit(protection.guardian, 'StrategyVerified')
          .withArgs(protection.treasuryProtectionStrategy.address);

        await expect(
          protection.guardian
            .connect(vars.lssAdmin)
            .verifyStrategies([
              protection.treasuryProtectionStrategy.address,
              protection.liquidityProtectionStrategy.address,
            ]),
        )
          .to.emit(protection.guardian, 'StrategyVerified')
          .withArgs(protection.liquidityProtectionStrategy.address);
      });

      describe('when sending empty array', () => {
        it('should succedd', async () => {
          await protection.guardian.connect(vars.lssAdmin).verifyStrategies([]);

          expect(
            await protection.guardian.verifiedStrategies(
              protection.treasuryProtectionStrategy.address,
            ),
          ).to.be.equal(false);
          expect(
            await protection.guardian.verifiedStrategies(
              protection.liquidityProtectionStrategy.address,
              [],
            ),
          ).to.be.equal(false);
        });
      });
    });
  });

  describe('removeStrategies', () => {
    beforeEach(async () => {
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies([
          protection.treasuryProtectionStrategy.address,
          protection.liquidityProtectionStrategy.address,
        ]);
    });

    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.guardianAdmin)
            .removeStrategies([
              protection.treasuryProtectionStrategy.address,
              protection.liquidityProtectionStrategy.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: not lossless admin');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succedd', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .removeStrategies([
            protection.treasuryProtectionStrategy.address,
            protection.liquidityProtectionStrategy.address,
          ]);

        expect(
          await protection.guardian.verifiedStrategies(
            protection.treasuryProtectionStrategy.address,
          ),
        ).to.be.equal(false);
        expect(
          await protection.guardian.verifiedStrategies(
            protection.liquidityProtectionStrategy.address,
          ),
        ).to.be.equal(false);
      });

      it('should emit StrategyRemoved events', async () => {
        await expect(
          protection.guardian
            .connect(vars.lssAdmin)
            .removeStrategies([
              protection.treasuryProtectionStrategy.address,
              protection.liquidityProtectionStrategy.address,
            ]),
        )
          .to.emit(protection.guardian, 'StrategyRemoved')
          .withArgs(protection.treasuryProtectionStrategy.address);

        await expect(
          protection.guardian
            .connect(vars.lssAdmin)
            .removeStrategies([
              protection.treasuryProtectionStrategy.address,
              protection.liquidityProtectionStrategy.address,
            ]),
        )
          .to.emit(protection.guardian, 'StrategyRemoved')
          .withArgs(protection.liquidityProtectionStrategy.address);
      });

      describe('when sending empty array', () => {
        it('should succedd', async () => {
          await protection.guardian.connect(vars.lssAdmin).removeStrategies([]);

          expect(
            await protection.guardian.verifiedStrategies(
              protection.treasuryProtectionStrategy.address,
            ),
          ).to.be.equal(true);
          expect(
            await protection.guardian.verifiedStrategies(
              protection.liquidityProtectionStrategy.address,
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
          protection.guardian
            .connect(vars.guardianAdmin)
            .verifyToken(vars.erc20s[0].address),
        ).to.be.revertedWith('LOSSLESS: not lossless admin');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should suceed', async () => {
        expect(
          await protection.guardian.verifiedTokens(vars.erc20s[0].address),
        ).to.be.equal(false);
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[0].address);

        expect(
          await protection.guardian.verifiedTokens(vars.erc20s[0].address),
        ).to.be.equal(true);
      });

      it('should emit TokenVerified event', async () => {
        await expect(
          protection.guardian
            .connect(vars.lssAdmin)
            .verifyToken(vars.erc20s[0].address),
        )
          .to.emit(protection.guardian, 'TokenVerified')
          .withArgs(vars.erc20s[0].address);
      });
    });
  });

  describe('removeVerifiedToken', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.guardianAdmin)
            .removeVerifiedToken(vars.erc20s[0].address),
        ).to.be.revertedWith('LOSSLESS: not lossless admin');
      });
    });

    describe('when sender is lossless admin', () => {
      before(async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[0].address);
      });

      it('should succedd', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .removeVerifiedToken(vars.erc20s[0].address);
        expect(
          await protection.guardian.verifiedTokens(vars.erc20s[0].address),
        ).to.be.equal(false);
      });

      it('should emit TokenVerificationRemoved event', async () => {
        await expect(
          protection.guardian
            .connect(vars.lssAdmin)
            .removeVerifiedToken(vars.erc20s[0].address),
        )
          .to.emit(protection.guardian, 'TokenVerificationRemoved')
          .withArgs(vars.erc20s[0].address);
      });
    });
  });

  describe('verifyAddress', () => {
    describe('when sender is not lossless admin', async () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.anotherAccount)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              true,
            ),
        ).to.be.revertedWith('LOSSLESS: not lossless admin');
      });
    });

    describe('when sender is lossless admin', async () => {
      describe('when address is not verifed yet', () => {
        it('should set to true', async () => {
          expect(
            await protection.guardian.isAddressVerified(
              vars.erc20s[0].address,
              vars.initialHolder.address,
            ),
          ).to.be.equal(false);

          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              true,
            );

          expect(
            await protection.guardian.isAddressVerified(
              vars.erc20s[0].address,
              vars.initialHolder.address,
            ),
          ).to.be.equal(true);
        });

        it('should emit AddressVerified event', async () => {
          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyAddress(
                vars.erc20s[0].address,
                vars.initialHolder.address,
                true,
              ),
          )
            .to.emit(protection.guardian, 'AddressVerified')
            .withArgs(vars.erc20s[0].address, vars.initialHolder.address, true);
        });
      });

      describe('when address already verified', () => {
        beforeEach(async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              false,
            );
        });

        it('should set to false', async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              false,
            );

          expect(
            await protection.guardian.isAddressVerified(
              vars.erc20s[0].address,
              vars.initialHolder.address,
            ),
          ).to.be.equal(false);
        });

        it('should emit AddressVerified event', async () => {
          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyAddress(
                vars.erc20s[0].address,
                vars.initialHolder.address,
                false,
              ),
          )
            .to.emit(protection.guardian, 'AddressVerified')
            .withArgs(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              false,
            );
        });
      });
    });

    describe('when sender is lossless admin', async () => {
      it('should set to true', async () => {
        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            true,
          );

        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);
      });

      it('should not set to true on other tokens', async () => {
        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[1].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            true,
          );

        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[1].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);
      });
    });
  });

  describe('setProtectedAddress', () => {
    describe('when sender is not verified strategy', () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
              protection.treasuryProtectionStrategy.address,
            ),
        ).to.be.revertedWith('LOSSLESS: strategy not verified');
      });
    });

    describe('when sender is verified strategy', () => {
      beforeEach(async () => {
        await vars.losslessController
          .connect(vars.lssAdmin)
          .setGuardian(protection.guardian.address);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyStrategies([vars.anotherAccount.address]);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
            true,
          );
      });

      describe('when address is not verified', () => {
        it('should revert', async () => {
          await expect(
            protection.guardian
              .connect(vars.anotherAccount)
              .setProtectedAddress(
                vars.erc20s[0].address,
                vars.oneMoreAccount.address,
                protection.treasuryProtectionStrategy.address,
              ),
          ).to.be.revertedWith('LOSSLESS: address not verified');
        });
      });

      describe('when address is verified', () => {
        it('should suceed', async () => {
          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);

          await protection.guardian
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
              protection.treasuryProtectionStrategy.address,
            );

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(true);
        });

        it('should not affect other tokens', async () => {
          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[2].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);

          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[1].address,
              vars.anotherAccount.address,
              true,
            );
          await protection.guardian
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[1].address,
              vars.anotherAccount.address,
              protection.treasuryProtectionStrategy.address,
            );

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[2].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);
        });
      });
    });
  });

  describe('removeProtectedAddresses', () => {
    beforeEach(async () => {
      await vars.losslessController
        .connect(vars.lssAdmin)
        .setGuardian(protection.guardian.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies([vars.anotherAccount.address]);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.anotherAccount.address,
          true,
        );

      await protection.guardian
        .connect(vars.anotherAccount)
        .setProtectedAddress(
          vars.erc20s[0].address,
          vars.anotherAccount.address,
          protection.treasuryProtectionStrategy.address,
        );
    });

    describe('when sender is not verified strategy', () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.oneMoreAccount)
            .removeProtectedAddresses(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
        ).to.be.revertedWith('LOSSLESS: strategy not verified');
      });
    });

    describe('when sender is verified strategy', () => {
      it('should succeed', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        await protection.guardian
          .connect(vars.anotherAccount)
          .removeProtectedAddresses(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(false);
      });

      it('should not affect other tokens', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
            true,
          );

        await protection.guardian
          .connect(vars.anotherAccount)
          .setProtectedAddress(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
            protection.treasuryProtectionStrategy.address,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        await protection.guardian
          .connect(vars.anotherAccount)
          .removeProtectedAddresses(
            vars.erc20s[1].address,
            vars.anotherAccount.address,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);
      });
    });
  });
});
