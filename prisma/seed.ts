import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.topic.count();
  if (count > 0) {
    console.log("Topics already exist, skipping seed.");
    return;
  }

  await prisma.topic.create({
    data: {
      name: "Default — Logistics & air freight",
      keywords: "air cargo pharmaceutical GDP cold chain 2026",
      brandVoice:
        "Professional, compliance-aware, concise. OMG Experience tone: reliability and documented handling.",
      active: true,
    },
  });

  console.log("Seeded default topic.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
