import { parse } from 'parse5';
import { Script } from 'node:vm';
import { digest, fail } from './security.mjs';
export const MAX_GAME_BYTES = 256 * 1024;
export const GAME_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts";
export function validateGame(version, html) {
  if (typeof version !== 'string' || version.length > 40 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) fail(400, 'Version must use MAJOR.MINOR.PATCH.');
  if (typeof html !== 'string' || Buffer.byteLength(html) > MAX_GAME_BYTES || !/^\s*<!doctype html>/i.test(html)) fail(400, 'Submit a complete HTML document up to 256 KiB.');
  if (!/<head(?:\s[^>]*)?>/i.test(html) || !/<body(?:\s[^>]*)?>/i.test(html)) fail(400, 'A game requires explicit head and body elements.');
  let scripts = 0;
  const forbidden = new Set(['iframe','frame','frameset','object','embed','base','form','link','portal','svg','math']);
  function walk(node) {
    if (forbidden.has(node.tagName)) fail(400, `Unsupported element: ${node.tagName}.`);
    for (const attr of node.attrs || []) {
      if (/^on/i.test(attr.name) || ['srcdoc','srcset','action','formaction','href','http-equiv'].includes(attr.name)) fail(400, `Unsupported attribute: ${attr.name}.`);
      if (attr.name === 'src' && !/^data:(image\/(png|jpeg|webp|gif)|audio\/(mpeg|ogg|wav));base64,/i.test(attr.value)) fail(400, 'Only embedded image/audio data URLs are supported.');
    }
    if (node.tagName === 'script') {
      if ((node.attrs || []).some(a => ['src','type'].includes(a.name))) fail(400, 'Use classic inline scripts only.');
      const source = (node.childNodes || []).map(n => n.value || '').join('');
      try { new Script(source); } catch { fail(400, 'Game JavaScript contains a syntax error.'); }
      scripts++;
    }
    for (const child of node.childNodes || []) walk(child);
    if (node.content) walk(node.content);
  }
  walk(parse(html));
  if (!scripts || !html.includes('unplug:ready')) fail(400, 'An inline script and unplug:ready startup message are required.');
  return { sha256: digest(html), bytes: Buffer.byteLength(html), checks: ['HTML contract', '256 KiB limit', 'JavaScript syntax', 'Readiness contract'] };
}
