async function main() {
  const LosslessGuardian = await ethers.getContractFactory('LosslessGuardian');

  const guardian = await LosslessGuardian.deploy(
    '0x0E067b7217B54aeB822A4E934eB0e364A2A91465',
  );

  console.log(guardian.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
