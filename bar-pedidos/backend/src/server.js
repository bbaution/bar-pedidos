const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
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

    if (
      hostname.includes("localhost") ||
      hostname.includes("127.0.0.1") ||
      hostname.includes("railway.app")
    ) {
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
   PEDIDOS
========================================================= */

function generarCodigoPedido() {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${Date.now().toString().slice(-4)}-${random}`;
}

/* =========================================================
   CREAR PEDIDO
========================================================= */

app.post("/api/pedidos", async (req, res) => {
  try {
    const {
      cliente_nombre,
      telefono,
      direccion,
      horario_entrega,
      observaciones,
      items,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "El pedido no tiene productos",
      });
    }

    let subtotal = 0;

    for (const item of items) {
      subtotal += Number(item.precio) * Number(item.cantidad);
    }

    const codigo = generarCodigoPedido();

    const [result] = await pool.query(
      `INSERT INTO pedidos (
        codigo,
        cliente_nombre,
        telefono,
        direccion,
        horario_entrega,
        estado,
        subtotal,
        total,
        observaciones
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo,
        cliente_nombre,
        telefono,
        direccion,
        horario_entrega,
        "pendiente_confirmacion",
        subtotal,
        subtotal,
        observaciones || null,
      ]
    );

    const pedidoId = result.insertId;

    for (const item of items) {
      await pool.query(
        `INSERT INTO pedido_items (
          pedido_id,
          plato_id,
          nombre_producto,
          cantidad,
          precio_unitario,
          subtotal,
          observaciones
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          pedidoId,
          item.plato_id || null,
          item.nombre,
          item.cantidad,
          item.precio,
          Number(item.precio) * Number(item.cantidad),
          item.observaciones || null,
        ]
      );
    }

    await pool.query(
      `INSERT INTO pedido_historial (
        pedido_id,
        estado_nuevo,
        detalle
      )
      VALUES (?, ?, ?)`,
      [
        pedidoId,
        "pendiente_confirmacion",
        "Pedido creado",
      ]
    );
    const io = req.app.get("io");

    if (io) {
      io.emit("pedido_nuevo", {
        id: pedidoId,
        codigo,
        estado: "pendiente_confirmacion",
        subtotal,
        total: subtotal,
      });
    }

    res.json({
      ok: true,
      pedido: {
        id: pedidoId,
        codigo,
        estado: "pendiente_confirmacion",
        subtotal,
        total: subtotal,
      },
    });
  } catch (error) {
    console.error("Error creando pedido:", error);
    res.status(500).json({
      error: "Error creando pedido",
    });
  }
});

/* =========================================================
   OBTENER PEDIDO PÚBLICO
========================================================= */

app.get("/api/pedidos/:codigo", async (req, res) => {
  try {
    const { codigo } = req.params;

    const [pedidos] = await pool.query(
      `SELECT *
       FROM pedidos
       WHERE codigo = ?
       LIMIT 1`,
      [codigo]
    );

    const pedido = pedidos[0];

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado",
      });
    }

    const [items] = await pool.query(
      `SELECT *
       FROM pedido_items
       WHERE pedido_id = ?`,
      [pedido.id]
    );

    res.json({
      ...pedido,
      items,
    });
  } catch (error) {
    console.error("Error obteniendo pedido:", error);

    res.status(500).json({
      error: "Error obteniendo pedido",
    });
  }
});

/* =========================================================
   ADMIN: LISTAR PEDIDOS
========================================================= */

app.get("/api/admin/pedidos", auth, async (req, res) => {
  try {
    const [pedidos] = await pool.query(
      `SELECT *
       FROM pedidos
       ORDER BY creado_en DESC`
    );

    for (const pedido of pedidos) {
      const [items] = await pool.query(
        `SELECT *
         FROM pedido_items
         WHERE pedido_id = ?`,
        [pedido.id]
      );

      pedido.items = items;
    }

    res.json(pedidos);
  } catch (error) {
    console.error("Error cargando pedidos:", error);

    res.status(500).json({
      error: "Error cargando pedidos",
    });
  }
});

/* =========================================================
   ADMIN: CAMBIAR ESTADO
========================================================= */

app.patch("/api/admin/pedidos/:id/estado", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = [
      "pendiente_confirmacion",
      "en_preparacion",
      "en_camino",
      "entregado",
      "cancelado",
    ];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        error: "Estado inválido",
      });
    }

    const [pedidos] = await pool.query(
      `SELECT *
       FROM pedidos
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const pedido = pedidos[0];

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado",
      });
    }

    await pool.query(
      `UPDATE pedidos
       SET estado = ?
       WHERE id = ?`,
      [estado, id]
    );

    await pool.query(
      `INSERT INTO pedido_historial (
        pedido_id,
        estado_anterior,
        estado_nuevo,
        detalle
      )
      VALUES (?, ?, ?, ?)`,
      [
        id,
        pedido.estado,
        estado,
        `Estado actualizado a ${estado}`,
      ]
    );

    res.json({
      ok: true,
    });
  } catch (error) {
    console.error("Error actualizando estado:", error);

    res.status(500).json({
      error: "Error actualizando estado",
    });
  }
});

/* =========================================================
   ADMIN: EDITAR PEDIDO
========================================================= */

app.patch("/api/admin/pedidos/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      cliente_nombre,
      telefono,
      direccion,
      horario_entrega,
      observaciones,
      costo_envio,
    } = req.body;

    const [pedidos] = await pool.query(
      `SELECT *
       FROM pedidos
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const pedido = pedidos[0];

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado",
      });
    }

    const envio = Number(costo_envio || 0);

    const total = Number(pedido.subtotal) + envio;

    await pool.query(
      `UPDATE pedidos
       SET cliente_nombre = ?,
           telefono = ?,
           direccion = ?,
           horario_entrega = ?,
           observaciones = ?,
           costo_envio = ?,
           total = ?
       WHERE id = ?`,
      [
        cliente_nombre,
        telefono,
        direccion,
        horario_entrega,
        observaciones,
        envio,
        total,
        id,
      ]
    );

    await pool.query(
      `INSERT INTO pedido_historial (
        pedido_id,
        detalle
      )
      VALUES (?, ?)`,
      [
        id,
        "Pedido editado manualmente",
      ]
    );

    res.json({
      ok: true,
    });
  } catch (error) {
    console.error("Error editando pedido:", error);

    res.status(500).json({
      error: "Error editando pedido",
    });
  }
});

app.patch("/api/admin/pedidos/:id/items", auth, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "El pedido debe tener al menos un producto",
      });
    }

    await connection.beginTransaction();

    const [pedidos] = await connection.query(
      `SELECT *
       FROM pedidos
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const pedido = pedidos[0];

    if (!pedido) {
      await connection.rollback();
      return res.status(404).json({
        error: "Pedido no encontrado",
      });
    }

    await connection.query(
      `DELETE FROM pedido_items
       WHERE pedido_id = ?`,
      [id]
    );

    let subtotal = 0;

    for (const item of items) {
      const cantidad = Number(item.cantidad || 1);
      const precio = Number(item.precio_unitario || item.precio || 0);
      const itemSubtotal = cantidad * precio;

      subtotal += itemSubtotal;

      await connection.query(
        `INSERT INTO pedido_items (
          pedido_id,
          plato_id,
          nombre_producto,
          cantidad,
          precio_unitario,
          subtotal,
          observaciones
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.plato_id || null,
          item.nombre_producto || item.nombre,
          cantidad,
          precio,
          itemSubtotal,
          item.observaciones || null,
        ]
      );
    }

    const costoEnvio = Number(pedido.costo_envio || 0);
    const total = subtotal + costoEnvio;

    await connection.query(
      `UPDATE pedidos
       SET subtotal = ?,
           total = ?
       WHERE id = ?`,
      [subtotal, total, id]
    );

    await connection.query(
      `INSERT INTO pedido_historial (
        pedido_id,
        detalle
      )
      VALUES (?, ?)`,
      [id, "Productos del pedido editados"]
    );

    await connection.commit();

    const io = req.app.get("io");
    if (io) {
      io.emit("pedido_actualizado");
    }

    res.json({
      ok: true,
      subtotal,
      total,
    });
  } catch (error) {
    await connection.rollback();

    console.error("Error editando items del pedido:", error);

    res.status(500).json({
      error: "Error editando productos del pedido",
    });
  } finally {
    connection.release();
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

const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Cliente conectado a sockets:", socket.id);

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Backend listo en puerto ${PORT}`);
});