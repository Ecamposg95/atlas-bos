#!/usr/bin/env node
/**
 * migrate-tw-colors — codemod para WS-2 (barrido de color a tokens).
 *
 * Reemplaza clases Tailwind de color hardcodeadas por las clases de token del
 * sistema (dax-* theme-aware + capa semántica sem-*). Pensado para correrse
 * PÁGINA POR PÁGINA con revisión humana + verificación en ambos temas, NO como
 * un sed masivo a ciegas.
 *
 * Uso:
 *   node scripts/migrate-tw-colors.mjs --dry                 # reporta todo el árbol
 *   node scripts/migrate-tw-colors.mjs --dry --path pages/hq # reporta un subárbol
 *   node scripts/migrate-tw-colors.mjs --apply --path pages/hq/HQOperations.tsx
 *
 * Notas:
 *  - Los modificadores de opacidad (`bg-slate-800/80`) se colapsan al token
 *    sólido; revísalos visualmente (por eso: página por página).
 *  - Sólo toca clases dentro de strings className; es textual/regex, revisa el diff.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = new URL('../src/', import.meta.url).pathname

// [regexClase, reemplazo]. \b y opción de /opacidad. Orden: específicos primero.
const MAP = [
  // ── Fondos oscuros → superficies dax ──
  ['bg-slate-950', 'bg-dax-bg'],
  ['bg-slate-900', 'bg-dax-bg'],
  ['bg-slate-800', 'bg-dax-card'],
  ['bg-slate-850', 'bg-dax-card'],
  ['bg-slate-700', 'bg-dax-surface'],
  ['bg-gray-900', 'bg-dax-bg'],
  ['bg-gray-800', 'bg-dax-card'],
  // ── Texto ──
  ['text-white', 'text-dax-text'],
  ['text-slate-50', 'text-dax-text'],
  ['text-slate-100', 'text-dax-text'],
  ['text-slate-200', 'text-dax-text'],
  ['text-slate-300', 'text-dax-muted'],
  ['text-slate-400', 'text-dax-muted'],
  ['text-slate-500', 'text-dax-muted'],
  ['text-slate-600', 'text-dax-faint'],
  ['text-gray-400', 'text-dax-muted'],
  ['text-gray-500', 'text-dax-muted'],
  // ── Bordes ──
  ['border-slate-600', 'border-dax-border'],
  ['border-slate-700', 'border-dax-border'],
  ['border-slate-800', 'border-dax-border'],
  ['border-gray-700', 'border-dax-border'],
  // ── Semántica (estado) ──
  ['text-emerald-300', 'text-sem-success'], ['text-emerald-400', 'text-sem-success'],
  ['text-emerald-500', 'text-sem-success'], ['text-emerald-600', 'text-sem-success'],
  ['text-green-400', 'text-sem-success'], ['text-green-500', 'text-sem-success'],
  ['text-amber-300', 'text-sem-warning'], ['text-amber-400', 'text-sem-warning'],
  ['text-amber-500', 'text-sem-warning'], ['text-yellow-400', 'text-sem-warning'],
  ['text-red-400', 'text-sem-critical'], ['text-red-500', 'text-sem-critical'],
  ['text-rose-400', 'text-sem-critical'], ['text-rose-500', 'text-sem-critical'],
  ['text-sky-400', 'text-sem-info'], ['text-blue-400', 'text-sem-info'], ['text-blue-500', 'text-sem-info'],
]

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const pathArg = (() => { const i = args.indexOf('--path'); return i >= 0 ? args[i + 1] : '' })()

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (['.tsx', '.ts'].includes(extname(p))) acc.push(p)
  }
  return acc
}

const target = pathArg ? join(ROOT, pathArg) : ROOT
const files = statSync(target).isDirectory() ? walk(target) : [target]

let totalHits = 0
const perFile = []

for (const file of files) {
  let src = readFileSync(file, 'utf8')
  let fileHits = 0
  const hitByRule = {}
  for (const [cls, repl] of MAP) {
    // \b<cls>(/\d+)?\b  — captura opcional de opacidad; se descarta al reemplazar.
    const re = new RegExp(`\\b${cls.replace(/[-/]/g, '\\$&')}(\\/\\d+)?\\b`, 'g')
    src = src.replace(re, (m) => { fileHits++; hitByRule[cls] = (hitByRule[cls] || 0) + 1; return repl })
  }
  if (fileHits > 0) {
    totalHits += fileHits
    perFile.push({ file: file.replace(ROOT, ''), hits: fileHits, rules: hitByRule })
    if (APPLY) writeFileSync(file, src, 'utf8')
  }
}

perFile.sort((a, b) => b.hits - a.hits)
console.log(`\n${APPLY ? '✍️  APLICADO' : '🔎 DRY-RUN'} — ${totalHits} reemplazos en ${perFile.length} archivos${pathArg ? ` (bajo ${pathArg})` : ''}\n`)
for (const f of perFile.slice(0, 40)) {
  console.log(`  ${String(f.hits).padStart(4)}  ${f.file}`)
}
if (perFile.length > 40) console.log(`  … y ${perFile.length - 40} archivos más`)
if (!APPLY) console.log('\nCorre con --apply --path <archivo|carpeta> por página, y verifica en claro/oscuro.\n')
