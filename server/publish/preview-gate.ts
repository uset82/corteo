import { accountIdentity, uploadPostConfig } from '../plugins/upload-post-client.ts';
import { publishRequestId, resolvePublishSource } from '../plugins/upload-post-source.ts';
import type { PublishRequest } from '../plugins/upload-post.ts';

/**
 * The confirm gate, reusable outside the publish route (Plan 5, OP-13).
 *
 * `publish_to_social` never trusts a supplied `previewId`: it recomputes the id from the
 * request and the resolved source, and refuses a confirm whose ids differ. Scheduling has to
 * do the same, or it would accept any non-empty string and publish something no human saw.
 *
 * This is the same derivation, not a second one: `publishRequestId` is the function the
 * publish route itself calls, so a change to what makes two posts identical changes both.
 */

export interface PreviewGateDeps {
  /** Defaults to the real Upload-Post config (key + profile). */
  identity?: () => Promise<string>;
  /** Defaults to the real Upload-Post profile name. */
  profile?: () => string;
  /** Defaults to the real source resolution (name, size, content hash). */
  source?: (src: string) => Promise<{ name: string; sizeBytes: number; contentHash: string }>;
}

export interface PreviewGateResult {
  matches: boolean;
  /** The id the request actually derives to. */
  derived: string;
  /** Why it could not be checked, when that is the case (missing key, unreadable file). */
  error?: string;
}

export async function derivePreviewId(
  request: PublishRequest,
  deps: PreviewGateDeps = {},
): Promise<PreviewGateResult> {
  try {
    const identity = deps.identity
      ? await deps.identity()
      : await accountIdentity(uploadPostConfig());
    const source = deps.source
      ? await deps.source(request.source)
      : await resolvePublishSource(request.source);
    const derived = publishRequestId(identity, deps.profile ? deps.profile() : profileOf(), source, request);
    return { matches: false, derived };
  } catch (error) {
    return {
      matches: false,
      derived: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** The profile the route uses; kept in one place so a test can reason about the identity. */
function profileOf(): string {
  try {
    return uploadPostConfig().profile;
  } catch {
    return '';
  }
}

/**
 * True only when the supplied id is what this exact request derives to. A missing id, an
 * unreadable source or a missing key all return false: scheduling refuses rather than guesses.
 */
export async function previewMatches(
  request: PublishRequest,
  previewId: string,
  deps: PreviewGateDeps = {},
): Promise<PreviewGateResult & { ok: boolean }> {
  if (!previewId.trim()) {
    return { ok: false, matches: false, derived: '', error: 'Falta la vista previa aprobada (previewId).' };
  }
  const result = await derivePreviewId(request, deps);
  if (result.error) return { ok: false, matches: false, derived: '', error: result.error };
  const matches = result.derived === previewId.trim();
  return {
    ok: matches,
    matches,
    derived: result.derived,
    ...(matches
      ? {}
      : { error: 'Esa vista previa no corresponde a esta publicación: el vídeo, la cuenta o los campos cambiaron. Genera una nueva y vuelve a aprobarla.' }),
  };
}
