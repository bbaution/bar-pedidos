// =====================================================
// App.jsx
// Sistema de pedidos Maikai
// Frontend público + login admin + panel admin
// =====================================================

import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";
import logo from "./assets/maikai-logo.png";
import api from "./services/api";

import {
  ShoppingCart,
  User,
  MapPin,
  Phone,
  Clock,
  CreditCard,
  Trash2,
  Plus,
  Minus,
  LogOut,
  Settings,
  MessageCircle,
  FileText,
} from "lucide-react";

// =====================================================
// Helpers generales
// =====================================================

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function getAuthHeaders() {
  const token = localStorage.getItem("admin_token");

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

// =====================================================
// App principal con rutas
// =====================================================

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

// =====================================================
// Ruta protegida para panel admin
// =====================================================

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("admin_token");

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

// =====================================================
// Header reutilizable
// =====================================================

function Header({ admin = false }) {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("admin_token");
    navigate("/admin/login");
  }

  return (
    <header className="topbar">
      <div className="brand" onClick={() => navigate("/")}>
        <img src={logo} alt="Maikai" />
      </div>

      <nav>
        <div className="header-actions">
          {window.location.pathname.startsWith("/admin") && (
            <>
              <button onClick={() => navigate("/")}>
                Ver menú
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem("admin_token");
                  navigate("/admin/login");
                }}
              >
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// =====================================================
// Componente reutilizable para inputs/selects con icono
// =====================================================

function Field({ icon, children }) {
  return (
    <div className="field">
      {icon}
      {children}
    </div>
  );
}

// =====================================================
// Página pública del cliente
// =====================================================

function HomePage() {
  const [platos, setPlatos] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [carrito, setCarrito] = useState([]);

  const [form, setForm] = useState({
    nombre: "",
    domicilio: "",
    telefono: "",
    horario: "",
    formaPago: "",
    observaciones: "",
  });

  useEffect(() => {
    cargarPlatos();
    cargarHorarios();
  }, []);

  async function cargarPlatos() {
    try {
      const { data } = await api.get("/platos");

      if (Array.isArray(data)) {
        setPlatos(data);
      } else {
        console.error("La respuesta de /platos no es un array:", data);
        setPlatos([]);
      }
    } catch (error) {
      console.error("Error cargando platos:", error);
      setPlatos([]);
    }
  }

  async function cargarHorarios() {
    try {
      const { data } = await api.get("/horarios");

      if (Array.isArray(data)) {
        setHorarios(data);
      } else {
        console.error("La respuesta de /horarios no es un array:", data);
        setHorarios([]);
      }
    } catch (error) {
      console.error("Error cargando horarios:", error);
      setHorarios([]);
    }
  }

  const total = useMemo(() => {
    return carrito.reduce(
      (acc, item) => acc + Number(item.precio) * item.cantidad,
      0
    );
  }, [carrito]);

  const platosPorCategoria = useMemo(() => {
    return platos.reduce((acc, plato) => {
      const categoria = plato.categoria_nombre || "Sin categoría";

      if (!acc[categoria]) acc[categoria] = [];

      acc[categoria].push(plato);

      return acc;
    }, {});
  }, [platos]);

  const formularioCompleto =
    form.nombre.trim() &&
    form.domicilio.trim() &&
    form.telefono.trim() &&
    form.horario.trim() &&
    form.formaPago.trim() &&
    carrito.length > 0;

  function agregarAlCarrito(plato, guarnicion) {
    const precioPlato = Number(plato.precio);
    const precioGuarnicion = guarnicion ? Number(guarnicion.precio) : 0;

    setCarrito((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        platoId: plato.id,
        nombre: plato.nombre,
        precio: precioPlato + precioGuarnicion,
        precioBase: precioPlato,
        cantidad: 1,
        guarnicion,
      },
    ]);
  }

  function eliminarItem(id) {
    setCarrito((prev) => prev.filter((item) => item.id !== id));
  }

  function generarMensajeWhatsapp() {
    const textoItems = carrito
      .map((item) => {
        const lineaGuarnicion = item.guarnicion
          ? `\n  Guarnición: ${item.guarnicion.nombre}${Number(item.guarnicion.precio) > 0
            ? ` +$${formatMoney(item.guarnicion.precio)}`
            : ""
          }`
          : "";

        return `- ${item.cantidad}x ${item.nombre} - $${formatMoney(
          item.precio * item.cantidad
        )}${lineaGuarnicion}`;
      })
      .join("\n");

    return `Hola, quiero hacer un pedido:

Cliente: ${form.nombre}
Domicilio: ${form.domicilio}
Teléfono: ${form.telefono}
Horario de entrega: ${form.horario}
Forma de pago: ${form.formaPago}

Pedido:
${textoItems}

Observaciones:
${form.observaciones || "Sin observaciones"}

Total: $${formatMoney(total)}`;
  }

  function comprarPorWhatsapp() {
    const numeroBar = "5493816432708";
    const mensaje = encodeURIComponent(generarMensajeWhatsapp());
    window.open(`https://wa.me/${numeroBar}?text=${mensaje}`, "_blank");
  }

  return (
    <div className="app">
      <Header />

      <main className="layout">
        <section>
          <div className="menu-header">
            <h2>Nuestro menú</h2>

            <div className="category-slider">
              {Object.keys(platosPorCategoria).map((categoria) => (
                <button
                  key={categoria}
                  onClick={() => {
                    const el = document.getElementById(
                      `cat-${categoria.replace(/\s+/g, "-").toLowerCase()}`
                    );

                    if (el) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }
                  }}
                >
                  {categoria}
                </button>
              ))}
            </div>
          </div>

          {Object.entries(platosPorCategoria).map(
            ([categoria, platosCategoria]) => (
              <div
                className="categoria-menu"
                key={categoria}
                id={`cat-${categoria.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <h3>{categoria}</h3>

                <div className="grid">
                  {platosCategoria.map((plato) => (
                    <PlatoCard
                      key={plato.id}
                      plato={plato}
                      carrito={carrito}
                      setCarrito={setCarrito}
                      agregarAlCarrito={agregarAlCarrito}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </section>

        <aside className="carrito">
          <h2>
            <ShoppingCart size={24} />
            Carrito
          </h2>

          {carrito.length === 0 && <p>No hay productos todavía.</p>}

          {carrito.map((item) => (
            <div className="item" key={item.id}>
              <strong>
                {item.cantidad}x {item.nombre}
              </strong>

              {item.guarnicion && (
                <span>
                  Guarnición: {item.guarnicion.nombre}
                  {Number(item.guarnicion.precio) > 0
                    ? ` +$${formatMoney(item.guarnicion.precio)}`
                    : ""}
                </span>
              )}

              <span>${formatMoney(item.precio * item.cantidad)}</span>

              <button onClick={() => eliminarItem(item.id)} aria-label="Eliminar">
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          <h3>Total: ${formatMoney(total)}</h3>

          <h3 className="datos-title">Datos del pedido</h3>

          <Field icon={<User size={18} />}>
            <input
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </Field>

          <Field icon={<MapPin size={18} />}>
            <input
              placeholder="Domicilio"
              value={form.domicilio}
              onChange={(e) => setForm({ ...form, domicilio: e.target.value })}
            />
          </Field>

          <Field icon={<Phone size={18} />}>
            <input
              placeholder="N° de teléfono"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </Field>

          <Field icon={<Clock size={18} />}>
            <select
              value={form.horario}
              onChange={(e) => setForm({ ...form, horario: e.target.value })}
            >
              <option value="">Horario de entrega</option>
              {horarios
                .slice()
                .sort((a, b) => Number(a.orden) - Number(b.orden))
                .map((hora) => (
                  <option key={hora.id} value={hora.horario}>
                    {hora.horario}
                  </option>
                ))}
            </select>
          </Field>

          <Field icon={<FileText size={18} />}>
            <input
              placeholder="Observaciones"
              value={form.observaciones}
              onChange={(e) =>
                setForm({ ...form, observaciones: e.target.value })
              }
            />
          </Field>

          <Field icon={<CreditCard size={18} />}>
            <select
              value={form.formaPago}
              onChange={(e) => setForm({ ...form, formaPago: e.target.value })}
            >
              <option value="">Forma de pago</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </Field>

          <button
            className="comprar"
            disabled={!formularioCompleto}
            onClick={comprarPorWhatsapp}
          >
            <MessageCircle size={18} />
            Pedir por WhatsApp
          </button>
        </aside>
      </main>
    </div>
  );
}

// =====================================================
// Card de plato del catálogo
// =====================================================

function PlatoCard({ plato, agregarAlCarrito, carrito, setCarrito }) {
  const [guarnicionId, setGuarnicionId] = useState("");

  const guarnicionSeleccionada = plato.guarniciones?.find(
    (g) => String(g.id) === String(guarnicionId)
  );

  const itemExistente = carrito.find(
    (item) =>
      item.platoId === plato.id &&
      String(item.guarnicion?.id || "") ===
      String(guarnicionSeleccionada?.id || "")
  );

  const cantidad = itemExistente?.cantidad || 0;

  const tieneGuarniciones =
    Boolean(plato.permite_guarnicion) && plato.guarniciones?.length > 0;

  const precioMostrado =
    Number(plato.precio) +
    (guarnicionSeleccionada ? Number(guarnicionSeleccionada.precio) : 0);

  function sumar() {
    if (tieneGuarniciones && !guarnicionSeleccionada) return;

    if (itemExistente) {
      setCarrito((prev) =>
        prev.map((item) =>
          item.id === itemExistente.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      );
    } else {
      agregarAlCarrito(plato, guarnicionSeleccionada || null);
    }
  }

  function restar() {
    if (!itemExistente) return;

    if (itemExistente.cantidad === 1) {
      setCarrito((prev) => prev.filter((item) => item.id !== itemExistente.id));
    } else {
      setCarrito((prev) =>
        prev.map((item) =>
          item.id === itemExistente.id
            ? { ...item, cantidad: item.cantidad - 1 }
            : item
        )
      );
    }
  }

  return (
    <div className="card">
      <img
        className="card-image"
        src={plato.foto_url || "https://placehold.co/600x400?text=Maikai"}
        alt={plato.nombre}
      />

      <h3>{plato.nombre}</h3>
      <p>{plato.descripcion}</p>
      <strong>${formatMoney(precioMostrado)}</strong>

      {tieneGuarniciones && (
        <select
          value={guarnicionId}
          onChange={(e) => setGuarnicionId(e.target.value)}
        >
          <option value="">Elegir guarnición</option>
          {plato.guarniciones.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
              {Number(g.precio) > 0 ? ` +$${formatMoney(g.precio)}` : ""}
            </option>
          ))}
        </select>
      )}

      {cantidad === 0 ? (
        <button className="botonplus"
          onClick={sumar}
          disabled={tieneGuarniciones && !guarnicionSeleccionada}
          aria-label="Agregar plato"
        >
          <Plus size={18} />
        </button>
      ) : (
        <div className="contador-card">
          <button onClick={restar} aria-label="Restar unidad">
            <Minus size={18} />
          </button>

          <span>{cantidad}</span>

          <button onClick={sumar} aria-label="Sumar unidad">
            <Plus size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Login del panel admin
// =====================================================

function AdminLoginPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");

  async function login(e) {
    e.preventDefault();
    setError("");

    try {
      const { data } = await api.post("/auth/login", form);
      localStorage.setItem("admin_token", data.token);
      navigate("/admin");
    } catch {
      setError("Usuario o contraseña incorrectos");
    }
  }

  return (
    <div className="app">
      <Header />

      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <h2>Ingreso admin</h2>

          {error && <p className="error-login">{error}</p>}

          <input
            placeholder="Usuario"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button>Ingresar</button>
        </form>
      </main>
    </div>
  );
}

// =====================================================
// Panel admin
// CRUD de categorías, guarniciones, horarios y platos
// =====================================================

function AdminPage() {
  const [platos, setPlatos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [guarniciones, setGuarniciones] = useState([]);
  const [horariosEntrega, setHorariosEntrega] = useState([]);

  const [mostrarCategorias, setMostrarCategorias] = useState(false);
  const [mostrarGuarniciones, setMostrarGuarniciones] = useState(false);
  const [mostrarHorarios, setMostrarHorarios] = useState(false);
  const [mostrarPlatos, setMostrarPlatos] = useState(false);

  const [nuevaCategoria, setNuevaCategoria] = useState({
    nombre: "",
    orden: 0,
    activa: true,
  });

  const [editCategoriaId, setEditCategoriaId] = useState(null);
  const [editCategoria, setEditCategoria] = useState({
    nombre: "",
    orden: 0,
    activa: true,
  });

  const [nuevaGuarnicion, setNuevaGuarnicion] = useState({
    nombre: "",
    precio: 0,
    disponible: true,
  });

  const [editGuarnicionId, setEditGuarnicionId] = useState(null);
  const [editGuarnicion, setEditGuarnicion] = useState({
    nombre: "",
    precio: 0,
    disponible: true,
  });

  const [nuevoHorario, setNuevoHorario] = useState({
    horario: "",
    orden: 0,
    activo: true,
  });

  const [editHorarioId, setEditHorarioId] = useState(null);
  const [editHorario, setEditHorario] = useState({
    horario: "",
    orden: 0,
    activo: true,
  });

  const [nuevo, setNuevo] = useState({
    categoria_id: "",
    nombre: "",
    descripcion: "",
    precio: "",
    foto_url: "",
    disponible: true,
    permite_guarnicion: false,
    orden: 0,
    guarniciones: [],
  });

  const [editPlatoId, setEditPlatoId] = useState(null);
  const [editPlato, setEditPlato] = useState({
    categoria_id: "",
    nombre: "",
    descripcion: "",
    precio: "",
    foto_url: "",
    disponible: true,
    permite_guarnicion: false,
    orden: 0,
    guarniciones: [],
  });

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    const [platosRes, categoriasRes, guarnicionesRes, horariosRes] =
      await Promise.all([
        api.get("/platos"),
        api.get("/categorias"),
        api.get("/guarniciones"),
        api.get("/horarios"),
      ]);

    setPlatos(Array.isArray(platosRes.data) ? platosRes.data : []);
    setCategorias(Array.isArray(categoriasRes.data) ? categoriasRes.data : []);
    setGuarniciones(Array.isArray(guarnicionesRes.data) ? guarnicionesRes.data : []);
    setHorariosEntrega(Array.isArray(horariosRes.data) ? horariosRes.data : []);
  }

  function toggleGuarnicion(id) {
    setNuevo((prev) => {
      const existe = prev.guarniciones.includes(id);

      return {
        ...prev,
        guarniciones: existe
          ? prev.guarniciones.filter((g) => g !== id)
          : [...prev.guarniciones, id],
      };
    });
  }

  function toggleGuarnicionEdit(id) {
    setEditPlato((prev) => {
      const existe = prev.guarniciones.includes(id);

      return {
        ...prev,
        guarniciones: existe
          ? prev.guarniciones.filter((g) => g !== id)
          : [...prev.guarniciones, id],
      };
    });
  }

  async function agregarCategoria() {
    if (!nuevaCategoria.nombre.trim()) return;

    await api.post("/admin/categorias", nuevaCategoria, getAuthHeaders());

    setNuevaCategoria({
      nombre: "",
      orden: 0,
      activa: true,
    });

    cargarTodo();
  }

  function comenzarEditarCategoria(cat) {
    setEditCategoriaId(cat.id);

    setEditCategoria({
      nombre: cat.nombre,
      orden: cat.orden,
      activa: Boolean(cat.activa),
    });
  }

  async function guardarCategoria(id) {
    if (!editCategoria.nombre.trim()) return;

    await api.put(
      `/admin/categorias/${id}`,
      {
        ...editCategoria,
        orden: Number(editCategoria.orden),
      },
      getAuthHeaders()
    );

    setEditCategoriaId(null);
    cargarTodo();
  }

  async function eliminarCategoria(id) {
    const confirmar = confirm("¿Eliminar esta categoría?");
    if (!confirmar) return;

    await api.delete(`/admin/categorias/${id}`, getAuthHeaders());
    cargarTodo();
  }

  async function agregarGuarnicion() {
    if (!nuevaGuarnicion.nombre.trim()) return;

    await api.post(
      "/admin/guarniciones",
      {
        ...nuevaGuarnicion,
        precio: Number(nuevaGuarnicion.precio),
      },
      getAuthHeaders()
    );

    setNuevaGuarnicion({
      nombre: "",
      precio: 0,
      disponible: true,
    });

    cargarTodo();
  }

  function comenzarEditarGuarnicion(g) {
    setEditGuarnicionId(g.id);

    setEditGuarnicion({
      nombre: g.nombre,
      precio: Number(g.precio),
      disponible: Boolean(g.disponible),
    });
  }

  async function guardarGuarnicion(id) {
    if (!editGuarnicion.nombre.trim()) return;

    await api.put(
      `/admin/guarniciones/${id}`,
      {
        ...editGuarnicion,
        precio: Number(editGuarnicion.precio),
      },
      getAuthHeaders()
    );

    setEditGuarnicionId(null);
    cargarTodo();
  }

  async function eliminarGuarnicion(id) {
    const confirmar = confirm("¿Eliminar esta guarnición?");
    if (!confirmar) return;

    await api.delete(`/admin/guarniciones/${id}`, getAuthHeaders());
    cargarTodo();
  }

  async function agregarHorario() {
    if (!nuevoHorario.horario.trim()) return;

    await api.post(
      "/admin/horarios",
      {
        ...nuevoHorario,
        orden: Number(nuevoHorario.orden),
      },
      getAuthHeaders()
    );

    setNuevoHorario({
      horario: "",
      orden: 0,
      activo: true,
    });

    cargarTodo();
  }

  function comenzarEditarHorario(h) {
    setEditHorarioId(h.id);

    setEditHorario({
      horario: h.horario,
      orden: h.orden,
      activo: Boolean(h.activo),
    });
  }

  async function guardarHorario(id) {
    if (!editHorario.horario.trim()) return;

    await api.put(
      `/admin/horarios/${id}`,
      {
        ...editHorario,
        orden: Number(editHorario.orden),
      },
      getAuthHeaders()
    );

    setEditHorarioId(null);
    cargarTodo();
  }

  async function eliminarHorario(id) {
    const confirmar = confirm("¿Eliminar este horario?");
    if (!confirmar) return;

    await api.delete(`/admin/horarios/${id}`, getAuthHeaders());
    cargarTodo();
  }

  async function agregarPlato() {
    if (!nuevo.categoria_id || !nuevo.nombre.trim() || !nuevo.precio) return;

    await api.post(
      "/admin/platos",
      {
        ...nuevo,
        categoria_id: Number(nuevo.categoria_id),
        precio: Number(nuevo.precio),
        orden: Number(nuevo.orden),
        guarniciones: nuevo.permite_guarnicion ? nuevo.guarniciones : [],
      },
      getAuthHeaders()
    );

    setNuevo({
      categoria_id: "",
      nombre: "",
      descripcion: "",
      precio: "",
      foto_url: "",
      disponible: true,
      permite_guarnicion: false,
      orden: 0,
      guarniciones: [],
    });

    cargarTodo();
  }

  function comenzarEditarPlato(plato) {
    setEditPlatoId(plato.id);

    setEditPlato({
      categoria_id: plato.categoria_id || "",
      nombre: plato.nombre || "",
      descripcion: plato.descripcion || "",
      precio: plato.precio || "",
      foto_url: plato.foto_url || "",
      disponible: Boolean(plato.disponible),
      permite_guarnicion: Boolean(plato.permite_guarnicion),
      orden: plato.orden || 0,
      guarniciones: plato.guarniciones?.map((g) => g.id) || [],
    });
  }

  async function guardarPlato(id) {
    if (!editPlato.categoria_id || !editPlato.nombre.trim() || !editPlato.precio)
      return;

    await api.put(
      `/admin/platos/${id}`,
      {
        ...editPlato,
        categoria_id: Number(editPlato.categoria_id),
        precio: Number(editPlato.precio),
        orden: Number(editPlato.orden),
        guarniciones: editPlato.permite_guarnicion
          ? editPlato.guarniciones
          : [],
      },
      getAuthHeaders()
    );

    setEditPlatoId(null);
    cargarTodo();
  }

  async function eliminarPlato(id) {
    const confirmar = confirm("¿Eliminar este plato?");
    if (!confirmar) return;

    await api.delete(`/admin/platos/${id}`, getAuthHeaders());
    cargarTodo();
  }

  return (
    <div className="app">
      <Header admin />

      <main>
        <h2>Panel admin</h2>

        <AdminCategorias
          mostrar={mostrarCategorias}
          setMostrar={setMostrarCategorias}
          categorias={categorias}
          nuevaCategoria={nuevaCategoria}
          setNuevaCategoria={setNuevaCategoria}
          editCategoriaId={editCategoriaId}
          setEditCategoriaId={setEditCategoriaId}
          editCategoria={editCategoria}
          setEditCategoria={setEditCategoria}
          agregarCategoria={agregarCategoria}
          comenzarEditarCategoria={comenzarEditarCategoria}
          guardarCategoria={guardarCategoria}
          eliminarCategoria={eliminarCategoria}
        />

        <AdminGuarniciones
          mostrar={mostrarGuarniciones}
          setMostrar={setMostrarGuarniciones}
          guarniciones={guarniciones}
          nuevaGuarnicion={nuevaGuarnicion}
          setNuevaGuarnicion={setNuevaGuarnicion}
          editGuarnicionId={editGuarnicionId}
          setEditGuarnicionId={setEditGuarnicionId}
          editGuarnicion={editGuarnicion}
          setEditGuarnicion={setEditGuarnicion}
          agregarGuarnicion={agregarGuarnicion}
          comenzarEditarGuarnicion={comenzarEditarGuarnicion}
          guardarGuarnicion={guardarGuarnicion}
          eliminarGuarnicion={eliminarGuarnicion}
        />

        <AdminHorarios
          mostrar={mostrarHorarios}
          setMostrar={setMostrarHorarios}
          horariosEntrega={horariosEntrega}
          nuevoHorario={nuevoHorario}
          setNuevoHorario={setNuevoHorario}
          editHorarioId={editHorarioId}
          setEditHorarioId={setEditHorarioId}
          editHorario={editHorario}
          setEditHorario={setEditHorario}
          agregarHorario={agregarHorario}
          comenzarEditarHorario={comenzarEditarHorario}
          guardarHorario={guardarHorario}
          eliminarHorario={eliminarHorario}
        />

        <AdminPlatos
          mostrar={mostrarPlatos}
          setMostrar={setMostrarPlatos}
          platos={platos}
          categorias={categorias}
          guarniciones={guarniciones}
          nuevo={nuevo}
          setNuevo={setNuevo}
          editPlatoId={editPlatoId}
          setEditPlatoId={setEditPlatoId}
          editPlato={editPlato}
          setEditPlato={setEditPlato}
          toggleGuarnicion={toggleGuarnicion}
          toggleGuarnicionEdit={toggleGuarnicionEdit}
          agregarPlato={agregarPlato}
          comenzarEditarPlato={comenzarEditarPlato}
          guardarPlato={guardarPlato}
          eliminarPlato={eliminarPlato}
        />
      </main>
    </div>
  );
}

// =====================================================
// Admin: CRUD categorías
// =====================================================

function AdminCategorias({
  mostrar,
  setMostrar,
  categorias,
  nuevaCategoria,
  setNuevaCategoria,
  editCategoriaId,
  setEditCategoriaId,
  editCategoria,
  setEditCategoria,
  agregarCategoria,
  comenzarEditarCategoria,
  guardarCategoria,
  eliminarCategoria,
}) {
  return (
    <section className="admin-section">
      <button className="admin-toggle" onClick={() => setMostrar(!mostrar)}>
        Categorías {mostrar ? "▲" : "▼"}
      </button>

      {mostrar && (
        <>
          <div className="admin-form-simple">
            <input
              placeholder="Nombre categoría"
              value={nuevaCategoria.nombre}
              onChange={(e) =>
                setNuevaCategoria({
                  ...nuevaCategoria,
                  nombre: e.target.value,
                })
              }
            />

            <input
              type="number"
              placeholder="Orden"
              value={nuevaCategoria.orden}
              onChange={(e) =>
                setNuevaCategoria({
                  ...nuevaCategoria,
                  orden: Number(e.target.value),
                })
              }
            />

            <button onClick={agregarCategoria}>Agregar categoría</button>
          </div>

          <div className="admin-mini-list">
            {categorias.map((cat) => (
              <div key={cat.id} className="admin-mini-item">
                {editCategoriaId === cat.id ? (
                  <>
                    <input
                      value={editCategoria.nombre}
                      onChange={(e) =>
                        setEditCategoria({
                          ...editCategoria,
                          nombre: e.target.value,
                        })
                      }
                    />

                    <input
                      type="number"
                      value={editCategoria.orden}
                      onChange={(e) =>
                        setEditCategoria({
                          ...editCategoria,
                          orden: Number(e.target.value),
                        })
                      }
                    />

                    <label className="check-admin">
                      <input
                        type="checkbox"
                        checked={editCategoria.activa}
                        onChange={(e) =>
                          setEditCategoria({
                            ...editCategoria,
                            activa: e.target.checked,
                          })
                        }
                      />
                      Activa
                    </label>

                    <button onClick={() => guardarCategoria(cat.id)}>
                      Guardar
                    </button>

                    <button onClick={() => setEditCategoriaId(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <strong>{cat.nombre}</strong>
                    <span>Orden: {cat.orden}</span>
                    <span>{cat.activa ? "Activa" : "Inactiva"}</span>

                    <button onClick={() => comenzarEditarCategoria(cat)}>
                      Editar
                    </button>

                    <button onClick={() => eliminarCategoria(cat.id)}>
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// =====================================================
// Admin: CRUD guarniciones
// =====================================================

function AdminGuarniciones({
  mostrar,
  setMostrar,
  guarniciones,
  nuevaGuarnicion,
  setNuevaGuarnicion,
  editGuarnicionId,
  setEditGuarnicionId,
  editGuarnicion,
  setEditGuarnicion,
  agregarGuarnicion,
  comenzarEditarGuarnicion,
  guardarGuarnicion,
  eliminarGuarnicion,
}) {
  return (
    <section className="admin-section">
      <button className="admin-toggle" onClick={() => setMostrar(!mostrar)}>
        Guarniciones {mostrar ? "▲" : "▼"}
      </button>

      {mostrar && (
        <>
          <div className="admin-form-simple">
            <input
              placeholder="Nombre guarnición"
              value={nuevaGuarnicion.nombre}
              onChange={(e) =>
                setNuevaGuarnicion({
                  ...nuevaGuarnicion,
                  nombre: e.target.value,
                })
              }
            />

            <input
              type="number"
              placeholder="Precio extra"
              value={nuevaGuarnicion.precio}
              onChange={(e) =>
                setNuevaGuarnicion({
                  ...nuevaGuarnicion,
                  precio: Number(e.target.value),
                })
              }
            />

            <button onClick={agregarGuarnicion}>Agregar guarnición</button>
          </div>

          <div className="admin-mini-list">
            {guarniciones.map((g) => (
              <div key={g.id} className="admin-mini-item">
                {editGuarnicionId === g.id ? (
                  <>
                    <input
                      value={editGuarnicion.nombre}
                      onChange={(e) =>
                        setEditGuarnicion({
                          ...editGuarnicion,
                          nombre: e.target.value,
                        })
                      }
                    />

                    <input
                      type="number"
                      value={editGuarnicion.precio}
                      onChange={(e) =>
                        setEditGuarnicion({
                          ...editGuarnicion,
                          precio: Number(e.target.value),
                        })
                      }
                    />

                    <label className="check-admin">
                      <input
                        type="checkbox"
                        checked={editGuarnicion.disponible}
                        onChange={(e) =>
                          setEditGuarnicion({
                            ...editGuarnicion,
                            disponible: e.target.checked,
                          })
                        }
                      />
                      Disponible
                    </label>

                    <button onClick={() => guardarGuarnicion(g.id)}>
                      Guardar
                    </button>

                    <button onClick={() => setEditGuarnicionId(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <strong>{g.nombre}</strong>
                    <span>${formatMoney(g.precio)}</span>
                    <span>{g.disponible ? "Disponible" : "No disponible"}</span>

                    <button onClick={() => comenzarEditarGuarnicion(g)}>
                      Editar
                    </button>

                    <button onClick={() => eliminarGuarnicion(g.id)}>
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// =====================================================
// Admin: CRUD horarios de entrega
// =====================================================

function AdminHorarios({
  mostrar,
  setMostrar,
  horariosEntrega,
  nuevoHorario,
  setNuevoHorario,
  editHorarioId,
  setEditHorarioId,
  editHorario,
  setEditHorario,
  agregarHorario,
  comenzarEditarHorario,
  guardarHorario,
  eliminarHorario,
}) {
  return (
    <section className="admin-section">
      <button className="admin-toggle" onClick={() => setMostrar(!mostrar)}>
        Horarios de entrega {mostrar ? "▲" : "▼"}
      </button>

      {mostrar && (
        <>
          <div className="admin-form-simple">
            <input
              placeholder="Horario. Ej: 12:30"
              value={nuevoHorario.horario}
              onChange={(e) =>
                setNuevoHorario({
                  ...nuevoHorario,
                  horario: e.target.value,
                })
              }
            />

            <input
              type="number"
              placeholder="Orden"
              value={nuevoHorario.orden}
              onChange={(e) =>
                setNuevoHorario({
                  ...nuevoHorario,
                  orden: Number(e.target.value),
                })
              }
            />

            <button onClick={agregarHorario}>Agregar horario</button>
          </div>

          <div className="admin-mini-list">
            {horariosEntrega.map((h) => (
              <div key={h.id} className="admin-mini-item">
                {editHorarioId === h.id ? (
                  <>
                    <input
                      value={editHorario.horario}
                      onChange={(e) =>
                        setEditHorario({
                          ...editHorario,
                          horario: e.target.value,
                        })
                      }
                    />

                    <input
                      type="number"
                      value={editHorario.orden}
                      onChange={(e) =>
                        setEditHorario({
                          ...editHorario,
                          orden: Number(e.target.value),
                        })
                      }
                    />

                    <label className="check-admin">
                      <input
                        type="checkbox"
                        checked={editHorario.activo}
                        onChange={(e) =>
                          setEditHorario({
                            ...editHorario,
                            activo: e.target.checked,
                          })
                        }
                      />
                      Activo
                    </label>

                    <button onClick={() => guardarHorario(h.id)}>Guardar</button>

                    <button onClick={() => setEditHorarioId(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <strong>{h.horario}</strong>
                    <span>Orden: {h.orden}</span>
                    <span>{h.activo ? "Activo" : "Inactivo"}</span>

                    <button onClick={() => comenzarEditarHorario(h)}>
                      Editar
                    </button>

                    <button onClick={() => eliminarHorario(h.id)}>
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// =====================================================
// Admin: CRUD platos
// =====================================================

function AdminPlatos({
  mostrar,
  setMostrar,
  platos,
  categorias,
  guarniciones,
  nuevo,
  setNuevo,
  editPlatoId,
  setEditPlatoId,
  editPlato,
  setEditPlato,
  toggleGuarnicion,
  toggleGuarnicionEdit,
  agregarPlato,
  comenzarEditarPlato,
  guardarPlato,
  eliminarPlato,
}) {
  return (
    <section className="admin-section">
      <button className="admin-toggle" onClick={() => setMostrar(!mostrar)}>
        Gestión de platos {mostrar ? "▲" : "▼"}
      </button>

      {mostrar && (
        <>
          <div className="admin-form">
            <select
              value={nuevo.categoria_id}
              onChange={(e) =>
                setNuevo({ ...nuevo, categoria_id: e.target.value })
              }
            >
              <option value="">Categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>

            <input
              placeholder="Nombre del plato"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            />

            <input
              placeholder="Descripción"
              value={nuevo.descripcion}
              onChange={(e) =>
                setNuevo({ ...nuevo, descripcion: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Precio"
              value={nuevo.precio}
              onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
            />

            <input
              placeholder="URL de imagen"
              value={nuevo.foto_url}
              onChange={(e) => setNuevo({ ...nuevo, foto_url: e.target.value })}
            />

            <input
              type="number"
              placeholder="Orden"
              value={nuevo.orden}
              onChange={(e) => setNuevo({ ...nuevo, orden: e.target.value })}
            />

            <label className="check-admin">
              <input
                type="checkbox"
                checked={nuevo.disponible}
                onChange={(e) =>
                  setNuevo({ ...nuevo, disponible: e.target.checked })
                }
              />
              Disponible
            </label>

            <label className="check-admin">
              <input
                type="checkbox"
                checked={nuevo.permite_guarnicion}
                onChange={(e) =>
                  setNuevo({
                    ...nuevo,
                    permite_guarnicion: e.target.checked,
                    guarniciones: e.target.checked ? nuevo.guarniciones : [],
                  })
                }
              />
              Permite guarnición
            </label>

            {nuevo.permite_guarnicion && (
              <div className="guarniciones-admin">
                {guarniciones.map((g) => (
                  <label key={g.id}>
                    <input
                      type="checkbox"
                      checked={nuevo.guarniciones.includes(g.id)}
                      onChange={() => toggleGuarnicion(g.id)}
                    />
                    {g.nombre}
                    {Number(g.precio) > 0 ? ` +$${formatMoney(g.precio)}` : ""}
                  </label>
                ))}
              </div>
            )}

            <button onClick={agregarPlato}>Agregar plato</button>
          </div>

          <div className="admin-list">
            {platos.map((plato) => (
              <div className="admin-item" key={plato.id}>
                {editPlatoId === plato.id ? (
                  <div className="edit-plato-form">
                    <select
                      value={editPlato.categoria_id}
                      onChange={(e) =>
                        setEditPlato({
                          ...editPlato,
                          categoria_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Categoría</option>
                      {categorias.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nombre}
                        </option>
                      ))}
                    </select>

                    <input
                      placeholder="Nombre del plato"
                      value={editPlato.nombre}
                      onChange={(e) =>
                        setEditPlato({
                          ...editPlato,
                          nombre: e.target.value,
                        })
                      }
                    />

                    <input
                      placeholder="Descripción"
                      value={editPlato.descripcion}
                      onChange={(e) =>
                        setEditPlato({
                          ...editPlato,
                          descripcion: e.target.value,
                        })
                      }
                    />

                    <input
                      type="number"
                      placeholder="Precio"
                      value={editPlato.precio}
                      onChange={(e) =>
                        setEditPlato({
                          ...editPlato,
                          precio: e.target.value,
                        })
                      }
                    />

                    <input
                      placeholder="URL de imagen"
                      value={editPlato.foto_url}
                      onChange={(e) =>
                        setEditPlato({
                          ...editPlato,
                          foto_url: e.target.value,
                        })
                      }
                    />

                    <input
                      type="number"
                      placeholder="Orden"
                      value={editPlato.orden}
                      onChange={(e) =>
                        setEditPlato({
                          ...editPlato,
                          orden: e.target.value,
                        })
                      }
                    />

                    <label className="check-admin">
                      <input
                        type="checkbox"
                        checked={editPlato.disponible}
                        onChange={(e) =>
                          setEditPlato({
                            ...editPlato,
                            disponible: e.target.checked,
                          })
                        }
                      />
                      Disponible
                    </label>

                    <label className="check-admin">
                      <input
                        type="checkbox"
                        checked={editPlato.permite_guarnicion}
                        onChange={(e) =>
                          setEditPlato({
                            ...editPlato,
                            permite_guarnicion: e.target.checked,
                            guarniciones: e.target.checked
                              ? editPlato.guarniciones
                              : [],
                          })
                        }
                      />
                      Permite guarnición
                    </label>

                    {editPlato.permite_guarnicion && (
                      <div className="guarniciones-admin">
                        {guarniciones.map((g) => (
                          <label key={g.id}>
                            <input
                              type="checkbox"
                              checked={editPlato.guarniciones.includes(g.id)}
                              onChange={() => toggleGuarnicionEdit(g.id)}
                            />
                            {g.nombre}
                            {Number(g.precio) > 0
                              ? ` +$${formatMoney(g.precio)}`
                              : ""}
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="edit-actions">
                      <button onClick={() => guardarPlato(plato.id)}>
                        Guardar
                      </button>
                      <button onClick={() => setEditPlatoId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <strong>{plato.nombre}</strong>
                      <p>${formatMoney(plato.precio)}</p>
                      <small>{plato.categoria_nombre}</small>
                    </div>

                    <small>
                      Guarniciones:{" "}
                      {plato.guarniciones?.length
                        ? plato.guarniciones
                          .map(
                            (g) =>
                              `${g.nombre}${Number(g.precio) > 0
                                ? ` +$${formatMoney(g.precio)}`
                                : ""
                              }`
                          )
                          .join(", ")
                        : "Sin guarniciones"}
                    </small>

                    <div>
                      <button onClick={() => comenzarEditarPlato(plato)}>
                        Editar
                      </button>
                      <button onClick={() => eliminarPlato(plato.id)}>
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
