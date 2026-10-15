// Uso: node server/crear-tablas.js   (crea las tablas académicas que falten; no toca Usuarios, Roles ni Apartados)
const { conectarDB } = require("./db");

const pasos = [
`IF OBJECT_ID('dbo.Cursos') IS NULL CREATE TABLE dbo.Cursos(IdCurso INT IDENTITY PRIMARY KEY, Codigo NVARCHAR(20) NOT NULL DEFAULT N'',
  Nombre NVARCHAR(120) NOT NULL, Descripcion NVARCHAR(500) NOT NULL DEFAULT N'', IdDocente INT NULL REFERENCES dbo.Usuarios(IdUsuario),
  Horario NVARCHAR(120) NOT NULL DEFAULT N'', Aula NVARCHAR(60) NOT NULL DEFAULT N'', Activo BIT NOT NULL DEFAULT 1)`,
`IF OBJECT_ID('dbo.Matriculas') IS NULL CREATE TABLE dbo.Matriculas(IdMatricula INT IDENTITY PRIMARY KEY,
  IdCurso INT NOT NULL REFERENCES dbo.Cursos(IdCurso), IdEstudiante INT NOT NULL REFERENCES dbo.Usuarios(IdUsuario),
  CONSTRAINT UQ_Matricula UNIQUE(IdCurso, IdEstudiante))`,
`IF OBJECT_ID('dbo.Archivos') IS NULL CREATE TABLE dbo.Archivos(IdArchivo INT IDENTITY PRIMARY KEY, Nombre NVARCHAR(200) NOT NULL,
  Tamano INT NOT NULL, Contenido VARBINARY(MAX) NOT NULL, IdUsuario INT NOT NULL REFERENCES dbo.Usuarios(IdUsuario),
  Fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME())`,
`IF OBJECT_ID('dbo.Tareas') IS NULL CREATE TABLE dbo.Tareas(IdTarea INT IDENTITY PRIMARY KEY, IdCurso INT NOT NULL REFERENCES dbo.Cursos(IdCurso),
  Titulo NVARCHAR(150) NOT NULL, Descripcion NVARCHAR(2000) NOT NULL DEFAULT N'', FechaPublicacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FechaLimite DATETIME2 NOT NULL, IdArchivo INT NULL REFERENCES dbo.Archivos(IdArchivo), Cerrada BIT NOT NULL DEFAULT 0)`,
`IF OBJECT_ID('dbo.Entregas') IS NULL CREATE TABLE dbo.Entregas(IdEntrega INT IDENTITY PRIMARY KEY, IdTarea INT NOT NULL REFERENCES dbo.Tareas(IdTarea),
  IdEstudiante INT NOT NULL REFERENCES dbo.Usuarios(IdUsuario), IdArchivo INT NULL REFERENCES dbo.Archivos(IdArchivo),
  Comentario NVARCHAR(500) NOT NULL DEFAULT N'', FechaEntrega DATETIME2 NOT NULL DEFAULT SYSDATETIME(), Calificacion DECIMAL(5,2) NULL,
  Observacion NVARCHAR(500) NOT NULL DEFAULT N'', FechaCalificacion DATETIME2 NULL, CONSTRAINT UQ_Entrega UNIQUE(IdTarea, IdEstudiante))`,
`IF OBJECT_ID('dbo.Avisos') IS NULL CREATE TABLE dbo.Avisos(IdAviso INT IDENTITY PRIMARY KEY, IdCurso INT NOT NULL REFERENCES dbo.Cursos(IdCurso),
  Titulo NVARCHAR(150) NOT NULL, Texto NVARCHAR(1000) NOT NULL DEFAULT N'', IdAutor INT NOT NULL REFERENCES dbo.Usuarios(IdUsuario),
  Fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME())`,
`IF OBJECT_ID('dbo.Materiales') IS NULL CREATE TABLE dbo.Materiales(IdMaterial INT IDENTITY PRIMARY KEY, IdCurso INT NOT NULL REFERENCES dbo.Cursos(IdCurso),
  Titulo NVARCHAR(150) NOT NULL, IdArchivo INT NOT NULL REFERENCES dbo.Archivos(IdArchivo), Fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME())`,
// Exámenes aún no está implementado: se oculta del menú (el administrador puede volver a mostrarlo en Apartados).
`IF OBJECT_ID('dbo.Apartados') IS NOT NULL UPDATE dbo.Apartados SET Visible = 0 WHERE Clave = N'examenes'`
];

(async () => {
  const pool = await conectarDB();
  for (const p of pasos) await pool.request().query(p);
  const r = await pool.request().query("SELECT name FROM sys.tables WHERE name IN ('Cursos','Matriculas','Archivos','Tareas','Entregas','Avisos','Materiales') ORDER BY name");
  console.log("Tablas listas:", r.recordset.map(x => x.name).join(", "));
  process.exit(0);
})().catch(e => { console.error("Error:", e.message); process.exit(1); });
