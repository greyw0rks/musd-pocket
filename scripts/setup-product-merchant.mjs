import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
const db=new PrismaClient({log:[]});
try{
const account=await db.user.findUnique({where:{username:"musd_pocket"},select:{id:true,xHandle:true,walletAddress:true,role:true,businessName:true}});
if(!account||account.xHandle?.toLowerCase()!=="musd_pocket"||account.walletAddress!=="0x0a5e59ca4f182561de80172c6da5db927091ea29") throw new Error("The confirmed product identity/wallet does not match.");
const apply=process.argv.includes("--apply");
if(apply){
const sql=await readFile(new URL("../prisma/sql/2026-11-02-merchant-and-rewards.sql",import.meta.url),"utf8");
const statements=sql.split(";").map(s=>s.trim()).filter(Boolean);
await db.$transaction(async tx=>{
for(const statement of statements) await tx.$executeRawUnsafe(statement);
await tx.user.update({where:{id:account.id},data:{role:"MERCHANT",businessName:"Pocket"}});
});
}
const result=await db.user.findUnique({where:{id:account.id},select:{username:true,xHandle:true,walletAddress:true,role:true,businessName:true}});
const journal=await db.$queryRawUnsafe("SELECT to_regclass('public.welcome_reward_attempts') IS NOT NULL AS exists");
console.log(JSON.stringify({capturedAt:new Date().toISOString(),applied:apply,merchant:result,rewardJournalExists:journal[0].exists,noInvoiceCreated:true,noFinancialBroadcasts:true},null,2));
}finally{await db.$disconnect();}
