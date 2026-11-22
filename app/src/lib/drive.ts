import { useEffect, useState } from 'react';
import {
  addDoc, collection, deleteDoc, updateDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where, writeBatch,
  type Query,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import { FOLDERS } from './ebinder';
import { checkUpload, propagate, roleKey, type Access, type Share } from './drive-access';
import type { Client, DriveItem, Role } from './types';

const col = () => collection(db, 'drive');
const MAX_BATCH = 450;

/** Keys that identify "me" in access lists: my uid and my role. */
export const myKeys = (uid: string, role: Role) => [uid, roleKey(role)];

/** Live contents of a folder (parentId null = top level). Staff see only what is shared with them. */
export function useFolder(parentId: string | null, mode: 'super' | 'staff', keys: string[]) {
  const [items, setItems] = useState<DriveItem[]>([]);
  const keyStr = keys.join('|');
  useEffect(() => {
    let q: Query;
    if (mode === 'super') q = query(col(), where('parentId', '==', parentId));
    else if (parentId === null) q = query(col(), where('sharedRoot', '==', true), where('viewers', 'array-contains-any', keys));
    else q = query(col(), where('parentId', '==', parentId), where('viewers', 'array-contains-any', keys));
    return onSnapshot(
      q,
      (s) => setItems(s.docs.map((d) => ({ ...(d.data() as DriveItem), id: d.id }))
        // Sorted here: names are sensitive and are never indexed in the database.
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))),
      () => setItems([]),
    );
  }, [parentId, mode, keyStr]); // eslint-disable-line react-hooks/exhaustive-deps
  return items;
}

/** Every folder (super admin only): feeds the folder tree on the left. */
export function useAllFolders(enabled = true) {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(col(), where('type', '==', 'folder')),
      (s) => { setItems(s.docs.map((d) => ({ ...(d.data() as DriveItem), id: d.id }))); setLoaded(true); },
      () => setLoaded(true),
    );
  }, [enabled]);
  return { items, loaded };
}

async function parentAccess(parent: DriveItem | null): Promise<{ access: Access; path: string[] }> {
  if (!parent) return { access: { viewers: [], uploaders: [] }, path: [] };
  return { access: { viewers: parent.viewers, uploaders: parent.uploaders }, path: [...parent.path, parent.id] };
}

// ---- Client folders: file manager <-> eBinder link ----
// Every client has a folder  Individuals / <client> / <eBinder folder>.  A file added there also appears in that
// client's eBinder, and a document uploaded to a client's eBinder also appears in that folder. Ids are fixed so the
// folders are never duplicated, whichever side creates them first.
export const ROOT_ID = 'individuals';
export const clientFolderId = (clientId: string) => `c_${clientId}`;
const subFolderId = (clientId: string, name: string) => `c_${clientId}__${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

async function ensureFolder(id: string, name: string, parent: DriveItem | null, uid: string, ownerName: string, extra: Partial<DriveItem>): Promise<DriveItem> {
  const ref0 = doc(db, 'drive', id);
  const have = await getDoc(ref0);
  if (have.exists()) return { ...(have.data() as DriveItem), id };
  const { access, path } = await parentAccess(parent);
  const data = {
    type: 'folder', name, parentId: parent?.id ?? null, path, ownerId: uid, ownerName,
    ownShares: [], ...access, sharedRoot: false, linked: true, createdAt: Timestamp.now(), ...extra,
  };
  await setDoc(ref0, data);
  return { ...(data as unknown as DriveItem), id };
}

/** The client's eBinder folder (creating Individuals / client / folder as needed). `folder` '' = the client's top folder. */
export async function ensureClientFolder(client: Pick<Client, 'id' | 'name'>, folder: string, uid: string, ownerName: string): Promise<DriveItem> {
  const root = await ensureFolder(ROOT_ID, 'Individuals', null, uid, ownerName, {});
  const top = await ensureFolder(clientFolderId(client.id), client.name, root, uid, ownerName, { clientId: client.id, ebinderFolder: '' });
  if (!folder || folder === 'General') return top;
  return ensureFolder(subFolderId(client.id, folder), folder, top, uid, ownerName, { clientId: client.id, ebinderFolder: folder });
}

/** Makes sure each client has a folder with the standard eBinder subfolders. Safe to run repeatedly. */
export async function syncClientFolders(clients: Pick<Client, 'id' | 'name'>[], existing: Set<string>, uid: string, ownerName: string, folders: readonly string[] = FOLDERS) {
  for (const c of clients) {
    if (existing.has(clientFolderId(c.id)) && folders.every((f) => existing.has(subFolderId(c.id, f)))) continue;
    for (const f of folders) await ensureClientFolder(c, f, uid, ownerName);
  }
}

export async function createFolder(name: string, parent: DriveItem | null, uid: string, ownerName = '') {
  const { access, path } = await parentAccess(parent);
  const link = parent?.clientId
    ? { linked: true, clientId: parent.clientId, ebinderFolder: parent.id === clientFolderId(parent.clientId) ? name.trim() : parent.ebinderFolder ?? '' }
    : parent?.linked ? { linked: true } : {};
  const data = {
    type: 'folder', name: name.trim(), parentId: parent?.id ?? null, path, ownerId: uid, ownerName,
    ownShares: [], ...access, sharedRoot: false, createdAt: Timestamp.now(), ...link,
  };
  const r = await addDoc(col(), data);
  return { ...(data as unknown as DriveItem), id: r.id };
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const mimeOf = (name: string) => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? '';

export interface ImportResult { files: number; folders: number; skipped: string[] }

/**
 * Bulk import for migrating from another system: a ZIP, or a dropped folder, becomes the same folder tree here.
 * A folder with the same name as an existing one (e.g. a client's name, or "Care Plans") is reused, so files inside a
 * client's folder land in that client's eBinder too. Types the file manager doesn't allow are skipped and reported.
 */
export async function importTree(
  entries: { path: string; file: File }[], parent: DriveItem | null, uid: string, ownerName: string, office: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { files: 0, folders: 0, skipped: [] };
  const cache = new Map<string, DriveItem>();
  const childFolder = async (par: DriveItem | null, name: string): Promise<DriveItem> => {
    const key = `${par?.id ?? ''}/${name.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const snap = await getDocs(query(col(), where('parentId', '==', par?.id ?? null), where('type', '==', 'folder')));
    const found = snap.docs.find((d) => String(d.data().name).toLowerCase() === name.toLowerCase());
    let item: DriveItem;
    if (found) item = { ...(found.data() as DriveItem), id: found.id };
    else { item = await createFolder(name, par, uid, ownerName); result.folders++; }
    cache.set(key, item);
    return item;
  };
  let done = 0;
  for (const e of entries) {
    const parts = e.path.split('/').filter((p) => p && p !== '.' && p !== '..');
    const base = parts.pop();
    if (!base || base.startsWith('.') || base === 'Thumbs.db' || parts.some((p) => p === '__MACOSX')) { onProgress?.(++done, entries.length); continue; }
    let cur = parent;
    for (const seg of parts) cur = await childFolder(cur, seg);
    const file = e.file.type ? e.file : new File([e.file], base, { type: mimeOf(base) });
    const problem = await uploadFile(file.name === base ? file : new File([file], base, { type: file.type }), cur, uid, ownerName, office);
    if (problem) result.skipped.push(`${e.path}: ${problem}`); else result.files++;
    onProgress?.(++done, entries.length);
  }
  return result;
}

/** Reads a ZIP into importTree entries (loaded only when needed). */
export async function zipEntries(zip: File): Promise<{ path: string; file: File }[]> {
  const { default: JSZip } = await import('jszip');
  const z = await JSZip.loadAsync(zip);
  const out: { path: string; file: File }[] = [];
  for (const [path, entry] of Object.entries(z.files)) {
    if (entry.dir) continue;
    const base = path.split('/').pop() ?? path;
    out.push({ path, file: new File([await entry.async('blob')], base, { type: mimeOf(base) }) });
  }
  return out;
}

/**
 * Creates the record first (rules check upload access), then uploads; rolls the record back on failure.
 * In a client's folder, office roles also get a matching eBinder document for that client.
 */
export async function uploadFile(file: File, parent: DriveItem | null, uid: string, ownerName = '', office = false): Promise<string | null> {
  const problem = checkUpload(file.type, file.size);
  if (problem) return problem;
  const { access, path } = await parentAccess(parent);
  const toEbinder = office && !!parent?.clientId;
  const docRef = doc(col());
  const link = parent?.clientId
    ? { linked: true, clientId: parent.clientId, ebinderFolder: parent.ebinderFolder ?? '', ...(toEbinder ? { ebinderDocId: `d_${docRef.id}` } : {}) }
    : parent?.linked ? { linked: true } : {};
  await setDoc(docRef, {
    type: 'file', name: file.name.slice(0, 200), parentId: parent?.id ?? null, path, ownerId: uid, ownerName,
    ownShares: [], ...access, sharedRoot: false, size: file.size, contentType: file.type, createdAt: Timestamp.now(), ...link,
  });
  try {
    await uploadBytes(ref(storage, `drive/${docRef.id}`), file, { contentType: file.type });
  } catch {
    await deleteDoc(docRef).catch(() => {});
    return 'Upload failed. You may not have permission to add files here.';
  }
  if (toEbinder && parent?.clientId) {
    // Visible to office roles only until an admin shares it with staff from eBinders.
    await setDoc(doc(db, 'ebinderDocs', `d_${docRef.id}`), {
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 200), fileName: file.name.slice(0, 200), folder: parent.ebinderFolder || 'General',
      clientId: parent.clientId, audience: 'admin', assignedTo: [], requiresSignature: false, body: '', acks: [],
      uploadedByName: ownerName, updatedAt: serverTimestamp(), version: 1, pdfPath: `drive/${docRef.id}`, driveId: docRef.id,
    }).catch(() => {});
  }
  return null;
}

/** A document uploaded in eBinders for a client also shows in that client's folder in the file manager. */
export async function mirrorEbinderDoc(
  docId: string, fileName: string, folder: string, client: Pick<Client, 'id' | 'name'>, uid: string, ownerName: string, size: number,
) {
  const id = `e_${docId}`;
  if ((await getDoc(doc(db, 'drive', id))).exists()) return;
  const parent = await ensureClientFolder(client, folder, uid, ownerName);
  const { access, path } = await parentAccess(parent);
  await setDoc(doc(db, 'drive', id), {
    type: 'file', name: fileName.slice(0, 200), parentId: parent.id, path, ownerId: uid, ownerName, ownShares: [], ...access,
    sharedRoot: false, size, contentType: 'application/pdf', createdAt: Timestamp.now(),
    linked: true, clientId: client.id, ebinderFolder: parent.ebinderFolder ?? '', ebinderDocId: docId, fromEbinder: true,
  });
  await updateDoc(doc(db, 'ebinderDocs', docId), { driveId: id });
}

/** Replace an item's own shares and recompute access for it and everything beneath it. */
export async function saveShares(item: DriveItem, own: Share[]) {
  const under = await getDocs(query(col(), where('path', 'array-contains', item.id)));
  const nodes = [
    { id: item.id, parentId: item.parentId, ownShares: own },
    ...under.docs.map((d) => ({ id: d.id, parentId: d.data().parentId as string | null, ownShares: (d.data().ownShares ?? []) as Share[] })),
  ];
  let parentAcc: Access | null = null;
  if (item.parentId) {
    const p = (await getDoc(doc(db, 'drive', item.parentId))).data();
    if (p) parentAcc = { viewers: p.viewers, uploaders: p.uploaders };
  }
  const result = propagate(item.id, parentAcc, nodes);
  const entries = [...result.entries()];
  for (let i = 0; i < entries.length; i += MAX_BATCH) {
    const batch = writeBatch(db);
    for (const [id, acc] of entries.slice(i, i + MAX_BATCH)) {
      const extra = id === item.id ? { ownShares: own, sharedRoot: own.length > 0 } : {};
      batch.update(doc(db, 'drive', id), { ...acc, ...extra });
    }
    await batch.commit();
  }
}

/** Deletes a folder, everything inside it, and the stored files. A file that came from eBinders only leaves the file manager. */
export async function deleteItem(item: DriveItem) {
  const under = item.type === 'folder' ? (await getDocs(query(col(), where('path', 'array-contains', item.id)))).docs : [];
  const all = [item as Partial<DriveItem> & { id: string }, ...under.map((d) => ({ ...(d.data() as DriveItem), id: d.id }))];
  for (const f of all) {
    if (f.type !== 'file') continue;
    if (!f.fromEbinder) await deleteObject(ref(storage, `drive/${f.id}`)).catch(() => {});
    // The linked eBinder document goes too, unless the file was uploaded in eBinders first.
    if (f.ebinderDocId && !f.fromEbinder) await deleteDoc(doc(db, 'ebinderDocs', f.ebinderDocId)).catch(() => {});
  }
  for (let i = 0; i < all.length; i += MAX_BATCH) {
    const batch = writeBatch(db);
    all.slice(i, i + MAX_BATCH).forEach((f) => batch.delete(doc(db, 'drive', f.id)));
    await batch.commit();
  }
}

/** Where a file's bytes are: the file manager, or (for files linked to an eBinder document) that document's current PDF. */
export async function fileUrl(item: DriveItem): Promise<string> {
  if (item.ebinderDocId) {
    const d = (await getDoc(doc(db, 'ebinderDocs', item.ebinderDocId))).data();
    if (d?.pdfPath) return getDownloadURL(ref(storage, d.pdfPath));
  }
  return getDownloadURL(ref(storage, `drive/${item.id}`));
}
