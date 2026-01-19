import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  try {
    const templates = await prisma.applicationTemplate.findMany({
      where: {
        OR: [
          { slug: { contains: "google", mode: "insensitive" } },
          { name: { contains: "google", mode: "insensitive" } },
          { name: { contains: "workspace", mode: "insensitive" } },
        ],
      },
    });

    for (const template of templates) {
      console.log("\n=== Template:", template.slug, "===");
      console.log("Name:", template.name);
      console.log("defaultTools:", JSON.stringify(template.defaultTools, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
