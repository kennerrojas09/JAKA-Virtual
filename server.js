const express = require("express");
const path = require("path");
const { conectarDB, sql } = require("./db");
const { crearHash, verificarHash, crearToken, leerToken } = require("./seguridad");

const app = express();
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const RAIZ = path.join(__dirname, "..");
const ROLES = ["Administrador", "Docente", "Estudiante"];
app.use(express.json({ limit: "12mb" }));

/* ---------- utilidades ---------- */
async function bd(consulta, params = {}) {
  const pool = await conectarDB();
  const req = pool.request();
  for (const [k, [tipo, valor]] of Object.entries(params)) req.input(k, tipo, valor);
  return (await req.query(consulta)).recordset || [];
}
const SEL = `SELECT u.IdUsuario, u.Nombre, u.Apellido, u.Correo, u.ContrasenaHash, u.Estado, r.NombreRol AS Rol
             FROM dbo.Usuarios u INNER JOIN dbo.Roles r ON r.IdRol = u.IdRol`;
const porCorreo = c => bd(SEL + " WHERE LOWER(u.Correo) = @c", { c: [sql.NVarChar(150), c] }).then(r => r[0]);
const porId = i => bd(SEL + " WHERE u.IdUsuario = @i", { i: [sql.Int, i] }).then(r => r[0]);
const txt = (v, n) => String(v ?? "").trim().slice(0, n);
const correoValido = c => c.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
const publico = u => ({ id: u.IdUsuario, nombre: u.Nombre, apellido: u.Apellido, correo: u.Correo, rol: u.Rol, activo: !!u.Estado });
const ruta = f => async (req, res, next) => {
  try { await f(req, res, next); }
  catch (e) { console.error(e.message); res.status(500).json({ mensaje: "Ocurrió un error en el servidor." }); }
};
const leerCookie = req => (req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith("jaka_sesion="))?.slice(12);
const poner = (res, token, max = 8 * 3600) =>
  res.setHeader("Set-Cookie", `jaka_sesion=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${max}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);

// Exige sesión válida y, si se indican, uno de los roles.
const requiere = (...roles) => ruta(async (req, res, next) => {
  const t = leerToken(leerCookie(req));
  const u = t && await porId(t.id);
  if (!u || !u.Estado) return res.status(401).json({ mensaje: "Inicia sesión para continuar." });
  if (roles.length && !roles.includes(u.Rol)) return res.status(403).json({ mensaje: "No tienes permiso para esta acción." });
  req.usuario = u;
  next();
});

const intentos = new Map();
function limitado(req, res) {
  const a = intentos.get(req.ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 10 * 60 * 1000) { a.n = 0; a.t = Date.now(); }
  a.n++; intentos.set(req.ip, a);
  if (a.n > 10) { res.status(429).json({ mensaje: "Demasiados intentos. Espera unos minutos." }); return true; }
  return false;
}

async function crearUsuario(b, rol) {
  const nombre = txt(b.nombre, 80), apellido = txt(b.apellido, 80), correo = txt(b.correo, 150).toLowerCase();
  if (!nombre || !apellido || !correoValido(correo)) return { codigo: 400, mensaje: "Revisa el nombre, el apellido y el correo." };
  if (typeof b.password !== "string" || b.password.length < 8 || b.password.length > 100)
    return { codigo: 400, mensaje: "La contraseña debe tener entre 8 y 100 caracteres." };
  if (!ROLES.includes(rol)) return { codigo: 400, mensaje: "Rol no válido." };
  if (await porCorreo(correo)) return { codigo: 409, mensaje: "Ese correo ya está registrado." };
  await bd(`INSERT dbo.Usuarios(Nombre, Apellido, Correo, ContrasenaHash, IdRol, Estado)
            VALUES(@n, @a, @c, @h, (SELECT IdRol FROM dbo.Roles WHERE NombreRol = @r), 1)`, {
    n: [sql.NVarChar(80), nombre], a: [sql.NVarChar(80), apellido], c: [sql.NVarChar(150), correo],
    h: [sql.NVarChar(300), await crearHash(b.password)], r: [sql.NVarChar(30), rol]
  });
  return { usuario: publico(await porCorreo(correo)) };
}

/* ---------- páginas y estado ---------- */
app.get("/", (req, res) => res.sendFile(path.join(RAIZ, "index.html")));
app.get("/jaka-auth.js", (req, res) => res.sendFile(path.join(RAIZ, "jaka-auth.js")));
app.get("/api/estado", (req, res) => res.json({ proyecto: "JAKA Virtual", servidor: "Funcionando", mensaje: "Nuestro backend esta activo" }));
app.get("/api", (req, res) => res.json({ mensaje: "Bienvenido al backend de JAKA Virtual" }));
app.get("/api/base-datos", ruta(async (req, res) => {
  const [fila] = await bd("SELECT DB_NAME() AS BaseDatos, @@SERVERNAME AS Servidor");
  res.json({ conectado: true, ...fila });
}));

/* ---------- 1) inicio de sesión ---------- */
app.post("/api/auth/login", ruta(async (req, res) => {
  if (limitado(req, res)) return;
  const correo = txt(req.body.correo, 150).toLowerCase(), password = req.body.password;
  if (!correo || typeof password !== "string" || !password)
    return res.status(400).json({ mensaje: "Ingresa tu correo y contraseña." });
  const u = await porCorreo(correo);
  if (!u || !u.Estado || !(await verificarHash(password, u.ContrasenaHash)))
    return res.status(401).json({ mensaje: "Correo o contraseña incorrectos." });
  intentos.delete(req.ip);
  poner(res, crearToken({ id: u.IdUsuario }));
  res.json({ mensaje: "Inicio de sesión correcto.", usuario: publico(u) });
}));
app.post("/api/auth/logout", (req, res) => { poner(res, "", 0); res.json({ mensaje: "Sesión cerrada." }); });
app.get("/api/auth/sesion", requiere(), (req, res) => res.json({ usuario: publico(req.usuario) }));

/* ---------- 2) estudiantes: registro público y consulta ---------- */
app.post("/api/estudiantes/registro", ruta(async (req, res) => {
  if (limitado(req, res)) return;
  const r = await crearUsuario(req.body, "Estudiante");
  if (r.codigo) return res.status(r.codigo).json({ mensaje: r.mensaje });
  poner(res, crearToken(r.usuario));
  res.status(201).json({ mensaje: "Cuenta de estudiante creada.", usuario: r.usuario });
}));
app.get("/api/estudiantes", requiere("Administrador"), ruta(async (req, res) => {
  const filas = await bd(SEL + " WHERE r.NombreRol = N'Estudiante' ORDER BY u.Apellido, u.Nombre");
  res.json({ estudiantes: filas.map(publico) });
}));

/* ---------- 3) panel del administrador ---------- */
app.get("/api/admin/usuarios", requiere("Administrador"), ruta(async (req, res) => {
  res.json({ usuarios: (await bd(SEL + " ORDER BY u.Apellido, u.Nombre")).map(publico) });
}));
app.post("/api/admin/usuarios", requiere("Administrador"), ruta(async (req, res) => {
  const r = await crearUsuario(req.body, req.body.rol);
  if (r.codigo) return res.status(r.codigo).json({ mensaje: r.mensaje });
  res.status(201).json({ mensaje: "Usuario creado.", usuario: r.usuario });
}));
app.patch("/api/admin/usuarios/:id", requiere("Administrador"), ruta(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ mensaje: "Usuario no válido." });
  if (id === Number(req.usuario.IdUsuario)) return res.status(400).json({ mensaje: "No puedes cambiar tu propio rol ni tu estado." });
  if (!(await porId(id))) return res.status(404).json({ mensaje: "Usuario no encontrado." });
  const { rol, activo } = req.body;
  if (rol !== undefined) {
    if (!ROLES.includes(rol)) return res.status(400).json({ mensaje: "Rol no válido." });
    await bd("UPDATE dbo.Usuarios SET IdRol = (SELECT IdRol FROM dbo.Roles WHERE NombreRol = @r) WHERE IdUsuario = @i",
      { r: [sql.NVarChar(30), rol], i: [sql.Int, id] });
  }
  if (typeof activo === "boolean")
    await bd("UPDATE dbo.Usuarios SET Estado = @e WHERE IdUsuario = @i", { e: [sql.Bit, activo], i: [sql.Int, id] });
  res.json({ mensaje: "Usuario actualizado.", usuario: publico(await porId(id)) });
}));

// Apartados del aula: el administrador define orden y visibilidad; docentes y estudiantes ven los visibles.
app.get("/api/apartados", requiere(), ruta(async (req, res) => {
  const filtro = req.usuario.Rol === "Administrador" ? "" : " WHERE Visible = 1";
  const filas = await bd("SELECT Clave, Nombre, Orden, Visible FROM dbo.Apartados" + filtro + " ORDER BY Orden");
  res.json({ apartados: filas.map(a => ({ clave: a.Clave, nombre: a.Nombre, orden: a.Orden, visible: !!a.Visible })) });
}));
app.put("/api/admin/apartados", requiere("Administrador"), ruta(async (req, res) => {
  const lista = req.body.apartados;
  if (!Array.isArray(lista) || !lista.length || lista.length > 30) return res.status(400).json({ mensaje: "Lista no válida." });
  for (const [i, a] of lista.entries())
    await bd("UPDATE dbo.Apartados SET Orden = @o, Visible = @v WHERE Clave = @c",
      { o: [sql.Int, i + 1], v: [sql.Bit, !!a.visible], c: [sql.NVarChar(30), txt(a.clave, 30)] });
  res.json({ mensaje: "Apartados guardados." });
}));

require("./academico")(app, { requiere, ruta, bd, sql, txt });

app.listen(PORT, () => console.log("JAKA Virtual activo en http://localhost:" + PORT));



