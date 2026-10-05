// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {PocketVault} from "../src/PocketVault.sol";

/// Minimal mintable ERC-20 standing in for Mezo testnet mUSD.
contract MockMUSD is ERC20 {
    constructor() ERC20("Mock mUSD", "mUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PocketVaultTest is Test {
    MockMUSD internal musd;
    PocketVault internal vault;

    address internal admin = makeAddr("admin");
    address internal engine = makeAddr("engine");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    bytes32 internal constant PID = keccak256("payment-1");

    function setUp() public {
        musd = new MockMUSD();
        vault = new PocketVault(address(musd), admin, engine);
        // Seed the vault with liquidity, as the relayer will on Mezo testnet.
        musd.mint(address(vault), 1_000e18);
    }

    function test_RolesAssignedAtConstruction() public view {
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(vault.hasRole(vault.ENGINE_ROLE(), engine));
        assertEq(address(vault.musd()), address(musd));
        assertEq(vault.liquidity(), 1_000e18);
    }

    function test_ConstructorRejectsZeroAddresses() public {
        vm.expectRevert(PocketVault.ZeroAddress.selector);
        new PocketVault(address(0), admin, engine);
        vm.expectRevert(PocketVault.ZeroAddress.selector);
        new PocketVault(address(musd), address(0), engine);
        vm.expectRevert(PocketVault.ZeroAddress.selector);
        new PocketVault(address(musd), admin, address(0));
    }

    function test_DepositPullsTokens() public {
        musd.mint(alice, 50e18);
        vm.startPrank(alice);
        musd.approve(address(vault), 50e18);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PocketVault.Deposit(alice, 50e18, PID);
        vault.deposit(50e18, PID);
        vm.stopPrank();
        assertEq(vault.liquidity(), 1_050e18);
        assertEq(musd.balanceOf(alice), 0);
    }

    function test_DepositRevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(PocketVault.ZeroAmount.selector);
        vault.deposit(0, PID);
    }

    function test_PayoutByEngine() public {
        vm.prank(engine);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PocketVault.Payout(bob, 20e18, PID);
        vault.payout(bob, 20e18, PID);
        assertEq(musd.balanceOf(bob), 20e18);
        assertEq(vault.liquidity(), 980e18);
        assertTrue(vault.processed(PID));
    }

    function test_PayoutRevertsForNonEngine() public {
        bytes32 role = vault.ENGINE_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                role
            )
        );
        vm.prank(alice);
        vault.payout(bob, 20e18, PID);
    }

    function test_PayoutIsIdempotentOnPaymentId() public {
        vm.startPrank(engine);
        vault.payout(bob, 20e18, PID);
        vm.expectRevert(abi.encodeWithSelector(PocketVault.AlreadyProcessed.selector, PID));
        vault.payout(bob, 20e18, PID);
        vm.stopPrank();
        assertEq(musd.balanceOf(bob), 20e18);
    }

    function test_PayoutRevertsOnInsufficientLiquidity() public {
        vm.prank(engine);
        vm.expectRevert(
            abi.encodeWithSelector(PocketVault.InsufficientLiquidity.selector, 2_000e18, 1_000e18)
        );
        vault.payout(bob, 2_000e18, PID);
    }

    function test_WithdrawByEngineEmitsWithdraw() public {
        vm.prank(engine);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PocketVault.Withdraw(bob, 15e18, PID);
        vault.withdraw(bob, 15e18, PID);
        assertEq(musd.balanceOf(bob), 15e18);
    }

    function test_PayoutAndWithdrawShareReplayGuard() public {
        vm.startPrank(engine);
        vault.payout(bob, 10e18, PID);
        vm.expectRevert(abi.encodeWithSelector(PocketVault.AlreadyProcessed.selector, PID));
        vault.withdraw(bob, 10e18, PID);
        vm.stopPrank();
    }

    function test_AdminCanRotateEngine() public {
        address newEngine = makeAddr("newEngine");
        vm.startPrank(admin);
        vault.grantRole(vault.ENGINE_ROLE(), newEngine);
        vault.revokeRole(vault.ENGINE_ROLE(), engine);
        vm.stopPrank();

        vm.prank(newEngine);
        vault.payout(bob, 5e18, PID);
        assertEq(musd.balanceOf(bob), 5e18);
    }
}
