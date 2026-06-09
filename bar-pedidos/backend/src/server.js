const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
    credentials: false,
  })
);

app.use(express.json());

app.use((req, res, next) => {
  res.header("ngrok-skip-browser-warning", "true");
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || "CAMBIAR_ESTO_POR_UN_SECRET_LARGO";

/* =========================================================
   MIDDLEWARE: DETECTAR CLIENTE POR SUBDOMINIO
   Localhost usa Maikai por defecto.
   maikai.pedidos.ramallolabs.dev => subdominio = maikai
========================================================= */

async function clienteMiddleware(req, res, next) {
  try {
    let hostname = req.hostname.replace("www.", "");

    if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
      const [clientes] = await pool.query(
        "SELECT * FROM clientes WHERE subdominio = ? AND activo = TRUE LIMIT 1",
        ["maikai"]
      );

      req.cliente = clientes[0];

      if (!req.cliente) {
        return res.status(404).json({ error: "Cliente local Maikai no encontrado" });
      }

      return next();
    }

    const partes = hostname.split(".");
    const subdominio = partes[0];

    if (subdominio === "api") {
      return next();
    }

    const [clientes] = await pool.query(
      "SELECT * FROM clientes WHERE subdominio = ? AND activo = TRUE LIMIT 1",
      [subdominio]
    );

    const cliente = clientes[0];

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    req.cliente = cliente;
    next();
  } catch (error) {
    console.error("Error detectando cliente:", error);
    res.status(500).json({ error: "Error detectando cliente" });
  }
}

app.use(clienteMiddleware);

/* =========================================================
   MIDDLEWARE: AUTENTICACIÓN ADMIN
========================================================= */

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const token = header.replace("Bearer ", "");

  try {
    req.user = jwt.verify(token, JWT_SECRET);

    if (req.cliente && req.user.cliente_id !== req.cliente.id) {
      return res.status(403).json({ error: "Token no corresponde a este cliente" });
    }

    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

/* =========================================================
   CONFIG CLIENTE
========================================================= */

app.get("/api/config", async (req, res) => {
  res.json({
    cliente: {
      id: req.cliente.id,
      nombre: req.cliente.nombre,
      subdominio: req.cliente.subdominio,
      dominio_personalizado: req.cliente.dominio_personalizado,
      logo_url: req.cliente.logo_url,
      color_primario: req.cliente.color_primario,
      whatsapp: req.cliente.whatsapp,
      activo: req.cliente.activo,
    },
  });
});

/* =========================================================
   AUTH ADMIN
========================================================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await pool.query(
      `SELECT * 
       FROM admin_users 
       WHERE username = ? 
       AND cliente_id = ?
       LIMIT 1`,
      [username, req.cliente.id]
    );

    const user = users[0];

    if (!user) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        cliente_id: user.cliente_id,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token });
  } catch (error) {
    console.error("Error login:", error);
    res.status(500).json({ error: "Error en login" });
  }
});

/* =========================================================
   ENDPOINTS PÚBLICOS
========================================================= */

app.get("/api/categorias", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * 
       FROM categorias 
       WHERE activa = TRUE 
       AND cliente_id = ?
       ORDER BY orden ASC`,
      [req.cliente.id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error categorías:", error);
    res.status(500).json({ error: "Error cargando categorías" });
  }
});

app.get("/api/guarniciones", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * 
       FROM guarniciones 
       WHERE cliente_id = ?
       ORDER BY nombre ASC`,
      [req.cliente.id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error guarniciones:", error);
    res.status(500).json({ error: "Error cargando guarniciones" });
  }
});

app.get("/api/horarios", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * 
       FROM horarios_entrega 
       WHERE activo = TRUE 
       AND cliente_id = ?
       ORDER BY orden ASC`,
      [req.cliente.id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error horarios:", error);
    res.status(500).json({ error: "Error cargando horarios" });
  }
});

app.get("/api/platos", async (req, res) => {
  try {
    const [platos] = await pool.query(
      `SELECT 
        p.*,
        c.nombre AS categoria_nombre
      FROM platos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.disponible = TRUE
      AND p.cliente_id = ?
      ORDER BY c.orden ASC, p.orden ASC`,
      [req.cliente.id]
    );

    const [guarniciones] = await pool.query(
      `SELECT 
        pg.plato_id,
        g.id,
        g.nombre,
        g.precio
      FROM plato_guarniciones pg
      INNER JOIN guarniciones g ON g.id = pg.guarnicion_id
      INNER JOIN platos p ON p.id = pg.plato_id
      WHERE g.disponible = TRUE
      AND g.cliente_id = ?
      AND p.cliente_id = ?`,
      [req.cliente.id, req.cliente.id]
    );

    const resultado = platos.map((plato) => ({
      ...plato,
      guarniciones: guarniciones.filter((g) => g.plato_id === plato.id),
    }));

    res.json(resultado);
  } catch (error) {
    console.error("Error platos:", error);
    res.status(500).json({ error: "Error cargando platos" });
  }
});

/* =========================================================
   ADMIN: CATEGORÍAS
========================================================= */

app.post("/api/admin/categorias", auth, async (req, res) => {
  try {
    const { nombre, orden = 0, activa = true } = req.body;

    await pool.query(
      "INSERT INTO categorias (cliente_id, nombre, orden, activa) VALUES (?, ?, ?, ?)",
      [req.cliente.id, nombre, orden, activa]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error creando categoría:", error);
    res.status(500).json({ error: "Error creando categoría" });
  }
});

app.put("/api/admin/categorias/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, orden = 0, activa = true } = req.body;

    await pool.query(
      `UPDATE categorias 
       SET nombre = ?, orden = ?, activa = ? 
       WHERE id = ? 
       AND cliente_id = ?`,
      [nombre, orden, activa, id, req.cliente.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error editando categoría:", error);
    res.status(500).json({ error: "Error editando categoría" });
  }
});

app.delete("/api/admin/categorias/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM categorias WHERE id = ? AND cliente_id = ?",
      [id, req.cliente.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando categoría:", error);
    res.status(500).json({ error: "Error eliminando categoría" });
  }
});

/* =========================================================
   ADMIN: GUARNICIONES
========================================================= */

app.post("/api/admin/guarniciones", auth, async (req, res) => {
  try {
    const { nombre, precio = 0, disponible = true } = req.body;

    await pool.query(
      "INSERT INTO guarniciones (cliente_id, nombre, precio, disponible) VALUES (?, ?, ?, ?)",
      [req.cliente.id, nombre, precio, disponible]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error creando guarnición:", error);
    res.status(500).json({ error: "Error creando guarnición" });
  }
});

app.put("/api/admin/guarniciones/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, precio = 0, disponible = true } = req.body;

    await pool.query(
      `UPDATE guarniciones 
       SET nombre = ?, precio = ?, disponible = ? 
       WHERE id = ? 
       AND cliente_id = ?`,
      [nombre, precio, disponible, id, req.cliente.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error editando guarnición:", error);
    res.status(500).json({ error: "Error editando guarnición" });
  }
});

app.delete("/api/admin/guarniciones/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM guarniciones WHERE id = ? AND cliente_id = ?",
      [id, req.cliente.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando guarnición:", error);
    res.status(500).json({ error: "Error eliminando guarnición" });
  }
});

/* =========================================================
   ADMIN: HORARIOS
========================================================= */

app.get("/api/admin/horarios", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * 
       FROM horarios_entrega 
       WHERE cliente_id = ?
       ORDER BY orden ASC`,
      [req.cliente.id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error horarios admin:", error);
    res.status(500).json({ error: "Error cargando horarios" });
  }
});

app.post("/api/admin/horarios", auth, async (req, res) => {
  try {
    const { horario, activo = true, orden = 0 } = req.body;

    await pool.query(
      "INSERT INTO horarios_entrega (cliente_id, horario, activo, orden) VALUES (?, ?, ?, ?)",
      [req.cliente.id, horario, activo, orden]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error creando horario:", error);
    res.status(500).json({ error: "Error creando horario" });
  }
});

app.put("/api/admin/horarios/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { horario, activo = true, orden = 0 } = req.body;

    await pool.query(
      `UPDATE horarios_entrega 
       SET horario = ?, activo = ?, orden = ? 
       WHERE id = ? 
       AND cliente_id = ?`,
      [horario, activo, orden, id, req.cliente.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error editando horario:", error);
    res.status(500).json({ error: "Error editando horario" });
  }
});

app.delete("/api/admin/horarios/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM horarios_entrega WHERE id = ? AND cliente_id = ?",
      [id, req.cliente.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando horario:", error);
    res.status(500).json({ error: "Error eliminando horario" });
  }
});

/* =========================================================
   ADMIN: PLATOS
========================================================= */

app.post("/api/admin/platos", auth, async (req, res) => {
  try {
    const {
      categoria_id,
      nombre,
      descripcion,
      precio,
      foto_url,
      disponible,
      permite_guarnicion,
      orden,
      guarniciones,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO platos 
      (cliente_id, categoria_id, nombre, descripcion, precio, foto_url, disponible, permite_guarnicion, orden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.cliente.id,
        categoria_id,
        nombre,
        descripcion,
        precio,
        foto_url,
        disponible,
        permite_guarnicion,
        orden,
      ]
    );

    const platoId = result.insertId;

    if (permite_guarnicion && Array.isArray(guarniciones)) {
      for (const guarnicionId of guarniciones) {
        await pool.query(
          `INSERT INTO plato_guarniciones (plato_id, guarnicion_id)
           SELECT ?, id 
           FROM guarniciones 
           WHERE id = ? 
           AND cliente_id = ?`,
          [platoId, guarnicionId, req.cliente.id]
        );
      }
    }

    res.json({ ok: true, id: platoId });
  } catch (error) {
    console.error("Error creando plato:", error);
    res.status(500).json({ error: "Error creando plato" });
  }
});

app.put("/api/admin/platos/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      categoria_id,
      nombre,
      descripcion,
      precio,
      foto_url,
      disponible,
      permite_guarnicion,
      orden,
      guarniciones,
    } = req.body;

    await pool.query(
      `UPDATE platos 
       SET categoria_id = ?, nombre = ?, descripcion = ?, precio = ?, foto_url = ?, 
           disponible = ?, permite_guarnicion = ?, orden = ?
       WHERE id = ?
       AND cliente_id = ?`,
      [
        categoria_id,
        nombre,
        descripcion,
        precio,
        foto_url,
        disponible,
        permite_guarnicion,
        orden,
        id,
        req.cliente.id,
      ]
    );

    await pool.query(
      `DELETE pg
       FROM plato_guarniciones pg
       INNER JOIN platos p ON p.id = pg.plato_id
       WHERE pg.plato_id = ?
       AND p.cliente_id = ?`,
      [id, req.cliente.id]
    );

    if (permite_guarnicion && Array.isArray(guarniciones)) {
      for (const guarnicionId of guarniciones) {
        await pool.query(
          `INSERT INTO plato_guarniciones (plato_id, guarnicion_id)
           SELECT ?, id 
           FROM guarniciones 
           WHERE id = ? 
           AND cliente_id = ?`,
          [id, guarnicionId, req.cliente.id]
        );
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error editando plato:", error);
    res.status(500).json({ error: "Error editando plato" });
  }
});

app.delete("/api/admin/platos/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE pg
       FROM plato_guarniciones pg
       INNER JOIN platos p ON p.id = pg.plato_id
       WHERE pg.plato_id = ?
       AND p.cliente_id = ?`,
      [id, req.cliente.id]
    );

    await pool.query(
      "DELETE FROM platos WHERE id = ? AND cliente_id = ?",
      [id, req.cliente.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando plato:", error);
    res.status(500).json({ error: "Error eliminando plato" });
  }
});

/* =========================================================
   ADMIN: CONFIGURACIÓN DEL LOCAL
========================================================= */

app.get("/api/admin/config", auth, async (req, res) => {
  try {
    const [clientes] = await pool.query(
      `SELECT 
        id,
        nombre,
        subdominio,
        dominio_personalizado,
        logo_url,
        color_primario,
        whatsapp,
        activo
      FROM clientes
      WHERE id = ?
      LIMIT 1`,
      [req.cliente.id]
    );

    res.json(clientes[0]);
  } catch (error) {
    console.error("Error cargando configuración:", error);
    res.status(500).json({ error: "Error cargando configuración" });
  }
});

app.put("/api/admin/config", auth, async (req, res) => {
  try {
    const {
      nombre,
      whatsapp,
      logo_url,
      color_primario,
      dominio_personalizado,
      activo,
    } = req.body;

    await pool.query(
      `UPDATE clientes
       SET nombre = ?,
           whatsapp = ?,
           logo_url = ?,
           color_primario = ?,
           dominio_personalizado = ?,
           activo = ?
       WHERE id = ?`,
      [
        nombre,
        whatsapp,
        logo_url,
        color_primario,
        dominio_personalizado,
        activo,
        req.cliente.id,
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error guardando configuración:", error);
    res.status(500).json({ error: "Error guardando configuración" });
  }
});

/* =========================================================
   HEALTHCHECK
========================================================= */

app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    cliente: req.cliente?.subdominio || null,
  });
});

/* =========================================================
   SERVER
========================================================= */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend listo en puerto ${PORT}`);
});