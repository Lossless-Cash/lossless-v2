/* eslint-disable arrow-body-style */
/* eslint-disable no-await-in-loop */
const { time } = require('@openzeppelin/test-helpers');

const tokens = [
  {
    name: 'My Token',
    symbol: 'MTKN',
    initialSupply: 1000000,
  },
  {
    name: 'My Token',
    symbol: 'MTKN',
    initialSupply: 1000000,
  },
  {
    name: 'My Token',
    symbol: 'MTKN',
    initialSupply: 1000000,
  },
];

const setupControllerAndTokens = async () => {
  const [
    initialHolder,
    anotherAccount,
    admin,
    lssAdmin,
    lssRecoveryAdmin,
    pauseAdmin,
    adminBackup,
    guardianAdmin,
    oneMoreAccount,
    recipient,
  ] = await ethers.getSigners();

  const LosslessController = await ethers.getContractFactory(
    'LosslessControllerV1',
  );

  const LosslessControllerV2 = await ethers.getContractFactory(
    'LosslessControllerV2',
  );

  const losslessControllerV1 = await upgrades.deployProxy(LosslessController, [
    lssAdmin.address,
    lssRecoveryAdmin.address,
    pauseAdmin.address,
  ]);

  const losslessController = await upgrades.upgradeProxy(
    losslessControllerV1.address,
    LosslessControllerV2,
  );

  const LERC20 = await ethers.getContractFactory('LERC20');
  const erc20s = await Promise.all(
    tokens.map(async (token) => {
      return LERC20.connect(initialHolder).deploy(
        token.initialSupply,
        token.name,
        token.symbol,
        admin.address,
        adminBackup.address,
        Number(time.duration.days(1)),
        losslessController.address,
      );
    }),
  );

  return {
    guardianAdmin,
    initialHolder,
    anotherAccount,
    admin,
    lssAdmin,
    lssRecoveryAdmin,
    pauseAdmin,
    adminBackup,
    erc20s,
    losslessController,
    oneMoreAccount,
    recipient,
  };
};

const deployProtection = async (losslessController) => {
  const LosslessGuardian = await ethers.getContractFactory('LosslessGuardian');
  const guardian = await LosslessGuardian.deploy(losslessController.address);

  const LiquidityProtectionStrategy = await ethers.getContractFactory(
    'LiquidityProtectionStrategy',
  );
  const liquidityProtectionStrategy = await LiquidityProtectionStrategy.deploy(
    guardian.address,
    losslessController.address,
  );

  const TreasuryProtectionStrategy = await ethers.getContractFactory(
    'TreasuryProtectionStrategy',
  );
  const treasuryProtectionStrategy = await TreasuryProtectionStrategy.deploy(
    guardian.address,
    losslessController.address,
  );

  return { guardian, liquidityProtectionStrategy, treasuryProtectionStrategy };
};

async function mineBlocks(count) {
  for (let i = 0; i < count; i += 1) {
    await ethers.provider.send('evm_mine');
  }
}

module.exports = {
  setupControllerAndTokens,
  deployProtection,
  tokens,
  mineBlocks,
};
