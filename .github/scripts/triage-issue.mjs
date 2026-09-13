#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REPO = process.env.GITHUB_REPOSITORY;
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const MODEL = process.env.TRIAGE_MODEL || "opencode/big-pickle";

let GH_TOKEN = null;

const ALLOWED_LABELS = {
  accessibility: { description: "Barrier affecting people with disabilities", color: "f143ab" },
  bug: { description: "Something isn't working", color: "d73a4a" },
  documentation: { description: "Improvements or additions to documentation", color: "0075ca" },
  duplicate: { description: "This issue or pull request already exists", color: "cfd3d7" },
  enhancement: { description: "New feature or request", color: "a2eeef" },
  "good first issue": { description: "Good for newcomers", color: "7057ff" },
  "help wanted": { description: "Extra attention is needed", color: "008672" },
  invalid: { description: "This doesn't seem right", color: "e4e669" },
  question: { description: "Further information is requested", color: "d876e3" },
  wontfix: { description: "This will not be worked on", color: "ffffff" },
};

const TIPO_TITULO = {
  bug: "Bug",
  enhancement: "Mejora",
  question: "Pregunta",
  documentation: "Documentación",
  "help wanted": "Ayuda solicitada",
  "good first issue": "Buen primer issue",
  invalid: "Inválido",
  duplicate: "Duplicado",
  wontfix: "No se hará",
};

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const event = readEvent();
  const issue = event.issue;
  if (!issue) {
    console.log("Evento sin issue, nada que hacer.");
    return;
  }

  const { owner, repo } = parseRepo(REPO);

  GH_TOKEN = await getOpenCodeToken();

  const number = issue.number;
  const title = issue.title || "";
  const body = issue.body || "";
  const author = issue.user?.login || "desconocido";
  const createdAt = issue.created_at || "";

  const git = getRepoState();
  console.log(`Triage del issue #${number} contra ${git.sha}`);

  const ai = await classifyWithAI({ title, body }).catch((err) => {
    console.warn("Clasificación con IA falló, usando keywords:", err.message);
    return null;
  });
  const classification = ai || classifyByKeywords(`${title}\n${body}`);

  const labels = cleanLabels(classification.labels, classification.tipo);
  await ensureLabels(owner, repo, labels);
  await updateIssue(
    owner,
    repo,
    number,
    buildBody({ body, classification, labels, meta: { author, createdAt, git } })
  );

  console.log(`Issue #${number} actualizado. Labels: [${labels.join(", ")}]`);

  await revokeAppToken().catch(() => {});
}

function readEvent() {
  const raw = readFileSync(EVENT_PATH, "utf8");
  return JSON.parse(raw);
}

function parseRepo(repo) {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`GITHUB_REPOSITORY inválido: ${repo}`);
  return { owner, repo: name };
}

function getRepoState() {
  const run = (args) => {
    try {
      return execFileSync("git", args, { encoding: "utf8" }).trim();
    } catch {
      return "—";
    }
  };
  return {
    sha: run(["rev-parse", "--short", "HEAD"]),
    message: run(["log", "-1", "--format=%s"]),
    author: run(["log", "-1", "--format=%an"]),
    date: run(["log", "-1", "--format=%ad", "--date=short"]),
  };
}

async function getOpenCodeToken() {
  const reqUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const reqToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!reqUrl || !reqToken) {
    throw new Error(
      "Faltan ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN. Revisá que el job tenga `permissions: id-token: write`."
    );
  }
  const url = `${reqUrl}${reqUrl.includes("?") ? "&" : "?"}audience=opencode-github-action`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${reqToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo obtener el OIDC token: ${res.status}`);
  const data = await res.json();
  if (!data.value) throw new Error("Respuesta OIDC sin campo 'value'");

  const ex = await fetch("https://api.opencode.ai/exchange_github_app_token", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.value}` },
  });
  if (!ex.ok) throw new Error(`Intercambio del token de la OpenCode App falló: ${ex.status}`);
  const exData = await ex.json();
  if (!exData.token) throw new Error("Respuesta de intercambio sin campo 'token'");
  return exData.token;
}

async function revokeAppToken() {
  if (!GH_TOKEN) return;
  await fetch("https://api.github.com/installation/token", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });
}

async function classifyWithAI({ title, body }) {
  const prompt = `Eres un bot que clasifica issues de un juego Asteroids en HTML5/Canvas (JavaScript puro).
Recibes el título y el contenido de un issue. Responde ÚNICAMENTE con un JSON válido, sin markdown ni texto adicional, con esta forma exacta:
{
  "tipo": "bug" | "enhancement" | "question" | "documentation" | "help wanted" | "good first issue" | "invalid",
  "labels": ["etiquetas permitidas que apliquen"],
  "descripcion": "resumen breve del issue en español",
  "reproducir": "pasos para reproducir en español, o 'No aplica'",
  "esperado": "comportamiento esperado en español, o 'No aplica'",
  "navegador": "navegador y sistema operativo mencionados en el issue, o cadena vacía"
}
Etiquetas permitidas: accessibility, bug, documentation, duplicate, enhancement, good first issue, help wanted, invalid, question, wontfix.
"tipo" es la etiqueta principal; "labels" puede incluir etiquetas adicionales.

Título del issue:
${title}

Cuerpo del issue:
${body}`;

  const out = execFileSync(
    "opencode",
    ["run", `--model=${MODEL}`, "--format=json", prompt],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: 240000 }
  );

  let text = "";
  for (const line of out.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let ev;
    try {
      ev = JSON.parse(t);
    } catch {
      continue;
    }
    if (ev.type === "message" && ev.message && ev.message.role === "assistant") {
      const content = ev.message.content;
      if (typeof content === "string") text += content + "\n";
      else if (Array.isArray(content)) {
        for (const part of content) {
          if (part && part.type === "text") text += part.text + "\n";
        }
      }
    }
  }

  const parsed = extractJSON(text.trim());
  if (!parsed || typeof parsed !== "object" || !parsed.tipo) {
    throw new Error("Respuesta de IA sin JSON válido");
  }
  return {
    tipo: String(parsed.tipo).toLowerCase(),
    labels: Array.isArray(parsed.labels) ? parsed.labels.map((l) => String(l).toLowerCase()) : [],
    descripcion: String(parsed.descripcion || ""),
    reproducir: String(parsed.reproducir || ""),
    esperado: String(parsed.esperado || ""),
    navegador: String(parsed.navegador || ""),
  };
}

function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No se encontró JSON en la respuesta");
  return JSON.parse(candidate.slice(start, end + 1));
}

function classifyByKeywords(text) {
  const t = text.toLowerCase();
  let tipo = "enhancement";
  if (/(se rompe|no funciona|error|excepci|falla|fallo|crash|bug|tira error|pantalla negra)/.test(t)) {
    tipo = "bug";
  } else if (/\?/.test(text) || /pregunta|como hago|como se|se puede/.test(t)) {
    tipo = "question";
  } else if (/document|readme|\.md/.test(t)) {
    tipo = "documentation";
  }
  return { tipo, labels: [tipo], descripcion: "", reproducir: "", esperado: "", navegador: "" };
}

function cleanLabels(labels, tipo) {
  const clean = new Set(
    labels
      .filter((l) => Object.prototype.hasOwnProperty.call(ALLOWED_LABELS, l))
      .filter((l) => l !== "wontfix" && l !== "duplicate" && l !== "invalid")
  );
  if (Object.prototype.hasOwnProperty.call(ALLOWED_LABELS, tipo)) clean.add(tipo);
  return [...clean].slice(0, 4);
}

function buildBody({ body, classification, labels, meta }) {
  const { tipo, descripcion, reproducir, esperado, navegador } = classification;
  const tituloTipo = TIPO_TITULO[tipo] || "—";
  const original = body.trim() || "*El autor no escribió contenido.*";
  const { author, createdAt, git } = meta;
  return [
    `> *Issue formateado automáticamente por el bot de triage. El contenido original está intacto en el bloque al final.*`,
    ``,
    `## Tipo`,
    `- **${tituloTipo}** (${tipo})`,
    labels.length ? `- **Labels:** ${labels.map((l) => `\`${l}\``).join(", ")}` : "",
    ``,
    `## Descripción`,
    descripcion.trim() || "—",
    ``,
    `## Cómo reproducir`,
    reproducir.trim() || "—",
    ``,
    `## Comportamiento esperado`,
    esperado.trim() || "—",
    ``,
    `<details>`,
    `<summary>Contenido original del reporte (tal cual lo escribió el autor)</summary>`,
    ``,
    original,
    ``,
    `</details>`,
    ``,
    `## Información de revisión`,
    ``,
    `- **Autor:** @${author}`,
    `- **Fecha de creación:** ${createdAt}`,
    `- **Último commit del repo al reportarse:** \`${git.sha}\` — "${git.message}" (_${git.author}, ${git.date}_)`,
    `- **Navegador/SO reportado:** ${navegador.trim() || "—"}`,
    ``,
    `### Checklist de revisión`,
    `- [ ] Reproducir el problema`,
    `- [ ] Confirmar la causa raíz`,
    `- [ ] Aplicar la corrección / mejora`,
    `- [ ] Verificar en navegador (abrir \`index.html\` o \`npx serve .\`)`,
  ].join("\n");
}

async function ensureLabels(owner, repo, labels) {
  for (const name of labels) {
    const meta = ALLOWED_LABELS[name];
    if (!meta) continue;
    const res = await api(`/repos/${owner}/${repo}/labels`, {
      method: "POST",
      body: JSON.stringify({ name, description: meta.description, color: meta.color }),
    });
    if (res.status === 422) {
      console.log(`Label "${name}" ya existía.`);
    } else if (res.status === 403) {
      console.warn(
        `El token de la app no puede crear label "${name}", se continúa si ya existe (403).`
      );
    } else if (!res.ok) {
      throw new Error(`No se pudo crear label "${name}": ${res.status}`);
    } else {
      console.log(`Label "${name}" creado.`);
    }
  }
}

async function updateIssue(owner, repo, number, body) {
  const res = await api(`/repos/${owner}/${repo}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`No se pudo actualizar el issue: ${res.status} ${await res.text()}`);
}

async function api(path, opts = {}) {
  if (!GH_TOKEN) throw new Error("Token de GitHub no disponible");
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "opencode-asteroids-triage",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

export { buildBody, cleanLabels, classifyByKeywords, extractJSON, getOpenCodeToken, getRepoState };