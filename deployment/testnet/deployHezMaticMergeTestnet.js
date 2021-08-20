const { ethers, upgrades } = require("hardhat");
const path = require("path");
const fs = require("fs");
const pathOutputJson = path.join(__dirname, "./deploy_output.json");

const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);

async function main() {
    const deployer = (await ethers.getSigners())[0].address;

    /*
        Parameters MATIC
    */
    const maticToken = deployParameters.maticToken
    const maticTokenName = maticToken.name;
    const maticTokenSymbol = maticToken.symbol;
    const maticTokenInitialBalance = ethers.utils.parseEther(maticToken.initialAmount.toString());

    /*
        Deployment MATIC
    */
    const CustomERC20Factory = await ethers.getContractFactory("ERC20PermitMock");

    maticTokenContract = await CustomERC20Factory.deploy(
        maticTokenName,
        maticTokenSymbol,
        deployer,
        maticTokenInitialBalance
    );

    /*
        Parameters Bridge
    */
    const hezTokenAddress = deployParameters.hezTokenAddress;
    const maticTokenAddress = maticTokenContract.address;
    const governanceAddress = deployer;
    const duration = 7776000;  // 90 days * 24 hours * 3600 seconds = 7776000

    console.log("\n#######################");
    console.log("##### Deployment #####");
    console.log("#######################");
    console.log("deployer:", deployer)
    console.log("hezTokenAddress:", hezTokenAddress)
    console.log("maticTokenAddress:", maticTokenAddress)
    console.log("governanceAddress:", governanceAddress)
    console.log("duration:", duration)

    const HezMaticMergeFactory = await ethers.getContractFactory("HezMaticMerge");
    const HezMaticMerge = await HezMaticMergeFactory.deploy(hezTokenAddress, maticTokenAddress, duration);
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

    console.log("hezTokenAddress:", await HezMaticMerge.hez());
    console.log("maticTokenAddress:", await HezMaticMerge.matic());
    console.log("SWAP_RATIO:", (await HezMaticMerge.SWAP_RATIO()).toNumber());
    console.log("withdrawTimeout:", (await HezMaticMerge.withdrawTimeout()).toNumber());
    console.log("current timestamp:", (await ethers.provider.getBlock()).timestamp);
    console.log("owner", await HezMaticMerge.owner());

    console.log("\n#######################");
    console.log("#####   Send MATIC tokens to HezMaticMerge #####");
    console.log("#######################");

    const txTransferTokens = await maticTokenContract.transfer(HezMaticMerge.address, maticTokenInitialBalance);
    await txTransferTokens.wait();
    console.log("MATIC balance of HezMaticMerge contract: ", ethers.utils.formatEther(await maticTokenContract.balanceOf(HezMaticMerge.address)));

    const outputJson = {
        hezTokenAddress: hezTokenAddress,
        maticTokenAddress: maticTokenAddress,
        governanceAddress: deployer,
        duration: duration,
        hezMaticMerge: HezMaticMerge.address
    };
    fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})