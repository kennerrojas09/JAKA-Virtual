const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);

// Define JAKA_SECRET en tu entorno para que las sesiones sobrevivan a reinicios.
const SECRETO = process.env.JAKA_SECRET || crypto.randomBytes(32).toString("hex");

async function crearHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

async function verificarHash(password, guardado) {
  try {
    const [salt, hashGuardado] = String(guardado).split(":");
    if (!salt || !hashGuardado) return false;
    const hash = await scrypt(password, salt, 64);
    const esperado = Buffer.from(hashGuardado, "hex");
    return esperado.length === hash.length && crypto.timingSafeEqual(hash, esperado);
  } catch {
    return false;
  }
}

const firmar = datos => crypto.createHmac("sha256", SECRETO).update(datos).digest("base64url");

function crearToken(usuario) {
  const cuerpo = Buffer.from(JSON.stringify({ id: usuario.id, exp: Date.now() + 8 * 3600 * 1000 })).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

function leerToken(token) {
  try {
    const [cuerpo, firma] = String(token).split(".");
    const a = Buffer.from(firma || ""), b = Buffer.from(firmar(cuerpo));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
    return datos.exp > Date.now() ? datos : null;
  } catch {
    return null;
  }
}

module.exports = { crearHash, verificarHash, crearToken, leerToken };
