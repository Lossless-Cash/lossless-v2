async function main() {
  const LosslessGuardian = await ethers.getContractFactory('LosslessGuardian');

  const guardian = await LosslessGuardian.deploy(
    '0x3E5f2374e10B134C8D035a5081da06E0Ea3EC210',
  );

  console.log(guardian.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
