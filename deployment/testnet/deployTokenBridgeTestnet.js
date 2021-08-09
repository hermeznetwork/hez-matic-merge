const { ethers, upgrades } = require("hardhat");
const path = require("path");
const fs = require("fs");
const pathOutputJson = path.join(__dirname, "./deploy_output.json");

const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);

async function main() {
    const deployer = (await ethers.getSigners())[0].address;

    /*
        Parameters Tokens
    */
    const tokenA = deployParameters.tokenA
    const tokenAName = tokenA.name;
    const tokenASymbol = tokenA.symbol;
    const tokenAInitialBalance = ethers.utils.parseEther(tokenA.initialAmount.toString());

    const tokenB = deployParameters.tokenB
    const tokenBName = tokenB.name;
    const tokenBSymbol = tokenB.symbol;
    const tokenBInitialBalance = ethers.utils.parseEther(tokenB.initialAmount.toString());

    /*
        Deployment Tokens
    */
   const CustomERC20Factory = await ethers.getContractFactory("ERC20PermitMock");

   tokenAContract = await CustomERC20Factory.deploy(
       tokenAName,
       tokenASymbol,
       deployer,
       tokenAInitialBalance
   );

   tokenBContract = await CustomERC20Factory.deploy(
       tokenBName,
       tokenBSymbol,
       deployer,
       tokenBInitialBalance
   );
   
    /*
        Parameters Bridge
    */
   const tokenAAddress = tokenAContract.address;
   const tokenBAddress = tokenBContract.address;
   const governanceAddress = deployer;
   const duration = 7776000;  // 90 days * 24 hours * 3600 seconds = 7776000

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
    console.log("BRIDGE_RATIO:",  await TokenBridge.BRIDGE_RATIO());
    console.log("withdrawTimeout:",  await TokenBridge.withdrawTimeout());
    console.log("current timestamp:",  (await ethers.provider.getBlock()).timestamp);

    console.log("\n#######################");
    console.log("#####   Send B tokens to  TokenBridge #####");
    console.log("#######################");

    const txTransferTokens = await tokenBContract.transfer(TokenBridge.address, tokenBInitialBalance);
    await txTransferTokens.wait();
    console.log("token Bridge has B tokens:", ethers.utils.formatEther(await tokenBContract.balanceOf(TokenBridge.address)));
    
    const outputJson = {
        tokenAAddress: tokenAAddress,
        tokenBAddress: tokenBAddress,
        governanceAddress: deployer,
        duration: duration,
        tokenBridge: TokenBridge.address
    };
    fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})