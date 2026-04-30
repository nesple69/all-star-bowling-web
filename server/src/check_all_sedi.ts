import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const sedi = await prisma.sedeTorneo.findMany();
    console.log(JSON.stringify(sedi, null, 2));
}
main();
