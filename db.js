const sql = require("mssql/msnodesqlv8");

const config = {
    connectionString:
        "Driver={ODBC Driver 17 for SQL Server};" +
        "Server=localhost\\SQLEXPRESS;" +
        "Database=JAKAVirtualDB;" +
        "Trusted_Connection=Yes;",
    options: { trustedConnection: true }
};

// Una sola conexión compartida: evita abrir un pool nuevo en cada petición.
let pool = null;
function conectarDB() {
    if (!pool) {
        pool = sql.connect(config)
            .then(p => { console.log("Conexión con SQL Server establecida."); return p; })
            .catch(error => { pool = null; console.error("Error al conectar con SQL Server:", error.message); throw error; });
    }
    return pool;
}

module.exports = { conectarDB, sql };
