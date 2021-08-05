// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "hardhat/console.sol";

contract TokenMerge {
    using SafeMath for uint256;

    // ERC20 signatures:
    // bytes4(keccak256(bytes("transfer(address,uint256)")));
    bytes4 constant _TRANSFER_SIGNATURE = 0xa9059cbb;
    // bytes4(keccak256(bytes("transferFrom(address,address,uint256)")));
    bytes4 constant _TRANSFER_FROM_SIGNATURE = 0x23b872dd;
    // bytes4(keccak256(bytes("approve(address,uint256)")));
    bytes4 constant _APPROVE_SIGNATURE = 0x095ea7b3;


    address constant BURN_ADDRESS = address(0);
    uint256 constant TIMEOUT = 172800; // 1 month
    uint256 constant RATIO = 35000; // 3.5

    address fromToken;
    address toToken;
    address sourceAddress;
    uint256 ratio;
    uint256 timeout;
    uint256 amountLoadToToken;
    bool readyToMerge;

    constructor (
      address _fromToken,
      address _toToken,
      address _sourceAddress,
      uint256 _amountLoadToToken
    ) public {
        fromToken = _fromToken;
        toToken = _toToken;
        sourceAddress = _sourceAddress;
        timeout = block.number + TIMEOUT;
        amountLoadToToken = _amountLoadToToken;
        readyToMerge = false;
    }

    function loadToToken() public payable {
        require(msg.sender == sourceAddress, "TokenMerge::loadToToken: SENDER_NOT_SOURCE_ADDRESS");

        _safeTransferFrom(
            toToken,
            msg.sender,
            address(this),
            amountLoadToToken
        );

        readyToMerge = true;
    }


    function tokenMerge(uint amountFromToken) public payable {
        // check readyToMerge
        require(
            readyToMerge,
            "TokenMerge::tokenMerge: NOT_READY_TO_MERGE"
        );

        // check enough balance msg.sender
        require(
            IERC20(fromToken).balanceOf(msg.sender) > amountFromToken,
            "TokenMerge::tokenMerge: NOT_ENOUGH_BALANCE"
        );

        uint amountToToken = amountFromToken
            .mul(RATIO)
            .div(10000);

        // burn from token
        _safeTransferFrom(
            fromToken,
            msg.sender,
            BURN_ADDRESS,
            amountFromToken
        );

        // receive toToken
        _safeTransfer(
            toToken,
            msg.sender,
            amountToToken
        );
    }

    function getLeftOver() public {
        // check source address
        require (msg.sender == sourceAddress, "TokenMerge::loadToToken: SENDER_NOT_SOURCE_ADDRESS");

        // limit time to withdraw leftovers
        require(
            block.number > timeout,
            "TokenMerge::getLeftOver: NOT_AVAILABLE_YET"
        );

        uint balance = IERC20(toToken).balanceOf(address(this));

        _safeTransfer(
            toToken,
            msg.sender,
            balance
        );
    }

    ///////////
    // helpers ERC20 functions
    ///////////
    /**
     * @dev Approve ERC20
     * @param token Token address
     * @param to Recievers
     * @param value Quantity of tokens to approve
     */
    function _safeApprove(
        address token,
        address to,
        uint256 value
    ) internal {
        /* solhint-disable avoid-low-level-calls */
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(_APPROVE_SIGNATURE, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "Hermez::_safeApprove: ERC20_APPROVE_FAILED"
        );
    }

    /**
     * @dev Transfer tokens or ether from the smart contract
     * @param token Token address
     * @param to Address to recieve the tokens
     * @param value Quantity to transfer
     */
    function _safeTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        // address 0 is reserved for eth
        if (token == address(0)) {
            /* solhint-disable avoid-low-level-calls */
            (bool success, ) = msg.sender.call{value: value}(new bytes(0));
            require(success, "Hermez::_safeTransfer: ETH_TRANSFER_FAILED");
        } else {
            /* solhint-disable avoid-low-level-calls */
            (bool success, bytes memory data) = token.call(
                abi.encodeWithSelector(_TRANSFER_SIGNATURE, to, value)
            );
            require(
                success && (data.length == 0 || abi.decode(data, (bool))),
                "Hermez::_safeTransfer: ERC20_TRANSFER_FAILED"
            );
        }
    }

    /**
     * @dev transferFrom ERC20
     * Require approve tokens for this contract previously
     * @param token Token address
     * @param from Sender
     * @param to Reciever
     * @param value Quantity of tokens to send
     */
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(_TRANSFER_FROM_SIGNATURE, from, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "Hermez::_safeTransferFrom: ERC20_TRANSFERFROM_FAILED"
        );
    }
}
