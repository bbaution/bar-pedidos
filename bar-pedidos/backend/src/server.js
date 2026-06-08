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
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
    credentials: false,
  })
);


app.use(express.json());

const JWT_SECRET = "CAMBIAR_ESTO_POR_UN_SECRET_LARGO";

function auth(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({ error: "No autorizado" });
    }

    const token = header.replace("Bearer ", "");

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Token inválido" });
    }
}
app.use((req, res, next) => {
  res.header("ngrok-skip-browser-warning", "true");
  next();
});
app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;

    const [users] = await pool.query(
        "SELECT * FROM admin_users WHERE username = ?",
        [username]
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
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "8h" }
    );

    res.json({ token });
});

app.get("/api/categorias", async (req, res) => {
    const [rows] = await pool.query(
        "SELECT * FROM categorias WHERE activa = TRUE ORDER BY orden ASC"
    );
    res.json(rows);
});

app.get("/api/guarniciones", async (req, res) => {
    const [rows] = await pool.query(
        "SELECT * FROM guarniciones ORDER BY nombre ASC"
    );
    res.json(rows);
});

app.get("/api/platos", async (req, res) => {
    const [platos] = await pool.query(`
    SELECT 
      p.*,
      c.nombre AS categoria_nombre
    FROM platos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.disponible = TRUE
    ORDER BY c.orden ASC, p.orden ASC
  `);

    const [guarniciones] = await pool.query(`
    SELECT 
  pg.plato_id,
  g.id,
  g.nombre,
  g.precio
    FROM plato_guarniciones pg
    INNER JOIN guarniciones g ON g.id = pg.guarnicion_id
    WHERE g.disponible = TRUE
  `);

    const resultado = platos.map((plato) => ({
        ...plato,
        guarniciones: guarniciones.filter((g) => g.plato_id === plato.id),
    }));

    res.json(resultado);
});

app.post("/api/admin/platos", auth, async (req, res) => {
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
    (categoria_id, nombre, descripcion, precio, foto_url, disponible, permite_guarnicion, orden)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
                "INSERT INTO plato_guarniciones (plato_id, guarnicion_id) VALUES (?, ?)",
                [platoId, guarnicionId]
            );
        }
    }

    res.json({ ok: true, id: platoId });
});
app.post("/api/admin/categorias", auth, async (req, res) => {
    const { nombre, orden = 0, activa = true } = req.body;

    await pool.query(
        "INSERT INTO categorias (nombre, orden, activa) VALUES (?, ?, ?)",
        [nombre, orden, activa]
    );

    res.json({ ok: true });
});

app.put("/api/admin/categorias/:id", auth, async (req, res) => {
    const { id } = req.params;
    const { nombre, orden = 0, activa = true } = req.body;

    await pool.query(
        "UPDATE categorias SET nombre = ?, orden = ?, activa = ? WHERE id = ?",
        [nombre, orden, activa, id]
    );

    res.json({ ok: true });
});

app.delete("/api/admin/categorias/:id", auth, async (req, res) => {
    const { id } = req.params;

    await pool.query("DELETE FROM categorias WHERE id = ?", [id]);

    res.json({ ok: true });
});
app.post("/api/admin/guarniciones", auth, async (req, res) => {
    const { nombre, precio = 0, disponible = true } = req.body;

    await pool.query(
        "INSERT INTO guarniciones (nombre, precio, disponible) VALUES (?, ?, ?)",
        [nombre, precio, disponible]
    );

    res.json({ ok: true });
});

app.put("/api/admin/guarniciones/:id", auth, async (req, res) => {
    const { id } = req.params;
    const { nombre, precio = 0, disponible = true } = req.body;

    await pool.query(
        "UPDATE guarniciones SET nombre = ?, precio = ?, disponible = ? WHERE id = ?",
        [nombre, precio, disponible, id]
    );

    res.json({ ok: true });
});

app.delete("/api/admin/guarniciones/:id", auth, async (req, res) => {
    const { id } = req.params;

    await pool.query("DELETE FROM guarniciones WHERE id = ?", [id]);

    res.json({ ok: true });
});

app.put("/api/admin/platos/:id", auth, async (req, res) => {
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
     WHERE id = ?`,
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
    ]
  );

  await pool.query("DELETE FROM plato_guarniciones WHERE plato_id = ?", [id]);

  if (permite_guarnicion && Array.isArray(guarniciones)) {
    for (const guarnicionId of guarniciones) {
      await pool.query(
        "INSERT INTO plato_guarniciones (plato_id, guarnicion_id) VALUES (?, ?)",
        [id, guarnicionId]
      );
    }
  }

  res.json({ ok: true });
});

app.delete("/api/admin/platos/:id", auth, async (req, res) => {
  const { id } = req.params;

  await pool.query("DELETE FROM plato_guarniciones WHERE plato_id = ?", [id]);
  await pool.query("DELETE FROM platos WHERE id = ?", [id]);

  res.json({ ok: true });
});

app.listen(4000, () => {
    console.log("Backend listo en http://localhost:4000");
});