// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWealthRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }
    function quoteAddLiquidity(address, address, bool, address, uint256, uint256)
        external
        view
        returns (uint256, uint256, uint256);
    function addLiquidity(address, address, bool, uint256, uint256, uint256, uint256, address, uint256)
        external
        returns (uint256, uint256, uint256);
    function quoteRemoveLiquidity(address, address, bool, address, uint256) external view returns (uint256, uint256);
    function removeLiquidity(address, address, bool, uint256, uint256, uint256, address, uint256)
        external
        returns (uint256, uint256);
    function swapExactTokensForTokens(uint256, uint256, Route[] calldata, address, uint256)
        external
        returns (uint256[] memory);
    function getAmountsOut(uint256, Route[] calldata) external view returns (uint256[] memory);
}

interface IWealthPool is IERC20 {
    function getReserves() external view returns (uint256, uint256, uint256);
    function claimFees() external returns (uint256, uint256);
}

interface IWealthEscrow {
    struct Locked {
        int128 amount;
        uint256 end;
        bool isPermanent;
        uint256 boost;
    }
    function createLock(uint256, uint256) external returns (uint256);
    function increaseAmount(uint256, uint256) external;
    function increaseUnlockTime(uint256, uint256) external;
    function lockPermanent(uint256) external;
    function unlockPermanent(uint256) external;
    function withdraw(uint256) external;
    function checkpoint() external;
    function locked(uint256) external view returns (Locked memory);
    function ownerOf(uint256) external view returns (address);
}

contract WealthFixtureToken is ERC20 {
    uint8 immutable tokenDecimals;

    constructor(uint8 d) ERC20("Local fixture", "FIX") {
        tokenDecimals = d;
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Local fork only. Deployed router/pool/escrow code is exercised, while
/// token contracts (including Cosmos precompiles) are replaced with fixtures.
/// This never broadcasts and does not prove a live token deposit.
contract PocketWealthForkTest is Test {
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant BTC = 0x7b7C000000000000000000000000000000000000;
    address constant USDC = 0xe1a26db653708A2AD8F824E92Db9852410e33A59;
    address constant USDT = 0x629320719a6190bd145C277226fd45e7648F950A;
    address constant MEZO = 0x7B7c000000000000000000000000000000000001;
    address constant FACTORY = 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A;
    IWealthRouter constant router = IWealthRouter(0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9);
    IWealthEscrow constant escrow = IWealthEscrow(0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b);
    address user;

    function setUp() public {
        string memory rpc = vm.envOr("MEZO_POOL_FORK_RPC", string(""));
        vm.skip(bytes(rpc).length == 0);
        vm.createSelectFork(rpc, 16525761);
        user = makeAddr("pocket-local-wealth-user");
    }

    function tokenFixture(address token, uint8 decimals) internal {
        WealthFixtureToken fixture = new WealthFixtureToken(decimals);
        vm.etch(token, address(fixture).code);
    }

    function exercisePool(address poolAddress, address other, bool stable, uint8 decimals) internal {
        IWealthPool pool = IWealthPool(poolAddress);
        (uint256 r0, uint256 r1,) = pool.getReserves();
        tokenFixture(MUSD, 18);
        tokenFixture(other, decimals);
        WealthFixtureToken(MUSD).mint(poolAddress, r0);
        WealthFixtureToken(other).mint(poolAddress, r1);
        uint256 deposit0 = 100 ether;
        uint256 deposit1 = r0 == 0 ? 100 * 10 ** decimals : deposit0 * r1 / r0;
        WealthFixtureToken(MUSD).mint(user, deposit0);
        WealthFixtureToken(other).mint(user, deposit1);
        vm.startPrank(user);
        IERC20(MUSD).approve(address(router), deposit0);
        IERC20(other).approve(address(router), deposit1);
        (uint256 used0, uint256 used1, uint256 lp) = router.addLiquidity(
            MUSD,
            other,
            stable,
            deposit0,
            deposit1,
            deposit0 * 99 / 100,
            deposit1 * 99 / 100,
            user,
            block.timestamp + 300
        );
        assertGt(lp, 0);
        assertEq(pool.balanceOf(user), lp);
        assertEq(IERC20(MUSD).balanceOf(user), deposit0 - used0);
        assertEq(IERC20(other).balanceOf(user), deposit1 - used1);
        pool.approve(address(router), lp);
        (uint256 amount0, uint256 amount1) = router.quoteRemoveLiquidity(MUSD, other, stable, FACTORY, lp / 2);
        vm.expectRevert();
        router.removeLiquidity(MUSD, other, stable, lp / 2, type(uint256).max, amount1, user, block.timestamp + 300);
        assertEq(pool.balanceOf(user), lp);
        router.removeLiquidity(
            MUSD, other, stable, lp / 2, amount0 * 99 / 100, amount1 * 99 / 100, user, block.timestamp + 300
        );
        assertEq(pool.balanceOf(user), lp - lp / 2);
        vm.stopPrank();
        exerciseFees(pool, other, stable);
    }

    function exerciseFees(IWealthPool pool, address other, bool stable) internal {
        // Generate real pool-fee accounting with a local fixture swap.
        address trader = makeAddr("local-fee-trader");
        WealthFixtureToken(MUSD).mint(trader, 10 ether);
        IWealthRouter.Route[] memory routes = new IWealthRouter.Route[](1);
        routes[0] = IWealthRouter.Route(MUSD, other, stable, FACTORY);
        vm.startPrank(trader);
        IERC20(MUSD).approve(address(router), 10 ether);
        uint256[] memory quote = router.getAmountsOut(10 ether, routes);
        vm.expectRevert();
        router.swapExactTokensForTokens(10 ether, type(uint256).max, routes, trader, block.timestamp + 300);
        router.swapExactTokensForTokens(10 ether, quote[1] * 99 / 100, routes, trader, block.timestamp + 300);
        assertEq(IERC20(MUSD).balanceOf(trader), 0);
        assertGe(IERC20(other).balanceOf(trader), quote[1] * 99 / 100);
        uint256 reverseAmount = IERC20(other).balanceOf(trader) / 2;
        IERC20(other).approve(address(router), reverseAmount);
        routes[0] = IWealthRouter.Route(other, MUSD, stable, FACTORY);
        quote = router.getAmountsOut(reverseAmount, routes);
        router.swapExactTokensForTokens(reverseAmount, quote[1] * 99 / 100, routes, trader, block.timestamp + 300);
        assertGe(IERC20(MUSD).balanceOf(trader), quote[1] * 99 / 100);
        vm.stopPrank();
        uint256 beforeFees = IERC20(MUSD).balanceOf(user);
        vm.prank(user);
        (uint256 fee0,) = pool.claimFees();
        assertGt(fee0, 0);
        assertEq(IERC20(MUSD).balanceOf(user), beforeFees + fee0);
    }

    function test_BtcPoolDepositWithdrawAndFees() public {
        exercisePool(0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9, BTC, false, 18);
    }

    function test_UsdcPoolDepositWithdrawAndFees() public {
        exercisePool(0x525F049A4494dA0a6c87E3C4df55f9929765Dc3e, USDC, true, 6);
    }

    function test_EmptyUsdtPoolFirstDepositWithdrawAndFees() public {
        exercisePool(0x27414B76CF00E24ed087adb56E26bAeEEe93494e, USDT, true, 6);
    }

    function newLock() internal returns (uint256 id) {
        tokenFixture(MEZO, 18);
        WealthFixtureToken(MEZO).mint(user, 25 ether);
        vm.startPrank(user);
        IERC20(MEZO).approve(address(escrow), 25 ether);
        id = escrow.createLock(20 ether, 4 weeks);
        vm.stopPrank();
        assertEq(escrow.ownerOf(id), user);
    }

    function test_LockCreateTopUpExtendAndWithdraw() public {
        uint256 id = newLock();
        vm.startPrank(user);
        escrow.increaseAmount(id, 5 ether);
        assertEq(int256(escrow.locked(id).amount), 25 ether);
        escrow.increaseUnlockTime(id, 26 weeks);
        assertEq(escrow.locked(id).end, ((block.timestamp + 26 weeks) / 1 weeks) * 1 weeks);
        vm.expectRevert();
        escrow.withdraw(id);
        vm.warp(escrow.locked(id).end);
        escrow.withdraw(id);
        vm.stopPrank();
        assertEq(IERC20(MEZO).balanceOf(user), 25 ether);
    }

    function test_PermanentLockStartsFullCountdownBeforeWithdrawal() public {
        uint256 id = newLock();
        vm.startPrank(user);
        escrow.lockPermanent(id);
        assertTrue(escrow.locked(id).isPermanent);
        vm.expectRevert();
        escrow.withdraw(id);
        escrow.unlockPermanent(id);
        uint256 end = ((block.timestamp + 208 weeks) / 1 weeks) * 1 weeks;
        assertEq(escrow.locked(id).end, end);
        vm.expectRevert();
        escrow.withdraw(id);
        // Keep global checkpoints current as normal chain activity would.
        // Jumping four idle years in one call exceeds the fork block gas limit.
        while (block.timestamp + 26 weeks < end) {
            vm.warp(block.timestamp + 26 weeks);
            escrow.checkpoint();
        }
        vm.warp(end);
        escrow.withdraw(id);
        vm.stopPrank();
        assertEq(IERC20(MEZO).balanceOf(user), 25 ether);
    }
}
