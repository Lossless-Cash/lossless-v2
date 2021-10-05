async function main() {
  const LosslessControllerV1 = await ethers.getContractFactory(
    'LosslessControllerV1',
  );

  console.log('deploying controller');

  let instance;
  while (!instance) {
    try {
      instance = await upgrades.deployProxy(LosslessControllerV1, [
        '0x0299a45a955d0A0C0E3E1c6056abfd7357801F10',
        '0x0299a45a955d0A0C0E3E1c6056abfd7357801F10',
        '0x0299a45a955d0A0C0E3E1c6056abfd7357801F10',
      ]);
    } catch (e) {
      console.log('Ignoring error', e);
    }
  }

  await instance.deployed();

  console.log('controller deployed, updating admin');

  await upgrades.admin.transferProxyAdminOwnership(
    '0x0299a45a955d0A0C0E3E1c6056abfd7357801F10',
  );

  console.log(instance.address);

  const LERC20 = await ethers.getContractFactory('LERC20');

  //   const erc20 = await LERC20.deploy(
  //     ethers.BigNumber.from(100).mul(ethers.BigNumber.from(10).pow(18)),
  //     'TEST1',
  //     'TEST1',
  //     '0x0299a45a955d0A0C0E3E1c6056abfd7357801F10',
  //     '0x0299a45a955d0A0C0E3E1c6056abfd7357801F10',
  //     86400,
  //     instance.address,
  //   );

  //   console.log('erc20 address', erc20.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
