import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function reset(usernameOrEmail: string, newPassword: string) {
    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: { equals: usernameOrEmail, mode: 'insensitive' } },
                    { email: { equals: usernameOrEmail, mode: 'insensitive' } }
                ]
            }
        });

        if (!user) {
            console.log(`❌ Nessun utente trovato con username o email: ${usernameOrEmail}`);
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        console.log(`✅ Password per l'utente "${user.nome} ${user.cognome}" resettata correttamente in "${newPassword}"!`);
    } catch (e) {
        console.error("❌ Errore durante il reset della password:", e);
    } finally {
        await prisma.$disconnect();
    }
}

// Recupera i parametri dalla riga di comando
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Uso: npx ts-node src/scripts/resetPassword.ts <username_o_email> <nuova_password>");
    process.exit(1);
}

reset(args[0], args[1]);
