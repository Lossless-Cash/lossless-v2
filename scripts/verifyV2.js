async function main() {
  await hre.run('verify:verify', {
    address: '0x32816569EB6A63A56c7CD9eca1b0Fe8Eb2Fa8752',
    constructorArguments: [],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
