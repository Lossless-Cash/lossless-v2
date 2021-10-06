const supply = ethers.BigNumber.from(1000000).mul(
  ethers.BigNumber.from(10).pow(18),
);
async function main() {
  const LERC20 = await ethers.getContractFactory('LERC20');

  const erc20 = await LERC20.deploy(
    supply,
    'Token1',
    'T1',
    '0xE87102C851C47dd4c6Ce2a0AB10a6D23E4380ce7',
    '0xE87102C851C47dd4c6Ce2a0AB10a6D23E4380ce7',
    86400,
    '0x3E5f2374e10B134C8D035a5081da06E0Ea3EC210',
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
