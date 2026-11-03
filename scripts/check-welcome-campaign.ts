// Inspect the configured campaign without a signer, voucher or database mutation.
import { writeFile } from "node:fs/promises";
import { erc20Abi, formatUnits, isAddress, parseAbi } from "viem";
import { getPublicClient } from "../lib/mezo/musd";
import { CHAIN_ID } from "../lib/mezo/config";
import { MEZO_REWARD_TOKEN, TESTNET_VEMEZO } from "../lib/rewards/abi";
async function main(){
const campaign=process.env.POCKET_WELCOME_REWARD_ADDRESS;
if(!campaign||!isAddress(campaign)||process.env.POCKET_WELCOME_REWARD_CHAIN_ID!=="31611")throw new Error("Campaign address/chain is not configured.");
const rpc=getPublicClient();if(CHAIN_ID!==31611||await rpc.getChainId()!==31611)throw new Error("Mezo testnet only.");
const blockNumber=await rpc.getBlockNumber();
const abi=parseAbi(["function rewardToken() view returns(address)","function votingEscrow() view returns(address)","function authorizer() view returns(address)","function owner() view returns(address)","function rewardAmount() view returns(uint256)","function lockDuration() view returns(uint256)","function paused() view returns(bool)","function walletClaimed(address) view returns(bool)"]);
const [code,token,escrow,authorizer,owner,amount,duration,paused,inventory,borrowerClaimed,merchantClaimed]=await Promise.all([
rpc.getCode({address:campaign,blockNumber}),
rpc.readContract({address:campaign,abi,functionName:"rewardToken",blockNumber}),
rpc.readContract({address:campaign,abi,functionName:"votingEscrow",blockNumber}),
rpc.readContract({address:campaign,abi,functionName:"authorizer",blockNumber}),
rpc.readContract({address:campaign,abi,functionName:"owner",blockNumber}),
rpc.readContract({address:campaign,abi,functionName:"rewardAmount",blockNumber}),
rpc.readContract({address:campaign,abi,functionName:"lockDuration",blockNumber}),
rpc.readContract({address:campaign,abi,functionName:"paused",blockNumber}),
rpc.readContract({address:MEZO_REWARD_TOKEN,abi:erc20Abi,functionName:"balanceOf",args:[campaign],blockNumber}),
rpc.readContract({address:campaign,abi,functionName:"walletClaimed",args:["0xe66d1c48792a320c16d7abd90c835b25a0ac37db"],blockNumber}),
rpc.readContract({address:campaign,abi,functionName:"walletClaimed",args:["0x0a5e59ca4f182561de80172c6da5db927091ea29"],blockNumber})]);
const expected={token:MEZO_REWARD_TOKEN,escrow:TESTNET_VEMEZO,authorizer:"0xBA46d08B9E298E8E70096Fc238Da207139BCCAB7",rewardAmount:"20000000000000000000",lockDuration:"1209600"};
const valid=Boolean(code&&code!=="0x")&&String(token).toLowerCase()===expected.token.toLowerCase()&&String(escrow).toLowerCase()===expected.escrow.toLowerCase()&&String(authorizer).toLowerCase()===expected.authorizer.toLowerCase()&&String(amount)===expected.rewardAmount&&String(duration)===expected.lockDuration;
const report={capturedAt:new Date().toISOString(),chainId:CHAIN_ID,block:String(blockNumber),campaign,configuredInProduction:true,configurationMatches:valid,token,escrow,authorizer,owner,rewardMezo:formatUnits(amount as bigint,18),lockDurationSeconds:String(duration),paused,inventoryMezo:formatUnits(inventory,18),fundedClaims:Number(inventory/(amount as bigint)),borrowerWalletAlreadyClaimed:borrowerClaimed,merchantWalletAlreadyClaimed:merchantClaimed,broadcasts:0};
await writeFile("docs/evidence/wave-2-welcome-campaign.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));if(!valid)process.exitCode=1;
}
main().catch(error=>{console.error(error.shortMessage??error.message);process.exitCode=1;});

