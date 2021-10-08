const supply = ethers.BigNumber.from(1000000).mul(
  ethers.BigNumber.from(10).pow(18),
);

async function main() {
  const LosslessControllerV2 = await ethers.getContractFactory(
    'LosslessControllerV2',
  );
  const controller = await LosslessControllerV2.attach(
    '0x3E5f2374e10B134C8D035a5081da06E0Ea3EC210',
  );
  const LosslessGuardian = await ethers.getContractFactory('LosslessGuardian');
  const guardian = await LosslessGuardian.attach(
    '0xa71F756B42905c3F1d87a9F54656496052795F7a',
  );

  const LERC20 = await ethers.getContractFactory('LERC20');
  const token1 = await LERC20.attach(
    '0xc2D1251312B184119594B836F59088F6B147697D',
  );

  // const LiquidityProtectionMultipleLimitsStrategy = await ethers.getContractFactory(
  //   'LiquidityProtectionMultipleLimitsStrategy',
  // );
  // const liquidityProtectionMultipleLimitsStrategy = await LiquidityProtectionMultipleLimitsStrategy.attach(
  //   '0x3E1f2DF8846C799ee605a1C7D9FBF8291B036Ad9',
  // );

  // const LiquidityProtectionSingleLimitStrategy = await ethers.getContractFactory(
  //   'LiquidityProtectionSingleLimitStrategy',
  // );
  // const liquidityProtectionSingleLimitStrategy = await LiquidityProtectionSingleLimitStrategy.attach(
  //   '0xe78b09814d4fF2F9deE1a9577C4498e4c5246882',
  // );

  const TreasuryProtectionStrategy = await ethers.getContractFactory(
    'TreasuryProtectionStrategy',
  );
  const treasuryProtectionStrategy = await TreasuryProtectionStrategy.attach(
    '0xc907025a66699da56734a78368c854731628c2ed',
  );

  // await treasuryProtectionStrategy.setProtectedAddress(
  //   '0xc2D1251312B184119594B836F59088F6B147697D',
  //   '0xc907025a66699da56734a78368c854731628c2ed',
  //   [
  //     '0xc907025a66699da56734a78368c854731628c2ed',
  //     '0xc907025a66699da56734a78368c854731628c2ed',
  //     '0xc907025a66699da56734a78368c854731628c2ed',
  //   ],
  // );

  // console.log(await treasuryProtectionStrategy.guardian());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
