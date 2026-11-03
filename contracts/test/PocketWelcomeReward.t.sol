// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PocketWelcomeReward, IWelcomeVotingEscrow} from "../src/PocketWelcomeReward.sol";

contract WelcomeTestToken is ERC20 {
    constructor() ERC20("Mock MEZO", "MEZO") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract WelcomeTestEscrow is IWelcomeVotingEscrow {
    address public immutable token;
    uint256 public nextId;
    mapping(uint256 => LockedBalance) internal positions;
    mapping(uint256 => address) public ownerOf;
    bool public fail;
    bool public wrongOwner;

    constructor(address token_) { token = token_; }
    function setFail(bool value) external { fail = value; }
    function setWrongOwner(bool value) external { wrongOwner = value; }
    function locked(uint256 id) external view returns (LockedBalance memory) { return positions[id]; }
    function createLockFor(uint256 amount, uint256 duration, address to) external returns (uint256 id) {
        require(!fail, "Escrow unavailable");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        id = ++nextId;
        ownerOf[id] = wrongOwner ? msg.sender : to;
        positions[id] = LockedBalance(int128(uint128(amount)), ((block.timestamp + duration) / 1 weeks) * 1 weeks, false, 0);
    }
    function withdraw(uint256 id) external {
        require(ownerOf[id] == msg.sender, "Not owner");
        require(block.timestamp >= positions[id].end, "Still locked");
        uint256 amount = uint256(uint128(positions[id].amount));
        delete positions[id];
        delete ownerOf[id];
        IERC20(token).transfer(msg.sender, amount);
    }
}

contract PocketWelcomeRewardTest is Test {
    uint256 internal constant SIGNER_KEY = 0x12345;
    bytes32 internal constant CLAIM_ID = keccak256("fixture-account");
    address internal alice = makeAddr("welcome-alice");
    address internal bob = makeAddr("welcome-bob");
    WelcomeTestToken internal token;
    WelcomeTestEscrow internal escrow;
    PocketWelcomeReward internal campaign;

    function setUp() public {
        vm.warp(1793480400); // Saturday, 31 October 2026.
        token = new WelcomeTestToken();
        escrow = new WelcomeTestEscrow(address(token));
        campaign = new PocketWelcomeReward(address(token), address(escrow), vm.addr(SIGNER_KEY), address(this));
        token.mint(address(campaign), 60 ether);
    }

    function voucher(PocketWelcomeReward target, bytes32 id, address recipient, uint256 deadline, uint256 key) internal view returns (bytes memory) {
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("PocketWelcomeReward"), keccak256("1"), block.chainid, address(target)
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain,
            keccak256(abi.encode(keccak256("WelcomeClaim(bytes32 claimId,address recipient,uint256 deadline)"), id, recipient, deadline))));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function claimAlice() internal returns (uint256) {
        uint256 deadline = block.timestamp + 300;
        return campaign.claim(CLAIM_ID, alice, deadline, voucher(campaign, CLAIM_ID, alice, deadline, SIGNER_KEY));
    }

    function test_RecipientOwnsExactly20MEZOAndWeeklyLock() public {
        uint256 id = claimAlice();
        assertEq(escrow.ownerOf(id), alice);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(address(escrow)), 20 ether);
        assertEq(token.balanceOf(address(campaign)), 40 ether);
        IWelcomeVotingEscrow.LockedBalance memory position = escrow.locked(id);
        assertEq(int256(position.amount), 20 ether);
        assertEq(position.end, ((block.timestamp + 2 weeks) / 1 weeks) * 1 weeks);
        assertGt(position.end - block.timestamp, 10 days);
        assertLt(position.end - block.timestamp, 12 days);
        assertEq(token.allowance(address(campaign), address(escrow)), 0);
    }

    function test_AccountCannotClaimAgainToDifferentWallet() public {
        claimAlice();
        uint256 deadline = block.timestamp + 300;
        bytes memory sig = voucher(campaign, CLAIM_ID, bob, deadline, SIGNER_KEY);
        vm.expectRevert(PocketWelcomeReward.AlreadyClaimed.selector);
        campaign.claim(CLAIM_ID, bob, deadline, sig);
        assertEq(token.balanceOf(address(campaign)), 40 ether);
    }

    function test_WalletCannotClaimWithDifferentAccount() public {
        claimAlice();
        bytes32 id = keccak256("second-account");
        uint256 deadline = block.timestamp + 300;
        bytes memory sig = voucher(campaign, id, alice, deadline, SIGNER_KEY);
        vm.expectRevert(PocketWelcomeReward.AlreadyClaimed.selector);
        campaign.claim(id, alice, deadline, sig);
    }

    function test_VoucherCannotRedirectRecipient() public {
        uint256 deadline = block.timestamp + 300;
        bytes memory sig = voucher(campaign, CLAIM_ID, alice, deadline, SIGNER_KEY);
        vm.expectRevert(PocketWelcomeReward.InvalidVoucher.selector);
        campaign.claim(CLAIM_ID, bob, deadline, sig);
    }

    function test_ExpiredVoucherCannotClaim() public {
        uint256 deadline = block.timestamp - 1;
        bytes memory sig = voucher(campaign, CLAIM_ID, alice, deadline, SIGNER_KEY);
        vm.expectRevert(PocketWelcomeReward.InvalidVoucher.selector);
        campaign.claim(CLAIM_ID, alice, deadline, sig);
    }

    function test_WrongSignerCannotClaim() public {
        uint256 deadline = block.timestamp + 300;
        bytes memory sig = voucher(campaign, CLAIM_ID, alice, deadline, SIGNER_KEY + 1);
        vm.expectRevert(PocketWelcomeReward.InvalidVoucher.selector);
        campaign.claim(CLAIM_ID, alice, deadline, sig);
    }

    function test_SignatureCannotReplayAcrossCampaigns() public {
        PocketWelcomeReward other = new PocketWelcomeReward(address(token), address(escrow), vm.addr(SIGNER_KEY), address(this));
        token.mint(address(other), 20 ether);
        uint256 deadline = block.timestamp + 300;
        bytes memory sig = voucher(campaign, CLAIM_ID, alice, deadline, SIGNER_KEY);
        vm.expectRevert(PocketWelcomeReward.InvalidVoucher.selector);
        other.claim(CLAIM_ID, alice, deadline, sig);
    }

    function test_SignatureCannotReplayAcrossChains() public {
        uint256 deadline = block.timestamp + 300;
        bytes memory sig = voucher(campaign, CLAIM_ID, alice, deadline, SIGNER_KEY);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(PocketWelcomeReward.InvalidVoucher.selector);
        campaign.claim(CLAIM_ID, alice, deadline, sig);
    }

    function test_EscrowFailureDoesNotSpendOrConsumeClaim() public {
        escrow.setFail(true);
        vm.expectRevert("Escrow unavailable");
        claimAlice();
        assertFalse(campaign.walletClaimed(alice));
        (address recipient,,,) = campaign.claims(CLAIM_ID);
        assertEq(recipient, address(0));
        assertEq(token.balanceOf(address(campaign)), 60 ether);
        escrow.setFail(false);
        claimAlice();
    }

    function test_InvalidNFTOwnershipRollsBackEverything() public {
        escrow.setWrongOwner(true);
        vm.expectRevert(PocketWelcomeReward.InvalidLock.selector);
        claimAlice();
        assertFalse(campaign.walletClaimed(alice));
        assertEq(token.balanceOf(address(campaign)), 60 ether);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_OnlyOwnerCanPauseAndRecoverUnusedBudget() public {
        claimAlice();
        vm.prank(alice);
        vm.expectRevert();
        campaign.setPaused(true);
        campaign.setPaused(true);
        campaign.recoverUnused(bob, 40 ether);
        assertEq(token.balanceOf(bob), 40 ether);
        assertEq(token.balanceOf(address(escrow)), 20 ether);
        assertEq(escrow.ownerOf(1), alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        claimAlice();
    }

    function test_RewardCannotWithdrawEarlyButOwnerCanAfterExpiry() public {
        uint256 id = claimAlice();
        vm.prank(alice);
        vm.expectRevert("Still locked");
        escrow.withdraw(id);
        vm.warp(escrow.locked(id).end);
        vm.prank(alice);
        escrow.withdraw(id);
        assertEq(token.balanceOf(alice), 20 ether);
        // Withdrawal does not make the welcome reward claimable again.
        assertTrue(campaign.walletClaimed(alice));
    }

    function test_RejectWrongUnderlyingToken() public {
        WelcomeTestToken wrong = new WelcomeTestToken();
        vm.expectRevert(PocketWelcomeReward.InvalidConfiguration.selector);
        new PocketWelcomeReward(address(wrong), address(escrow), vm.addr(SIGNER_KEY), address(this));
    }

    function testFuzz_LockNeverPromisesAnElevenDayDuration(uint256 offset) public {
        offset = bound(offset, 0, 1 weeks - 1);
        vm.warp((block.timestamp / 1 weeks) * 1 weeks + offset);
        uint256 id = claimAlice();
        uint256 remaining = escrow.locked(id).end - block.timestamp;
        assertGt(remaining, 1 weeks);
        assertLe(remaining, 2 weeks);
    }
}
