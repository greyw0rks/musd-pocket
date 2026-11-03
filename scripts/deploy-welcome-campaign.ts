// Approved scope: deploy a 20-MEZO campaign and fund exactly 100 testnet MEZO.
// No claims. Aggregate signed gas upper bound is capped at 0.000001 BTC.
// Persist intent/nonce before submission; ambiguous outcomes never auto-resend.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createWalletClient, encodeDeployData, encodeFunctionData, erc20Abi, formatEther, formatUnits, http, parseEther, parseUnits, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getPublicClient } from "../lib/mezo/musd";
import { activeChain, CHAIN_ID, RPC_URL } from "../lib/mezo/config";
import { MEZO_REWARD_TOKEN, TESTNET_VEMEZO, WELCOME_REWARD_ABI } from "../lib/rewards/abi";
type Journal={chainId:number;account:Address;stage?:string;nonce?:number;deployHash?:Hex;fundHash?:Hex;campaign?:Address;reservedFeeWei?:string;paidFeeWei?:string;funded?:boolean;capturedAt?:string};
function receiptFee(receipt:{gasUsed:bigint;effectiveGasPrice?:bigint},tx:{gasPrice?:bigint}){
const price=receipt.effectiveGasPrice??tx.gasPrice;
if(price===undefined)throw new Error("Receipt gas price is unavailable; reconcile before continuing.");
return receipt.gasUsed*price;
}
async function main(){
const rpc=getPublicClient();if(CHAIN_ID!==31611||await rpc.getChainId()!==31611)throw new Error("Testnet only.");
let explorerFallbackUsed=false;
async function knownTransaction(hash:Hex){
for(let attempt=0;attempt<8;attempt++){
try{return await rpc.getTransaction({hash});}catch{if(attempt<7)await new Promise(resolve=>setTimeout(resolve,1000));}
}
const response=await fetch(`https://api.explorer.test.mezo.org/api/v2/transactions/${hash}`,{signal:AbortSignal.timeout(10000)});
if(!response.ok)throw new Error("Saved transaction is still unreadable; do not resend.");
const data=await response.json();
if(data.hash?.toLowerCase()!==hash.toLowerCase()||data.status!=="ok"||!Number.isSafeInteger(data.block_number)||!data.from?.hash||!data.raw_input||!data.gas_price)throw new Error("Explorer transaction proof is incomplete.");
explorerFallbackUsed=true;
return{from:data.from.hash as Address,to:(data.to?.hash??null) as Address|null,input:data.raw_input as Hex,gasPrice:BigInt(data.gas_price),blockNumber:BigInt(data.block_number)};
}
const key=process.env.RELAYER_PRIVATE_KEY;if(!key)throw new Error("Relayer key is missing.");
const account=privateKeyToAccount(key as Hex);
if(account.address.toLowerCase()!=="0xba46d08b9e298e8e70096fc238da207139bccab7")throw new Error("Authorizer wallet mismatch.");
const client=createWalletClient({account,chain:activeChain,transport:http(RPC_URL)});
const budget=parseEther("0.000001"),inventory=parseUnits("100",18);
const artifact=JSON.parse(await readFile("contracts/out/PocketWelcomeReward.sol/PocketWelcomeReward.json","utf8"));
const args=[MEZO_REWARD_TOKEN,TESTNET_VEMEZO,account.address,account.address];
const deployData=encodeDeployData({abi:artifact.abi,bytecode:artifact.bytecode.object,args});
const path=".local/wave-2-welcome-deployment.json";
await mkdir(".local",{recursive:true});
let journal:Journal;try{journal=JSON.parse(await readFile(path,"utf8"));}catch(error){if((error as {code?:string}).code!=="ENOENT")throw error;journal={chainId:31611,account:account.address,paidFeeWei:"0",reservedFeeWei:"0"};}
if(journal.chainId!==31611||journal.account.toLowerCase()!==account.address.toLowerCase())throw new Error("Journal identity mismatch.");
async function save(){journal.capturedAt=new Date().toISOString();await writeFile(path+".tmp",JSON.stringify(journal,null,2)+"\n",{mode:0o600});await rename(path+".tmp",path);}
async function bounds(data:Hex,to?:Address){
const [gas,gasPrice,balance]=await Promise.all([rpc.estimateGas({account:account.address,data,...(to?{to}:{})}),rpc.getGasPrice(),rpc.getBalance({address:account.address})]);
const gasLimit=(gas*120n+99n)/100n;const maximum=gasLimit*gasPrice;
if(BigInt(journal.reservedFeeWei??"0")+maximum>budget||balance<maximum)throw new Error("Approved BTC gas cap or available balance would be exceeded.");
return{gas:gasLimit,gasPrice,maximum};
}
const initial=await bounds(deployData);
if(!process.argv.includes("--broadcast")){console.log(JSON.stringify({broadcasts:0,account:account.address,rewardMezo:"20",inventoryMezo:"100",estimatedDeploymentUpperBoundBtc:formatEther(initial.maximum),gasBudgetBtc:formatEther(budget),journalStage:journal.stage??"new"},null,2));return;}
if(journal.stage?.startsWith("submitting")&&!(journal.stage==="submitting-deploy"?journal.deployHash:journal.fundHash))throw new Error("Ambiguous previous submission: reconcile the recorded nonce before retrying.");
if(!journal.deployHash){
const terms=await bounds(deployData);journal.stage="submitting-deploy";journal.nonce=await rpc.getTransactionCount({address:account.address,blockTag:"pending"});journal.reservedFeeWei=String(BigInt(journal.reservedFeeWei??"0")+terms.maximum);await save();
journal.deployHash=await client.deployContract({abi:artifact.abi,bytecode:artifact.bytecode.object,args,gas:terms.gas,gasPrice:terms.gasPrice,nonce:journal.nonce});journal.stage="deployment-pending";await save();
}
const deployReceipt=await rpc.waitForTransactionReceipt({hash:journal.deployHash,timeout:60000});
const deploymentTx=await knownTransaction(journal.deployHash);
if(deployReceipt.status!=="success"||!deployReceipt.contractAddress||deploymentTx.blockNumber!==deployReceipt.blockNumber||deploymentTx.from.toLowerCase()!==account.address.toLowerCase()||deploymentTx.input.toLowerCase()!==deployData.toLowerCase())throw new Error("Deployment proof is invalid. Do not resend.");
journal.campaign=deployReceipt.contractAddress;journal.paidFeeWei=String(receiptFee(deployReceipt,deploymentTx));journal.stage="deployed";await save();
const campaign=journal.campaign;
const ownerAbi=parseAbi(["function owner() view returns(address)"]);
const [token,escrow,authorizer,owner,reward,duration]=await Promise.all([
rpc.readContract({address:campaign,abi:WELCOME_REWARD_ABI,functionName:"rewardToken"}),
rpc.readContract({address:campaign,abi:WELCOME_REWARD_ABI,functionName:"votingEscrow"}),
rpc.readContract({address:campaign,abi:WELCOME_REWARD_ABI,functionName:"authorizer"}),
rpc.readContract({address:campaign,abi:ownerAbi,functionName:"owner"}),
rpc.readContract({address:campaign,abi:WELCOME_REWARD_ABI,functionName:"rewardAmount"}),
rpc.readContract({address:campaign,abi:WELCOME_REWARD_ABI,functionName:"lockDuration"})]);
if(token.toLowerCase()!==MEZO_REWARD_TOKEN.toLowerCase()||escrow.toLowerCase()!==TESTNET_VEMEZO.toLowerCase()||authorizer.toLowerCase()!==account.address.toLowerCase()||owner.toLowerCase()!==account.address.toLowerCase()||reward!==parseUnits("20",18)||duration!==1209600n)throw new Error("Deployed campaign does not match approved configuration.");
const fundData=encodeFunctionData({abi:erc20Abi,functionName:"transfer",args:[campaign,inventory]});
if(!journal.fundHash){
const balance=await rpc.readContract({address:MEZO_REWARD_TOKEN,abi:erc20Abi,functionName:"balanceOf",args:[account.address]});
const existing=await rpc.readContract({address:MEZO_REWARD_TOKEN,abi:erc20Abi,functionName:"balanceOf",args:[campaign]});
if(balance<inventory||existing!==0n)throw new Error("Funding inventory changed; reconcile before sending.");
await rpc.simulateContract({account:account.address,address:MEZO_REWARD_TOKEN,abi:erc20Abi,functionName:"transfer",args:[campaign,inventory]});
const terms=await bounds(fundData,MEZO_REWARD_TOKEN);journal.stage="submitting-fund";journal.nonce=await rpc.getTransactionCount({address:account.address,blockTag:"pending"});journal.reservedFeeWei=String(BigInt(journal.reservedFeeWei??"0")+terms.maximum);await save();
journal.fundHash=await client.writeContract({address:MEZO_REWARD_TOKEN,abi:erc20Abi,functionName:"transfer",args:[campaign,inventory],gas:terms.gas,gasPrice:terms.gasPrice,nonce:journal.nonce});journal.stage="funding-pending";await save();
}
const fundReceipt=await rpc.waitForTransactionReceipt({hash:journal.fundHash,timeout:60000});
const fundTx=await knownTransaction(journal.fundHash);
if(fundReceipt.status!=="success"||fundTx.blockNumber!==fundReceipt.blockNumber||fundTx.from.toLowerCase()!==account.address.toLowerCase()||fundTx.to?.toLowerCase()!==MEZO_REWARD_TOKEN.toLowerCase()||fundTx.input.toLowerCase()!==fundData.toLowerCase())throw new Error("Funding proof invalid. Do not resend.");
const held=await rpc.readContract({address:MEZO_REWARD_TOKEN,abi:erc20Abi,functionName:"balanceOf",args:[campaign]});
journal.paidFeeWei=String(BigInt(journal.paidFeeWei??"0")+receiptFee(fundReceipt,fundTx));journal.funded=true;journal.stage="funded";await save();
const report={capturedAt:new Date().toISOString(),chainId:31611,campaign,admin:owner,authorizer,rewardMezo:"20",lockDurationSeconds:"1209600",approvedInventoryMezo:"100",currentInventoryMezo:formatUnits(held,18),fundedClaims:Number(held/reward),deploymentHash:journal.deployHash,fundingHash:journal.fundHash,actualBtcGas:formatEther(BigInt(journal.paidFeeWei)),signedBtcGasUpperBound:formatEther(BigInt(journal.reservedFeeWei??"0")),approvedBtcGasCap:"0.000001",explorerFallbackUsed,claimBroadcasts:0};
await writeFile("docs/evidence/wave-2-welcome-deployment.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error.shortMessage??error.message);process.exitCode=1;});

