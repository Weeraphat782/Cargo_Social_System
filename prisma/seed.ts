import { PrismaClient } from "@prisma/client";
import { omgTemplate } from "../lib/brands/templates/omg";
import { templateToJsonPayload } from "../lib/brands/payload-schema";

const prisma = new PrismaClient();

async function main() {
  const omgRow = await prisma.brandTemplateMaster.findUnique({ where: { slug: "omg" } });
  if (!omgRow) {
    await prisma.brandTemplateMaster.create({
      data: {
        slug: "omg",
        displayName: omgTemplate.displayName,
        payload: templateToJsonPayload(omgTemplate) as object,
        isSystem: true,
      },
    });
    console.log("Seeded Brand master: OMG (from hardcoded template).");
  }

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
