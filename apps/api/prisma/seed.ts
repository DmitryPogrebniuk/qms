import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Clean existing data
  await prisma.evaluation.deleteMany()
  await prisma.recording.deleteMany()
  await prisma.agentSkill.deleteMany()
  await prisma.agentTeam.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.skill.deleteMany()
  await prisma.team.deleteMany()
  await prisma.user.deleteMany()

  // Create teams
  const team1 = await prisma.team.create({
    data: {
      teamCode: 'BILLING',
      displayName: 'Billing Support Team',
      supervisorIds: ['supervisor-1'],
    },
  })

  const team2 = await prisma.team.create({
    data: {
      teamCode: 'SUPPORT',
      displayName: 'Technical Support Team',
      supervisorIds: ['supervisor-2'],
    },
  })

  // Create agents
  const agent1 = await prisma.agent.create({
    data: {
      agentId: 'agent001',
      fullName: 'John Smith',
      email: 'john.smith@company.com',
      activeFlag: true,
    },
  })

  const agent2 = await prisma.agent.create({
    data: {
      agentId: 'agent002',
      fullName: 'Jane Doe',
      email: 'jane.doe@company.com',
      activeFlag: true,
    },
  })

  // Assign agents to teams
  await prisma.agentTeam.create({
    data: {
      agentId: agent1.id,
      teamId: team1.id,
    },
  })

  await prisma.agentTeam.create({
    data: {
      agentId: agent2.id,
      teamId: team2.id,
    },
  })

  // Create skills
  const skill1 = await prisma.skill.create({
    data: {
      skillId: 'SKILL_BILLING',
      skillName: 'Billing',
    },
  })

  const skill2 = await prisma.skill.create({
    data: {
      skillId: 'SKILL_TECHNICAL',
      skillName: 'Technical Support',
    },
  })

  // Assign skills to agents
  await prisma.agentSkill.create({
    data: {
      agentId: agent1.id,
      skillId: skill1.id,
      proficiency: 9,
    },
  })

  await prisma.agentSkill.create({
    data: {
      agentId: agent2.id,
      skillId: skill2.id,
      proficiency: 8,
    },
  })

  // Create admin user
  await prisma.user.create({
    data: {
      keycloakId: 'admin-keycloak-id',
      username: 'admin',
      email: 'admin@company.com',
      fullName: 'Admin User',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Create supervisor user
  await prisma.user.create({
    data: {
      keycloakId: 'supervisor-keycloak-id',
      username: 'supervisor',
      email: 'supervisor@company.com',
      fullName: 'Team Supervisor',
      role: 'SUPERVISOR',
      isActive: true,
      teamCodes: ['BILLING'],
    },
  })

  // Create QA user
  await prisma.user.create({
    data: {
      keycloakId: 'qa-keycloak-id',
      username: 'qa_user',
      email: 'qa@company.com',
      fullName: 'QA Specialist',
      role: 'QA',
      isActive: true,
    },
  })

  // Create regular user (agent)
  await prisma.user.create({
    data: {
      keycloakId: 'agent-keycloak-id',
      username: 'agent001',
      email: 'john.smith@company.com',
      fullName: 'John Smith',
      role: 'USER',
      isActive: true,
      agentId: agent1.agentId,
      teamCodes: ['BILLING'],
    },
  })

  // Create sample recording
  await prisma.recording.create({
    data: {
      mediasenseRecordingId: 'REC_001',
      agentId: agent1.id,
      teamCode: team1.teamCode,
      startTime: new Date('2024-01-15T10:30:00Z'),
      endTime: new Date('2024-01-15T10:45:00Z'),
      durationSeconds: 900,
      contactId: 'CONT_001',
      callId: 'CALL_001',
      direction: 'inbound',
      ani: '5551234567',
      dnis: '18003334444',
      csq: 'BILLING_QUEUE',
      wrapUpReason: 'ISSUE_RESOLVED',
      transferCount: 0,
      holdTimeSeconds: 120,
      isArchived: false,
    },
  })

  // Create sample scorecard template
  const scorecard = await prisma.scorecardTemplate.create({
    data: {
      name: 'Customer Service Evaluation',
      version: 1,
      description: 'Standard evaluation template for customer service calls',
      sections: JSON.stringify([
        {
          id: 'section-1',
          title: 'Call Handling',
          questions: [
            {
              id: 'q-1',
              text: 'Did agent greet customer professionally?',
              weight: 1,
              maxScore: 5,
              isFatal: false,
              allowNA: false,
            },
            {
              id: 'q-2',
              text: 'Was issue resolved on first contact?',
              weight: 2,
          isArchived: false,
              allowNA: false,
            },
          ],
        },
      ]),
      isActive: true,
    },
  })

  // Create local admin user FIRST (before evaluation that references it)
  const hashedPassword = await bcrypt.hash('boss', 10)
  const adminUser = await prisma.user.create({
    data: {
      username: 'boss',
      password: hashedPassword,
      email: 'boss@localhost',
      fullName: 'Boss Admin',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Create sample evaluation (using the admin user as evaluator)
  await prisma.evaluation.create({
    data: {
      scorecardTemplateId: scorecard.id,
      evaluatorId: adminUser.id,
      agentId: agent1.id,
      teamCode: team1.teamCode,
      status: 'SUBMITTED',
      responses: JSON.stringify([
        { questionId: 'q-1', score: 5, comment: 'Excellent greeting', isNA: false },
        { questionId: 'q-2', score: 5, comment: 'Issue resolved immediately', isNA: false },
      ]),
      totalScore: 10,
      comments: 'Outstanding performance',
      submittedAt: new Date(),
    },
  })

  // Create sample daily stats
  await prisma.dailyAgentStats.create({
    data: {
      agentId: agent1.id,
      date: new Date('2024-01-15'),
      callsHandled: 42,
      avgHandleTime: 480,
      holdTime: 120,
      transfers: 3,
      wrapUpCounts: JSON.stringify({
        ISSUE_RESOLVED: 35,
        ESCALATED: 5,
        TRANSFER: 2,
      }),
    },
  })

  console.log('✅ Seed completed successfully!')
  console.log('👤 Admin user created: boss / boss')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
