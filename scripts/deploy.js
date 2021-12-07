async function main() {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const ADMIN_ADDRESS = '0x06F2075587fa961E4Bf7e9c01c5c8EFf69C52837';

  console.log('Deploying controllerV1...');

  const LosslessControllerV1 = await ethers.getContractFactory(
    'LosslessControllerV1',
  );

  const controllerV1 = await upgrades.deployProxy(LosslessControllerV1, [
    ADMIN_ADDRESS,
    ADMIN_ADDRESS,
    ADMIN_ADDRESS,
  ]);

  await controllerV1.deployed();

  console.log('deployed!');
  console.log('Transfering Admin to Proxy...');

  await upgrades.admin.transferProxyAdminOwnership(
    ADMIN_ADDRESS,
  );

  console.log('transfered!');
  console.log('Deploying controllerV2...');

  const LosslessControllerV2 = await ethers.getContractFactory(
    'LosslessControllerV2',
  );

  const controllerV2 = await upgrades.upgradeProxy(
    controllerV1.address,
    LosslessControllerV2,
  );

  console.log('deployed!');
  console.log('Deploying guardian...');

  const LosslessGuardian = await ethers.getContractFactory('LosslessGuardian');

  const guardian = await LosslessGuardian.deploy(
    controllerV2.address,
  );

  console.log('deployed!');
  console.log('Deploying Treasury Protection...');

  const TreasuryProtectionStrategy = await ethers.getContractFactory(
    'TreasuryProtectionStrategy',
  );

  const strategy = await TreasuryProtectionStrategy.deploy(
    guardian.address,
    controllerV2.address,
  );

  console.log('deployed!');
  console.log('Deploying singleLimit...');

  const LiquidityProtectionSingleLimitStrategy = await ethers.getContractFactory(
    'LiquidityProtectionSingleLimitStrategy',
  );

  const singeLimit = await LiquidityProtectionSingleLimitStrategy.deploy(
    guardian.address,
    controllerV2.address,
  );

  console.log('deployed!');
  console.log('All done!');

  console.log('Waiting 5 minutes to verify contracts...');
  await delay(5 * 60 * 1000);
  console.log('done!');
  console.log('Verifiying guardian...');
  await hre.run('verify:verify', {
    address: guardian.address,
    constructorArguments: [
      controllerV2.address,
    ],
  });
  console.log('verified!');
  console.log('Verifiying strategy...');
  await hre.run('verify:verify', {
    address: strategy.address,
    constructorArguments: [
      guardian.address,
      controllerV2.address,
    ],
  });
  console.log('verified!');
  console.log('Verifiying singleLimit...');
  await hre.run('verify:verify', {
    address: singeLimit.address,
    constructorArguments: [
      guardian.address,
      controllerV2.address,
    ],
  });
  console.log('verified!');

  console.log('ControllerV1:  %s', controllerV1.address);
  console.log('ControllerV2:  %s', controllerV2.address);
  console.log('Guardian:      %s', guardian.address);
  console.log('TreasuryStrat: %s', strategy.address);
  console.log('SingleLimit:   %s', singeLimit.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
