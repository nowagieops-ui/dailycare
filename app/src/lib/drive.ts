import { useEffect, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, Timestamp, where, writeBatch,
  type Query,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import { checkUpload, propagate, roleKey, type Access, type Share } from './drive-access';
import type { DriveItem, Role } from './types';

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

async function parentAccess(parent: DriveItem | null): Promise<{ access: Access; path: string[] }> {
  if (!parent) return { access: { viewers: [], uploaders: [] }, path: [] };
  return { access: { viewers: parent.viewers, uploaders: parent.uploaders }, path: [...parent.path, parent.id] };
}

export async function createFolder(name: string, parent: DriveItem | null, uid: string) {
  const { access, path } = await parentAccess(parent);
  await addDoc(col(), {
    type: 'folder', name: name.trim(), parentId: parent?.id ?? null, path, ownerId: uid,
    ownShares: [], ...access, sharedRoot: false, createdAt: Timestamp.now(),
  });
}

/** Creates the record first (rules check upload access), then uploads; rolls the record back on failure. */
export async function uploadFile(file: File, parent: DriveItem | null, uid: string): Promise<string | null> {
  const problem = checkUpload(file.type, file.size);
  if (problem) return problem;
  const { access, path } = await parentAccess(parent);
  const docRef = await addDoc(col(), {
    type: 'file', name: file.name.slice(0, 200), parentId: parent?.id ?? null, path, ownerId: uid,
    ownShares: [], ...access, sharedRoot: false, size: file.size, contentType: file.type, createdAt: Timestamp.now(),
  });
  try {
    await uploadBytes(ref(storage, `drive/${docRef.id}`), file, { contentType: file.type });
    return null;
  } catch {
    await deleteDoc(docRef).catch(() => {});
    return 'Upload failed. You may not have permission to add files here.';
  }
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

/** Deletes a folder, everything inside it, and the stored files. */
export async function deleteItem(item: DriveItem) {
  const under = item.type === 'folder' ? (await getDocs(query(col(), where('path', 'array-contains', item.id)))).docs : [];
  const all = [{ id: item.id, type: item.type }, ...under.map((d) => ({ id: d.id, type: d.data().type as string }))];
  for (const f of all) {
    if (f.type === 'file') await deleteObject(ref(storage, `drive/${f.id}`)).catch(() => {});
  }
  for (let i = 0; i < all.length; i += MAX_BATCH) {
    const batch = writeBatch(db);
    all.slice(i, i + MAX_BATCH).forEach((f) => batch.delete(doc(db, 'drive', f.id)));
    await batch.commit();
  }
}

export async function fileUrl(item: DriveItem): Promise<string> {
  return getDownloadURL(ref(storage, `drive/${item.id}`));
}
