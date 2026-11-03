// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev Mezo's VotingEscrow surface; the configured escrow must lock MEZO.
interface IWelcomeVotingEscrow {
    struct LockedBalance { int128 amount; uint256 end; bool isPermanent; uint256 boost; }
    function token() external view returns (address);
    function createLockFor(uint256 amount, uint256 duration, address to) external returns (uint256);
    function locked(uint256 tokenId) external view returns (LockedBalance memory);
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @notice Pocket-funded welcome MEZO, locked as a recipient-owned veMEZO NFT.
/// @dev One claim per authenticated account AND recipient per deployment.
/// Anyone may relay a voucher; changing its recipient invalidates the signature.
contract PocketWelcomeReward is EIP712, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant WEEK = 1 weeks;
    bytes32 public constant CLAIM_TYPEHASH = keccak256("WelcomeClaim(bytes32 claimId,address recipient,uint256 deadline)");
    IERC20 public immutable rewardToken;
    IWelcomeVotingEscrow public immutable votingEscrow;
    address public immutable authorizer;
    uint256 public constant rewardAmount = 20 ether;
    uint256 public constant lockDuration = 2 weeks;

    struct Claim { address recipient; uint256 tokenId; uint256 amount; uint256 unlockAt; }
    mapping(bytes32 => Claim) public claims;
    mapping(address => bool) public walletClaimed;

    error InvalidConfiguration();
    error InvalidVoucher();
    error AlreadyClaimed();
    error InvalidLock();
    event WelcomeClaimed(bytes32 indexed claimId, address indexed recipient, uint256 indexed tokenId, uint256 amount, uint256 unlockAt);

    constructor(address token_, address escrow_, address authorizer_, address admin_)
        EIP712("PocketWelcomeReward", "1") Ownable(admin_)
    {
        if (token_ == address(0) || escrow_ == address(0) || authorizer_ == address(0)
            || IWelcomeVotingEscrow(escrow_).token() != token_) revert InvalidConfiguration();
        rewardToken = IERC20(token_);
        votingEscrow = IWelcomeVotingEscrow(escrow_);
        authorizer = authorizer_;
    }

    function claim(bytes32 claimId, address recipient, uint256 deadline, bytes calldata signature)
        external nonReentrant whenNotPaused returns (uint256 tokenId)
    {
        if (claimId == bytes32(0) || recipient == address(0) || block.timestamp > deadline) revert InvalidVoucher();
        if (claims[claimId].recipient != address(0) || walletClaimed[recipient]) revert AlreadyClaimed();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, claimId, recipient, deadline)));
        if (ECDSA.recover(digest, signature) != authorizer) revert InvalidVoucher();

        // Effects precede the escrow call. Every failure rolls the entire claim back.
        walletClaimed[recipient] = true;
        claims[claimId].recipient = recipient;
        rewardToken.forceApprove(address(votingEscrow), rewardAmount);
        tokenId = votingEscrow.createLockFor(rewardAmount, lockDuration, recipient);
        rewardToken.forceApprove(address(votingEscrow), 0);

        IWelcomeVotingEscrow.LockedBalance memory position = votingEscrow.locked(tokenId);
        uint256 expectedEnd = ((block.timestamp + lockDuration) / WEEK) * WEEK;
        if (tokenId == 0 || position.amount != int128(uint128(rewardAmount)) || position.isPermanent
            || position.end != expectedEnd || position.end <= block.timestamp
            || votingEscrow.ownerOf(tokenId) != recipient) revert InvalidLock();
        claims[claimId] = Claim(recipient, tokenId, rewardAmount, position.end);
        emit WelcomeClaimed(claimId, recipient, tokenId, rewardAmount, position.end);
    }

    function setPaused(bool value) external onlyOwner {
        if (value) _pause(); else _unpause();
    }

    /// @notice Only unused campaign inventory is recoverable; users own their NFTs.
    function recoverUnused(address to, uint256 amount) external onlyOwner nonReentrant whenPaused {
        if (to == address(0)) revert InvalidConfiguration();
        rewardToken.safeTransfer(to, amount);
    }
}
