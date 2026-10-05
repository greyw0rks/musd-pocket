// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PocketVault
/// @notice Minimal liquidity vault for MUSD Pocket. Holds MUSD and releases it
///         to recipients only on the authority of the off-chain settlement
///         engine (ENGINE_ROLE). Custody of funds lives in this contract, not
///         in any backend wallet; the engine key can *move* funds but never
///         *holds* them — a trust point a production system would decentralize.
/// @dev Deposits may arrive two ways: (1) `deposit()`, which pulls MUSD via
///      transferFrom and emits a Deposit event, or (2) a plain ERC-20 transfer
///      straight to this address. The backend indexes the token's Transfer log
///      (to == vault) for both, and the Deposit event for the former.
contract PocketVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Role allowed to release funds (the settlement engine / relayer).
    bytes32 public constant ENGINE_ROLE = keccak256("ENGINE_ROLE");

    /// @notice The MUSD token this vault custodies.
    IERC20 public immutable musd;

    /// @notice Replay guard — each paymentId can only release funds once.
    mapping(bytes32 => bool) public processed;

    event Deposit(address indexed from, uint256 amount, bytes32 indexed paymentId);
    event Payout(address indexed to, uint256 amount, bytes32 indexed paymentId);
    event Withdraw(address indexed to, uint256 amount, bytes32 indexed paymentId);

    error ZeroAddress();
    error ZeroAmount();
    error AlreadyProcessed(bytes32 paymentId);
    error InsufficientLiquidity(uint256 requested, uint256 available);

    /// @param musd_  Address of the MUSD ERC-20 (Mezo testnet mUSD for the demo).
    /// @param admin  Holder of DEFAULT_ADMIN_ROLE (can grant/revoke ENGINE_ROLE).
    /// @param engine Settlement-engine address granted ENGINE_ROLE.
    constructor(address musd_, address admin, address engine) {
        if (musd_ == address(0) || admin == address(0) || engine == address(0)) {
            revert ZeroAddress();
        }
        musd = IERC20(musd_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ENGINE_ROLE, engine);
    }

    /// @notice Deposit MUSD into the vault. Requires a prior ERC-20 approval.
    /// @param amount    MUSD amount (18 decimals) to pull from the caller.
    /// @param paymentId Opaque id the backend binds this deposit to.
    function deposit(uint256 amount, bytes32 paymentId) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        musd.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount, paymentId);
    }

    /// @notice Release vault liquidity to a Pocket recipient. Engine-only, idempotent.
    function payout(address to, uint256 amount, bytes32 paymentId)
        external
        nonReentrant
        onlyRole(ENGINE_ROLE)
    {
        _release(to, amount, paymentId);
        emit Payout(to, amount, paymentId);
    }

    /// @notice Cash a user out to an external address. Same release primitive as
    ///         payout; a distinct event lets the indexer classify the flow.
    function withdraw(address to, uint256 amount, bytes32 paymentId)
        external
        nonReentrant
        onlyRole(ENGINE_ROLE)
    {
        _release(to, amount, paymentId);
        emit Withdraw(to, amount, paymentId);
    }

    /// @notice Current MUSD liquidity held by the vault.
    function liquidity() external view returns (uint256) {
        return musd.balanceOf(address(this));
    }

    /// @dev Checks-effects-interactions: mark processed before the transfer.
    function _release(address to, uint256 amount, bytes32 paymentId) internal {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (processed[paymentId]) revert AlreadyProcessed(paymentId);
        uint256 bal = musd.balanceOf(address(this));
        if (amount > bal) revert InsufficientLiquidity(amount, bal);
        processed[paymentId] = true;
        musd.safeTransfer(to, amount);
    }
}
