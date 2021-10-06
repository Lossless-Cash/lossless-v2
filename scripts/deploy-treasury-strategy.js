async function main() {
  const TreasuryProtectionStrategy = await ethers.getContractFactory(
    'TreasuryProtectionStrategy',
  );

  const strategy = await TreasuryProtectionStrategy.deploy(
    '0xa71F756B42905c3F1d87a9F54656496052795F7a',
    '0x3E5f2374e10B134C8D035a5081da06E0Ea3EC210',
  );

  console.log(strategy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
