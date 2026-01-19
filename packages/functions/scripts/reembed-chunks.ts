/**
 * Re-embed all chunks for a specific application using text-embedding-3-small.
 *
 * Run with: npx sst shell --stage production -- npx tsx packages/functions/scripts/reembed-chunks.ts <applicationId>
 */

import { Resource } from "sst";
import { prisma } from "@repo/db";

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const OPENAI_EMBEDDINGS_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 20; // Process 20 chunks at a time
const DELAY_MS = 100; // Delay between API calls

function getOpenAIApiKey(): string {
  const resource = Resource as unknown as { OpenaiApiKey?: { value: string } };
  if (!resource.OpenaiApiKey?.value) {
    throw new Error("OpenAI API key not configured - run via: npx sst shell --stage production");
  }
  return resource.OpenaiApiKey.value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDINGS_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function main() {
  const applicationId = process.argv[2];

  if (!applicationId) {
    console.error("Usage: npx tsx reembed-chunks.ts <applicationId>");
    console.error("\nTo find applicationId, check the database or URL when viewing the app.");
    process.exit(1);
  }

  console.log(`Re-embedding chunks for application: ${applicationId}`);
  console.log(`Model: ${OPENAI_EMBEDDINGS_MODEL} (${EMBEDDING_DIMENSIONS} dimensions)`);

  const apiKey = getOpenAIApiKey();
  console.log("OpenAI API key loaded\n");

  // Get all chunks for this application
  const chunks = await prisma.documentChunk.findMany({
    where: { applicationId },
    select: { id: true, content: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${chunks.length} chunks to re-embed\n`);

  if (chunks.length === 0) {
    console.log("No chunks found for this application.");
    return;
  }

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    for (const chunk of batch) {
      try {
        const embedding = await generateEmbedding(chunk.content, apiKey);
        const embeddingVector = `[${embedding.join(",")}]`;

        await prisma.$executeRawUnsafe(`
          UPDATE document_chunks
          SET embedding = '${embeddingVector}'::vector
          WHERE id = '${chunk.id}'::uuid
        `);

        processed++;

        // Progress update every 10 chunks
        if (processed % 10 === 0) {
          console.log(`Progress: ${processed}/${chunks.length} (${Math.round(processed/chunks.length*100)}%)`);
        }

        await sleep(DELAY_MS);
      } catch (error) {
        errors++;
        console.error(`Error processing chunk ${chunk.id}:`, error);

        // If we hit rate limits, wait longer
        if (error instanceof Error && error.message.includes("429")) {
          console.log("Rate limited, waiting 10 seconds...");
          await sleep(10000);
        }
      }
    }
  }

  console.log(`\nComplete!`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${chunks.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
