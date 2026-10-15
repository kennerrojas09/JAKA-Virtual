// server/academico.js — cursos, matrículas, tareas, entregas, calificaciones, materiales, avisos y archivos.
// Se conecta desde server.js con: require("./academico")(app, { requiere, ruta, bd, sql, txt });
const path = require("path");
const EXT = ["pdf", "doc", "docx", "txt", "ppt", "pptx", "xls", "xlsx", "zip", "png", "jpg", "jpeg"];
const MAX = 8 * 1024 * 1024;

module.exports = function (app, { requiere, ruta, bd, sql, txt }) {
  console.log("Módulo académico cargado (v3: permisos de docente por SQL)");
  const I = v => [sql.Int, v];
  const pub = (m, codigo) => Object.assign(new Error(m), { publico: true, codigo });
  const NO = () => pub("No tienes acceso a este recurso.", 403);
  const R = f => ruta(async (q, r, n) => {                 // errores de validación -> mensaje claro al usuario
    try { await f(q, r, n); } catch (e) { if (e.publico) return r.status(e.codigo || 400).json({ mensaje: e.message }); throw e; }
  });
  const id = q => { const n = Number(q.params.id); if (!Number.isInteger(n)) throw pub("Identificador no válido."); return n; };
  const ambito = u => u.Rol === "Administrador" ? "1=1" : u.Rol === "Docente" ? "c.IdDocente=@u"
    : "EXISTS(SELECT 1 FROM dbo.Matriculas m WHERE m.IdCurso=c.IdCurso AND m.IdEstudiante=@u)";
  const ahora = () => [sql.DateTime2, new Date()];
  const yo = q => ({ u: I(q.usuario.IdUsuario) });

  async function acceso(u, idCurso) {                      // quién es el usuario respecto a ese curso
    const c = (await bd("SELECT * FROM dbo.Cursos WHERE IdCurso=@i", { i: I(idCurso) }))[0];
    if (!c) throw pub("El curso no existe.", 404);
    if (u.Rol === "Administrador") return { c, rel: "admin" };
    if (u.Rol === "Docente" && (await bd("SELECT 1 x FROM dbo.Cursos WHERE IdCurso=@c AND IdDocente=@u", { c: I(idCurso), u: I(u.IdUsuario) })).length) return { c, rel: "docente" };
    if (u.Rol === "Estudiante" && (await bd("SELECT 1 x FROM dbo.Matriculas WHERE IdCurso=@c AND IdEstudiante=@u", { c: I(idCurso), u: I(u.IdUsuario) })).length)
      return { c, rel: "estudiante" };
    console.log("[acceso denegado]", u.Rol, "usuario", u.IdUsuario, typeof u.IdUsuario, "| curso", c.IdCurso, "docente", c.IdDocente, typeof c.IdDocente);
    throw NO();
  }
  async function tareaAcc(q, idTarea, ...rels) {
    const t = (await bd("SELECT * FROM dbo.Tareas WHERE IdTarea=@i", { i: I(idTarea) }))[0];
    if (!t) throw pub("La tarea no existe.", 404);
    const a = await acceso(q.usuario, t.IdCurso);
    if (rels.length && !rels.includes(a.rel)) throw NO();
    return { t, ...a };
  }
  async function guardarArchivo(a, idUsuario) {            // el archivo se guarda en SQL Server (persistente y con permisos)
    if (!a) return null;
    const nombre = txt(a.nombre, 200).replace(/[\\/:*?"<>|]/g, "_");
    if (!EXT.includes(nombre.split(".").pop().toLowerCase())) throw pub("Formato no permitido. Usa: " + EXT.join(", ") + ".");
    const buf = Buffer.from(String(a.datos || ""), "base64");
    if (!buf.length || buf.length > MAX) throw pub("El archivo está vacío o supera 8 MB.");
    const r = await bd("INSERT dbo.Archivos(Nombre, Tamano, Contenido, IdUsuario, Fecha) OUTPUT INSERTED.IdArchivo VALUES(@n,@t,@c,@u,@now)",
      { now: ahora(), n: [sql.NVarChar(200), nombre], t: I(buf.length), c: [sql.VarBinary(sql.MAX), buf], u: I(idUsuario) });
    return r[0].IdArchivo;
  }
  async function datosCurso(b) {
    const nombre = txt(b.nombre, 120);
    if (!nombre) throw pub("El nombre del curso es obligatorio.");
    let doc = null;
    if (b.idDocente) {
      doc = Number(b.idDocente);
      if (!(await bd("SELECT 1 x FROM dbo.Usuarios u JOIN dbo.Roles r ON r.IdRol=u.IdRol WHERE u.IdUsuario=@i AND r.NombreRol=N'Docente'", { i: I(doc) })).length)
        throw pub("El docente seleccionado no existe.");
    }
    return { codigo: txt(b.codigo, 20), nombre, descripcion: txt(b.descripcion, 500), horario: txt(b.horario, 120), aula: txt(b.aula, 60), doc };
  }
  const pc = d => ({ cod: [sql.NVarChar(20), d.codigo], n: [sql.NVarChar(120), d.nombre], d: [sql.NVarChar(500), d.descripcion],
    doc: [sql.Int, d.doc], h: [sql.NVarChar(120), d.horario], a: [sql.NVarChar(60), d.aula] });

  app.get("/jaka-aula.js", (q, r) => r.sendFile(path.join(__dirname, "..", "jaka-aula.js")));

  /* ---------- administrador: cursos y matrículas ---------- */
  app.get("/api/admin/personas", requiere("Administrador"), R(async (q, r) => {
    const f = await bd(`SELECT u.IdUsuario id, u.Nombre nombre, u.Apellido apellido, u.Correo correo, ro.NombreRol rol FROM dbo.Usuarios u
      JOIN dbo.Roles ro ON ro.IdRol=u.IdRol WHERE u.Estado=1 AND ro.NombreRol IN (N'Docente', N'Estudiante') ORDER BY u.Apellido, u.Nombre`);
    r.json({ docentes: f.filter(x => x.rol === "Docente"), estudiantes: f.filter(x => x.rol === "Estudiante") });
  }));
  app.post("/api/admin/cursos", requiere("Administrador"), R(async (q, r) => {
    const d = await datosCurso(q.body);
    const f = await bd("INSERT dbo.Cursos(Codigo,Nombre,Descripcion,IdDocente,Horario,Aula) OUTPUT INSERTED.IdCurso VALUES(@cod,@n,@d,@doc,@h,@a)", pc(d));
    r.status(201).json({ mensaje: "Curso creado.", id: f[0].IdCurso });
  }));
  app.patch("/api/admin/cursos/:id", requiere("Administrador"), R(async (q, r) => {
    await acceso(q.usuario, id(q));
    if (typeof q.body.activo === "boolean" && Object.keys(q.body).length === 1)
      await bd("UPDATE dbo.Cursos SET Activo=@v WHERE IdCurso=@i", { v: [sql.Bit, q.body.activo], i: I(id(q)) });
    else await bd("UPDATE dbo.Cursos SET Codigo=@cod,Nombre=@n,Descripcion=@d,IdDocente=@doc,Horario=@h,Aula=@a WHERE IdCurso=@i", { ...pc(await datosCurso(q.body)), i: I(id(q)) });
    r.json({ mensaje: "Curso actualizado." });
  }));
  app.post("/api/admin/cursos/:id/matriculas", requiere("Administrador"), R(async (q, r) => {
    await acceso(q.usuario, id(q));
    const e = Number(q.body.idEstudiante);
    if (!(await bd("SELECT 1 x FROM dbo.Usuarios u JOIN dbo.Roles r ON r.IdRol=u.IdRol WHERE u.IdUsuario=@i AND r.NombreRol=N'Estudiante' AND u.Estado=1", { i: I(e) })).length)
      throw pub("Selecciona un estudiante válido.");
    if ((await bd("SELECT 1 x FROM dbo.Matriculas WHERE IdCurso=@c AND IdEstudiante=@e", { c: I(id(q)), e: I(e) })).length) throw pub("Ese estudiante ya está matriculado.", 409);
    await bd("INSERT dbo.Matriculas(IdCurso, IdEstudiante) VALUES(@c,@e)", { c: I(id(q)), e: I(e) });
    r.status(201).json({ mensaje: "Estudiante matriculado." });
  }));
  app.delete("/api/admin/cursos/:id/matriculas/:est", requiere("Administrador"), R(async (q, r) => {
    await bd("DELETE FROM dbo.Matriculas WHERE IdCurso=@c AND IdEstudiante=@e", { c: I(id(q)), e: I(Number(q.params.est)) });
    r.json({ mensaje: "Matrícula eliminada." });
  }));

  /* ---------- cursos (cada rol ve solo los suyos) ---------- */
  app.get("/api/cursos", requiere(), R(async (q, r) => {
    r.json({ cursos: await bd(`SELECT c.IdCurso id, c.Codigo codigo, c.Nombre nombre, c.Descripcion descripcion, c.Horario horario, c.Aula aula, c.Activo activo,
      c.IdDocente idDocente, d.Nombre + N' ' + d.Apellido docente, (SELECT COUNT(*) FROM dbo.Matriculas m WHERE m.IdCurso=c.IdCurso) alumnos
      FROM dbo.Cursos c LEFT JOIN dbo.Usuarios d ON d.IdUsuario=c.IdDocente WHERE ${ambito(q.usuario)} ORDER BY c.Nombre`, yo(q)) });
  }));
  app.get("/api/cursos/:id", requiere(), R(async (q, r) => {
    const { c, rel } = await acceso(q.usuario, id(q));
    const doc = c.IdDocente ? (await bd("SELECT Nombre + N' ' + Apellido n FROM dbo.Usuarios WHERE IdUsuario=@i", { i: I(c.IdDocente) }))[0] : null;
    const alumnos = rel === "estudiante" ? [] : await bd(`SELECT u.IdUsuario id, u.Nombre nombre, u.Apellido apellido, u.Correo correo FROM dbo.Matriculas m
      JOIN dbo.Usuarios u ON u.IdUsuario=m.IdEstudiante WHERE m.IdCurso=@c ORDER BY u.Apellido, u.Nombre`, { c: I(c.IdCurso) });
    r.json({ rel, alumnos, curso: { id: c.IdCurso, codigo: c.Codigo, nombre: c.Nombre, descripcion: c.Descripcion, horario: c.Horario, aula: c.Aula,
      activo: !!c.Activo, idDocente: c.IdDocente, docente: doc && doc.n } });
  }));

  /* ---------- tareas y entregas ---------- */
  app.get("/api/cursos/:id/tareas", requiere(), R(async (q, r) => {
    await acceso(q.usuario, id(q));
    r.json({ tareas: await bd(`SELECT t.IdTarea id, t.Titulo titulo, t.Descripcion descripcion, t.FechaPublicacion publicada, t.FechaLimite limite, t.Cerrada cerrada,
      t.IdArchivo archivoId, a.Nombre archivoNombre, (SELECT COUNT(*) FROM dbo.Entregas x WHERE x.IdTarea=t.IdTarea) entregas,
      e.IdEntrega miId, e.FechaEntrega miFecha, e.Calificacion miNota, e.Observacion miObs
      FROM dbo.Tareas t LEFT JOIN dbo.Archivos a ON a.IdArchivo=t.IdArchivo LEFT JOIN dbo.Entregas e ON e.IdTarea=t.IdTarea AND e.IdEstudiante=@u
      WHERE t.IdCurso=@c ORDER BY t.FechaLimite`, { ...yo(q), c: I(id(q)) }) });
  }));
  app.post("/api/cursos/:id/tareas", requiere("Docente"), R(async (q, r) => {
    const { rel } = await acceso(q.usuario, id(q));
    if (rel !== "docente") throw NO();
    const titulo = txt(q.body.titulo, 150), lim = new Date(q.body.fechaLimite);
    if (!titulo || isNaN(lim)) throw pub("Escribe el título y una fecha límite válida.");
    const arch = await guardarArchivo(q.body.archivo, q.usuario.IdUsuario);
    await bd("INSERT dbo.Tareas(IdCurso,Titulo,Descripcion,FechaLimite,IdArchivo,FechaPublicacion) VALUES(@c,@t,@d,@l,@a,@now)",
      { now: ahora(), c: I(id(q)), t: [sql.NVarChar(150), titulo], d: [sql.NVarChar(2000), txt(q.body.descripcion, 2000)], l: [sql.DateTime2, lim], a: [sql.Int, arch] });
    r.status(201).json({ mensaje: "Tarea publicada." });
  }));
  app.get("/api/tareas/:id", requiere(), R(async (q, r) => {
    const { t, c, rel } = await tareaAcc(q, id(q));
    const ar = t.IdArchivo ? (await bd("SELECT Nombre FROM dbo.Archivos WHERE IdArchivo=@i", { i: I(t.IdArchivo) }))[0] : null;
    const entrega = rel !== "estudiante" ? null : (await bd(`SELECT e.IdEntrega id, e.FechaEntrega fecha, e.Comentario comentario, e.Calificacion nota, e.Observacion obs,
      e.IdArchivo archivoId, a.Nombre archivoNombre FROM dbo.Entregas e LEFT JOIN dbo.Archivos a ON a.IdArchivo=e.IdArchivo
      WHERE e.IdTarea=@t AND e.IdEstudiante=@u`, { t: I(t.IdTarea), ...yo(q) }))[0] || null;
    r.json({ entrega, tarea: { id: t.IdTarea, cursoId: c.IdCurso, curso: c.Nombre, titulo: t.Titulo, descripcion: t.Descripcion, publicada: t.FechaPublicacion,
      limite: t.FechaLimite, cerrada: !!t.Cerrada, archivoId: t.IdArchivo, archivoNombre: ar && ar.Nombre } });
  }));
  app.patch("/api/tareas/:id/cerrar", requiere("Docente"), R(async (q, r) => {
    await tareaAcc(q, id(q), "docente");
    await bd("UPDATE dbo.Tareas SET Cerrada = CASE WHEN Cerrada=1 THEN 0 ELSE 1 END WHERE IdTarea=@i", { i: I(id(q)) });
    r.json({ mensaje: "Estado de la tarea actualizado." });
  }));
  app.get("/api/tareas/:id/entregas", requiere("Docente"), R(async (q, r) => {
    const { t } = await tareaAcc(q, id(q), "docente");
    r.json({ entregas: await bd(`SELECT u.IdUsuario idEst, u.Nombre nombre, u.Apellido apellido, e.IdEntrega id, e.FechaEntrega fecha, e.Comentario comentario,
      e.Calificacion nota, e.Observacion obs, e.IdArchivo archivoId, a.Nombre archivoNombre FROM dbo.Matriculas m JOIN dbo.Usuarios u ON u.IdUsuario=m.IdEstudiante
      LEFT JOIN dbo.Entregas e ON e.IdTarea=@t AND e.IdEstudiante=u.IdUsuario LEFT JOIN dbo.Archivos a ON a.IdArchivo=e.IdArchivo
      WHERE m.IdCurso=@c ORDER BY u.Apellido, u.Nombre`, { t: I(t.IdTarea), c: I(t.IdCurso) }) });
  }));
  app.post("/api/tareas/:id/entrega", requiere("Estudiante"), R(async (q, r) => {
    const { t } = await tareaAcc(q, id(q), "estudiante");
    if (t.Cerrada) throw pub("La tarea está cerrada.");
    const prev = (await bd("SELECT IdEntrega, IdArchivo, Calificacion FROM dbo.Entregas WHERE IdTarea=@t AND IdEstudiante=@u", { t: I(t.IdTarea), ...yo(q) }))[0];
    if (prev && prev.Calificacion !== null) throw pub("Tu entrega ya fue calificada y no puede modificarse.");
    if (!q.body.archivo) throw pub("Adjunta el archivo de tu entrega.");
    const f = await guardarArchivo(q.body.archivo, q.usuario.IdUsuario), com = [sql.NVarChar(500), txt(q.body.comentario, 500)];
    if (prev) {
      await bd("UPDATE dbo.Entregas SET IdArchivo=@f, Comentario=@c, FechaEntrega=@now WHERE IdEntrega=@i", { now: ahora(), f: I(f), c: com, i: I(prev.IdEntrega) });
      if (prev.IdArchivo) await bd("DELETE FROM dbo.Archivos WHERE IdArchivo=@f", { f: I(prev.IdArchivo) });
    } else await bd("INSERT dbo.Entregas(IdTarea, IdEstudiante, IdArchivo, Comentario, FechaEntrega) VALUES(@t,@u,@f,@c,@now)", { now: ahora(), t: I(t.IdTarea), ...yo(q), f: I(f), c: com });
    r.json({ mensaje: prev ? "Entrega actualizada." : "Entrega enviada." });
  }));
  app.put("/api/entregas/:id/calificacion", requiere("Docente"), R(async (q, r) => {
    const e = (await bd("SELECT e.IdEntrega, t.IdCurso FROM dbo.Entregas e JOIN dbo.Tareas t ON t.IdTarea=e.IdTarea WHERE e.IdEntrega=@i", { i: I(id(q)) }))[0];
    if (!e) throw pub("La entrega no existe.", 404);
    if ((await acceso(q.usuario, e.IdCurso)).rel !== "docente") throw NO();
    const nota = Number(q.body.nota);
    if (q.body.nota === "" || q.body.nota == null || !(nota >= 0 && nota <= 100)) throw pub("La nota debe estar entre 0 y 100.");
    await bd("UPDATE dbo.Entregas SET Calificacion=@n, Observacion=@o, FechaCalificacion=@now WHERE IdEntrega=@i",
      { now: ahora(), n: [sql.Decimal(5, 2), nota], o: [sql.NVarChar(500), txt(q.body.observacion, 500)], i: I(e.IdEntrega) });
    r.json({ mensaje: "Calificación guardada." });
  }));

  /* ---------- calificaciones, agenda, avisos, materiales ---------- */
  app.get("/api/mis-calificaciones", requiere("Estudiante"), R(async (q, r) => {
    r.json({ calificaciones: await bd(`SELECT c.IdCurso cursoId, c.Nombre curso, t.Titulo tarea, t.FechaLimite limite, e.Calificacion nota, e.Observacion obs, e.FechaCalificacion fecha
      FROM dbo.Entregas e JOIN dbo.Tareas t ON t.IdTarea=e.IdTarea JOIN dbo.Cursos c ON c.IdCurso=t.IdCurso
      WHERE e.IdEstudiante=@u AND e.Calificacion IS NOT NULL ORDER BY c.Nombre, t.FechaLimite`, yo(q)) });
  }));
  app.get("/api/calificaciones", requiere("Docente"), R(async (q, r) => {
    const w = "WHERE c.IdDocente=@u";
    const [cursos, tareas, alumnos, entregas] = await Promise.all([
      bd(`SELECT c.IdCurso id, c.Nombre nombre FROM dbo.Cursos c ${w} ORDER BY c.Nombre`, yo(q)),
      bd(`SELECT t.IdTarea id, t.IdCurso cursoId, t.Titulo titulo FROM dbo.Tareas t JOIN dbo.Cursos c ON c.IdCurso=t.IdCurso ${w} ORDER BY t.FechaLimite`, yo(q)),
      bd(`SELECT m.IdCurso cursoId, u.IdUsuario id, u.Nombre nombre, u.Apellido apellido FROM dbo.Matriculas m JOIN dbo.Cursos c ON c.IdCurso=m.IdCurso
          JOIN dbo.Usuarios u ON u.IdUsuario=m.IdEstudiante ${w} ORDER BY u.Apellido, u.Nombre`, yo(q)),
      bd(`SELECT e.IdTarea idTarea, e.IdEstudiante idEst, e.Calificacion nota FROM dbo.Entregas e JOIN dbo.Tareas t ON t.IdTarea=e.IdTarea
          JOIN dbo.Cursos c ON c.IdCurso=t.IdCurso ${w}`, yo(q))]);
    r.json({ cursos, tareas, alumnos, entregas });
  }));
  app.get("/api/mis-alumnos", requiere("Docente"), R(async (q, r) => {
    r.json({ alumnos: await bd(`SELECT u.IdUsuario id, u.Nombre nombre, u.Apellido apellido, u.Correo correo, c.Nombre curso FROM dbo.Matriculas m
      JOIN dbo.Cursos c ON c.IdCurso=m.IdCurso JOIN dbo.Usuarios u ON u.IdUsuario=m.IdEstudiante WHERE c.IdDocente=@u ORDER BY u.Apellido, u.Nombre, c.Nombre`, yo(q)) });
  }));
  app.get("/api/agenda", requiere(), R(async (q, r) => {
    r.json({ agenda: await bd(`SELECT t.IdTarea id, t.Titulo titulo, t.FechaLimite limite, t.Cerrada cerrada, c.IdCurso cursoId, c.Nombre curso,
      (SELECT COUNT(*) FROM dbo.Entregas x WHERE x.IdTarea=t.IdTarea) entregas, e.IdEntrega miId, e.Calificacion miNota
      FROM dbo.Tareas t JOIN dbo.Cursos c ON c.IdCurso=t.IdCurso LEFT JOIN dbo.Entregas e ON e.IdTarea=t.IdTarea AND e.IdEstudiante=@u
      WHERE ${ambito(q.usuario)} ORDER BY t.FechaLimite`, yo(q)) });
  }));
  const filtroCurso = q => ({ ...yo(q), cur: I(Number(q.query.curso) || 0) });
  app.get("/api/avisos", requiere(), R(async (q, r) => {
    r.json({ avisos: await bd(`SELECT v.IdAviso id, v.Titulo titulo, v.Texto texto, v.Fecha fecha, c.IdCurso cursoId, c.Nombre curso, a.Nombre + N' ' + a.Apellido autor
      FROM dbo.Avisos v JOIN dbo.Cursos c ON c.IdCurso=v.IdCurso JOIN dbo.Usuarios a ON a.IdUsuario=v.IdAutor
      WHERE ${ambito(q.usuario)} AND (@cur=0 OR c.IdCurso=@cur) ORDER BY v.Fecha DESC`, filtroCurso(q)) });
  }));
  app.post("/api/cursos/:id/avisos", requiere("Docente"), R(async (q, r) => {
    if ((await acceso(q.usuario, id(q))).rel !== "docente") throw NO();
    const titulo = txt(q.body.titulo, 150);
    if (!titulo) throw pub("Escribe el título del aviso.");
    await bd("INSERT dbo.Avisos(IdCurso, Titulo, Texto, IdAutor, Fecha) VALUES(@c,@t,@x,@u,@now)",
      { now: ahora(), c: I(id(q)), t: [sql.NVarChar(150), titulo], x: [sql.NVarChar(1000), txt(q.body.texto, 1000)], ...yo(q) });
    r.status(201).json({ mensaje: "Aviso publicado." });
  }));
  app.get("/api/materiales", requiere(), R(async (q, r) => {
    r.json({ materiales: await bd(`SELECT x.IdMaterial id, x.Titulo titulo, x.Fecha fecha, x.IdArchivo archivoId, ar.Nombre archivoNombre, c.Nombre curso
      FROM dbo.Materiales x JOIN dbo.Cursos c ON c.IdCurso=x.IdCurso JOIN dbo.Archivos ar ON ar.IdArchivo=x.IdArchivo
      WHERE ${ambito(q.usuario)} AND (@cur=0 OR c.IdCurso=@cur) ORDER BY x.Fecha DESC`, filtroCurso(q)) });
  }));
  app.post("/api/cursos/:id/materiales", requiere("Docente"), R(async (q, r) => {
    if ((await acceso(q.usuario, id(q))).rel !== "docente") throw NO();
    const titulo = txt(q.body.titulo, 150);
    if (!titulo || !q.body.archivo) throw pub("Escribe un título y adjunta el archivo.");
    const f = await guardarArchivo(q.body.archivo, q.usuario.IdUsuario);
    await bd("INSERT dbo.Materiales(IdCurso, Titulo, IdArchivo, Fecha) VALUES(@c,@t,@f,@now)", { now: ahora(), c: I(id(q)), t: [sql.NVarChar(150), titulo], f: I(f) });
    r.status(201).json({ mensaje: "Material publicado." });
  }));

  /* ---------- descarga de archivos (solo quien tiene permiso) ---------- */
  const COMPARTE = "(c.IdDocente=@u OR EXISTS(SELECT 1 FROM dbo.Matriculas m WHERE m.IdCurso=c.IdCurso AND m.IdEstudiante=@u))";
  app.get("/api/archivos/:id", requiere(), R(async (q, r) => {
    const f = (await bd(`SELECT a.Nombre, a.Contenido FROM dbo.Archivos a WHERE a.IdArchivo=@f AND (a.IdUsuario=@u OR @adm=1
      OR EXISTS(SELECT 1 FROM dbo.Tareas t JOIN dbo.Cursos c ON c.IdCurso=t.IdCurso WHERE t.IdArchivo=a.IdArchivo AND ${COMPARTE})
      OR EXISTS(SELECT 1 FROM dbo.Materiales x JOIN dbo.Cursos c ON c.IdCurso=x.IdCurso WHERE x.IdArchivo=a.IdArchivo AND ${COMPARTE})
      OR EXISTS(SELECT 1 FROM dbo.Entregas e JOIN dbo.Tareas t ON t.IdTarea=e.IdTarea JOIN dbo.Cursos c ON c.IdCurso=t.IdCurso WHERE e.IdArchivo=a.IdArchivo AND c.IdDocente=@u))`,
      { f: I(id(q)), ...yo(q), adm: I(q.usuario.Rol === "Administrador" ? 1 : 0) }))[0];
    if (!f) throw pub("Archivo no disponible.", 404);
    r.setHeader("X-Content-Type-Options", "nosniff");
    r.setHeader("Content-Type", "application/octet-stream");
    r.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodeURIComponent(f.Nombre));
    r.send(f.Contenido);
  }));
};