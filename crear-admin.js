// Uso: node server/crear-admin.js correo contraseña [nombre] [apellido]
const { conectarDB, sql } = require("./db");
const { crearHash } = require("./seguridad");

(async () => {
  const [correo, password, nombre = "Admin", apellido = "JAKA"] = process.argv.slice(2);
  if (!correo || !password || password.length < 8) {
    console.log("Uso: node server/crear-admin.js correo contraseña(8+) [nombre] [apellido]");
    process.exit(1);
  }
  const pool = await conectarDB();
  await pool.request()
    .input("n", sql.NVarChar(80), nombre).input("a", sql.NVarChar(80), apellido)
    .input("c", sql.NVarChar(150), correo.toLowerCase()).input("h", sql.NVarChar(300), await crearHash(password))
    .query(`DECLARE @rol INT = (SELECT IdRol FROM dbo.Roles WHERE NombreRol = N'Administrador');
      IF EXISTS (SELECT 1 FROM dbo.Usuarios WHERE LOWER(Correo) = @c)
        UPDATE dbo.Usuarios SET ContrasenaHash = @h, Estado = 1, IdRol = @rol WHERE LOWER(Correo) = @c
      ELSE
        INSERT dbo.Usuarios(Nombre, Apellido, Correo, ContrasenaHash, IdRol, Estado) VALUES(@n, @a, @c, @h, @rol, 1)`);
  console.log("Administrador listo:", correo.toLowerCase());
  process.exit(0);
})().catch(e => { console.error("Error:", e.message); process.exit(1); });

