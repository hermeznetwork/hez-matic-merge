const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

const pathOutputJson = path.join(__dirname, "./deploy_output.json");

async function main() {
    const deployer = (await ethers.getSigners())[0].address;

    /*
        Parameters
    */
    const hezAddress = "0xEEF9f339514298C6A857EfCfC1A762aF84438dEE"
    const maticAddress = "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0"
    const governanceAddress = "0xee563F7B03dBfF86F7bD2E550763C5bBaEA89c34"
    const duration = 0;

    /*
        Deployment
    */
    console.log("\n#######################");
    console.log("##### Deployment #####");
    console.log("#######################");
    console.log("deployer:", deployer)
    console.log("hezAddress:", hezAddress)
    console.log("maticAddress:", maticAddress)
    console.log("governanceAddress:", governanceAddress)
    console.log("duration:", duration)

    const HezMaticMergeFactory = await ethers.getContractFactory("HezMaticMerge");
    const HezMaticMerge = await HezMaticMergeFactory.deploy(hezAddress, maticAddress, duration);
    await HezMaticMerge.deployed();

    console.log("#######################\n");
    console.log("HezMaticMerge deployed to:", HezMaticMerge.address);

    console.log("\n#######################");
    console.log("##### Transfer ownership #####");
    console.log("#######################");

    const txTransferOwnership = await HezMaticMerge.transferOwnership(governanceAddress)
    const receipt = await txTransferOwnership.wait();
    console.log("ownership transfered to the governance, txHash: ", receipt.transactionHash);

    console.log("\n#######################");
    console.log("#####    Checks    #####");
    console.log("#######################");

    console.log("hezAddress:", await HezMaticMerge.hez());
    console.log("maticAddress:", await HezMaticMerge.matic());
    console.log("SWAP_RATIO:", (await HezMaticMerge.SWAP_RATIO()).toNumber());

    const withdrawTimeout = (await HezMaticMerge.withdrawTimeout()).toNumber()
    console.log("withdrawTimeout:", withdrawTimeout);
    const currentTimestamp = (await ethers.provider.getBlock()).timestamp
    console.log("current timestamp:", currentTimestamp);
    console.log("duration", withdrawTimeout - currentTimestamp);
    console.log("owner", await HezMaticMerge.owner());

    const outputJson = {
        hezAddress: hezAddress,
        maticAddress: maticAddress,
        governanceAddress: governanceAddress,
        duration: duration,
        hezMaticMerge: HezMaticMerge.address
    };
    fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})