const { expect } = require("chai");
const { ethers } = require("hardhat");
const Scalar = require("ffjavascript").Scalar;

const utilsHelpers = require("./helpers/utils");

describe("TokenMerge", function () {
    const sourceAddress = "0x0000000000000000000000000000000000000003";
    const amountLoadToToken = utilsHelpers.to18(100);

    const fromTokenName = "A_Token";
    const fromTokenSymbol = "AT";
    const fromTokenDecimals = 18;
    const fromTokenInitialAccount = sourceAddress;
    const fromTokenInitialBalance = utilsHelpers.to18(250);

    const toTokenName = "B_Token";
    const toTokenSymbol = "BT";
    const toTokenDecimals = 18;
    const toTokenInitialAccount = sourceAddress;
    const toTokenInitialBalance = utilsHelpers.to18(25);

    let signers;

    before("Deploy contract", async () => {
        // load signers
        signers = await ethers.getSigners();

        // deploy custom ERC20
        const CustomERC20 = await ethers.getContractFactory("CustomERC20");

        const insFromERC20 = await CustomERC20.deploy(
            fromTokenName,
            fromTokenSymbol,
            fromTokenDecimals,
            fromTokenInitialAccount,
            fromTokenInitialBalance
        );

        const insToERC20 = await CustomERC20.deploy(
            toTokenName,
            toTokenSymbol,
            toTokenDecimals,
            toTokenInitialAccount,
            toTokenInitialBalance
        );

        await insFromERC20.deployed();
        await insToERC20.deployed();

        const TokenMerge = await ethers.getContractFactory("TokenMerge");
        const insTokenMerge = await TokenMerge.deploy(
            insFromERC20.address,
            insToERC20.address,
            sourceAddress,
            amountLoadToToken
        );

        await insTokenMerge.deployed();
    });

    it("loadToTokens", async () => {
        console.log("Hi !!");
    });
});
