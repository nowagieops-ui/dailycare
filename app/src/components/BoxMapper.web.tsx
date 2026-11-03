import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Box } from './box-types';
import { colors } from '../lib/theme';

const SCALE = 1.4;

/** Renders one PDF page and lets the admin drag rectangles where answers should be written. Web only. */
export function BoxMapper({ data, boxes, onAdd }: { data: ArrayBuffer; boxes: Box[]; onAdd: (b: Omit<Box, 'id'>) => void }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [pageH, setPageH] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const lib: any = await import('pdfjs-dist/build/pdf.min.mjs');
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        // isEvalSupported off and no scripting: the PDF is treated strictly as a picture.
        const doc = await lib.getDocument({ data: new Uint8Array(data.slice(0)), isEvalSupported: false, enableScripting: false }).promise;
        if (!dead) setPdf(doc);
      } catch { if (!dead) setErr('This PDF could not be displayed.'); }
    })();
    return () => { dead = true; };
  }, [data]);

  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let task: any;
    (async () => {
      const p = await pdf.getPage(page + 1);
      const vp = p.getViewport({ scale: SCALE });
      const c = canvas.current!;
      c.width = vp.width; c.height = vp.height;
      setSize({ w: vp.width, h: vp.height });
      setPageH(p.getViewport({ scale: 1 }).height);
      task = p.render({ canvasContext: c.getContext('2d')!, viewport: vp });
      await task.promise.catch(() => {});
    })();
    return () => task?.cancel?.();
  }, [pdf, page]);

  const pos = (e: any) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const finish = () => {
    if (drag) {
      const x = Math.min(drag.x, drag.x2), y = Math.min(drag.y, drag.y2), w = Math.abs(drag.x2 - drag.x), h = Math.abs(drag.y2 - drag.y);
      if (w > 8 && h > 8) onAdd({ label: '', page, x: x / SCALE, y: pageH - (y + h) / SCALE, w: w / SCALE, h: h / SCALE });
    }
    setDrag(null);
  };

  if (err) return <Text style={{ color: colors.red }}>{err}</Text>;
  const mine = boxes.map((b, i) => ({ b, n: i + 1 })).filter(({ b }) => b.page === page);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Pressable onPress={() => setPage((p) => Math.max(0, p - 1))}><Text style={{ color: colors.primary, fontWeight: '700' }}>‹ Prev</Text></Pressable>
        <Text style={{ color: colors.ink }}>Page {page + 1} of {pdf?.numPages ?? '…'}</Text>
        <Pressable onPress={() => setPage((p) => Math.min((pdf?.numPages ?? 1) - 1, p + 1))}><Text style={{ color: colors.primary, fontWeight: '700' }}>Next ›</Text></Pressable>
        <Text style={{ color: colors.inkFaint, fontSize: 12 }}>Drag on the page to draw a box for an answer.</Text>
      </View>
      <div style={{ overflow: 'auto', maxHeight: 640, border: `1px solid ${colors.line}`, borderRadius: 8 }}>
        <div
          style={{ position: 'relative', width: size.w, height: size.h, cursor: 'crosshair', userSelect: 'none' }}
          onMouseDown={(e) => { const p = pos(e); setDrag({ x: p.x, y: p.y, x2: p.x, y2: p.y }); }}
          onMouseMove={(e) => { if (drag) { const p = pos(e); setDrag({ ...drag, x2: p.x, y2: p.y }); } }}
          onMouseUp={finish} onMouseLeave={finish}
        >
          <canvas ref={canvas} style={{ display: 'block' }} />
          {mine.map(({ b, n }) => (
            <div key={b.id} style={{ position: 'absolute', left: b.x * SCALE, top: (pageH - b.y - b.h) * SCALE, width: b.w * SCALE, height: b.h * SCALE, border: '2px solid #373CB6', background: 'rgba(55,60,182,0.12)', pointerEvents: 'none', fontSize: 11, color: '#373CB6', fontWeight: 700 }}>{n}</div>
          ))}
          {drag && <div style={{ position: 'absolute', left: Math.min(drag.x, drag.x2), top: Math.min(drag.y, drag.y2), width: Math.abs(drag.x2 - drag.x), height: Math.abs(drag.y2 - drag.y), border: '2px dashed #C98A1E', pointerEvents: 'none' }} />}
        </div>
      </div>
    </View>
  );
}
