// Builds a monochrome "most used languages" card from the owner's public, non-fork repos.
import { writeFileSync, mkdirSync } from "node:fs";

const user = process.env.GH_USER;
const headers = { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "langs-card" };
const skipRepos = new Set([user.toLowerCase(), "achievement-playground"]);
const skipLangs = new Set(["HTML", "CSS", "SCSS", "Jupyter Notebook", "Makefile", "Dockerfile", "Shell", "Solidity", "Move"]);

const repos = [];
for (let page = 1; ; page++) {
  const res = await fetch(`https://api.github.com/users/${user}/repos?type=owner&per_page=100&page=${page}`, { headers });
  const batch = await res.json();
  if (!Array.isArray(batch) || batch.length === 0) break;
  repos.push(...batch);
  if (batch.length < 100) break;
}

const totals = {};
for (const repo of repos) {
  if (repo.fork || skipRepos.has(repo.name.toLowerCase())) continue;
  const langs = await (await fetch(repo.languages_url, { headers })).json();
  for (const [lang, bytes] of Object.entries(langs)) {
    if (!skipLangs.has(lang)) totals[lang] = (totals[lang] || 0) + bytes;
  }
}

const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
const shades = ["#ffffff", "#d4d4d4", "#a8a8a8", "#808080", "#5e5e5e", "#444444"];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const W = 350, H = 195, barX = 25, barW = 220;
const rows = top.map(([lang, bytes], i) => {
  const pct = (bytes / sum) * 100;
  const y = 62 + i * 22;
  return `<text x="${barX}" y="${y}" class="t">${esc(lang)}</text>
  <rect x="${barX + 100}" y="${y - 9}" width="${barW - 100}" height="8" rx="2" fill="#1a1a1a"/>
  <rect x="${barX + 100}" y="${y - 9}" width="${Math.max(2, ((barW - 100) * pct) / 100).toFixed(1)}" height="8" rx="2" fill="${shades[i]}"/>
  <text x="${barX + barW + 12}" y="${y}" class="t">${pct.toFixed(1)}%</text>`;
}).join("\n  ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
    .h { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: #ffffff; }
    .t { font: 400 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; fill: #c9d1d9; }
  </style>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="4.5" fill="#000000" stroke="#333333"/>
  <text x="25" y="35" class="h">Most Used Languages</text>
  ${rows}
</svg>
`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/langs.svg", svg);
console.log(top.map(([l, b]) => `${l}: ${((b / sum) * 100).toFixed(1)}%`).join("\n"));
