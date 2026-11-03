// Verify an intended partial repayment after the user signs it in Pocket.
import {writeFile} from "node:fs/promises";
import {decodeEventLog,decodeFunctionData,erc20Abi,formatUnits,zeroAddress,type Hex} from "viem";
import {getPublicClient} from "../lib/mezo/musd";
import {activeBorrow,CHAIN_ID,MUSD_ADDRESS} from "../lib/mezo/config";
import {TROVE_MANAGER_ABI} from "../lib/mezo/borrow";
import {BORROWER_OPERATIONS_ABI} from "../lib/mezo/borrow-write";
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
async function state(blockNumber:bigint){const[debt,collateral,balance]=await Promise.all([
rpc.readContract({address:activeBorrow.troveManager,abi:TROVE_MANAGER_ABI,functionName:"getTroveDebt",args:[owner],blockNumber}),
rpc.readContract({address:activeBorrow.troveManager,abi:TROVE_MANAGER_ABI,functionName:"getTroveColl",args:[owner],blockNumber}),
rpc.readContract({address:MUSD_ADDRESS,abi:erc20Abi,functionName:"balanceOf",args:[owner],blockNumber})
]);return{debt,collateral,balance};}
const[before,after]=await Promise.all([state(receipt.blockNumber-1n),state(receipt.blockNumber)]);
let burned=0n;for(const log of receipt.logs){if(log.address.toLowerCase()!==MUSD_ADDRESS.toLowerCase())continue;try{const event=decodeEventLog({abi:erc20Abi,eventName:"Transfer",data:log.data,topics:log.topics});if(event.args.from.toLowerCase()===owner&&event.args.to.toLowerCase()===zeroAddress)burned+=event.args.value;}catch{}}
const passed=before.debt-after.debt===amount&&before.collateral===after.collateral&&before.balance-after.balance===amount&&burned===amount;
const format=(state:{debt:bigint;collateral:bigint;balance:bigint})=>({debtMusd:formatUnits(state.debt,18),collateralBtc:formatUnits(state.collateral,18),walletMusd:formatUnits(state.balance,18)});
const report={capturedAt:new Date().toISOString(),chainId:31611,hash,owner,block:String(receipt.blockNumber),status:receipt.status,requestedRepayMusd:formatUnits(amount,18),burnedMusd:formatUnits(burned,18),before:format(before),after:format(after),exactDebtReduction:before.debt-after.debt===amount,collateralUnchanged:before.collateral===after.collateral,passed,broadcasts:0};
await writeFile("docs/evidence/wave-2-repayment-proof.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));if(!passed)process.exitCode=1;
}
main().catch(error=>{console.error(error.shortMessage??error.message);process.exitCode=1;});

