---
description: Crea un git worktree local en .worktrees/<nombre> a partir de un argumento.
---

Crea un worktree de git localmente.

Argumento del usuario: "$ARGUMENTS"

Deriva de ese argumento un nombre corto y descriptivo para el worktree:

- Analiza el contexto del argumento; si está en español, traduce la idea al inglés.
- Formato kebab-case: minúsculas y guiones ("-"), sin espacios (ej. "agregar sonido" -> "add-sound").
- Solo caracteres [a-z0-9-]. Sustituye por un guion los espacios y cualquier otro caracter (mayúsculas, puntuación, "/", "\", ".."). El nombre no debe permitir rutas ni paréntesis de directorio.
- El nombre sale del argumento proporcionado, no de tu inventiva.
- si los argumentos son muy largos, simplificalos a un nombre significativo.

Luego ejecuta ÚNICAMENTE esta orden, sin cambiar de directorio:

git worktree add .worktrees/<nombre>

Mientras trabajas:

- No cambies de directorio (cd).
- No ejecutes ninguna otra orden de git (commit, checkout, branch, switch, pull, push, etc.).
- No modifiques, crees ni borres archivos.
- No hagas nada más.

Al terminar, reporta solo la salida de la orden y el nombre del worktree creado.
