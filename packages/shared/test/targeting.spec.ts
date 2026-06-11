import { describe, expect, it } from 'vitest';
import {
  Gender,
  Language,
  matchesTargeting,
  hasDemographicTargeting,
  type RespondentContext,
  type Targeting,
} from '../src/index.js';

const identified: RespondentContext = {
  age: 30,
  gender: Gender.MALE,
  region: 'Tel Aviv',
  language: Language.HE,
  trustScore: 1.0,
};
const anonymous: RespondentContext = { trustScore: 0.4, language: Language.HE };

describe('hasDemographicTargeting', () => {
  it('treats an empty / ALL profile as non-targeted', () => {
    expect(hasDemographicTargeting({})).toBe(false);
    expect(hasDemographicTargeting({ gender: 'ALL', language: 'ALL', minTrustScore: 0.4 })).toBe(false);
  });
  it('detects each demographic axis', () => {
    expect(hasDemographicTargeting({ ageMin: 18 })).toBe(true);
    expect(hasDemographicTargeting({ gender: 'FEMALE' })).toBe(true);
    expect(hasDemographicTargeting({ regions: ['Haifa'] })).toBe(true);
    expect(hasDemographicTargeting({ language: 'EN' })).toBe(true);
  });
});

describe('matchesTargeting', () => {
  it('shows general questions to everyone, including anonymous', () => {
    const general: Targeting = {};
    expect(matchesTargeting(general, identified)).toBe(true);
    expect(matchesTargeting(general, anonymous)).toBe(true);
  });

  it('never shows demographically targeted questions to anonymous users', () => {
    expect(matchesTargeting({ ageMin: 18, ageMax: 35 }, anonymous)).toBe(false);
    expect(matchesTargeting({ gender: 'MALE' }, anonymous)).toBe(false);
  });

  it('enforces the min-trust gate even for general questions', () => {
    expect(matchesTargeting({ minTrustScore: 0.7 }, anonymous)).toBe(false);
    expect(matchesTargeting({ minTrustScore: 0.7 }, identified)).toBe(true);
  });

  it('matches identified users on each axis', () => {
    expect(matchesTargeting({ ageMin: 18, ageMax: 35 }, identified)).toBe(true);
    expect(matchesTargeting({ ageMin: 40 }, identified)).toBe(false);
    expect(matchesTargeting({ gender: 'MALE' }, identified)).toBe(true);
    expect(matchesTargeting({ gender: 'FEMALE' }, identified)).toBe(false);
    expect(matchesTargeting({ regions: ['Tel Aviv', 'Haifa'] }, identified)).toBe(true);
    expect(matchesTargeting({ regions: ['Eilat'] }, identified)).toBe(false);
    expect(matchesTargeting({ language: 'HE' }, identified)).toBe(true);
    expect(matchesTargeting({ language: 'EN' }, identified)).toBe(false);
  });

  it('fails closed when a targeted axis is unknown for the respondent', () => {
    const noAge: RespondentContext = { trustScore: 1.0, gender: Gender.MALE };
    expect(matchesTargeting({ ageMin: 18 }, noAge)).toBe(false);
  });
});
