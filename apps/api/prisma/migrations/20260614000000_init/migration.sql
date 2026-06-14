-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE', 'EMAIL', 'FINGERPRINT', 'ANONYMOUS', 'EXTERNAL_AUTHORIZED', 'EXTERNAL_UNIDENTIFIED', 'EXTERNAL_AUTHENTICATED', 'EXTERNAL_UNKNOWN', 'IVR');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('YES_NO', 'SCALE', 'SINGLE_CHOICE', 'TEXT_IMAGE');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('SOCIETY_POLITICS', 'CONSUMER', 'HEALTH_LIFESTYLE', 'TECHNOLOGY', 'PERSONAL_FINANCE', 'GENERAL');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('HE', 'EN');

-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('STREAK', 'FAST', 'DIVERSE', 'CHALLENGE', 'CHALLENGE_OF_WEEK', 'ALMOST');

-- CreateEnum
CREATE TYPE "DisplayMode" AS ENUM ('RAW', 'WEIGHTED', 'BOTH');

-- CreateEnum
CREATE TYPE "CycleState" AS ENUM ('OPEN', 'CLOSED', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "XSource" AS ENUM ('WEB', 'APP', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "Cadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "trustScoreMin" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "trustScoreMax" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "canRegisterUsers" BOOLEAN NOT NULL DEFAULT false,
    "canReadResults" BOOLEAN NOT NULL DEFAULT false,
    "resultsScope" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Respondent" (
    "id" TEXT NOT NULL,
    "authProvider" "AuthProvider" NOT NULL,
    "externalId" TEXT,
    "sourceId" TEXT,
    "fingerprintHash" TEXT,
    "email" TEXT,
    "nickname" TEXT,
    "nicknameChangedAt" TIMESTAMP(3),
    "trustScore" DOUBLE PRECISION NOT NULL,
    "showInLeaderboard" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" "Language" NOT NULL DEFAULT 'HE',
    "preferredCategories" JSONB,
    "notificationToken" TEXT,
    "age" INTEGER,
    "gender" "Gender",
    "region" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Respondent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "titleHe" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "cadence" "Cadence" NOT NULL DEFAULT 'WEEKLY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "textHe" TEXT NOT NULL,
    "textEn" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "scaleMin" INTEGER,
    "scaleMax" INTEGER,
    "options" JSONB,
    "imageUrl" TEXT,
    "expiresAfterCycles" INTEGER,
    "startCycleSequence" INTEGER NOT NULL DEFAULT 1,
    "targeting" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "respondentId" TEXT,
    "fingerprintHash" TEXT,
    "answerValue" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "seen" BOOLEAN NOT NULL DEFAULT true,
    "trustScoreAtSubmission" DOUBLE PRECISION NOT NULL,
    "source" "XSource" NOT NULL,
    "rawCounted" BOOLEAN NOT NULL DEFAULT true,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "answerTimeMs" INTEGER,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyCycle" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "state" "CycleState" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "displayMode" "DisplayMode" NOT NULL DEFAULT 'BOTH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyChallenge" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "avgPerWeek" DOUBLE PRECISION,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeProgress" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "countAnswered" INTEGER NOT NULL DEFAULT 0,
    "countSeen" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChallengeProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespondentBadge" (
    "id" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "type" "BadgeType" NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RespondentBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSource_apiKeyHash_key" ON "ExternalSource"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Respondent_nickname_key" ON "Respondent"("nickname");

-- CreateIndex
CREATE INDEX "Respondent_sourceId_idx" ON "Respondent"("sourceId");

-- CreateIndex
CREATE INDEX "Respondent_fingerprintHash_idx" ON "Respondent"("fingerprintHash");

-- CreateIndex
CREATE INDEX "Question_surveyId_active_idx" ON "Question"("surveyId", "active");

-- CreateIndex
CREATE INDEX "Question_category_idx" ON "Question"("category");

-- CreateIndex
CREATE INDEX "Response_questionId_idx" ON "Response"("questionId");

-- CreateIndex
CREATE INDEX "Response_respondentId_idx" ON "Response"("respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_questionId_respondentId_key" ON "Response"("questionId", "respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_questionId_fingerprintHash_key" ON "Response"("questionId", "fingerprintHash");

-- CreateIndex
CREATE INDEX "SurveyCycle_surveyId_state_idx" ON "SurveyCycle"("surveyId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyChallenge_cycleId_key" ON "WeeklyChallenge"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeProgress_challengeId_respondentId_key" ON "ChallengeProgress"("challengeId", "respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "RespondentBadge_respondentId_type_key" ON "RespondentBadge"("respondentId", "type");

-- AddForeignKey
ALTER TABLE "Respondent" ADD CONSTRAINT "Respondent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExternalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyCycle" ADD CONSTRAINT "SurveyCycle_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyCycle" ADD CONSTRAINT "SurveyCycle_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyChallenge" ADD CONSTRAINT "WeeklyChallenge_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "SurveyCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeProgress" ADD CONSTRAINT "ChallengeProgress_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "WeeklyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeProgress" ADD CONSTRAINT "ChallengeProgress_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespondentBadge" ADD CONSTRAINT "RespondentBadge_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

