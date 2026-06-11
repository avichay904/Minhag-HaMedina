/**
 * Demo data seed — Worker K implements the full dataset
 * (1 survey + open cycle, ~12 bilingual questions across all categories & types,
 *  2 external sources, ~8 respondents across providers, 1 admin, a weekly challenge).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seed placeholder — to be implemented by the seed worker.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
