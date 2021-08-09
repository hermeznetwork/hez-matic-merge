const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@openzeppelin/test-helpers");

const {
    createPermitSignature
  } = require("./helpers/erc2612");

describe("TokenBridge", function () {
    const ABIbid = [
        "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
      ];
    const iface = new ethers.utils.Interface(ABIbid);

    const bridgeRatio = 3500;
    const duration = 3600; // 1 hour

    const tokenAName = "AToken";
    const tokenASymbol = "AT";
    const tokenAInitialBalance = ethers.utils.parseEther("20000000");

    const tokenBName = "BToken";
    const tokenBSymbol = "BT";
    const tokenBInitialBalance = ethers.utils.parseEther("20000000");

    let signers;

    let deployer;
    let governance;
    let userAWallet;
    let userBWallet;

    let TokenBridgeContract;
    let tokenAContract;
    let tokenBContract;

    before("Deploy contract", async () => {
        // load signers
        signers = await ethers.getSigners();

        // assign signers
        deployer = signers[0];
        governance = signers[1];
        userAWallet = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", ethers.provider);;
        userBWallet = new ethers.Wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", ethers.provider);;
        // deploy ERC20 tokens
        const CustomERC20Factory = await ethers.getContractFactory("ERC20MockPermit");

        tokenAContract = await CustomERC20Factory.deploy(
            tokenAName,
            tokenASymbol,
            deployer.address,
            tokenAInitialBalance
        );

        tokenBContract = await CustomERC20Factory.deploy(
            tokenBName,
            tokenBSymbol,
            deployer.address,
            tokenBInitialBalance
        );

        await tokenAContract.deployed();
        await tokenBContract.deployed();

        // deploy TokenBridgeContract
        const TokenBridgeFactory = await ethers.getContractFactory("TokenBridge");
        TokenBridgeContract = await TokenBridgeFactory.deploy(
            tokenAContract.address,
            tokenBContract.address,
            governance.address,
            duration
        );

       await TokenBridgeContract.deployed();
    });

    it("should check the constructor", async () => {
        expect(await TokenBridgeContract.tokenA()).to.be.equal(tokenAContract.address);
        expect(await TokenBridgeContract.tokenB()).to.be.equal(tokenBContract.address);
        expect(await TokenBridgeContract.governance()).to.be.equal(governance.address);
        expect(await TokenBridgeContract.BRIDGE_RATIO()).to.be.equal(bridgeRatio);

        const deployedTimestamp = (await ethers.provider.getBlock(TokenBridgeContract.deployTransaction.blockNumber)).timestamp;
        expect(await TokenBridgeContract.withdrawTimeout()).to.be.equal(deployedTimestamp + duration);
    });
    
    // it("should not be able to bridge until TokenBridgeContract has tokens", async () => {
    //     const amountToBridge = ethers.utils.parseEther("1");
    //     expect(await 
    //         TokenBridgeContractContract.bridge(amountToBridge)
    //     ).to.be.revertedWith("TokenBridgeContractContract::TokenBridgeContractContract: NOT_READY_TO_MERGE");
    // });

    it("should be able to bridge tokens", async () => {
        // send tokens to the TokenBridge contract
        const tokenBridgeAmount = ethers.utils.parseEther("100")
        await tokenBContract.connect(deployer).transfer(TokenBridgeContract.address, tokenBridgeAmount);
        expect(await tokenBContract.balanceOf(TokenBridgeContract.address)).to.be.equal(tokenBridgeAmount)

        // send tokens to users A and B
        const userAWalletmount = ethers.utils.parseEther("100")

        await tokenAContract.connect(deployer).transfer(userAWallet.address, userAWalletmount);
        await tokenAContract.connect(deployer).transfer(userBWallet.address, userAWalletmount);
        expect(await tokenAContract.balanceOf(userAWallet.address)).to.be.equal(userAWalletmount);
        expect(await tokenAContract.balanceOf(userBWallet.address)).to.be.equal(userAWalletmount);
        expect(await tokenBContract.balanceOf(userAWallet.address)).to.be.equal(0);
        expect(await tokenBContract.balanceOf(userBWallet.address)).to.be.equal(0);

        // bridge 1 A token to 3.5 B tokens
        const amountToBridge = ethers.utils.parseEther("1");
        const deadline = ethers.constants.MaxUint256;
        const value = amountToBridge;
        const nonce = await tokenAContract.nonces(userAWallet.address);
        const { v, r, s } = await createPermitSignature(
          tokenAContract,
          userAWallet,
          TokenBridgeContract.address,
          value,
          nonce,
          deadline
        );
  
        const dataPermit = iface.encodeFunctionData("permit", [
          userAWallet.address,
          TokenBridgeContract.address,
          value,
          deadline,
          v,
          r,
          s
        ]);

        await TokenBridgeContract.connect(userAWallet).bridge(amountToBridge, dataPermit)

        const amountBridged = amountToBridge.mul(bridgeRatio).div(1000);
        // check balances
        expect(await tokenAContract.balanceOf(userAWallet.address)).to.be.equal(userAWalletmount.sub(amountToBridge));
        expect(await tokenAContract.balanceOf(TokenBridgeContract.address)).to.be.equal(0);
        expect(await tokenBContract.balanceOf(userAWallet.address)).to.be.equal(amountBridged);
        expect(await tokenBContract.balanceOf(TokenBridgeContract.address)).to.be.equal(tokenBridgeAmount.sub(amountBridged));
        expect(amountBridged).to.be.equal(ethers.utils.parseEther("3.5"));
    });

    // it("TokenBridgeContract: error balance & succesful user A", async () => {
    //     const baltokenAA = await tokenAContract.balanceOf(userAWallet.address);

    //     // error not enough balance
    //     const overAmount = utilsHelpers.to18(5);
    //     expect(await 
    //         TokenBridgeContract.connect(userAWallet).TokenBridgeContract(overAmount)
    //     ).to.be.revertedWith("TokenBridgeContract::TokenBridgeContract: NOT_ENOUGH_BALANCE");

    //     // approve from userAWallet to TokenBridgeContract contract
    //     await tokenAContract.connect(userAWallet).approve(TokenBridgeContract.address, amountToMergeA);

    //     await TokenBridgeContract.connect(userAWallet).TokenBridgeContract(amountToMergeA);

    //     const newBaltokenAA = await tokenAContract.balanceOf(userAWallet.address);
    //     const newBaltokenBA = await tokenBContract.balanceOf(userAWallet.address);

    //     const ratio = await TokenBridgeContract.RATIO();

    //     expect(Scalar.eq(baltokenAA, Scalar.add(newBaltokenAA, amountToMergeA)))
    //         .to.be.equal(true);
    //     const expectedBaltokenB = Scalar.div(Scalar.mul(ratio, amountToMergeA), 10000);
    //     expect(Scalar.eq(expectedBaltokenB, newBaltokenBA)).to.be.equal(true);
    // });

    // it("getLeftOver: error sender & error timeout", async () => {
    //     expect(await 
    //         TokenBridgeContract.connect(userAWallet).getLeftOver()
    //     ).to.be.revertedWith("TokenBridgeContract::loadtokenB: SENDER_NOT_SOURCE_ADDRESS");

    //     expect(await 
    //         TokenBridgeContract.connect(governance).getLeftOver()
    //     ).to.be.revertedWith("TokenBridgeContract::getLeftOver: NOT_AVAILABLE_YET");
    // });

    // it("getLeftOver: succesful call", async () => {
    //     // advance blocks
    //     const timeoutBlocks = await TokenBridgeContract.timeout();
    //     await time.advanceBlockTo(timeoutBlocks.toNumber() + 1);

    //     const balanceContract = await tokenBContract.balanceOf(TokenBridgeContract.address);
    //     const balanceSource = await tokenBContract.balanceOf(governance.address);

    //     await TokenBridgeContract.connect(governance).getLeftOver();

    //     const newBalanceContract = await tokenBContract.balanceOf(TokenBridgeContract.address);
    //     const newBalanceSource = await tokenBContract.balanceOf(governance.address);

    //     expect(Scalar.eq(newBalanceContract, 0)).to.be.equal(true);
    //     expect(Scalar.eq(newBalanceSource, Scalar.add(balanceContract, balanceSource)))
    //         .to.be.equal(true);
    // });
});
