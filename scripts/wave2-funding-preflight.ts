// Read-only Wave 2 funding and proposed repayment review. Never signs or broadcasts.
import { readFile, writeFile } from "node:fs/promises";
import { encodeDeployData, erc20Abi, formatEther, formatUnits, parseEther, parseUnits, parseAbi, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getPublicClient } from "../lib/mezo/musd";
import { activeBorrow, CHAIN_ID, MUSD_ADDRESS } from "../lib/mezo/config";
import { TROVE_MANAGER_ABI, PRICE_FEED_ABI, TROVE_STATUS } from "../lib/mezo/borrow";
import { BORROWER_OPERATIONS_ABI } from "../lib/mezo/borrow-write";
import { MEZO_REWARD_TOKEN } from "../lib/rewards/abi";
import { TESTNET_VEMEZO } from "../lib/rewards/abi";
async function main() {
const rpc=getPublicClient();
if(CHAIN_ID!==31611||await rpc.getChainId()!==31611) throw new Error("Mezo testnet only.");
const owner="0xe66d1c48792a320c16d7abd90c835b25a0ac37db" as const;
const merchant="0x0a5e59ca4f182561de80172c6da5db927091ea29" as const;
const key=process.env.RELAYER_PRIVATE_KEY;
if(!key) throw new Error("Relayer is not configured.");
const relayer=privateKeyToAccount(key as `0x${string}`).address;
const block=await rpc.getBlock();const blockNumber=block.number;
async function balances(address:`0x${string}`){
const [btc,musd,mezo]=await Promise.all([rpc.getBalance({address,blockNumber}),rpc.readContract({address:MUSD_ADDRESS,abi:erc20Abi,functionName:"balanceOf",args:[address],blockNumber}),rpc.readContract({address:MEZO_REWARD_TOKEN,abi:erc20Abi,functionName:"balanceOf",args:[address],blockNumber})]);
return{address,btc:formatEther(btc),musd:formatUnits(musd,18),mezo:formatUnits(mezo,18)};
}
const [ownerFunds,merchantFunds,relayerFunds,status,debt,price,minNetDebt]=await Promise.all([
balances(owner),balances(merchant),balances(relayer),
rpc.readContract({address:activeBorrow.troveManager,abi:TROVE_MANAGER_ABI,functionName:"getTroveStatus",args:[owner],blockNumber}),
rpc.readContract({address:activeBorrow.troveManager,abi:TROVE_MANAGER_ABI,functionName:"getTroveDebt",args:[owner],blockNumber}),
rpc.readContract({address:activeBorrow.priceFeed,abi:PRICE_FEED_ABI,functionName:"fetchPrice",blockNumber}),
rpc.readContract({address:activeBorrow.borrowerOperations,abi:BORROWER_OPERATIONS_ABI,functionName:"minNetDebt",blockNumber})
]);
const collateral=parseEther("0.05"),draw=parseUnits("2000",18),repay=parseUnits("10",18);
const feeAbi=parseAbi(["function getBorrowingFee(uint256) view returns (uint256)"]);
const [fee,recovery,gasPrice]=await Promise.all([
rpc.readContract({address:activeBorrow.borrowerOperations,abi:feeAbi,functionName:"getBorrowingFee",args:[draw],blockNumber}),
rpc.readContract({address:activeBorrow.troveManager,abi:TROVE_MANAGER_ABI,functionName:"checkRecoveryMode",args:[price],blockNumber}),rpc.getGasPrice()
]);
const artifact=JSON.parse(await readFile("contracts/out/PocketWelcomeReward.sol/PocketWelcomeReward.json","utf8"));
const deploymentData=encodeDeployData({abi:artifact.abi,bytecode:artifact.bytecode.object,args:[MEZO_REWARD_TOKEN,TESTNET_VEMEZO,relayer,relayer]});
const deploymentGas=await rpc.estimateGas({account:relayer,data:deploymentData});
const composite=draw+fee+parseUnits("200",18);
const open={account:owner,address:activeBorrow.borrowerOperations,abi:BORROWER_OPERATIONS_ABI,functionName:"openTrove" as const,args:[draw,zeroAddress,zeroAddress] as const,value:collateral};
let simulation:{passed:boolean;estimatedBtcFee?:string;reason?:string};
try {await rpc.simulateContract({...open,blockNumber});const gas=await rpc.estimateContractGas(open);simulation={passed:true,estimatedBtcFee:formatEther(gas*gasPrice)};}
catch(error){simulation={passed:false,reason:(error as {shortMessage?:string}).shortMessage??"Simulation unavailable"};}
const report={capturedAt:new Date().toISOString(),block:blockNumber.toString(),chainId:CHAIN_ID,broadcasts:0,owner:ownerFunds,merchant:merchantFunds,relayer:relayerFunds,
welcome:{proposedClaims:5,rewardMezo:"20",proposedInventoryMezo:"100",adminAndAuthorizer:relayer,estimatedDeploymentBtcFee:formatEther(deploymentGas*gasPrice),campaignConfigured:Boolean(process.env.POCKET_WELCOME_REWARD_ADDRESS)},
repayment:{owner,existingStatus:TROVE_STATUS[status as keyof typeof TROVE_STATUS],existingDebt:formatUnits(debt,18),proposalOnly:true,btcCollateral:"0.05",musdDraw:"2000",borrowingFeeMusd:formatUnits(fee,18),gasReserveMusd:"200",compositeDebtMusd:formatUnits(composite,18),partialRepaymentMusd:"10",remainingNetDebtMusd:formatUnits(draw+fee-repay,18),minimumNetDebtMusd:formatUnits(minNetDebt,18),btcPriceUsd:formatUnits(price,18),collateralRatioPercent:(Number(collateral*price/composite)/1e16).toFixed(2),recoveryMode:recovery,simulation,userWalletSignatureRequired:true}};
await writeFile("docs/evidence/wave-2-funding-preflight.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error.shortMessage??"Read-only preflight could not complete.");process.exitCode=1;});
