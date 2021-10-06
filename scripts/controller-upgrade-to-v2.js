async function main() {
  const LosslessControllerV2 = await ethers.getContractFactory(
    'LosslessControllerV2',
  );
  const upgraded = await upgrades.upgradeProxy(
    '0x3E5f2374e10B134C8D035a5081da06E0Ea3EC210',
    LosslessControllerV2,
  );

  console.log(upgraded);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
