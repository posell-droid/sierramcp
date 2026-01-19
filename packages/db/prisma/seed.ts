import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create a demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-company" },
    update: {},
    create: {
      id: randomUUID(),
      name: "Demo Company",
      slug: "demo-company",
      plan: "PROFESSIONAL",
      settings: {
        theme: "light",
        timezone: "America/New_York",
      },
    },
  });

  console.log(`✅ Created tenant: ${tenant.name}`);

  // Create demo users
  const ownerUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "owner@demo.com",
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      email: "owner@demo.com",
      name: "Demo Owner",
      cognitoSub: `demo-owner-${randomUUID()}`, // Replace with real Cognito sub in production
      tenantId: tenant.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "admin@demo.com",
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      email: "admin@demo.com",
      name: "Demo Admin",
      cognitoSub: `demo-admin-${randomUUID()}`,
      tenantId: tenant.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const memberUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "member@demo.com",
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      email: "member@demo.com",
      name: "Demo Member",
      cognitoSub: `demo-member-${randomUUID()}`,
      tenantId: tenant.id,
      role: "MEMBER",
      status: "ACTIVE",
    },
  });

  console.log(`✅ Created ${3} users`);

  // Create demo projects
  const projects = [
    {
      name: "Website Redesign",
      description: "Complete overhaul of the company website with new branding",
      status: "ACTIVE" as const,
    },
    {
      name: "Mobile App Development",
      description: "Native iOS and Android apps for customer engagement",
      status: "ACTIVE" as const,
    },
    {
      name: "Data Migration",
      description: "Migrate legacy data to new cloud infrastructure",
      status: "ARCHIVED" as const,
    },
  ];

  for (const projectData of projects) {
    await prisma.project.upsert({
      where: {
        id: randomUUID(), // This will always create since UUIDs are unique
      },
      update: {},
      create: {
        id: randomUUID(),
        name: projectData.name,
        description: projectData.description,
        status: projectData.status,
        tenantId: tenant.id,
        createdById: ownerUser.id,
        metadata: {},
      },
    });
  }

  console.log(`✅ Created ${projects.length} projects`);

  // Log some audit entries
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: ownerUser.id,
        action: "tenant.created",
        entityType: "Tenant",
        entityId: tenant.id,
        metadata: { name: tenant.name },
      },
      {
        tenantId: tenant.id,
        userId: ownerUser.id,
        action: "user.created",
        entityType: "User",
        entityId: adminUser.id,
        metadata: { email: adminUser.email },
      },
      {
        tenantId: tenant.id,
        userId: ownerUser.id,
        action: "user.created",
        entityType: "User",
        entityId: memberUser.id,
        metadata: { email: memberUser.email },
      },
    ],
  });

  console.log("✅ Created audit logs");

  console.log("\n🎉 Seeding complete!\n");
  console.log("Demo tenant:", tenant.slug);
  console.log("Demo users:");
  console.log("  - owner@demo.com (OWNER)");
  console.log("  - admin@demo.com (ADMIN)");
  console.log("  - member@demo.com (MEMBER)");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
