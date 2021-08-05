const { expect } = require("chai");
const { ethers } = require("hardhat");
const Scalar = require("ffjavascript").Scalar;
const { time } = require("@openzeppelin/test-helpers");

const utilsHelpers = require("./helpers/utils");

describe("TokenMerge", function () {
    const timeout = 100;
    const amountLoadToToken = utilsHelpers.to18(100);

    const fromTokenName = "A_Token";
    const fromTokenSymbol = "AT";
    const fromTokenDecimals = 18;
    const fromTokenInitialBalance = utilsHelpers.to18(200);

    const toTokenName = "B_Token";
    const toTokenSymbol = "BT";
    const toTokenDecimals = 18;
    const toTokenInitialBalance = utilsHelpers.to18(300);

    let signers;

    let deployer;
    let sourceTo;
    let userA;
    let userB;

    let insTokenMerge;
    let insFromERC20;
    let insToERC20;

    let amountToMergeA = utilsHelpers.to18(1);
    let amountToMergeB = utilsHelpers.to18(3);

    before("Deploy contract", async () => {
        // load signers
        signers = await ethers.getSigners();

        // assign signers
        deployer = signers[0];
        sourceTo = signers[1];
        userA = signers[2];
        userB = signers[3];

        // deploy custom ERC20
        const CustomERC20 = await ethers.getContractFactory("CustomERC20");

        insFromERC20 = await CustomERC20.deploy(
            fromTokenName,
            fromTokenSymbol,
            fromTokenDecimals,
            deployer.address,
            fromTokenInitialBalance
        );

        insToERC20 = await CustomERC20.deploy(
            toTokenName,
            toTokenSymbol,
            toTokenDecimals,
            sourceTo.address,
            toTokenInitialBalance
        );

        await insFromERC20.deployed();
        await insToERC20.deployed();

        // send tokensFrom to users A and B
        await insFromERC20.connect(deployer).transfer(userA.address, utilsHelpers.to18(2));
        await insFromERC20.connect(deployer).transfer(userB.address, utilsHelpers.to18(3));

        // deploy tokenMerge
        const TokenMerge = await ethers.getContractFactory("TokenMerge");
        insTokenMerge = await TokenMerge.deploy(
            insFromERC20.address,
            insToERC20.address,
            sourceTo.address,
            amountLoadToToken,
            timeout
        );

        await insTokenMerge.deployed();
    });

    it("tokenMerge: not ready to merge", async () => {
        // error msg.sender
        await expect(
            insTokenMerge.tokenMerge(amountToMergeA)
        ).to.be.revertedWith("TokenMerge::tokenMerge: NOT_READY_TO_MERGE");
    });

    it("loadToToken: error sender & succesful call", async () => {
        // approve from sourceAddress to tokenMerge contract
        await insToERC20.connect(sourceTo).approve(insTokenMerge.address, amountLoadToToken);

        // error msg.sender
        await expect(
            insTokenMerge.loadToToken()
        ).to.be.revertedWith("TokenMerge::loadToToken: SENDER_NOT_SOURCE_ADDRESS");

        // load tokens
        await insTokenMerge.connect(sourceTo).loadToToken();

        // check contract tokens
        const balanceContract = await insToERC20.balanceOf(insTokenMerge.address);
        expect(Scalar.eq(balanceContract, amountLoadToToken)).to.be.equal(true);
    });

    it("tokenMerge: error balance & succesful user A", async () => {
        const balFromTokenA = await insFromERC20.balanceOf(userA.address);

        // error not enough balance
        const overAmount = utilsHelpers.to18(5);
        await expect(
            insTokenMerge.connect(userA).tokenMerge(overAmount)
        ).to.be.revertedWith("TokenMerge::tokenMerge: NOT_ENOUGH_BALANCE");

        // approve from userA to tokenMerge contract
        await insFromERC20.connect(userA).approve(insTokenMerge.address, amountToMergeA);

        await insTokenMerge.connect(userA).tokenMerge(amountToMergeA);

        const newBalFromTokenA = await insFromERC20.balanceOf(userA.address);
        const newBalToTokenA = await insToERC20.balanceOf(userA.address);

        const ratio = await insTokenMerge.RATIO();

        expect(Scalar.eq(balFromTokenA, Scalar.add(newBalFromTokenA, amountToMergeA)))
            .to.be.equal(true);
        const expectedBalToToken = Scalar.div(Scalar.mul(ratio, amountToMergeA), 10000);
        expect(Scalar.eq(expectedBalToToken, newBalToTokenA)).to.be.equal(true);
    });

    it("tokenMerge: succesful user B", async () => {
        const balFromTokenB = await insFromERC20.balanceOf(userB.address);

        // approve from userB to tokenMerge contract
        await insFromERC20.connect(userB).approve(insTokenMerge.address, amountToMergeB);

        await insTokenMerge.connect(userB).tokenMerge(amountToMergeB);

        const newBalFromTokenB = await insFromERC20.balanceOf(userB.address);
        const newBalToTokenB = await insToERC20.balanceOf(userB.address);

        const ratio = await insTokenMerge.RATIO();

        expect(Scalar.eq(balFromTokenB, Scalar.add(newBalFromTokenB, amountToMergeB)))
            .to.be.equal(true);
        const expectedBalToToken = Scalar.div(Scalar.mul(ratio, amountToMergeB), 10000);
        expect(Scalar.eq(expectedBalToToken, newBalToTokenB)).to.be.equal(true);
    });

    it("getLeftOver: error sender & error timeout", async () => {
        await expect(
            insTokenMerge.connect(userA).getLeftOver()
        ).to.be.revertedWith("TokenMerge::loadToToken: SENDER_NOT_SOURCE_ADDRESS");

        await expect(
            insTokenMerge.connect(sourceTo).getLeftOver()
        ).to.be.revertedWith("TokenMerge::getLeftOver: NOT_AVAILABLE_YET");
    });

    it("getLeftOver: succesful call", async () => {
        // advance blocks
        const timeoutBlocks = await insTokenMerge.timeout();
        await time.advanceBlockTo(timeoutBlocks.toNumber() + 1);

        const balanceContract = await insToERC20.balanceOf(insTokenMerge.address);
        const balanceSource = await insToERC20.balanceOf(sourceTo.address);

        await insTokenMerge.connect(sourceTo).getLeftOver();

        const newBalanceContract = await insToERC20.balanceOf(insTokenMerge.address);
        const newBalanceSource = await insToERC20.balanceOf(sourceTo.address);

        expect(Scalar.eq(newBalanceContract, 0)).to.be.equal(true);
        expect(Scalar.eq(newBalanceSource, Scalar.add(balanceContract, balanceSource)))
            .to.be.equal(true);
    });
});
