import { useEffect, useState } from 'react';
import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Role, UserProfile } from './types';

export interface Chat {
  id: string; members: string[]; names: Record<string, string>; kind: 'direct' | 'group'; title?: string;
  lastText?: string; lastAt?: Timestamp; createdAt: Timestamp;
}
export interface Message { id: string; senderId: string; senderName: string; text: string; at: Timestamp }
export interface Person { id: string; name: string; role: Role; active: boolean }

export function useChats(uid: string | undefined) {
  const [rows, setRows] = useState<Chat[]>([]);
  useEffect(() => {
    if (!uid) return;
    // No orderBy: sorted here so no composite index is needed.
    return onSnapshot(query(collection(db, 'chats'), where('members', 'array-contains', uid)),
      (s) => setRows(s.docs.map((d) => ({ ...(d.data() as Chat), id: d.id }))), () => {});
  }, [uid]);
  return rows.sort((a, b) => (b.lastAt ?? b.createdAt)?.toMillis() - (a.lastAt ?? a.createdAt)?.toMillis());
}

export function useMessages(chatId: string | undefined) {
  const [rows, setRows] = useState<Message[]>([]);
  useEffect(() => {
    if (!chatId) return;
    return onSnapshot(query(collection(db, 'chats', chatId, 'messages'), orderBy('at', 'asc')),
      (s) => setRows(s.docs.map((d) => ({ ...(d.data() as Message), id: d.id }))), () => {});
  }, [chatId]);
  return rows;
}

export function usePeople() {
  const [rows, setRows] = useState<Person[]>([]);
  useEffect(() => onSnapshot(collection(db, 'directory'),
    (s) => setRows(s.docs.map((d) => ({ ...(d.data() as Omit<Person, 'id'>), id: d.id })).filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name))), () => {}), []);
  return rows;
}

export const chatTitle = (c: Chat, uid: string) =>
  c.title || c.members.filter((m) => m !== uid).map((m) => c.names[m] ?? 'Someone').join(', ') || 'Chat';

export async function startChat(me: UserProfile, people: Person[], existing: Chat[]): Promise<string> {
  const members = [me.uid, ...people.map((p) => p.id)];
  if (people.length === 1) {
    const dup = existing.find((c) => c.kind === 'direct' && c.members.length === 2 && c.members.includes(people[0].id));
    if (dup) return dup.id;
  }
  const names: Record<string, string> = { [me.uid]: me.name };
  people.forEach((p) => { names[p.id] = p.name; });
  const ref = await addDoc(collection(db, 'chats'), {
    members, names, kind: people.length === 1 ? 'direct' : 'group', createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function sendMessage(chatId: string, me: UserProfile, text: string) {
  const t = text.trim();
  if (!t) return;
  const b = writeBatch(db);
  b.set(doc(collection(db, 'chats', chatId, 'messages')), { senderId: me.uid, senderName: me.name, text: t, at: serverTimestamp() });
  b.update(doc(db, 'chats', chatId), { lastText: t.slice(0, 80), lastAt: serverTimestamp() });
  await b.commit();
}
