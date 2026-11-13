// Index existing confirmed activity for the builder's existing account. No signing.
import { writeFile } from "node:fs/promises";
import { prisma } from "../lib/db.ts";
import { weeklyStatus } from "../lib/rewards/weekly-service.ts";
try {
  const user = await prisma.user.findUnique({ where: { walletAddress: "0xe66d1c48792a320c16d7abd90c835b25a0ac37db" } });
  if (!user) throw Error("Existing builder account not found.");
  const status = await weeklyStatus(user.id, user.walletAddress);
  const report = { capturedAt: new Date().toISOString(), realChainReads: true, fixture: false, financialBroadcasts: 0,
    weekStart: status.weekStart, resetsAt: status.resetsAt, syncing: status.syncing,
    tasks: status.tasks.map(({ id, progress, target, complete }) => ({ id, progress, target, complete })),
    verifiedRows: await prisma.weeklyActivity.count({ where: { walletAddress: user.walletAddress } }),
    inviteCodeCreated: true,
  };
  await writeFile("docs/evidence/weekly-live-activity.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await prisma.$disconnect(); }
