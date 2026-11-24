// @ts-nocheck
/* eslint-disable */
/**
 * Lógica de la versión validada, copiada sin cambios de "Prompt CalBanda.txt" (líneas 155-356).
 * Solo se usa en tests para comparar el comportamiento nuevo contra el original.
 */

function roundLinks(widthIn, incIn, mode) {
  const x = widthIn / incIn;
  if (mode === "floor") return Math.floor(x);
  if (mode === "ceil") return Math.ceil(x);
  return Math.round(x);
}

function combosSumTarget(target, partSizes, limit = 1200) {
  const sizes = [...new Set(partSizes)].sort((a, b) => b - a);
  const memo = new Map();
  function key(rem, idx) { return rem + ":" + idx; }
  function rec(rem, idx) {
    const k = key(rem, idx);
    if (memo.has(k)) return memo.get(k);
    if (rem === 0) return [[]];
    if (rem < 0 || idx >= sizes.length) return [];
    const s = sizes[idx];
    const maxK = Math.floor(rem / s);
    const out = [];
    for (let kcount = maxK; kcount >= 0; kcount--) {
      const part = Array(kcount).fill(s);
      const tails = rec(rem - s * kcount, idx + 1);
      for (const t of tails) {
        out.push([...part, ...t]);
        if (out.length >= limit) break;
      }
      if (out.length >= limit) break;
    }
    memo.set(k, out);
    return out;
  }
  const res = rec(target, 0);
  res.sort((a, b) => {
    // menos piezas; y favorecer piezas grandes
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const ai = a[i] ?? 0, bi = b[i] ?? 0;
      if (ai !== bi) return bi - ai;
    }
    return 0;
  });
  return res.slice(0, limit);
}

function seamPositionsFromSegments(segments) {
  const seams = new Set();
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    acc += segments[i].size;
    if (i !== segments.length - 1) seams.add(acc); // no añadir borde final
  }
  return seams;
}

function makeRowPatterns(widthLinks, edgeSizes, internalSizes, maxPatterns = 500) {
  const patterns = [];
  const eSizes = [...new Set(edgeSizes)].sort((a, b) => b - a);
  const iSizes = [...new Set(internalSizes)].sort((a, b) => b - a);

  for (const le of eSizes) {
    for (const re of eSizes) {
      if (le + re > widthLinks) continue;
      const remain = widthLinks - le - re;
      if (remain === 0) {
        const segs = [
          { role: "L", size: le, key: `edgeL_${le}` },
          { role: "R", size: re, key: `edgeR_${re}` },
        ];
        const seams = Array.from(seamPositionsFromSegments(segs));
        const pieceCount = 2;
        const score2 = -(le * le + re * re);
        patterns.push({ segments: segs, seams, pieceCount, score: [pieceCount, score2], widthLinks });
        continue;
      }
      const combos = combosSumTarget(remain, iSizes, 1200);
      for (const combo of combos) {
        const base = combo.slice();
        const segs = [
          { role: "L", size: le, key: `edgeL_${le}` },
          ...base.map((w, idx) => ({ role: "I", size: w, key: `int_${w}_${idx}` })),
          { role: "R", size: re, key: `edgeR_${re}` },
        ];
        const seams = Array.from(seamPositionsFromSegments(segs));
        const pieceCount = 2 + base.length;
        const score2 = -[...base, le, re].reduce((s, x) => s + x * x, 0);
        patterns.push({ segments: segs, seams, pieceCount, score: [pieceCount, score2], widthLinks });

        // Variantes por rotación de internos (patrón ladrillo)
        for (let shift = 1; shift < Math.min(4, base.length); shift++) {
          const rotated = base.slice(shift).concat(base.slice(0, shift));
          const segs2 = [
            { role: "L", size: le, key: `edgeL_${le}` },
            ...rotated.map((w, idx) => ({ role: "I", size: w, key: `int_${w}_rot${shift}_${idx}` })),
            { role: "R", size: re, key: `edgeR_${re}` },
          ];
          const seams2 = Array.from(seamPositionsFromSegments(segs2));
          const pieceCount2 = 2 + rotated.length;
          const score22 = -[...rotated, le, re].reduce((s, x) => s + x * x, 0);
          patterns.push({ segments: segs2, seams: seams2, pieceCount: pieceCount2, score: [pieceCount2, score22], widthLinks });
        }
      }
    }
  }

  // Deduplicar por conjunto de juntas + número de piezas
  const dedup = new Map();
  for (const p of patterns) {
    const k = JSON.stringify({ s: [...p.seams].sort((a,b)=>a-b), c: p.pieceCount });
    if (!dedup.has(k) || (p.score[0] < dedup.get(k).score[0]) || (p.score[0] === dedup.get(k).score[0] && p.score[1] < dedup.get(k).score[1])) {
      dedup.set(k, p);
    }
  }
  const uniq = Array.from(dedup.values());
  uniq.sort((a, b) => (a.pieceCount - b.pieceCount) || (a.score[1] - b.score[1]));
  return uniq.slice(0, maxPatterns);
}

function layoutRows(numRows, patterns) {
  if (!patterns.length) return [];
  const chosen = [];
  let prevSeams = new Set();
  for (let i = 0; i < numRows; i++) {
    let picked = null;
    for (const p of patterns) {
      const inter = p.seams.filter((x) => prevSeams.has(x));
      if (inter.length === 0) { picked = p; break; }
    }
    if (!picked) {
      // elegir el de menor intersección
      let best = null, bestOverlap = 1e9;
      for (const p of patterns) {
        const overlap = p.seams.filter((x) => prevSeams.has(x)).length;
        if (overlap < bestOverlap) { bestOverlap = overlap; best = p; }
      }
      picked = best || patterns[0];
    }
    chosen.push(picked);
    prevSeams = new Set(picked.seams);
  }
  return chosen;
}

function computeBOM(rows) {
  const bom = {};
  for (const r of rows) {
    for (const seg of r.segments) {
      const k = `${seg.role}:${seg.size}`;
      bom[k] = (bom[k] || 0) + 1;
    }
  }
  return bom;
}

function calcPusherRows(numRows, usePushers, mode, stepRows, offsetRows, stepIn, offsetIn, pitch){
  const P = new Set();
  if (!usePushers) return P;
  let start = 1, step = 1;
  if (mode === 'rows'){
    step = Math.max(1, Math.round(stepRows || 1));
    start = 1 + Math.max(0, Math.round(offsetRows || 0));
  } else {
    step = Math.max(1, Math.round(((stepIn || pitch)) / pitch));
    start = 1 + Math.max(0, Math.round(((offsetIn || 0)) / pitch));
  }
  for (let r = start; r <= numRows; r += step) P.add(r);
  return P;
}

function layoutRowsWithFlights(numRows, patternsNormal, patternsFlight, pusherRows){
  if (!patternsNormal.length && !patternsFlight.length) return [];
  const chosen = [];
  let prevSeams = new Set();
  for (let i = 1; i <= numRows; i++){
    const useFlight = pusherRows.has(i);
    const cand = (useFlight && patternsFlight.length) ? patternsFlight : patternsNormal;
    let picked = null;
    for (const p of cand){
      const overlap = p.seams.reduce((acc, s) => acc + (prevSeams.has(s) ? 1 : 0), 0);
      if (overlap === 0){ picked = p; break; }
    }
    if (!picked){
      let best = null, bestOverlap = 1e9;
      for (const p of cand){
        const ov = p.seams.reduce((acc, s) => acc + (prevSeams.has(s) ? 1 : 0), 0);
        if (ov < bestOverlap){ bestOverlap = ov; best = p; }
      }
      picked = best || (cand[0] || patternsNormal[0]);
    }
    let segments = picked.segments;
    if (useFlight){
      segments = picked.segments.map(seg => {
        if (seg.role === 'L') return {...seg, role:'LF'};
        if (seg.role === 'R') return {...seg, role:'RF'};
        return {...seg, role:'IF'};
      });
    }
    const row = { ...picked, segments };
    chosen.push(row);
    prevSeams = new Set(row.seams);
  }
  return chosen;
}

export {

  roundLinks as legacyRoundLinks,

  combosSumTarget as legacyCombosSumTarget,

  seamPositionsFromSegments as legacySeamPositions,

  makeRowPatterns as legacyMakeRowPatterns,

  layoutRows as legacyLayoutRows,

  computeBOM as legacyComputeBOM,

  calcPusherRows as legacyCalcPusherRows,

  layoutRowsWithFlights as legacyLayoutRowsWithFlights

};
