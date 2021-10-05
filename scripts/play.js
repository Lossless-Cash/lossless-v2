const supply = ethers.BigNumber.from(1000000).mul(
  ethers.BigNumber.from(10).pow(18),
);

async function main() {
  const LosslessControllerV2 = await ethers.getContractFactory(
    'LosslessControllerV2',
  );
  const controller = await LosslessControllerV2.attach(
    '0x0E067b7217B54aeB822A4E934eB0e364A2A91465',
  );

  const LosslessGuardian = await ethers.getContractFactory('LosslessGuardian');
  const guardian = await LosslessGuardian.attach(
    '0xb561df98e00DF9Fa530848d7aA6beBa803a15DBD',
  );

  const LERC20 = await ethers.getContractFactory('LERC20');
  const token3 = await LERC20.attach(
    '0x48e02f740b0e47e5fa308f57a3b288dd677c826e',
  );
  const token2 = await LERC20.attach(
    '0x320b52291a56d4f219e37c828ec4f090197a62d8',
  );

  const LiquidityProtectionMultipleLimitsStrategy = await ethers.getContractFactory(
    'LiquidityProtectionMultipleLimitsStrategy',
  );
  const liquidityProtectionMultipleLimitsStrategy = await LiquidityProtectionMultipleLimitsStrategy.attach(
    '0x3E1f2DF8846C799ee605a1C7D9FBF8291B036Ad9',
  );

  const LiquidityProtectionSingleLimitStrategy = await ethers.getContractFactory(
    'LiquidityProtectionSingleLimitStrategy',
  );
  const liquidityProtectionSingleLimitStrategy = await LiquidityProtectionSingleLimitStrategy.attach(
    '0xe78b09814d4fF2F9deE1a9577C4498e4c5246882',
  );

  const TreasuryProtectionStrategy = await ethers.getContractFactory(
    'TreasuryProtectionStrategy',
  );
  const treasuryProtectionStrategy = await TreasuryProtectionStrategy.attach(
    '0x8F478975E605219909159bFd27C636c8f396FDee',
  );

  //   await controller.setGuardian('0xb561df98e00DF9Fa530848d7aA6beBa803a15DBD');

  //   await guardian.verifyStrategies(
  //     [
  //       '0x8F478975E605219909159bFd27C636c8f396FDee',
  //       '0xe78b09814d4fF2F9deE1a9577C4498e4c5246882',
  //       '0x3E1f2DF8846C799ee605a1C7D9FBF8291B036Ad9',
  //     ],
  //     true,
  //   );

  //   console.log(
  //     await guardian.verifiedStrategies(
  //       '0x3E1f2DF8846C799ee605a1C7D9FBF8291B036Ad9',
  //     ),
  //   );

  // await guardian.verifyToken(
  //   '0x320b52291a56d4f219e37c828ec4f090197a62d8',
  //   true,
  // );

  //   console.log(
  //     await guardian.verifiedTokens('0x48e02f740b0e47e5fa308f57a3b288dd677c826e'),
  //   );

  // await guardian.setProtectionAdmin(
  //   '0x320b52291a56d4f219e37c828ec4f090197a62d8',
  //   '0x0299a45a955d0A0C0E3E1c6056abfd7357801F10',
  // );

  // await guardian.verifyAddress(
  //   '0x320b52291a56d4f219e37c828ec4f090197a62d8',
  //   '0xE2a7fB53dba7609e4A9F93434E6ef84C34dBE9d5',
  //   true,
  // );

  //   await treasuryProtectionStrategy.setProtectedAddress(
  //     '0x2852e4a89913864ea7dfcfad233567d0cd1d154f',
  //     '0x4f7cf3eA75454d3867DAF674617aE95086C9Ed33',
  //     [
  //       '0x2C2C1c1C6c90EA6faFb8115b6873d3B582f47441',
  //       '0x47F2152e108cF5f0Efba9107D6d6133368167c83',
  //     ],
  //   );

  //   await treasuryProtectionStrategy.removeProtectedAddresses(
  //     '0x48e02f740b0e47e5fa308f57a3b288dd677c826e',
  //     ['0x4f7cf3eA75454d3867DAF674617aE95086C9Ed33'],
  //   );

  //   console.log(
  //     await controller.isAddressProtected(
  //       '0x48e02f740b0e47e5fa308f57a3b288dd677c826e',
  //       '0x4f7cf3eA75454d3867DAF674617aE95086C9Ed33',
  //     ),
  //   );

  //   await token3.approve('0x99dA0418E1A5B93C5a1693609E6F28fcD26F6D3d', supply);
  // await token2.approve('0xE2a7fB53dba7609e4A9F93434E6ef84C34dBE9d5', supply);

  await liquidityProtectionMultipleLimitsStrategy.setLimits(
    '0x320b52291a56d4f219e37c828ec4f090197a62d8',
    '0xE2a7fB53dba7609e4A9F93434E6ef84C34dBE9d5',
    [100, 50],
    [
      ethers.BigNumber.from(900).mul(ethers.BigNumber.from(10).pow(18)),
      ethers.BigNumber.from(500).mul(ethers.BigNumber.from(10).pow(18)),
    ],
    [11168000, 11168000],
  );

  // console.log(
  //   (
  //     await liquidityProtectionSingleLimitStrategy.getLimit(
  //       '0x48e02f740b0e47e5fa308f57a3b288dd677c826e',
  //       '0x99dA0418E1A5B93C5a1693609E6F28fcD26F6D3d',
  //     )
  //   )[3].toString(),
  // );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
