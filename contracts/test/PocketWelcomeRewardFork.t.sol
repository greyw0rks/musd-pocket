// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PocketWelcomeReward, IWelcomeVotingEscrow} from "../src/PocketWelcomeReward.sol";
import {WelcomeTestToken} from "./PocketWelcomeReward.t.sol";

/// @dev Real deployed veMEZO implementation on a LOCAL fork, with the Cosmos
/// MEZO ERC-20 precompile replaced by a mintable EVM token fixture. No broadcast.
contract PocketWelcomeRewardForkTest is Test {
    address constant TOKEN = 0x7B7c000000000000000000000000000000000001;
    address constant ESCROW = 0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b;

    function test_ClaimAndWithdrawAgainstDeployedVeMEZO() public {
        string memory rpc = vm.envOr("MEZO_REWARD_FORK_RPC", string(""));
        vm.skip(bytes(rpc).length == 0);
        vm.createSelectFork(rpc, 16492615);
        WelcomeTestToken fixture = new WelcomeTestToken();
        vm.etch(TOKEN, address(fixture).code);
        address recipient = makeAddr("local-fork-welcome-recipient");
        PocketWelcomeReward campaign = new PocketWelcomeReward(TOKEN, ESCROW, vm.addr(0x12345), address(this));
        WelcomeTestToken(TOKEN).mint(address(campaign), 20 ether);
        uint256 tokenId = claimFixture(campaign, recipient);
        IWelcomeVotingEscrow escrow = IWelcomeVotingEscrow(ESCROW);
        IWelcomeVotingEscrow.LockedBalance memory position = escrow.locked(tokenId);
        assertEq(escrow.ownerOf(tokenId), recipient);
        assertEq(int256(position.amount), 20 ether);
        assertEq(position.end, ((block.timestamp + 2 weeks) / 1 weeks) * 1 weeks);
        assertEq(WelcomeTestToken(TOKEN).balanceOf(recipient), 0);
        vm.prank(recipient);
        (bool early,) = ESCROW.call(abi.encodeWithSignature("withdraw(uint256)", tokenId));
        assertFalse(early);
        vm.warp(position.end);
        vm.prank(recipient);
        (bool withdrawn,) = ESCROW.call(abi.encodeWithSignature("withdraw(uint256)", tokenId));
        assertTrue(withdrawn);
        assertEq(WelcomeTestToken(TOKEN).balanceOf(recipient), 20 ether);
        assertTrue(campaign.walletClaimed(recipient));
    }

    function claimFixture(PocketWelcomeReward campaign, address recipient) internal returns (uint256) {
        bytes32 id = keccak256("local-fork-fixture-account");
        uint256 deadline = block.timestamp + 300;
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("PocketWelcomeReward"), keccak256("1"), block.chainid, address(campaign)
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain,
            keccak256(abi.encode(campaign.CLAIM_TYPEHASH(), id, recipient, deadline))));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0x12345, digest);
        return campaign.claim(id, recipient, deadline, abi.encodePacked(r, s, v));
    }
}
