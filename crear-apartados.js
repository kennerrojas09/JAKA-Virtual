// Uso: node server/crear-apartados.js  (crea la tabla de apartados del aula si no existe)
const { conectarDB } = require("./db");

(async () => {
  const pool = await conectarDB();
  await pool.request().query(`
    IF OBJECT_ID('dbo.Apartados') IS NULL
      CREATE TABLE dbo.Apartados(IdApartado INT IDENTITY PRIMARY KEY, Clave NVARCHAR(30) NOT NULL UNIQUE,
        Nombre NVARCHAR(60) NOT NULL, Orden INT NOT NULL, Visible BIT NOT NULL DEFAULT 1);`);
  await pool.request().query(`
    INSERT dbo.Apartados(Clave, Nombre, Orden) SELECT c, n, o FROM (VALUES
      (N'cursos',N'Cursos',1),(N'tareas',N'Tareas',2),(N'examenes',N'Exámenes',3),(N'calificaciones',N'Calificaciones',4),
      (N'materiales',N'Materiales',5),(N'calendario',N'Calendario',6),(N'avisos',N'Avisos',7)) t(c, n, o)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Apartados a WHERE a.Clave = t.c);`);
  const r = await pool.request().query("SELECT Orden, Clave, Nombre FROM dbo.Apartados ORDER BY Orden");
  console.table(r.recordset);
  process.exit(0);
})().catch(e => { console.error("Error:", e.message); process.exit(1); });