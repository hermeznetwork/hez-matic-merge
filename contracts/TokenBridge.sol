// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract TokenBridge is Ownable {
    using SafeERC20 for IERC20; 

    // bytes4(keccak256(bytes("permit(address,address,uint256,uint256,uint8,bytes32,bytes32)")));
    bytes4 constant _PERMIT_SIGNATURE = 0xd505accf;
    
    // Bridge ratio between tokenA and tokenB multiplied by 1000
    uint256 public constant BRIDGE_RATIO = 3500;

    // Token A address
    IERC20 public immutable tokenA; 

    // Token B address
    IERC20 public immutable tokenB;
    
    // Governance address
    address public governance;

    // UNIX time when the owner will be able to withdraw the rest of the tokens
    uint256 public withdrawTimeout;

    /**
     * @dev Emitted when someone bridges their tokens
     */
    event Bridge(address indexed grantee, uint256 amount);

    /**
     * @dev Emitted when the governance increases the timeout
     */
    event TimeoutIncreased(uint256 newWithdrawTimeout);

    /**
     * @dev Emitted when the owner withdraw the remaining tokens
     */
    event WithdrawLeftOver(uint256 amount);

    /**
     * @dev This contract will recieve B token tokens, the users will be able to bridge their A tokens for B tokens
     *      as long as this contract holds enough amount. A Tokens will be burned in this process.
     *      Once the withdrawTimeout is reached the owner will be able to withdraw the leftover tokens.
     * @param _tokenA Token A address
     * @param _tokenB Token B address
     * @param _governance Governance address
     * @param duration Time in seconds that the owner will not be able to withdraw the tokens
     */
    constructor (
        IERC20 _tokenA,
        IERC20 _tokenB,
        address _governance,
        uint256 duration
    ){
        tokenA = _tokenA;
        tokenB = _tokenB;
        governance = _governance;
        withdrawTimeout = block.timestamp + duration;
    }

    /**
     * @notice Method that allows bridge from tokens A to B at the ratio of 1 A --> 3.5 B
     * @param amount Amount of A tokens tokens to bridge
     */
    function bridge(uint256 amount, bytes calldata _permitData) public {
        // recieve and burn A tokens     
        if (_permitData.length != 0) {
            _permit(address(tokenA), amount, _permitData);
        }

        tokenA.safeTransferFrom(msg.sender, address(this), amount);
        ERC20Burnable(address(tokenA)).burn(amount);

        // transfer B tokens
        tokenB.safeTransfer(msg.sender, (amount * BRIDGE_RATIO) / 1000);
        
        emit Bridge(msg.sender, amount);
    }

    /**
     * @notice Method that allows the owner to withdraw the remaining B tokens
     */
    function withdrawLeftOver() public onlyOwner {
        require(
            block.timestamp > withdrawTimeout,
            "TokenBridge::withdrawLeftOver: TIMEOUT_NOT_REACHED"
        );
        uint256 currentBalance = tokenB.balanceOf(address(this));
        tokenB.safeTransfer(owner(), currentBalance);

        emit WithdrawLeftOver(currentBalance);
    }

    /**
     * @notice Method that allows the governance to increase the withdraw timeout
     */
    function increaseWithdrawTimeout(uint256 duration) public {
        require(
            msg.sender == governance,
             "TokenBridge::extentWithdawTimeout: ONLY_GOVERNANCE_ALLOWED"
        );
        withdrawTimeout = withdrawTimeout + duration; 
        
        emit TimeoutIncreased(withdrawTimeout);
    }

    /**
     * @notice Function to extract the selector of a bytes calldata
     * @param _data The calldata bytes
     */
    function getSelector(bytes memory _data) private pure returns (bytes4 sig) {
        assembly {
            sig := mload(add(_data, 32))
        }
    }

    /**
     * @notice Function to call token permit method of extended ERC20
     + @param token ERC20 token address
     * @param _amount Quantity that is expected to be allowed
     * @param _permitData Raw data of the call `permit` of the token
     */
    function _permit(
        address token,
        uint256 _amount,
        bytes calldata _permitData
    ) internal {
        bytes4 sig = getSelector(_permitData);
        require(
            sig == _PERMIT_SIGNATURE,
            "TokenBridge::_permit: NOT_VALID_CALL"
        );
        (
            address owner,
            address spender,
            uint256 value,
            uint256 deadline,
            uint8 v,
            bytes32 r,
            bytes32 s
        ) = abi.decode(
            _permitData[4:],
            (address, address, uint256, uint256, uint8, bytes32, bytes32)
        );
        require(
            owner == msg.sender,
            "TokenBridge::_permit: PERMIT_OWNER_MUST_BE_THE_SENDER"
        );
        require(
            spender == address(this),
            "TokenBridge::_permit: SPENDER_MUST_BE_THIS"
        );
        require(
            value == _amount,
            "TokenBridge::_permit: PERMIT_AMOUNT_DOES_NOT_MATCH"
        );

        // we call without checking the result, in case it fails and he doesn't have enough balance
        // the following transferFrom should be fail. This prevents DoS attacks from using a signature
        // before the smartcontract call
        /* solhint-disable avoid-low-level-calls */
        address(token).call(
            abi.encodeWithSelector(
                _PERMIT_SIGNATURE,
                owner,
                spender,
                value,
                deadline,
                v,
                r,
                s
            )
        );
    }   
}
