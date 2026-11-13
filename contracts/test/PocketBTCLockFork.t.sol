// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVeBTC {
    struct Locked { int128 amount; uint256 end; bool isPermanent; }
    function token() external view returns (address);
    function createLock(uint256 amount, uint256 duration) external returns (uint256);
    function increaseAmount(uint256 tokenId, uint256 amount) external;
    function increaseUnlockTime(uint256 tokenId, uint256 duration) external;
    function lockPermanent(uint256 tokenId) external;
    function unlockPermanent(uint256 tokenId) external;
    function locked(uint256 tokenId) external view returns (Locked memory);
    function ownerOf(uint256 tokenId) external view returns (address);
    function withdraw(uint256 tokenId) external;
}

contract BTCFixture is ERC20 {
    constructor() ERC20("Local BTC fixture", "BTC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev Deployed veBTC code on a local fork. The native-token precompile is
/// replaced by an ERC-20 fixture, so this is not a live BTC transfer or signature.
contract PocketBTCLockForkTest is Test {
    address constant BTC = 0x7b7C000000000000000000000000000000000000;
    IVeBTC constant escrow = IVeBTC(0xB63fcCd03521Cf21907627bd7fA465C129479231);
    uint256 constant PRINCIPAL = 0.001 ether;
    address user;

    function setUp() public {
        string memory rpc = vm.envOr("MEZO_BTC_LOCK_FORK_RPC", string(""));
        vm.skip(bytes(rpc).length == 0);
        vm.createSelectFork(rpc, 16742669);
        assertEq(escrow.token(), BTC);
        assertEq(uint256(vm.load(address(escrow), bytes32(uint256(82)))), 30 days);
        BTCFixture fixture = new BTCFixture();
        vm.etch(BTC, address(fixture).code);
        user = makeAddr("pocket-btc-lock-user");
        BTCFixture(BTC).mint(user, 3 * PRINCIPAL);
        vm.startPrank(user);
        IERC20(BTC).approve(address(escrow), 2 * PRINCIPAL);
    }

    function testBTCLockCreateTopUpExtendAndWithdraw() public {
        uint256 id = escrow.createLock(PRINCIPAL, 2 weeks);
        assertEq(escrow.ownerOf(id), user);
        assertEq(escrow.locked(id).amount, int128(int256(PRINCIPAL)));
        assertEq(IERC20(BTC).balanceOf(user), 2 * PRINCIPAL);
        vm.expectRevert();
        escrow.withdraw(id);
        escrow.increaseAmount(id, PRINCIPAL / 2);
        escrow.increaseUnlockTime(id, 4 weeks);
        IVeBTC.Locked memory position = escrow.locked(id);
        assertEq(position.amount, int128(int256(PRINCIPAL * 3 / 2)));
        assertEq(position.end, ((block.timestamp + 4 weeks) / 1 weeks) * 1 weeks);
        vm.expectRevert();
        escrow.createLock(1, 5 weeks);
        vm.warp(position.end);
        escrow.withdraw(id);
        assertEq(IERC20(BTC).balanceOf(user), 3 * PRINCIPAL);
        // The deployed escrow returns address(0) for a burned position.
        assertEq(escrow.ownerOf(id), address(0));
    }

    function testPermanentBTCUnlockUsesThirtyDays() public {
        uint256 id = escrow.createLock(PRINCIPAL, 2 weeks);
        escrow.lockPermanent(id);
        assertTrue(escrow.locked(id).isPermanent);
        escrow.unlockPermanent(id);
        IVeBTC.Locked memory position = escrow.locked(id);
        assertFalse(position.isPermanent);
        assertEq(position.end, ((block.timestamp + 30 days) / 1 weeks) * 1 weeks);
        vm.expectRevert();
        escrow.withdraw(id);
        vm.warp(position.end);
        escrow.withdraw(id);
        assertEq(IERC20(BTC).balanceOf(user), 3 * PRINCIPAL);
    }
}
