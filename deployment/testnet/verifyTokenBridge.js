require("dotenv").config();
const path = require("path");
const hre = require("hardhat");
const {expect} = require("chai");
const { ethers } = require("hardhat");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);

async function main() {    

  // load Mnemonic accounts
  const signersArray = await ethers.getSigners();
  const deployer = signersArray[0];
  const deployerAddress = await deployer.getAddress();

  if (typeof process.env.ETHERSCAN_API_KEY === "undefined") {
    throw new Error("Etherscan API KEY has not been defined");
  }

  // verify bridge
  try {
    await hre.run("verify:verify",
      {
        address:deployOutputParameters.tokenBridge,
        constructorArguments: [
          deployOutputParameters.tokenAAddress,
          deployOutputParameters.tokenBAddress,  
          deployOutputParameters.governanceAddress,
          deployOutputParameters.duration,
        ]
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }

  // verify tokenA
  const tokenA = deployParameters.tokenA;
  try {
    // verify governance
    await hre.run("verify:verify",
      {
        address:deployOutputParameters.tokenAAddress,
        constructorArguments: [
          tokenA.name,
          tokenA.symbol,  
          tokenA.initialAccount || deployerAddress,
          ethers.utils.parseEther(tokenA.initialAmount.toString()),
        ]
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }
  // verify tokenB
  const tokenB = deployParameters.tokenB;
  try {
    // verify governance
    await hre.run("verify:verify",
      {
        address:deployOutputParameters.tokenBAddress,
        constructorArguments: [
          tokenB.name,
          tokenB.symbol,  
          tokenB.initialAccount || deployerAddress,
          ethers.utils.parseEther(tokenB.initialAmount.toString()),
        ]
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
