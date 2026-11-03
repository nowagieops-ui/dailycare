import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface Notice { id: string; title: string; body: string; createdAt: Timestamp; read: boolean }

export function useNotices(uid: string | undefined) {
  const [items, setItems] = useState<Notice[]>([]);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (s) => setItems(s.docs.map((d) => ({ ...(d.data() as Notice), id: d.id }))), () => {});
  }, [uid]);
  return items;
}

export async function markAllRead(items: Notice[]) {
  const unread = items.filter((n) => !n.read);
  if (!unread.length) return;
  const b = writeBatch(db);
  unread.forEach((n) => b.update(doc(db, 'notifications', n.id), { read: true }));
  await b.commit();
}

export const timeAgo = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });
};
