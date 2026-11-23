// A small calculator: + − × ÷, decimals, brackets and square root, with the usual order of operations.
// Written by hand so nothing typed by the student is ever run as code.

type Tok = { t: "num"; v: number } | { t: "op"; v: "+" | "-" | "*" | "/" } | { t: "(" } | { t: ")" } | { t: "sqrt" };

function tokenise(src: string): Tok[] | null {
  const s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/,/g, "");
  const out: Tok[] = [];
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; } // spaces separate tokens, so "2 3" is not read as 23
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const text = s.slice(i, j);
      if ((text.match(/\./g) ?? []).length > 1 || text === ".") return null;
      out.push({ t: "num", v: Number(text) });
      i = j;
    } else if (c === "+" || c === "-" || c === "*" || c === "/") { out.push({ t: "op", v: c }); i++; }
    else if (c === "(" || c === ")") { out.push({ t: c }); i++; }
    else if (c === "√") { out.push({ t: "sqrt" }); i++; }
    else if (s.startsWith("sqrt", i)) { out.push({ t: "sqrt" }); i += 4; }
    else return null;
  }
  return out;
}

/** Work out an expression. Returns null if it cannot be read or has no real answer (such as dividing by zero). */
export function evaluate(src: string): number | null {
  const toks = tokenise(src);
  if (!toks || !toks.length) return null;
  let pos = 0;
  const peek = () => toks[pos];

  function expr(): number | null {
    let left = term();
    for (let t = peek(); left !== null && t?.t === "op" && (t.v === "+" || t.v === "-"); t = peek()) {
      pos++;
      const right = term();
      if (right === null) return null;
      left = t.v === "+" ? left + right : left - right;
    }
    return left;
  }
  function term(): number | null {
    let left = factor();
    for (let t = peek(); left !== null && t?.t === "op" && (t.v === "*" || t.v === "/"); t = peek()) {
      pos++;
      const right = factor();
      if (right === null) return null;
      if (t.v === "/" && right === 0) return null;
      left = t.v === "*" ? left * right : left / right;
    }
    return left;
  }
  function factor(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.t === "op" && t.v === "-") { pos++; const v = factor(); return v === null ? null : -v; }
    if (t.t === "sqrt") { pos++; const v = factor(); return v === null || v < 0 ? null : Math.sqrt(v); }
    if (t.t === "num") { pos++; return t.v; }
    if (t.t === "(") {
      pos++;
      const v = expr();
      if (v === null || peek()?.t !== ")") return null;
      pos++;
      return v;
    }
    return null;
  }

  const v = expr();
  if (v === null || pos !== toks.length || !Number.isFinite(v)) return null;
  return v;
}

/** Show a result without float noise (0.1 + 0.2 shows as 0.3). */
export function show(n: number): string {
  const r = Math.round(n * 1e8) / 1e8;
  return Object.is(r, -0) ? "0" : String(r);
}
