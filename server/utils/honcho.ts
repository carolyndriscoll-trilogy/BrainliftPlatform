/**
 * Honcho Client Module
 *
 * Singleton client for the Honcho learner profile API using @honcho-ai/sdk.
 * Follows the same pattern as server/utils/s3.ts.
 *
 * Architecture (Peer-based):
 *   Workspace: "brainlift-platform" (or env HONCHO_WORKSPACE_ID)
 *   Peers:
 *     student-{userId}     ← the learner (accumulates representations)
 *     discussion-agent     ← study partner identity
 *     import-agent         ← import guide identity
 *     grading-agent        ← evaluator identity
 *   Sessions:
 *     discussion-{slug}-{timestamp}  ← per discussion thread
 *     import-{slug}                  ← per brainlift import (reused on resume)
 *
 * All public functions return null/no-op when HONCHO_API_KEY is not set.
 * All wrapped in try/catch — Honcho failures never break the app.
 */

import { Honcho } from '@honcho-ai/sdk';
import { storage } from '../storage';

// ─── Singleton Client ───────────────────────────────────────────────────────

const honcho = process.env.HONCHO_API_KEY
  ? new Honcho({
      apiKey: process.env.HONCHO_API_KEY,
      workspaceId: process.env.HONCHO_WORKSPACE_ID || 'brainlift-platform',
      environment: 'production',
    })
  : null;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if Honcho is configured with the required environment variable.
 */
export function isHonchoConfigured(): boolean {
  return honcho !== null;
}

/**
 * Fetch the learner profile for a user via Honcho's peer chat API.
 * The agent peer queries its representation of the student peer.
 * Returns a ~300 word string summarizing the student's patterns, or null.
 */
export async function getLearnerContext(
  userId: string,
  agentName: string,
  options?: { searchQuery?: string }
): Promise<string | null> {
  if (!honcho) return null;

  try {
    const agentPeer = await honcho.peer(agentName);
    const studentPeerId = `student-${userId}`;

    const query = options?.searchQuery
      ? `Summarize this student's learning patterns, strengths, and growth areas, especially related to: ${options.searchQuery}. Be concise (under 300 words).`
      : `Summarize this student's learning patterns, strengths, and growth areas. Be concise (under 300 words).`;

    const response = await agentPeer.chat(query, { target: studentPeerId });

    if (!response || response.trim().length < 20) return null;

    return response.trim();
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
  if (!honcho) return null;

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
 * Store conversation messages to a Honcho session with proper peer attribution.
 * Creates student and agent peers, adds them to a session, then stores messages.
 * Fire-and-forget: never throws, logs errors only.
 */
export async function storeMessages(
  sessionKey: string,
  userId: string,
  agentName: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  if (!honcho) return;

  try {
    const studentPeer = await honcho.peer(`student-${userId}`);
    const agentPeer = await honcho.peer(agentName);
    const session = await honcho.session(sessionKey);

    // Add both peers to the session
    await session.addPeers([studentPeer, agentPeer]);

    // Build peer-attributed messages
    const messageInputs = messages
      .filter(m => m.content && m.content.trim().length > 0)
      .map(m => {
        const peer = m.role === 'user' ? studentPeer : agentPeer;
        return peer.message(
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        );
      });

    if (messageInputs.length > 0) {
      await session.addMessages(messageInputs);
    }
  } catch (err: any) {
    console.error(`[Honcho] storeMessages failed for session ${sessionKey}: ${err.message}`);
  }
}

/**
 * Store a structured observation as a Honcho conclusion.
 * The agent peer records what it observed about the student peer.
 * Fire-and-forget: never throws.
 */
export async function storeObservation(
  userId: string,
  type: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!honcho) return;

  try {
    // Determine which agent peer is the observer based on event type
    const agentName = type.startsWith('import') ? 'import-agent' : 'grading-agent';

    const agentPeer = await honcho.peer(agentName);
    const studentPeerId = `student-${userId}`;

    // Create a conclusion: what the agent observed about the student
    const conclusionContent = metadata
      ? `[${type}] ${content} | metadata: ${JSON.stringify(metadata)}`
      : `[${type}] ${content}`;

    await agentPeer.conclusionsOf(studentPeerId).create({
      content: conclusionContent,
    });
  } catch (err: any) {
    console.error(`[Honcho] storeObservation failed for user ${userId}: ${err.message}`);
  }
}
