/**
 * Skill Registry
 *
 * This is the single place to register skills with the agent.
 * To add a new skill:
 *   1. Create services/agent/src/skills/my-skill.ts
 *   2. Export a Skill object from it
 *   3. Add it to the array below
 *
 * agent.ts picks up everything automatically — no other file needs changing.
 */

import type { Skill } from './types.js';

import { getTimeSkill }          from './get-time.js';
import { createMeetingSkill }    from './calendar.js';
import { readCalendarSkill }     from './read-calendar.js';
import { webSearchSkill }        from './research.js';
import { getWeatherSkill }       from './get-weather.js';
import { calculateSkill }        from './calculate.js';

export const skills: Skill[] = [
  getTimeSkill,
  createMeetingSkill,
  readCalendarSkill,
  webSearchSkill,
  getWeatherSkill,
  calculateSkill,
];

export type { Skill };
