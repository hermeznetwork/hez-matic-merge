const { ethers, upgrades } = require("hardhat");

async function main() {
    const deployer = (await ethers.getSigners())[0].address;
    /*
        Parameters
    */
    const tokenAAddress = "0xDa007777D86AC6d989cC9f79A73261b3fC5e0DA0"
    const tokenBAddress = "0xDa007777D86AC6d989cC9f79A73261b3fC5e0DA0"
    const governanceAddress = "0xDa007777D86AC6d989cC9f79A73261b3fC5e0DA0"
    const duration = 7776000;  // 90 days * 24 hours * 3600 seconds = 7776000
    /*
        Deployment
    */
    console.log("\n#######################");
    console.log("##### Deployment #####");
    console.log("#######################");
    console.log("deployer:", deployer)
    console.log("tokenAAddress:", tokenAAddress)
    console.log("tokenBAddress:", tokenBAddress)
    console.log("governanceAddress:", governanceAddress)
    console.log("duration:", duration)

    const TokenBridgeFactory = await ethers.getContractFactory("TokenBridge");
    const TokenBridge = await TokenBridgeFactory.deploy(tokenAAddress, tokenBAddress, governanceAddress, duration);
    await TokenBridge.deployed();

    console.log("#######################\n");
    console.log("TokenBridge deployed to:", TokenBridge.address);

    console.log("\n#######################");
    console.log("#####    Checks    #####");
    console.log("#######################");

    console.log("tokenAAddress:",  await TokenBridge.tokenA());
    console.log("tokenBAddress:",  await TokenBridge.tokenB());
    console.log("governanceAddress:",  await TokenBridge.governance());
    console.log("BRIDGE_RATIO:",  (await TokenBridge.BRIDGE_RATIO()).toNumber());

    console.log("withdrawTimeout:",  await TokenBridge.withdrawTimeout());
    console.log("current timestamp:",  (await ethers.provider.getBlock()).timestamp);
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})