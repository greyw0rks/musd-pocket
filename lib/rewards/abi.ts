import { parseAbi } from "viem";

export const WELCOME_REWARD_ABI = parseAbi([
  "function rewardToken() view returns (address)",
  "function votingEscrow() view returns (address)",
  "function authorizer() view returns (address)",
  "function rewardAmount() view returns (uint256)",
  "function lockDuration() view returns (uint256)",
  "function paused() view returns (bool)",
  "function walletClaimed(address) view returns (bool)",
  "function claims(bytes32) view returns (address recipient, uint256 tokenId, uint256 amount, uint256 unlockAt)",
  "function claim(bytes32 claimId, address recipient, uint256 deadline, bytes signature) returns (uint256 tokenId)",
  "event WelcomeClaimed(bytes32 indexed claimId, address indexed recipient, uint256 indexed tokenId, uint256 amount, uint256 unlockAt)",
  "error AlreadyClaimed()",
  "error InvalidConfiguration()",
  "error InvalidVoucher()",
  "error InvalidLock()",
]);

export const WELCOME_ESCROW_ABI = parseAbi([
  "function token() view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerToNFTokenIdList(address owner, uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function locked(uint256 tokenId) view returns ((int128 amount, uint256 end, bool isPermanent, uint256 boost))",
  "function withdraw(uint256 tokenId)",
]);

export const WELCOME_CLAIM_TYPES = {
  WelcomeClaim: [
    { name: "claimId", type: "bytes32" },
    { name: "recipient", type: "address" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const REWARD_EPOCH_SECONDS = 604_800n;
export const MEZO_REWARD_TOKEN =
  "0x7B7c000000000000000000000000000000000001" as const;
export const TESTNET_VEMEZO =
  "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b" as const;
export const WELCOME_MEZO_AMOUNT = 20n * 10n ** 18n;
export const WELCOME_LOCK_DURATION = 2n * REWARD_EPOCH_SECONDS;

export function epochUnlockAt(timestamp: bigint, duration: bigint): bigint {
  return ((timestamp + duration) / REWARD_EPOCH_SECONDS) * REWARD_EPOCH_SECONDS;
}
