async function main() {
  const LosslessControllerV2 = await ethers.getContractFactory(
    'LosslessControllerV2',
  );
  const upgraded = await upgrades.upgradeProxy(
    '0x0E067b7217B54aeB822A4E934eB0e364A2A91465',
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
