// Verify an intended partial repayment after the user signs it in Pocket.
import {writeFile} from "node:fs/promises";
import {decodeEventLog,decodeFunctionData,erc20Abi,formatUnits,parseAbi,zeroAddress,type Hex} from "viem";
import {getPublicClient} from "../lib/mezo/musd";
import {activeBorrow,CHAIN_ID,MUSD_ADDRESS} from "../lib/mezo/config";
import {TROVE_MANAGER_ABI} from "../lib/mezo/borrow";
import {BORROWER_OPERATIONS_ABI} from "../lib/mezo/borrow-write";
// Pinned to the verified testnet implementation and InterestRateMath source.
const implementation="0x9aab567966983e95536fc460c12266fb0cc10b07";
const implementationSlot="0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;
const detailAbi=parseAbi([
"function Troves(address) view returns(uint256 coll,uint256 principal,uint256 interestOwed,uint256 stake,uint8 status,uint16 interestRate,uint256 lastInterestUpdateTime,uint256 maxBorrowingCapacity,uint128 arrayIndex)",
"function getPendingDebt(address) view returns(uint256 pendingPrincipal,uint256 pendingInterest)",
"function getPendingCollateral(address) view returns(uint256)"
]);
const eventAbi=parseAbi(["event TroveUpdated(address indexed _borrower,uint256 _principal,uint256 _interest,uint256 _coll,uint256 _stake,uint16 _interestRate,uint256 _lastInterestUpdateTime,uint8 _operation)"]);
const interest=(principal:bigint,rate:number,start:bigint,end:bigint)=>{
if(end<start)throw new Error("Invalid interest timestamps.");
return principal*BigInt(rate)*(end-start)/(10000n*31556952n);
};
async function main(){
const hash=process.argv[2] as Hex;if(!/^0x[0-9a-fA-F]{64}$/.test(hash??""))throw new Error("Pass the user-signed repay transaction hash.");
const rpc=getPublicClient();if(CHAIN_ID!==31611||await rpc.getChainId()!==31611)throw new Error("Mezo testnet only.");
const receipt=await rpc.waitForTransactionReceipt({hash,timeout:60000});
if(receipt.status!=="success")throw new Error("Repayment reverted.");
let from:string,to:string|null,input:Hex;
try{const tx=await rpc.getTransaction({hash});from=tx.from;to=tx.to;input=tx.input;}
catch{
const response=await fetch(`https://api.explorer.test.mezo.org/api/v2/transactions/${hash}`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error("Transaction proof unavailable.");
const tx=await response.json();if(tx.hash?.toLowerCase()!==hash.toLowerCase()||tx.status!=="ok"||BigInt(tx.block_number)!==receipt.blockNumber)throw new Error("Explorer proof does not match the receipt.");from=tx.from.hash;to=tx.to?.hash??null;input=tx.raw_input;
}
const owner="0xe66d1c48792a320c16d7abd90c835b25a0ac37db" as const;
if(from.toLowerCase()!==owner||to?.toLowerCase()!==activeBorrow.borrowerOperations.toLowerCase())throw new Error("Wrong borrower or protocol target.");
const call=decodeFunctionData({abi:BORROWER_OPERATIONS_ABI,data:input});if(call.functionName!=="repayMUSD")throw new Error("This is not a partial repayment.");
const amount=call.args[0];if(amount!==10000000000000000000n)throw new Error("Repayment differs from the approved 10 mUSD.");
async function state(blockNumber:bigint){const[debt,collateral,balance,trove,block,impl,pendingDebt,pendingCollateral]=await Promise.all([
rpc.readContract({address:activeBorrow.troveManager,abi:TROVE_MANAGER_ABI,functionName:"getTroveDebt",args:[owner],blockNumber}),
rpc.readContract({address:activeBorrow.troveManager,abi:TROVE_MANAGER_ABI,functionName:"getTroveColl",args:[owner],blockNumber}),
rpc.readContract({address:MUSD_ADDRESS,abi:erc20Abi,functionName:"balanceOf",args:[owner],blockNumber}),
rpc.readContract({address:activeBorrow.troveManager,abi:detailAbi,functionName:"Troves",args:[owner],blockNumber}),
rpc.getBlock({blockNumber}),
rpc.getStorageAt({address:activeBorrow.troveManager,slot:implementationSlot,blockNumber}),
rpc.readContract({address:activeBorrow.troveManager,abi:detailAbi,functionName:"getPendingDebt",args:[owner],blockNumber}),
rpc.readContract({address:activeBorrow.troveManager,abi:detailAbi,functionName:"getPendingCollateral",args:[owner],blockNumber})
]);
if(`0x${impl?.slice(-40)}`.toLowerCase()!==implementation)throw new Error("Interest implementation differs from the inspected source.");
const[coll,principal,interestOwed,,status,rate,updatedAt]=trove;
if(coll!==collateral||debt!==principal+interestOwed+interest(principal,rate,updatedAt,block.timestamp))throw new Error("Source-derived debt does not match the protocol read.");
// Fail closed on redistribution rather than concealing an unrelated state change.
if(pendingDebt.some(value=>value!==0n)||pendingCollateral!==0n)throw new Error("Pending redistribution requires separate transaction-level analysis.");
return{debt,collateral,balance,principal,interestOwed,status,rate,updatedAt,timestamp:block.timestamp};}
const[before,after]=await Promise.all([state(receipt.blockNumber-1n),state(receipt.blockNumber)]);
const owedAtRepayment=before.interestOwed+interest(before.principal,before.rate,before.updatedAt,after.timestamp);
const debtAtRepaymentBeforeBurn=before.principal+owedAtRepayment;
const accruedBetweenBlocks=debtAtRepaymentBeforeBurn-before.debt;
const interestPaid=amount<owedAtRepayment?amount:owedAtRepayment;
const principalPaid=amount-interestPaid;
let protocolEventMatches=false;
for(const log of receipt.logs){
if(log.address.toLowerCase()!==activeBorrow.borrowerOperations.toLowerCase())continue;
try{const e=decodeEventLog({abi:eventAbi,eventName:"TroveUpdated",data:log.data,topics:log.topics});protocolEventMatches ||= e.args._borrower.toLowerCase()===owner&&e.args._principal===after.principal&&e.args._interest===after.interestOwed&&e.args._coll===after.collateral&&e.args._interestRate===after.rate&&e.args._lastInterestUpdateTime===after.updatedAt;}catch{}
}
let burned=0n;for(const log of receipt.logs){if(log.address.toLowerCase()!==MUSD_ADDRESS.toLowerCase())continue;try{const event=decodeEventLog({abi:erc20Abi,eventName:"Transfer",data:log.data,topics:log.topics});if(event.args.from.toLowerCase()===owner&&event.args.to.toLowerCase()===zeroAddress)burned+=event.args.value;}catch{}}
const exactDebtReduction=debtAtRepaymentBeforeBurn-after.debt===amount;
const passed=before.status===1&&after.status===1&&exactDebtReduction&&protocolEventMatches&&before.collateral===after.collateral&&before.balance-after.balance===amount&&burned===amount&&after.principal===before.principal-principalPaid&&after.interestOwed===owedAtRepayment-interestPaid&&after.updatedAt===after.timestamp&&after.rate===before.rate;
const format=(state:typeof before)=>({debtMusd:formatUnits(state.debt,18),collateralBtc:formatUnits(state.collateral,18),walletMusd:formatUnits(state.balance,18),principalMusd:formatUnits(state.principal,18),interestOwedMusd:formatUnits(state.interestOwed,18),interestRateBps:state.rate,lastInterestUpdateTime:String(state.updatedAt),blockTimestamp:String(state.timestamp),status:state.status});
const report={capturedAt:new Date().toISOString(),chainId:31611,hash,owner,block:String(receipt.blockNumber),status:receipt.status,requestedRepayMusd:formatUnits(amount,18),burnedMusd:formatUnits(burned,18),before:format(before),after:format(after),debtAtRepaymentBeforeBurnMusd:formatUnits(debtAtRepaymentBeforeBurn,18),accruedBetweenBlocksMusd:formatUnits(accruedBetweenBlocks,18),interestPaidMusd:formatUnits(interestPaid,18),principalPaidMusd:formatUnits(principalPaid,18),rawBlockDebtReductionMusd:formatUnits(before.debt-after.debt,18),exactDebtReductionAfterAccrual:exactDebtReduction,protocolEventMatches,collateralUnchanged:before.collateral===after.collateral,sourceImplementation:implementation,sourceUrl:`https://api.explorer.test.mezo.org/api/v2/smart-contracts/${implementation}`,passed,broadcasts:0};
await writeFile("docs/evidence/wave-2-repayment-proof.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));if(!passed)process.exitCode=1;
}
main().catch(error=>{console.error(error.shortMessage??error.message);process.exitCode=1;});
