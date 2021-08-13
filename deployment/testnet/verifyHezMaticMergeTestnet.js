require("dotenv").config();
const path = require("path");
const hre = require("hardhat");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

const pathDeployParameters = path.join(__dirname, "./deploy_parameters.json");
const deployParameters = require(pathDeployParameters);

async function main() {

  // load deployer account
  const signersArray = await ethers.getSigners();
  const deployer = signersArray[0];
  const deployerAddress = await deployer.getAddress();

  if (typeof process.env.ETHERSCAN_API_KEY === "undefined") {
    throw new Error("Etherscan API KEY has not been defined");
  }

  // verify hezMaticMerge
  try {
    await hre.run("verify:verify",
      {
        address: deployOutputParameters.hezMaticMerge,
        constructorArguments: [
          deployOutputParameters.hezTokenAddress,
          deployOutputParameters.maticTokenAddress,
          deployOutputParameters.governanceAddress,
          deployOutputParameters.duration,
        ]
      }
    );
  } catch (error) {
    expect(error.message).to.be.equal("Contract source code already verified");
  }

  // verify maticToken
  const maticToken = deployParameters.maticToken;
  try {
    // verify governance
    await hre.run("verify:verify",
      {
        address: deployOutputParameters.maticTokenAddress,
        constructorArguments: [
          maticToken.name,
          maticToken.symbol,
          maticToken.initialAccount || deployerAddress,
          ethers.utils.parseEther(maticToken.initialAmount.toString()),
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

