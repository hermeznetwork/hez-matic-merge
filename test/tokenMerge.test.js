const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
  createPermitSignature
} = require("./helpers/erc2612");

describe("TokenBridge", function () {
  const ABIbid = [
    "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
  ];
  const iface = new ethers.utils.Interface(ABIbid);

  const bridgeRatio = 3500; // 3.5 factor
  const duration = 3600; // 1 hour

  const tokenAName = "AToken";
  const tokenASymbol = "AT";
  const tokenAInitialBalance = ethers.utils.parseEther("20000000");

  const manoloTokenName = "Manolo";
  const manoloTokenSymbol = "MAN";
  const manoloTokenInitialBalance = ethers.utils.parseEther("20000000");

  let deployer;
  let governance;
  let userAWallet;
  let userBWallet;

  let TokenBridgeContract;
  let tokenAContract;
  let manoloTokenContract;

  beforeEach("Deploy contract", async () => {
    // load signers
    const signers = await ethers.getSigners();

    // assign signers
    deployer = signers[0];
    governance = signers[1];
    userAWallet = signers[2];
    userBWallet = signers[3];

    // deploy ERC20 tokens
    const CustomERC20Factory = await ethers.getContractFactory("ERC20PermitMock");

    tokenAContract = await CustomERC20Factory.deploy(
      tokenAName,
      tokenASymbol,
      deployer.address,
      tokenAInitialBalance
    );

    manoloTokenContract = await CustomERC20Factory.deploy(
      manoloTokenName,
      manoloTokenSymbol,
      deployer.address,
      manoloTokenInitialBalance
    );

    await tokenAContract.deployed();
    await manoloTokenContract.deployed();

    // deploy TokenBridgeContract
    const TokenBridgeFactory = await ethers.getContractFactory("TokenBridge");
    TokenBridgeContract = await TokenBridgeFactory.deploy(
      tokenAContract.address,
      manoloTokenContract.address,
      governance.address,
      duration
    );

    await TokenBridgeContract.deployed();
  });

  it("should check the constructor", async () => {
    expect(await TokenBridgeContract.tokenA()).to.be.equal(tokenAContract.address);
    expect(await TokenBridgeContract.manoloToken()).to.be.equal(manoloTokenContract.address);
    expect(await TokenBridgeContract.governance()).to.be.equal(governance.address);
    expect(await TokenBridgeContract.BRIDGE_RATIO()).to.be.equal(bridgeRatio);

    const deployedTimestamp = (await ethers.provider.getBlock(TokenBridgeContract.deployTransaction.blockNumber)).timestamp;
    expect(await TokenBridgeContract.withdrawTimeout()).to.be.equal(deployedTimestamp + duration);
  });

  it("shouldn't be able to bridge tokens A for tokens B", async () => {
    // distribute tokens
    const tokenBridgeAmount = ethers.utils.parseEther("100")
    const userAWalletmount = ethers.utils.parseEther("1")

    await manoloTokenContract.connect(deployer).transfer(TokenBridgeContract.address, tokenBridgeAmount);
    await tokenAContract.connect(deployer).transfer(userAWallet.address, userAWalletmount);
    await tokenAContract.connect(deployer).transfer(userBWallet.address, userAWalletmount);

    // assert token amounts
    expect(await manoloTokenContract.balanceOf(TokenBridgeContract.address)).to.be.equal(tokenBridgeAmount)
    expect(await tokenAContract.balanceOf(userAWallet.address)).to.be.equal(userAWalletmount);
    expect(await tokenAContract.balanceOf(userBWallet.address)).to.be.equal(userAWalletmount);
    expect(await manoloTokenContract.balanceOf(userAWallet.address)).to.be.equal(0);
    expect(await manoloTokenContract.balanceOf(userBWallet.address)).to.be.equal(0);

    // bridge 1 A token for 3.5 manolo tokens
    const amountToBridgeInt = 10;
    const amountBridgedInt = amountToBridgeInt * bridgeRatio / 1000;
    const amountToBridge = ethers.utils.parseEther(amountToBridgeInt.toString());

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

    await expect(TokenBridgeContract.connect(userAWallet).bridge(amountToBridge, dataPermit)
    ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
  });

  it("should be able to bridge tokens A for tokens B", async () => {
    // distribute tokens
    const tokenBridgeAmount = ethers.utils.parseEther("100")
    const userAWalletmount = ethers.utils.parseEther("10")

    await manoloTokenContract.connect(deployer).transfer(TokenBridgeContract.address, tokenBridgeAmount);
    await tokenAContract.connect(deployer).transfer(userAWallet.address, userAWalletmount);
    await tokenAContract.connect(deployer).transfer(userBWallet.address, userAWalletmount);

    // assert token amounts
    expect(await manoloTokenContract.balanceOf(TokenBridgeContract.address)).to.be.equal(tokenBridgeAmount)
    expect(await tokenAContract.balanceOf(userAWallet.address)).to.be.equal(userAWalletmount);
    expect(await tokenAContract.balanceOf(userBWallet.address)).to.be.equal(userAWalletmount);
    expect(await manoloTokenContract.balanceOf(userAWallet.address)).to.be.equal(0);
    expect(await manoloTokenContract.balanceOf(userBWallet.address)).to.be.equal(0);

    // bridge 1 A token for 3.5 manolo tokens
    const amountToBridgeInt = 1;
    const amountBridgedInt = amountToBridgeInt * bridgeRatio / 1000;
    const amountToBridge = ethers.utils.parseEther(amountToBridgeInt.toString());
    const amountBridged = amountToBridge.mul(bridgeRatio).div(1000);

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

    const txBridge = await TokenBridgeContract.connect(userAWallet).bridge(amountToBridge, dataPermit)
    const receiptBridge = await txBridge.wait();

    // approve event
    const approveEvent = tokenAContract.interface.parseLog(receiptBridge.events[0])
    expect(approveEvent.name).to.be.equal("Approval");
    expect(approveEvent.args.owner).to.be.equal(userAWallet.address);
    expect(approveEvent.args.spender).to.be.equal(TokenBridgeContract.address);
    expect(approveEvent.args.value).to.be.equal(amountToBridge);

    // transferFrom event
    const transferFromEvent = tokenAContract.interface.parseLog(receiptBridge.events[1])
    expect(transferFromEvent.name).to.be.equal("Transfer");
    expect(transferFromEvent.args.from).to.be.equal(userAWallet.address);
    expect(transferFromEvent.args.to).to.be.equal(TokenBridgeContract.address);
    expect(transferFromEvent.args.value).to.be.equal(amountToBridge);

    const transferFromApproveEvent = tokenAContract.interface.parseLog(receiptBridge.events[2])
    expect(transferFromApproveEvent.name).to.be.equal("Approval");
    expect(transferFromApproveEvent.args.owner).to.be.equal(userAWallet.address);
    expect(transferFromApproveEvent.args.spender).to.be.equal(TokenBridgeContract.address);
    expect(transferFromApproveEvent.args.value).to.be.equal(0);

    // burn event
    const burnEvent = tokenAContract.interface.parseLog(receiptBridge.events[3])
    expect(burnEvent.name).to.be.equal("Transfer");
    expect(burnEvent.args.from).to.be.equal(TokenBridgeContract.address);
    expect(burnEvent.args.to).to.be.equal("0x0000000000000000000000000000000000000000");
    expect(burnEvent.args.value).to.be.equal(amountToBridge);

    // transfer manolo token Event
    const transfermanoloTokenEvent = manoloTokenContract.interface.parseLog(receiptBridge.events[4])
    expect(transfermanoloTokenEvent.name).to.be.equal("Transfer");
    expect(transfermanoloTokenEvent.args.from).to.be.equal(TokenBridgeContract.address);
    expect(transfermanoloTokenEvent.args.to).to.be.equal(userAWallet.address);
    expect(transfermanoloTokenEvent.args.value).to.be.equal(amountBridged);

    // bridge event
    const granteeEvent = receiptBridge.events[5]
    expect(granteeEvent.event).to.be.equal("Bridge")
    expect(granteeEvent.args.grantee).to.be.equal(userAWallet.address);
    expect(granteeEvent.args.amount).to.be.equal(amountToBridge);

    // check balances
    expect(await tokenAContract.balanceOf(userAWallet.address)).to.be.equal(userAWalletmount.sub(amountToBridge));
    expect(await tokenAContract.balanceOf(TokenBridgeContract.address)).to.be.equal(0);
    expect(await manoloTokenContract.balanceOf(userAWallet.address)).to.be.equal(amountBridged);
    expect(await manoloTokenContract.balanceOf(TokenBridgeContract.address)).to.be.equal(tokenBridgeAmount.sub(amountBridged));
    expect(amountBridged).to.be.equal(ethers.utils.parseEther(amountBridgedInt.toString()));
  });

  it("shouldn't be able to withdrawLeftOver if is not the owner, or the timeout is not reached", async () => {
    await expect(
      TokenBridgeContract.connect(userAWallet).withdrawLeftOver()
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
      TokenBridgeContract.connect(deployer).withdrawLeftOver()
    ).to.be.revertedWith("TokenBridge::withdrawLeftOver: TIMEOUT_NOT_REACHED");
  });

  it("should be able to withdrawLeftOver ", async () => {
    // send tokens to TokenBridge contract
    await manoloTokenContract.connect(deployer).transfer(TokenBridgeContract.address, manoloTokenInitialBalance);
    await tokenAContract.connect(deployer).transfer(TokenBridgeContract.address, tokenAInitialBalance);

    // assert balances TokenBridge
    expect(await manoloTokenContract.balanceOf(TokenBridgeContract.address)).to.be.equal(manoloTokenInitialBalance);
    expect(await tokenAContract.balanceOf(TokenBridgeContract.address)).to.be.equal(tokenAInitialBalance);

    // assert balances deployer
    expect(await tokenAContract.balanceOf(deployer.address)).to.be.equal(0);
    expect(await manoloTokenContract.balanceOf(deployer.address)).to.be.equal(0);

    // assert withdraw can't be done until timeout is reached
    const withdrawTimeout = (await TokenBridgeContract.withdrawTimeout()).toNumber();
    let currentTimestamp = (await ethers.provider.getBlock()).timestamp

    expect(withdrawTimeout).to.be.greaterThan(currentTimestamp)

    await expect(
      TokenBridgeContract.connect(deployer).withdrawLeftOver()
    ).to.be.revertedWith("TokenBridge::withdrawLeftOver: TIMEOUT_NOT_REACHED");

    // advance time and withdraw leftovers
    await ethers.provider.send("evm_increaseTime", [withdrawTimeout - currentTimestamp + 1])
    await ethers.provider.send("evm_mine")

    currentTimestamp = (await ethers.provider.getBlock()).timestamp
    expect(withdrawTimeout).to.be.lessThan(currentTimestamp)

    await TokenBridgeContract.connect(deployer).withdrawLeftOver();

    // assert balances TokenBridge
    expect(await manoloTokenContract.balanceOf(TokenBridgeContract.address)).to.be.equal(0);
    expect(await tokenAContract.balanceOf(TokenBridgeContract.address)).to.be.equal(tokenAInitialBalance);

    // assert balances deployer
    expect(await tokenAContract.balanceOf(deployer.address)).to.be.equal(0);
    expect(await manoloTokenContract.balanceOf(deployer.address)).to.be.equal(manoloTokenInitialBalance);
  });

  it("should be able to update withdrawLeftOver ", async () => {
    // send tokens to TokenBridge contract
    await manoloTokenContract.connect(deployer).transfer(TokenBridgeContract.address, manoloTokenInitialBalance);

    // assert balances
    expect(await manoloTokenContract.balanceOf(TokenBridgeContract.address)).to.be.equal(manoloTokenInitialBalance);
    expect(await manoloTokenContract.balanceOf(deployer.address)).to.be.equal(0);

    // assert withdraw can't be done until timeout is reached
    const withdrawTimeout = (await TokenBridgeContract.withdrawTimeout()).toNumber();
    let currentTimestamp = (await ethers.provider.getBlock()).timestamp

    expect(withdrawTimeout).to.be.greaterThan(currentTimestamp)

    await expect(
      TokenBridgeContract.connect(deployer).withdrawLeftOver()
    ).to.be.revertedWith("TokenBridge::withdrawLeftOver: TIMEOUT_NOT_REACHED");

    // advance time and withdraw leftovers
    await ethers.provider.send("evm_increaseTime", [withdrawTimeout - currentTimestamp + 1])
    await ethers.provider.send("evm_mine")

    currentTimestamp = (await ethers.provider.getBlock()).timestamp
    expect(withdrawTimeout).to.be.lessThan(currentTimestamp)

    await expect(
      TokenBridgeContract.connect(deployer).setWithdrawTimeout(withdrawTimeout)
    ).to.be.revertedWith("TokenBridge::setWithdrawTimeout: ONLY_GOVERNANCE_ALLOWED");

    await expect(
      TokenBridgeContract.connect(governance).setWithdrawTimeout(withdrawTimeout)
    ).to.be.revertedWith("TokenBridge::setWithdrawTimeout: NEW_TIMEOUT_MUST_BE_HIGHER");

    await expect(
      TokenBridgeContract.connect(governance).setWithdrawTimeout(currentTimestamp)
    ).to.emit(TokenBridgeContract, "TimeoutIncreased")
      .withArgs(currentTimestamp);

    await expect(
      TokenBridgeContract.connect(governance).setWithdrawTimeout(currentTimestamp + 3000)
    ).to.emit(TokenBridgeContract, "TimeoutIncreased")
      .withArgs(currentTimestamp + 3000);

    await expect(
      TokenBridgeContract.connect(deployer).withdrawLeftOver()
    ).to.be.revertedWith("TokenBridge::withdrawLeftOver: TIMEOUT_NOT_REACHED");
  });
});