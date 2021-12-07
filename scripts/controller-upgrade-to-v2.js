async function main() {
  const LosslessControllerV2 = await ethers.getContractFactory(
    'LosslessControllerV2',
  );
  const upgraded = await upgrades.upgradeProxy(
    '0x128A877E54e1a2B23562E289029A0FfA77722f74',
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
