const supply = ethers.BigNumber.from(1000000).mul(
  ethers.BigNumber.from(10).pow(18),
);
async function main() {
  const LERC20 = await ethers.getContractFactory('LERC20');

  const erc20 = await LERC20.deploy(
    supply,
    'TEST4',
    'TEST4',
    '0x0299a45a955d0A0C0E3E1c6056abfd7357801F10',
    '0x0299a45a955d0A0C0E3E1c6056abfd7357801F10',
    86400,
    '0x0E067b7217B54aeB822A4E934eB0e364A2A91465',
  );

  //   erc20.transfer(0x0299a45a955d0A0C0E3E1c6056abfd7357801F10, supply);

  console.log('erc20 address', erc20.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
