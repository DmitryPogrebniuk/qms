import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Clean existing data
  await prisma.evaluation.deleteMany()
  await prisma.recording.deleteMany()
  await prisma.agentSkill.deleteMany()
  // Debug: print DATABASE_URL
  console.log('DATABASE_URL:', process.env.DATABASE_URL);

  // Clean existing data
  await prisma.evaluation.deleteMany();
  await prisma.recording.deleteMany();
    // Clean existing users
    await prisma.user.deleteMany();
  try {
    await prisma.user.create({
      data: {
        username: 'boss',
        password: hashedPassword,
        email: 'boss@localhost',
        fullName: 'Boss Admin',
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('✅ Only boss user created: boss / boss');
  } catch (e) {
    console.error('User creation error:', e);
  }

  // Print users after seed
  const users = await prisma.user.findMany();
  console.log('Users after seed:', users);
  // Create admin user
  await prisma.user.create({
    data: {

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
