// Uso: node server/instalar-academico.js
// Conecta el módulo académico a server.js e index.html con cambios mínimos y hace copia de respaldo.
const fs = require("fs"), path = require("path");
const sv = path.join(__dirname, "server.js"), ix = path.join(__dirname, "..", "index.html");
const log = [], aviso = [];
let s = fs.readFileSync(sv, "utf8"), h = fs.readFileSync(ix, "utf8");
const resp = (f, copia) => { if (!fs.existsSync(copia)) fs.copyFileSync(f, copia); };
resp(sv, path.join(__dirname, "server.antes-academico.js")); resp(ix, path.join(__dirname, "..", "index.antes-academico.html"));

for (const id of ["requiere", "ruta", "bd", "sql", "txt"])
  if (!new RegExp("(const|function|async function)\\s+" + id + "\\b|\\{\\s*conectarDB,\\s*sql\\s*\\}").test(s) && id !== "sql") aviso.push("No encontré '" + id + "' en server.js (¿lo cambiaste?).");

if (!s.includes('require("./academico")')) {
  if (s.includes("app.listen(")) { s = s.replace("app.listen(", 'require("./academico")(app, { requiere, ruta, bd, sql, txt });\n\napp.listen('); log.push("Módulo académico conectado en server.js"); }
  else aviso.push('No encontré app.listen en server.js. Añade antes: require("./academico")(app, { requiere, ruta, bd, sql, txt });');
}
if (s.includes('limit: "20kb"')) { s = s.replace('limit: "20kb"', 'limit: "12mb"'); log.push("Límite de cuerpo JSON subido a 12 MB (para recibir archivos)"); }
const e0 = 'app.get("/api/estudiantes", requiere("Administrador", "Docente"),';
if (s.includes(e0)) { s = s.replace(e0, 'app.get("/api/estudiantes", requiere("Administrador"),'); log.push("/api/estudiantes: ahora solo el administrador ve todos los alumnos (el docente ve los suyos)"); }
if (!s.includes('NODE_ENV === "production"')) {
  s = s.replace("Max-Age=${max}`", 'Max-Age=${max}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`');
  s = s.replace("const app = express();", 'const app = express();\nif (process.env.NODE_ENV === "production") app.set("trust proxy", 1);');
  log.push("Cookie Secure y trust proxy activos solo en producción");
}
fs.writeFileSync(sv, s);

if (!h.includes("jaka-aula.js")) {
  const i = h.lastIndexOf("</body>");
  if (i < 0) aviso.push("No encontré </body> en index.html."); else { h = h.slice(0, i) + '<script src="/jaka-aula.js"></script>' + h.slice(i); fs.writeFileSync(ix, h); log.push("index.html: añadido <script src=\"/jaka-aula.js\"></script>"); }
}
console.log(log.map(x => "OK  " + x).concat(aviso.map(x => "!!  " + x)).join("\n") || "Nada que cambiar: ya estaba instalado.");
