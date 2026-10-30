/**
 * Pure access logic for the file manager (no Firebase imports, so it is easy to test).
 *
 * A folder/file stores its own shares plus the *effective* access: its own shares plus everything
 * inherited from its ancestors. Security rules only look at the effective lists, so changing a
 * share means recomputing them for the item and everything beneath it.
 *
 * A "key" is either a user id or "role:<role>" (e.g. "role:family_staff").
 */
export type Level = 'view' | 'upload';
export interface Share { key: string; level: Level }
export interface Access { viewers: string[]; uploaders: string[] }
export interface Node { id: string; parentId: string | null; ownShares: Share[] }

export const roleKey = (r: string) => `role:${r}`;

export function combine(parent: Access | null, own: Share[]): Access {
  const viewers = new Set(parent?.viewers ?? []);
  const uploaders = new Set(parent?.uploaders ?? []);
  for (const s of own) {
    viewers.add(s.key); // uploading implies viewing
    if (s.level === 'upload') uploaders.add(s.key);
  }
  return { viewers: [...viewers], uploaders: [...uploaders] };
}

/** Effective access for `rootId` and all of its descendants. `nodes` must contain them all. */
export function propagate(rootId: string, rootParentAccess: Access | null, nodes: Node[]): Map<string, Access> {
  const kids = new Map<string, Node[]>();
  const byId = new Map<string, Node>();
  for (const n of nodes) {
    byId.set(n.id, n);
    if (n.parentId) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n]);
  }
  const out = new Map<string, Access>();
  const walk = (id: string, parentAccess: Access | null) => {
    const node = byId.get(id);
    if (!node || out.has(id)) return; // guards against a corrupt cycle
    const acc = combine(parentAccess, node.ownShares);
    out.set(id, acc);
    for (const c of kids.get(id) ?? []) walk(c.id, acc);
  };
  walk(rootId, rootParentAccess);
  return out;
}

export const ALLOWED_TYPES = [
  'application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export const MAX_BYTES = 25 * 1024 * 1024;

export function checkUpload(type: string, size: number): string | null {
  if (!ALLOWED_TYPES.includes(type)) return 'That file type isn\'t allowed. Use PDF, Word, Excel, PNG, JPEG, TXT or CSV.';
  if (size > MAX_BYTES) return 'That file is over 25 MB.';
  if (size === 0) return 'That file is empty.';
  return null;
}
