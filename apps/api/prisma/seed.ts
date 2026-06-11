/**
 * Demo data seed — Minhag HaMedina (Phase 0 frozen)
 *
 * Run via:  pnpm --filter api exec tsx prisma/seed.ts
 *
 * Idempotent: deletes all rows in FK-safe order before inserting.
 * Covers every model, all 6 categories, all 4 question types, all major
 * auth-providers, and varied demographics for realistic weighted vs. raw
 * result divergence.
 */

import { PrismaClient } from '@prisma/client';
import { sha256 } from '../src/common/crypto.util';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────────
// Fixed plaintext API keys (printed at the end; never change them)
// ──────────────────────────────────────────────────────────────
const TZINTUKIM_API_KEY = 'tzintukim-demo-key-2024-alpha-001';
const PARTNER_API_KEY   = 'partner-api-demo-key-2024-beta-002';

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('🌱  Minhag HaMedina — seeding demo data…\n');

  // ── 0. Wipe in FK-safe order ──────────────────────────────────
  await prisma.respondentBadge.deleteMany();
  await prisma.challengeProgress.deleteMany();
  await prisma.weeklyChallenge.deleteMany();
  await prisma.response.deleteMany();
  await prisma.question.deleteMany();
  await prisma.surveyCycle.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.respondent.deleteMany();
  await prisma.externalSource.deleteMany();
  await prisma.admin.deleteMany();
  console.log('  ✓ Cleared existing rows');

  // ── 1. Admin ──────────────────────────────────────────────────
  const admin = await prisma.admin.create({
    data: {
      email: 'admin@minhag.example',
      name:  'Minhag Admin',
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  // ── 2. External Sources ───────────────────────────────────────
  const sourceTzintukim = await prisma.externalSource.create({
    data: {
      name:             'Tzintukim',
      apiKeyHash:       sha256(TZINTUKIM_API_KEY),
      trustScoreMin:    0.6,
      trustScoreMax:    1.0,
      canRegisterUsers: true,
      canReadResults:   true,
      resultsScope:     { ownRespondentsOnly: true, categories: [] },
      active:           true,
    },
  });

  const sourcePartner = await prisma.externalSource.create({
    data: {
      name:             'PartnerAPI',
      apiKeyHash:       sha256(PARTNER_API_KEY),
      trustScoreMin:    0.4,
      trustScoreMax:    0.7,
      canRegisterUsers: false,
      canReadResults:   true,
      resultsScope:     { ownRespondentsOnly: true, categories: ['CONSUMER', 'TECHNOLOGY'] },
      active:           true,
    },
  });
  console.log(`  ✓ ExternalSources: ${sourceTzintukim.name}, ${sourcePartner.name}`);

  // ── 3. Survey + SurveyCycle + WeeklyChallenge ─────────────────
  const survey = await prisma.survey.create({
    data: {
      titleHe: 'סקר מנהג המדינה — שבועי',
      titleEn: 'Minhag HaMedina Weekly Survey',
      cadence: 'WEEKLY',
      active:  true,
    },
  });

  const cycle = await prisma.surveyCycle.create({
    data: {
      surveyId:    survey.id,
      sequence:    1,
      state:       'OPEN',
      openedAt:    new Date('2024-06-10T07:00:00Z'),
      displayMode: 'BOTH',
    },
  });

  const challenge = await prisma.weeklyChallenge.create({
    data: {
      cycleId:     cycle.id,
      targetCount: 5,
      avgPerWeek:  5,
    },
  });
  console.log(`  ✓ Survey → Cycle (seq 1, OPEN) → WeeklyChallenge (target 5)`);

  // ── 4. Questions (12 — all 6 categories, all 4 types) ─────────
  //
  // Targeting helper shapes:
  //   {}                    → general (no filter)
  //   { ageMin, ageMax }    → age range
  //   { gender }            → gender
  //   { region }            → region string
  //   { minTrustScore }     → trust gate

  const questions = await Promise.all([
    // --- SOCIETY_POLITICS (yes_no × 2) -------------------------
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'SOCIETY_POLITICS',
        textHe:             'האם אתה מאמין שהממשלה הנוכחית מטפלת נכון במשבר הכלכלי?',
        textEn:             'Do you believe the current government is handling the economic crisis correctly?',
        type:               'YES_NO',
        targeting:          {},
        active:             true,
        startCycleSequence: 1,
      },
    }),
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'SOCIETY_POLITICS',
        textHe:             'האם תומך/ת בהפחתת גיל ההצבעה ל-16?',
        textEn:             'Do you support lowering the voting age to 16?',
        type:               'YES_NO',
        targeting:          { ageMin: 18, ageMax: 35 },
        active:             true,
        startCycleSequence: 1,
      },
    }),

    // --- CONSUMER (single_choice + yes_no) ----------------------
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'CONSUMER',
        textHe:             'מה הקטגוריה שבה הכי גדלו ההוצאות שלך בשנה האחרונה?',
        textEn:             'Which category saw the biggest increase in your spending over the past year?',
        type:               'SINGLE_CHOICE',
        options:            [
          { key: 'food',      labelHe: 'מזון וסופרמרקט',  labelEn: 'Food & Groceries' },
          { key: 'housing',   labelHe: 'דיור ושכירות',    labelEn: 'Housing & Rent' },
          { key: 'transport', labelHe: 'תחבורה',          labelEn: 'Transportation' },
          { key: 'leisure',   labelHe: 'פנאי ובידור',     labelEn: 'Leisure & Entertainment' },
        ],
        targeting:          {},
        active:             true,
        startCycleSequence: 1,
      },
    }),
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'CONSUMER',
        textHe:             'האם קנית מוצר יד שנייה ב-12 החודשים האחרונים?',
        textEn:             'Did you buy a second-hand product in the last 12 months?',
        type:               'YES_NO',
        targeting:          {},
        active:             true,
        startCycleSequence: 1,
      },
    }),

    // --- HEALTH_LIFESTYLE (scale 1-5 + yes_no targeted) ---------
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'HEALTH_LIFESTYLE',
        textHe:             'כיצד היית מדרג/ת את בריאותך הכללית בחודש האחרון? (1=גרועה, 5=מצוינת)',
        textEn:             'How would you rate your overall health in the past month? (1=Poor, 5=Excellent)',
        type:               'SCALE',
        scaleMin:           1,
        scaleMax:           5,
        targeting:          {},
        active:             true,
        startCycleSequence: 1,
      },
    }),
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'HEALTH_LIFESTYLE',
        textHe:             'האם ביצעת בדיקת שד מניעתית בשנה האחרונה?',
        textEn:             'Have you had a preventive breast examination in the past year?',
        type:               'YES_NO',
        targeting:          { gender: 'FEMALE' },
        active:             true,
        startCycleSequence: 1,
      },
    }),

    // --- TECHNOLOGY (scale 1-10 + single_choice) ----------------
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'TECHNOLOGY',
        textHe:             'באיזו מידה אתה חושש/ת מהשפעת הבינה המלאכותית על שוק העבודה? (1=כלל לא, 10=מאוד)',
        textEn:             'How concerned are you about AI\'s impact on the job market? (1=Not at all, 10=Very much)',
        type:               'SCALE',
        scaleMin:           1,
        scaleMax:           10,
        targeting:          { minTrustScore: 0.7 },
        active:             true,
        startCycleSequence: 1,
      },
    }),
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'TECHNOLOGY',
        textHe:             'באיזה מכשיר אתה גולש/ת ברשת הכי הרבה?',
        textEn:             'Which device do you use most often to browse the internet?',
        type:               'SINGLE_CHOICE',
        options:            [
          { key: 'smartphone', labelHe: 'סמארטפון', labelEn: 'Smartphone' },
          { key: 'laptop',     labelHe: 'מחשב נייד', labelEn: 'Laptop' },
          { key: 'desktop',    labelHe: 'מחשב שולחני', labelEn: 'Desktop PC' },
        ],
        targeting:          {},
        active:             true,
        startCycleSequence: 1,
      },
    }),

    // --- PERSONAL_FINANCE (yes_no + text_image) -----------------
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'PERSONAL_FINANCE',
        textHe:             'האם אתה חוסך לפחות 10% מהכנסתך החודשית?',
        textEn:             'Do you save at least 10% of your monthly income?',
        type:               'YES_NO',
        targeting:          { region: 'Tel Aviv' },
        active:             true,
        startCycleSequence: 1,
      },
    }),
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'PERSONAL_FINANCE',
        textHe:             'מה רמת הלחץ הכלכלי שלך? (1=נמוך מאוד, 5=גבוה מאוד)',
        textEn:             'What is your level of financial stress? (1=Very low, 5=Very high)',
        type:               'SCALE',
        scaleMin:           1,
        scaleMax:           5,
        targeting:          {},
        active:             true,
        startCycleSequence: 1,
      },
    }),

    // --- GENERAL (text_image + single_choice) -------------------
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'GENERAL',
        textHe:             'איזה ערך מייצג לדעתך הסמל הזה?',
        textEn:             'Which value does this symbol represent to you?',
        type:               'TEXT_IMAGE',
        imageUrl:           'https://assets.minhag-hamedina.example/seed/symbol-survey-q1.png',
        options:            [
          { key: 'unity',    labelHe: 'אחדות', labelEn: 'Unity' },
          { key: 'justice',  labelHe: 'צדק',   labelEn: 'Justice' },
          { key: 'freedom',  labelHe: 'חירות', labelEn: 'Freedom' },
        ],
        targeting:          {},
        active:             true,
        startCycleSequence: 1,
      },
    }),
    prisma.question.create({
      data: {
        surveyId:           survey.id,
        category:           'GENERAL',
        textHe:             'מה מקור המידע העיקרי שלך לחדשות?',
        textEn:             'What is your primary source of news?',
        type:               'SINGLE_CHOICE',
        options:            [
          { key: 'tv',          labelHe: 'טלוויזיה',     labelEn: 'Television' },
          { key: 'online_news', labelHe: 'חדשות אונליין', labelEn: 'Online news sites' },
          { key: 'social',      labelHe: 'רשתות חברתיות', labelEn: 'Social media' },
          { key: 'radio',       labelHe: 'רדיו',          labelEn: 'Radio' },
        ],
        targeting:          {},
        active:             true,
        startCycleSequence: 1,
      },
    }),
  ]);

  // Named aliases for readability in Response section
  const [
    qGovEconomy,        // 0  SOCIETY_POLITICS yes_no   general
    qVotingAge,         // 1  SOCIETY_POLITICS yes_no   age 18-35
    qSpendingCat,       // 2  CONSUMER         single   general
    qSecondHand,        // 3  CONSUMER         yes_no   general
    qHealthScale,       // 4  HEALTH_LIFESTYLE scale1-5 general
    qBreastExam,        // 5  HEALTH_LIFESTYLE yes_no   gender FEMALE
    qAiConcern,         // 6  TECHNOLOGY       scale1-10 minTrust 0.7
    qBrowseDevice,      // 7  TECHNOLOGY       single   general
    _qSavings,          // 8  PERSONAL_FINANCE yes_no   region TLV
    qFinStress,         // 9  PERSONAL_FINANCE scale1-5 general
    qSymbol,            // 10 GENERAL          text_img general
    qNewsSource,        // 11 GENERAL          single   general
  ] = questions;

  console.log(`  ✓ Questions: ${questions.length} (all 6 categories, all 4 types)`);

  // ── 5. Respondents ────────────────────────────────────────────
  const r1Google = await prisma.respondent.create({
    data: {
      authProvider:        'GOOGLE',
      email:               'gal.levi@gmail.com',
      nickname:            'GalLevi',
      nicknameChangedAt:   new Date('2024-01-15'),
      trustScore:          1.0,
      showInLeaderboard:   true,
      preferredLanguage:   'HE',
      preferredCategories: ['SOCIETY_POLITICS', 'TECHNOLOGY'],
      age:                 29,
      gender:              'MALE',
      region:              'Tel Aviv',
      points:              85,
      answeredCount:       6,
    },
  });

  const r2Apple = await prisma.respondent.create({
    data: {
      authProvider:        'APPLE',
      email:               'noa.cohen@icloud.com',
      nickname:            'Noa_C',
      nicknameChangedAt:   new Date('2024-02-20'),
      trustScore:          1.0,
      showInLeaderboard:   true,
      preferredLanguage:   'HE',
      preferredCategories: ['HEALTH_LIFESTYLE', 'CONSUMER'],
      age:                 34,
      gender:              'FEMALE',
      region:              'Jerusalem',
      points:              70,
      answeredCount:       6,
    },
  });

  const r3Email = await prisma.respondent.create({
    data: {
      authProvider:        'EMAIL',
      email:               'ron.mizrahi@example.co.il',
      nickname:            'Ron_M',
      nicknameChangedAt:   new Date('2024-03-05'),
      trustScore:          1.0,
      showInLeaderboard:   true,
      preferredLanguage:   'EN',
      preferredCategories: ['PERSONAL_FINANCE', 'GENERAL'],
      age:                 42,
      gender:              'MALE',
      region:              'Haifa',
      points:              60,
      answeredCount:       6,
    },
  });

  const r4Fingerprint = await prisma.respondent.create({
    data: {
      authProvider:    'FINGERPRINT',
      fingerprintHash: sha256('demo-fingerprint-device-abc123'),
      trustScore:      0.7,
      showInLeaderboard: false,
      preferredLanguage: 'HE',
      preferredCategories: ['GENERAL'],
      age:             22,
      gender:          'FEMALE',
      region:          'Tel Aviv',
      points:          30,
      answeredCount:   4,
    },
  });

  const r5Anonymous = await prisma.respondent.create({
    data: {
      authProvider:      'ANONYMOUS',
      trustScore:        0.4,
      showInLeaderboard: false,
      preferredLanguage: 'HE',
      preferredCategories: [],
      points:            0,
      answeredCount:     2,
    },
  });

  const r6ExtAuth = await prisma.respondent.create({
    data: {
      authProvider:        'EXTERNAL_AUTHENTICATED',
      externalId:          'tzint-user-001',
      sourceId:            sourceTzintukim.id,
      trustScore:          0.7,
      showInLeaderboard:   false,
      preferredLanguage:   'HE',
      preferredCategories: ['TECHNOLOGY'],
      age:                 31,
      gender:              'MALE',
      region:              'Be\'er Sheva',
      points:              20,
      answeredCount:       3,
    },
  });

  const r7ExtAuthorized = await prisma.respondent.create({
    data: {
      authProvider:        'EXTERNAL_AUTHORIZED',
      externalId:          'tzint-user-002',
      sourceId:            sourceTzintukim.id,
      trustScore:          1.0,
      showInLeaderboard:   true,
      nickname:            'TzintUser2',
      nicknameChangedAt:   new Date('2024-04-01'),
      preferredLanguage:   'EN',
      preferredCategories: ['TECHNOLOGY', 'PERSONAL_FINANCE'],
      age:                 27,
      gender:              'FEMALE',
      region:              'Netanya',
      points:              45,
      answeredCount:       5,
    },
  });

  const r8ExtUnknown = await prisma.respondent.create({
    data: {
      authProvider:        'EXTERNAL_UNKNOWN',
      externalId:          'partner-anon-7f3a',
      sourceId:            sourcePartner.id,
      trustScore:          0.5,
      showInLeaderboard:   false,
      preferredLanguage:   'EN',
      preferredCategories: ['CONSUMER'],
      age:                 55,
      gender:              'OTHER',
      region:              'Rishon LeZion',
      points:              10,
      answeredCount:       2,
    },
  });

  console.log(`  ✓ Respondents: 8 (google, apple, email, fingerprint, anonymous, ext_authenticated, ext_authorized, ext_unknown)`);

  // ── 6. Responses ──────────────────────────────────────────────
  // Helper to build a non-skipped response
  const ans = (
    questionId: string,
    respondentId: string,
    answerValue: string,
    trustScore: number,
    source: 'WEB' | 'APP',
    answerTimeMs?: number,
  ) => ({
    questionId,
    respondentId,
    answerValue,
    skipped:                false,
    seen:                   true,
    trustScoreAtSubmission: trustScore,
    source,
    rawCounted:             true,
    answerTimeMs:           answerTimeMs ?? null,
  });

  // Helper to build a skipped response
  const skip = (
    questionId: string,
    respondentId: string,
    trustScore: number,
  ) => ({
    questionId,
    respondentId,
    answerValue:            null,
    skipped:                true,
    seen:                   true,
    trustScoreAtSubmission: trustScore,
    source:                 'WEB' as const,
    rawCounted:             false,
  });

  // r1Google (trust 1.0) — answers 6 questions
  await prisma.response.createMany({
    data: [
      ans(qGovEconomy.id,   r1Google.id, '0',          1.0, 'WEB', 3200),
      ans(qVotingAge.id,    r1Google.id, '1',          1.0, 'WEB', 2800),  // age 29 in range 18-35
      ans(qSpendingCat.id,  r1Google.id, 'housing',    1.0, 'APP', 4100),
      ans(qSecondHand.id,   r1Google.id, '1',          1.0, 'APP', 1900),
      ans(qHealthScale.id,  r1Google.id, '4',          1.0, 'WEB', 2200),
      ans(qBrowseDevice.id, r1Google.id, 'smartphone', 1.0, 'APP', 1500),
    ],
  });

  // r2Apple (trust 1.0) — answers 6 questions (including female-targeted)
  await prisma.response.createMany({
    data: [
      ans(qGovEconomy.id,  r2Apple.id, '1',      1.0, 'WEB', 2700),
      ans(qSecondHand.id,  r2Apple.id, '0',      1.0, 'WEB', 1800),
      ans(qHealthScale.id, r2Apple.id, '5',      1.0, 'APP', 2000),
      ans(qBreastExam.id,  r2Apple.id, '1',      1.0, 'WEB', 1200),  // gender FEMALE
      ans(qFinStress.id,   r2Apple.id, '3',      1.0, 'APP', 2300),
      ans(qNewsSource.id,  r2Apple.id, 'online_news', 1.0, 'WEB', 1700),
    ],
  });

  // r3Email (trust 1.0) — answers 6 questions (region Tel Aviv? No — Haifa, so skip qSavings)
  await prisma.response.createMany({
    data: [
      ans(qGovEconomy.id,  r3Email.id, '0',       1.0, 'WEB', 5100),
      ans(qSpendingCat.id, r3Email.id, 'food',    1.0, 'WEB', 3800),
      ans(qAiConcern.id,   r3Email.id, '7',       1.0, 'APP', 4200),  // trust >= 0.7 ✓
      ans(qBrowseDevice.id,r3Email.id, 'laptop',  1.0, 'APP', 1600),
      ans(qFinStress.id,   r3Email.id, '2',       1.0, 'WEB', 2100),
      ans(qSymbol.id,      r3Email.id, 'justice', 1.0, 'WEB', 3300),
    ],
  });

  // r4Fingerprint (trust 0.7) — answers 4 questions + 1 skip
  await prisma.response.createMany({
    data: [
      ans(qGovEconomy.id,   r4Fingerprint.id, '0',       0.7, 'APP', 2900),
      ans(qBreastExam.id,   r4Fingerprint.id, '0',       0.7, 'APP', 1400),  // gender FEMALE
      ans(qHealthScale.id,  r4Fingerprint.id, '3',       0.7, 'WEB', 2600),
      ans(qNewsSource.id,   r4Fingerprint.id, 'social',  0.7, 'APP', 1300),
      skip(qFinStress.id,   r4Fingerprint.id, 0.7),
    ],
  });

  // r5Anonymous (trust 0.4) — answers 2 questions (general only)
  await prisma.response.createMany({
    data: [
      ans(qSecondHand.id,  r5Anonymous.id, '1',  0.4, 'WEB', 6200),
      ans(qNewsSource.id,  r5Anonymous.id, 'tv', 0.4, 'WEB', 4500),
    ],
  });

  // r6ExtAuth (trust 0.7, Tzintukim) — answers 3 questions
  await prisma.response.createMany({
    data: [
      ans(qAiConcern.id,    r6ExtAuth.id, '8',          0.7, 'APP', 3700),  // trust >= 0.7 ✓
      ans(qBrowseDevice.id, r6ExtAuth.id, 'smartphone', 0.7, 'APP', 1800),
      ans(qVotingAge.id,    r6ExtAuth.id, '0',          0.7, 'WEB', 2100),  // age 31 in range 18-35
    ],
  });

  // r7ExtAuthorized (trust 1.0, Tzintukim) — answers 5 questions + 1 skip
  await prisma.response.createMany({
    data: [
      ans(qGovEconomy.id,  r7ExtAuthorized.id, '1',     1.0, 'WEB', 2400),
      ans(qAiConcern.id,   r7ExtAuthorized.id, '9',     1.0, 'APP', 3900),  // trust >= 0.7 ✓
      ans(qSpendingCat.id, r7ExtAuthorized.id, 'transport', 1.0, 'WEB', 3100),
      ans(qFinStress.id,   r7ExtAuthorized.id, '4',     1.0, 'APP', 2700),
      ans(qSymbol.id,      r7ExtAuthorized.id, 'freedom', 1.0, 'WEB', 2900),
      skip(qNewsSource.id, r7ExtAuthorized.id, 1.0),
    ],
  });

  // r8ExtUnknown (trust 0.5, PartnerAPI) — answers 2 questions (consumer-focused)
  await prisma.response.createMany({
    data: [
      ans(qSecondHand.id,  r8ExtUnknown.id, '0',    0.5, 'WEB', 5400),
      ans(qSpendingCat.id, r8ExtUnknown.id, 'food', 0.5, 'WEB', 4800),
    ],
  });

  console.log(`  ✓ Responses: seeded (answers + skips across 5 respondent groups)`);

  // ── 7. ChallengeProgress ──────────────────────────────────────
  await prisma.challengeProgress.createMany({
    data: [
      {
        challengeId:  challenge.id,
        respondentId: r1Google.id,
        countAnswered: 6,
        countSeen:     6,
        completed:     true,
      },
      {
        challengeId:  challenge.id,
        respondentId: r2Apple.id,
        countAnswered: 6,
        countSeen:     6,
        completed:     true,
      },
      {
        challengeId:  challenge.id,
        respondentId: r7ExtAuthorized.id,
        countAnswered: 5,
        countSeen:     6,
        completed:     false,
      },
    ],
  });
  console.log(`  ✓ ChallengeProgress: 3 rows (2 completed, 1 in progress)`);

  // ── 8. RespondentBadges ───────────────────────────────────────
  await prisma.respondentBadge.createMany({
    data: [
      { respondentId: r1Google.id,       type: 'FAST' },
      { respondentId: r2Apple.id,        type: 'DIVERSE' },
      { respondentId: r3Email.id,        type: 'STREAK' },
      { respondentId: r7ExtAuthorized.id, type: 'CHALLENGE_OF_WEEK' },
    ],
  });
  console.log(`  ✓ RespondentBadges: 4 (FAST, DIVERSE, STREAK, CHALLENGE_OF_WEEK)`);

  // ── Final summary ─────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Minhag HaMedina — Demo Seed Complete                ║
╠══════════════════════════════════════════════════════════════╣
║  Admin              1  (admin@minhag.example)               ║
║  External Sources   2  (Tzintukim, PartnerAPI)              ║
║  Surveys            1  (weekly, HE+EN titles)               ║
║  SurveyCycles       1  (seq 1, OPEN, displayMode BOTH)      ║
║  WeeklyChallenges   1  (target 5, avgPerWeek 5)             ║
║  Questions         12  (all 6 categories, all 4 types)      ║
║  Respondents        8  (google/apple/email/fingerprint/     ║
║                        anonymous/ext_auth/ext_authorized/  ║
║                        ext_unknown)                         ║
║  Responses        ~36  (answers + skips)                    ║
║  ChallengeProgress  3                                       ║
║  RespondentBadges   4                                       ║
╠══════════════════════════════════════════════════════════════╣
║  PLAINTEXT API KEYS (never commit these to production):     ║
║                                                             ║
║  Tzintukim  → ${TZINTUKIM_API_KEY.padEnd(45)} ║
║  PartnerAPI → ${PARTNER_API_KEY.padEnd(45)} ║
╠══════════════════════════════════════════════════════════════╣
║  Admin API token: ADMIN_API_TOKEN env var                   ║
║  Default dev value: dev-admin-token                         ║
╚══════════════════════════════════════════════════════════════╝
`);
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
