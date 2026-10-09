import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.$queryRawUnsafe("select tablename from pg_tables where schemaname=public order by tablename");
console.log(rows);
await prisma.$disconnect();
