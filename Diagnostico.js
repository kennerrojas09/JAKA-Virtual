// Uso: node server/diagnostico.js  — muestra quién es quién en la base (sin contraseñas ni hashes).
const { conectarDB } = require("./db");
(async () => {
  const p = await conectarDB(), q = s => p.request().query(s).then(r => r.recordset);
  console.log("\nUSUARIOS");
  console.table(await q("SELECT u.IdUsuario, u.Correo, r.NombreRol AS Rol, u.Estado FROM dbo.Usuarios u JOIN dbo.Roles r ON r.IdRol=u.IdRol ORDER BY r.NombreRol, u.IdUsuario"));
  console.log("CURSOS (IdDocente debe ser el IdUsuario del docente que publica)");
  console.table(await q("SELECT IdCurso, Nombre, IdDocente, Activo FROM dbo.Cursos"));
  console.log("MATRICULAS");
  console.table(await q("SELECT IdCurso, IdEstudiante FROM dbo.Matriculas"));
  process.exit(0);
})().catch(e => { console.error("Error:", e.message); process.exit(1); });