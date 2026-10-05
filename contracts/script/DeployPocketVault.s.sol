// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PocketVault} from "../src/PocketVault.sol";

/// @notice Deploys PocketVault. All inputs come from the environment so no key
///         or address is committed. Broadcasting this against Mezo testnet is a
///         real on-chain action — only run it after explicit confirmation.
///
/// Required env:
///   MUSD_ADDRESS          - MUSD ERC-20 (Mezo testnet: 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503)
///   VAULT_ADMIN           - DEFAULT_ADMIN_ROLE holder (relayer address for the demo)
///   VAULT_ENGINE          - ENGINE_ROLE holder (relayer / settlement-engine address)
///   DEPLOYER_PRIVATE_KEY  - funded deployer (relayer key)
contract DeployPocketVault is Script {
    function run() external returns (PocketVault vault) {
        address musd = vm.envAddress("MUSD_ADDRESS");
        address admin = vm.envAddress("VAULT_ADMIN");
        address engine = vm.envAddress("VAULT_ENGINE");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        vault = new PocketVault(musd, admin, engine);
        vm.stopBroadcast();

        console2.log("PocketVault deployed:", address(vault));
        console2.log("  musd  :", musd);
        console2.log("  admin :", admin);
        console2.log("  engine:", engine);
    }
}
