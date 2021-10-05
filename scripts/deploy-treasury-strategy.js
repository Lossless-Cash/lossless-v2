async function main() {
  const TreasuryProtectionStrategy = await ethers.getContractFactory(
    'TreasuryProtectionStrategy',
  );

  const strategy = await TreasuryProtectionStrategy.deploy(
    '0xb561df98e00DF9Fa530848d7aA6beBa803a15DBD',
    '0x0E067b7217B54aeB822A4E934eB0e364A2A91465',
  );

  console.log(strategy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
