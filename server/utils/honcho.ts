/**
 * Honcho Client Module
 *
 * Singleton client for the Honcho learner profile API.
 * Follows the same pattern as server/utils/s3.ts.
 *
 * Architecture:
 *   App: "brainlift-platform" (single app)
 *   User: "user-{userId}" (one per student)
 *   Sessions: keyed by interaction type (discussion, import, grading)
 *   Messages: conversation turns stored in sessions
 *   Metamessages: structured observations (grading outcomes, import stats)
 *
 * All public functions return null/no-op when HONCHO_API_KEY is not set.
 * All wrapped in try/catch — Honcho failures never break the app.
 */

import Honcho from 'honcho-ai';
import { storage } from '../storage';

// ─── Singleton Client ───────────────────────────────────────────────────────

const client = process.env.HONCHO_API_KEY
  ? new Honcho({
      apiKey: process.env.HONCHO_API_KEY,
      environment: 'production',
    })
  : null;

const APP_NAME = 'brainlift-platform';

// Lazily cached app ID
let _appId: string | null = null;

async function getAppId(): Promise<string> {
  if (_appId) return _appId;
  if (!client) throw new Error('Honcho not configured');
  const app = await client.apps.getOrCreate(APP_NAME);
  _appId = app.id;
  return _appId;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if Honcho is configured with the required environment variable.
 */
export function isHonchoConfigured(): boolean {
  return client !== null;
}

/**
 * Get or create a Honcho user for a platform user ID.
 * Returns the Honcho user ID.
 */
async function getOrCreateUser(userId: string): Promise<string> {
  const appId = await getAppId();
  const user = await client!.apps.users.getOrCreate(appId, `user-${userId}`);
  return user.id;
}

/**
 * Get or create a Honcho session by session key.
 * Uses metadata filtering to find existing sessions.
 */
async function getOrCreateSession(
  honchoUserId: string,
  sessionKey: string,
  agentName: string
): Promise<string> {
  const appId = await getAppId();

  // Try to find existing session by metadata filter
  const sessions = await client!.apps.users.sessions.list(appId, honchoUserId, {
    filter: { session_key: sessionKey },
  });

  const existing = sessions.items?.[0];
  if (existing) return existing.id;

  // Create new session
  const session = await client!.apps.users.sessions.create(appId, honchoUserId, {
    metadata: { session_key: sessionKey, agent: agentName },
  });
  return session.id;
}

/**
 * Fetch the learner profile for a user via Honcho's dialectic API.
 * Returns a ~500 token string summarizing the student's patterns, or null.
 */
export async function getLearnerContext(
  userId: string,
  agentName: string,
  options?: { searchQuery?: string }
): Promise<string | null> {
  if (!client) return null;

  try {
    const appId = await getAppId();
    const honchoUserId = await getOrCreateUser(userId);

    // Create a temporary session for the context query
    const session = await client.apps.users.sessions.create(appId, honchoUserId, {
      metadata: { agent: agentName, type: 'context-query' },
    });

    const query = options?.searchQuery
      ? `Summarize this student's learning patterns, strengths, and growth areas, especially related to: ${options.searchQuery}. Be concise (under 300 words).`
      : `Summarize this student's learning patterns, strengths, and growth areas. Be concise (under 300 words).`;

    const response = await client.apps.users.sessions.chat(
      appId,
      honchoUserId,
      session.id,
      { queries: query }
    );

    // Clean up temp session
    await client.apps.users.sessions.delete(appId, honchoUserId, session.id).catch(() => {});

    const content = response.content?.trim();
    if (!content || content.length < 20) return null;

    return content;
  } catch (err: any) {
    console.error(`[Honcho] getLearnerContext failed for user ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch learner context for background jobs that only have a brainliftId.
 * Looks up the brainlift owner, then delegates to getLearnerContext.
 */
export async function getLearnerContextForGrading(
  brainliftId: number
): Promise<string | null> {
  if (!client) return null;

  try {
    const brainlift = await storage.getBrainliftById(brainliftId);
    if (!brainlift?.createdByUserId) return null;
    return getLearnerContext(brainlift.createdByUserId, 'grading-agent');
  } catch (err: any) {
    console.error(`[Honcho] getLearnerContextForGrading failed for brainlift ${brainliftId}: ${err.message}`);
    return null;
  }
}

/**
 * Store conversation messages to a Honcho session.
 * Fire-and-forget: never throws, logs errors only.
 */
export async function storeMessages(
  sessionKey: string,
  userId: string,
  agentName: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  if (!client) return;

  try {
    const honchoUserId = await getOrCreateUser(userId);
    const appId = await getAppId();
    const sessionId = await getOrCreateSession(honchoUserId, sessionKey, agentName);

    const batchMessages = messages.map(m => ({
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      is_user: m.role === 'user',
    }));

    if (batchMessages.length > 0) {
      // Batch API supports max 100 messages per call
      for (let i = 0; i < batchMessages.length; i += 100) {
        const chunk = batchMessages.slice(i, i + 100);
        await client.apps.users.sessions.messages.batch(
          appId,
          honchoUserId,
          sessionId,
          { messages: chunk }
        );
      }
    }
  } catch (err: any) {
    console.error(`[Honcho] storeMessages failed for session ${sessionKey}: ${err.message}`);
  }
}

/**
 * Store a structured observation as a Honcho metamessage.
 * Used after grading completions, import completions, etc.
 * Fire-and-forget: never throws.
 */
export async function storeObservation(
  userId: string,
  type: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!client) return;

  try {
    const appId = await getAppId();
    const honchoUserId = await getOrCreateUser(userId);

    await client.apps.users.metamessages.create(appId, honchoUserId, {
      content,
      metamessage_type: type,
      metadata,
    });
  } catch (err: any) {
    console.error(`[Honcho] storeObservation failed for user ${userId}: ${err.message}`);
  }
}
