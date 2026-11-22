import { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { escapeHtml, renderRecord } from '../../lib/records';
import type { Shift } from '../../lib/types';
import { Btn, Card, fmtDay, Muted, s, Screen } from '../../lib/ui';
import { colors } from '../../lib/theme';

export default function Records() {
  const [rows, setRows] = useState<Shift[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const q = query(collection(db, 'shifts'), where('status', '==', 'completed'), orderBy('start', 'desc'), limit(50));
    return onSnapshot(q, (sn) => setRows(sn.docs.map((d) => ({ ...(d.data() as Shift), id: d.id }))), () => {});
  }, []);

  function print(sh: Shift) {
    const w = window.open('', '_blank');
    if (!w) return;
    // Everything is escaped: staff-entered notes must never run as markup.
    w.document.write(`<!doctype html><title>Visit record</title><pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;padding:24px">${escapeHtml(renderRecord(sh))}</pre>`);
    w.document.close();
    w.print();
  }

  return (
    <Screen title="Visit records">
      <Muted>Each completed shift fills a record from the DSP's checklist, daily note and clock times.</Muted>
      {rows.map((sh) => (
        <Card key={sh.id}>
          <Text style={s.h2}>{sh.clientName} · {fmtDay(sh.start.toMillis())}</Text>
          <Muted>{sh.staffName}</Muted>
          <Btn label={open === sh.id ? 'Hide' : 'View record'} tone="ghost" onPress={() => setOpen(open === sh.id ? null : sh.id)} />
          {open === sh.id && (
            <>
              <Text selectable style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), color: colors.ink }}>
                {renderRecord(sh)}
              </Text>
              {Platform.OS === 'web' && <Btn label="Print / save as PDF" onPress={() => print(sh)} />}
            </>
          )}
        </Card>
      ))}
    </Screen>
  );
}
