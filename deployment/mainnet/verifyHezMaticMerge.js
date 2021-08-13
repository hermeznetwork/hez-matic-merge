require("dotenv").config();
const path = require("path");
const hre = require("hardhat");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const pathDeployOutputParameters = path.join(__dirname, "./deploy_output.json");
const deployOutputParameters = require(pathDeployOutputParameters);

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
          deployOutputParameters.hezAddress,
          deployOutputParameters.maticAddress,
          deployOutputParameters.governanceAddress,
          deployOutputParameters.duration,
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

