// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PocketWelcomeReward} from "../src/PocketWelcomeReward.sol";

/// @notice Deployment only. Fund the returned campaign separately after reviewing the budget.
contract DeployPocketWelcomeReward is Script {
    function run() external returns (PocketWelcomeReward campaign) {
        require(block.chainid == 31611, "Mezo testnet only");
        address authorizer = vm.envAddress("WELCOME_REWARD_AUTHORIZER");
        address admin = vm.envAddress("WELCOME_REWARD_ADMIN");
        // A dry run needs only --sender. A real --broadcast run uses the
        // operator's configured CLI signer / encrypted keystore.
        vm.startBroadcast();
        campaign = new PocketWelcomeReward(
            0x7B7c000000000000000000000000000000000001,
            0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b,
            authorizer, admin
        );
        vm.stopBroadcast();
        console2.log("Pocket welcome campaign:", address(campaign));
        console2.log("MEZO per claim:", campaign.rewardAmount());
        console2.log("Lock duration in seconds:", campaign.lockDuration());
    }
}
