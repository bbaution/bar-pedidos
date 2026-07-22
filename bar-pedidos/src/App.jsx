// =====================================================
// App.jsx
// Sistema de pedidos Maikai
// Frontend público + login admin + panel admin
// =====================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import "./App.css";
import logo from "./assets/maikai-logo.png";
import api from "./services/api";
import { io } from "socket.io-client";

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
      <Route path="/pedido/:codigo" element={<PedidoTracking />} />
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
// Tracking público del pedido
// =====================================================

function PedidoTracking() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarPedido();

    const socket = io(import.meta.env.VITE_API_URL || window.location.origin);

    socket.on("pedido_actualizado", () => {
      cargarPedido();
    });

    return () => {
      socket.disconnect();
    };
  }, [codigo]);

  async function cargarPedido() {
    try {
      const res = await api.get(`/pedidos/${codigo}`);
      setPedido(res.data);
      setError("");
    } catch (error) {
      console.error("Error cargando pedido:", error);
      setError("Pedido no encontrado");
    }
  }

  async function cambiarEstadoDesdeTracking(nuevoEstado) {
    const accion = nuevoEstado === "en_preparacion" ? "confirmar" : "cancelar";

    const ok = confirm(`¿Está seguro que quiere ${accion} el pedido #${pedido.codigo}?`);
    if (!ok) return;

    try {
      await api.patch(
        `/admin/pedidos/${pedido.id}/estado`,
        { estado: nuevoEstado },
        getAuthHeaders()
      );

      navigate("/admin");
    } catch (error) {
      console.error("Error actualizando pedido desde link:", error);
      alert("No se pudo actualizar el pedido. Verificá que estés logueado como admin.");
    }
  }

  function textoEstado(estado) {
    const textos = {
      pendiente_confirmacion: "Esperando confirmación",
      en_preparacion: "En preparación",
      en_camino: "En camino",
      entregado: "Entregado",
      cancelado: "Cancelado",
    };

    return textos[estado] || estado;
  }

  if (error) {
    return (
      <div className="tracking-page">
        <div className="tracking-card">
          <h1>{error}</h1>
          <p>Verificá que el link sea correcto.</p>
        </div>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="tracking-page">
        <div className="tracking-card">Cargando pedido...</div>
      </div>
    );
  }

  return (
    <div className="tracking-page">
      <div className="tracking-card">
        <h1>Pedido #{pedido.codigo}</h1>
        <h2>{textoEstado(pedido.estado)}</h2>

        <p><strong>Cliente:</strong> {pedido.cliente_nombre}</p>
        <p><strong>Horario:</strong> {pedido.horario_entrega}</p>
        <p><strong>Total:</strong> ${formatMoney(pedido.total)}</p>

        <h3>Productos</h3>

        {pedido.items?.map((item) => (
          <div key={item.id} className="tracking-item">
            {item.cantidad}x {item.nombre_producto}
          </div>
        ))}

        {localStorage.getItem("admin_token") &&
          pedido.estado === "pendiente_confirmacion" && (
            <div className="tracking-admin-actions">
              <button onClick={() => cambiarEstadoDesdeTracking("en_preparacion")}>
                Confirmar pedido
              </button>

              <button onClick={() => cambiarEstadoDesdeTracking("cancelado")}>
                Cancelar pedido
              </button>
            </div>
          )}
      </div>
    </div>
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

function Header({ admin = false, logoUrl = null }) {
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div className="brand" onClick={() => navigate("/")}>
        <img src={logoUrl || logo} alt="Logo" />
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
                <LogOut size={18} />
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
  const [config, setConfig] = useState(null);
  const carritoRef = useRef(null);
  const [resaltarCarrito, setResaltarCarrito] = useState(false);

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
    cargarConfig();
  }, []);

  async function cargarConfig() {
    try {
      const { data } = await api.get("/config");
      setConfig(data.cliente);

      if (data.cliente?.color_primario) {
        document.documentElement.style.setProperty(
          "--green",
          data.cliente.color_primario
        );
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    }
  }

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
  const cantidadProductos = useMemo(() => {
    return carrito.reduce(
      (acc, item) => acc + Number(item.cantidad || 0),
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

  function generarMensajeWhatsapp(pedidoCreado) {
    const textoItems = carrito
      .map((item) => {
        const lineaGuarnicion = item.guarnicion
          ? `
  Guarnición: ${item.guarnicion.nombre}${Number(item.guarnicion.precio) > 0
            ? ` +$${formatMoney(item.guarnicion.precio)}`
            : ""
          }`
          : "";

        return `- ${item.cantidad}x ${item.nombre} - $${formatMoney(
          item.precio * item.cantidad
        )}${lineaGuarnicion}`;
      })
      .join("\n");

    const linkSeguimiento = `${window.location.origin}/pedido/${pedidoCreado.codigo}`;

    return `Hola, quiero hacer un pedido:

Pedido: #${pedidoCreado.codigo}
Link del pedido: ${linkSeguimiento}

Cliente: ${form.nombre}
Domicilio: ${form.domicilio}
Teléfono: ${form.telefono}
Horario de entrega: ${form.horario}
Forma de pago: ${form.formaPago}

Pedido:
${textoItems}

Observaciones:
${form.observaciones || "Sin observaciones"}

Total: $${formatMoney(pedidoCreado.total || total)}`;
  }

  async function comprarPorWhatsapp() {
    try {
      const payload = {
        cliente_nombre: form.nombre,
        telefono: form.telefono,
        direccion: form.domicilio,
        horario_entrega: form.horario,
        observaciones: `Forma de pago: ${form.formaPago}${form.observaciones ? ` | ${form.observaciones}` : ""}`,
        items: carrito.map((item) => ({
          plato_id: item.platoId || null,
          nombre: item.guarnicion
            ? `${item.nombre} con ${item.guarnicion.nombre}`
            : item.nombre,
          cantidad: item.cantidad,
          precio: item.precio,
          observaciones: item.guarnicion
            ? `Guarnición: ${item.guarnicion.nombre}`
            : null,
        })),
      };

      const res = await api.post("/pedidos", payload);
      const pedidoCreado = res.data.pedido;

      const numeroBar = config?.whatsapp || "5493816432708";
      const mensaje = encodeURIComponent(generarMensajeWhatsapp(pedidoCreado));
      const whatsappUrl = `https://wa.me/${numeroBar}?text=${mensaje}`;

      window.location.href = whatsappUrl;
    } catch (error) {
      console.error("Error creando pedido antes de WhatsApp:", error);
      alert("No se pudo crear el pedido. Intentá nuevamente.");
    }
  }
  function irAlCarrito() {
    carritoRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setResaltarCarrito(true);

    setTimeout(() => {
      setResaltarCarrito(false);
    }, 900);
  }

  return (
    <div className="app">
      <Header logoUrl={config?.logo_url} />

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
        <aside
          ref={carritoRef}
          id="carrito"
          className={`carrito ${resaltarCarrito ? "carrito-resaltado" : ""}`}
        >
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

      {carrito.length > 0 && (
        <div className="carrito-flotante">
          <div className="carrito-flotante-info">
            <strong>${formatMoney(total)}</strong>

            <span>
              {cantidadProductos}{" "}
              {cantidadProductos === 1 ? "producto" : "productos"}
            </span>
          </div>

          <button
            type="button"
            onClick={irAlCarrito}
          >
            <ShoppingCart size={18} />
            Ver carrito
          </button>
        </div>
      )}
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
  const [pedidos, setPedidos] = useState([]);
  const [pedidoEditando, setPedidoEditando] = useState(null);
  const [pedidoForm, setPedidoForm] = useState({
    cliente_nombre: "",
    telefono: "",
    direccion: "",
    horario_entrega: "",
    observaciones: "",
    costo_envio: 0,
  });

  const [pedidoItemsEditando, setPedidoItemsEditando] = useState([]);
  const [platoAgregarPedidoId, setPlatoAgregarPedidoId] = useState("");

  const [mostrarConfig, setMostrarConfig] = useState(false);

  const [configLocal, setConfigLocal] = useState({
    nombre: "",
    whatsapp: "",
    logo_url: "",
    color_primario: "#2f4a3f",
    dominio_personalizado: "",
    costo_envio_fijo: 0,
    activo: true,
  });

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

    const socket = io(import.meta.env.VITE_API_URL || window.location.origin);

    socket.on("pedido_nuevo", () => {
      cargarTodo();
    });

    socket.on("pedido_actualizado", () => {
      cargarTodo();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function cambiarEstadoPedido(id, estado) {
    if (estado === "en_preparacion") {
      const ok = confirm("¿Está seguro que quiere confirmar este pedido?");
      if (!ok) return;
    }

    try {
      await api.patch(
        `/admin/pedidos/${id}/estado`,
        { estado },
        getAuthHeaders()
      );

      cargarTodo();
    } catch (error) {
      console.error("Error actualizando pedido:", error);
      alert("Error actualizando pedido");
    }
  }

  function abrirModalEditarPedido(pedido) {
    setPedidoEditando(pedido);
    setPedidoForm({
      cliente_nombre: pedido.cliente_nombre || "",
      telefono: pedido.telefono || "",
      direccion: pedido.direccion || "",
      horario_entrega: pedido.horario_entrega || "",
      observaciones: pedido.observaciones || "",
      costo_envio: Number(pedido.costo_envio || 0),
    });

    setPedidoItemsEditando(
      (pedido.items || []).map((item) => ({
        temp_id: item.id || crypto.randomUUID(),
        id: item.id,
        plato_id: item.plato_id || null,
        nombre_producto: item.nombre_producto || item.nombre || "",
        cantidad: Number(item.cantidad || 1),
        precio_unitario: Number(item.precio_unitario || item.precio || 0),
        observaciones: item.observaciones || "",
      }))
    );

    setPlatoAgregarPedidoId("");
  }

  function cerrarModalPedido() {
    setPedidoEditando(null);
    setPedidoForm({
      cliente_nombre: "",
      telefono: "",
      direccion: "",
      horario_entrega: "",
      observaciones: "",
      costo_envio: 0,
    });
    setPedidoItemsEditando([]);
    setPlatoAgregarPedidoId("");
  }

  function actualizarItemPedido(tempId, cambios) {
    setPedidoItemsEditando((prev) =>
      prev.map((item) =>
        item.temp_id === tempId
          ? {
            ...item,
            ...cambios,
          }
          : item
      )
    );
  }

  function sumarCantidadItem(tempId) {
    setPedidoItemsEditando((prev) =>
      prev.map((item) =>
        item.temp_id === tempId
          ? { ...item, cantidad: Number(item.cantidad || 1) + 1 }
          : item
      )
    );
  }

  function restarCantidadItem(tempId) {
    setPedidoItemsEditando((prev) =>
      prev
        .map((item) =>
          item.temp_id === tempId
            ? { ...item, cantidad: Math.max(0, Number(item.cantidad || 1) - 1) }
            : item
        )
        .filter((item) => Number(item.cantidad) > 0)
    );
  }

  function eliminarItemPedido(tempId) {
    setPedidoItemsEditando((prev) => prev.filter((item) => item.temp_id !== tempId));
  }

  function agregarProductoAlPedido() {
    if (!platoAgregarPedidoId) return;

    const plato = platos.find((p) => String(p.id) === String(platoAgregarPedidoId));
    if (!plato) return;

    setPedidoItemsEditando((prev) => [
      ...prev,
      {
        temp_id: crypto.randomUUID(),
        plato_id: plato.id,
        nombre_producto: plato.nombre,
        cantidad: 1,
        precio_unitario: Number(plato.precio || 0),
        observaciones: "",
      },
    ]);

    setPlatoAgregarPedidoId("");
  }

  const subtotalPedidoEditando = pedidoItemsEditando.reduce(
    (acc, item) =>
      acc + Number(item.precio_unitario || 0) * Number(item.cantidad || 0),
    0
  );

  const totalPedidoEditando =
    subtotalPedidoEditando + Number(pedidoForm.costo_envio || 0);

  async function guardarEdicionPedido() {
    if (!pedidoEditando) return;

    const itemsValidos = pedidoItemsEditando
      .filter((item) => Number(item.cantidad) > 0)
      .map((item) => ({
        plato_id: item.plato_id || null,
        nombre_producto: item.nombre_producto,
        cantidad: Number(item.cantidad || 1),
        precio_unitario: Number(item.precio_unitario || 0),
        observaciones: item.observaciones || null,
      }));

    if (itemsValidos.length === 0) {
      alert("El pedido debe tener al menos un producto");
      return;
    }

    try {
      await api.patch(
        `/admin/pedidos/${pedidoEditando.id}`,
        {
          cliente_nombre: pedidoForm.cliente_nombre,
          telefono: pedidoForm.telefono,
          direccion: pedidoForm.direccion,
          horario_entrega: pedidoForm.horario_entrega,
          observaciones: pedidoForm.observaciones,
          costo_envio: Number(pedidoForm.costo_envio || 0),
        },
        getAuthHeaders()
      );

      await api.patch(
        `/admin/pedidos/${pedidoEditando.id}/items`,
        {
          items: itemsValidos,
        },
        getAuthHeaders()
      );

      cerrarModalPedido();
      cargarTodo();
    } catch (error) {
      console.error("Error editando pedido:", error);
      alert("Error editando pedido");
    }
  }

  function agregarEnvioPedido(pedido) {
    const costoEnvio = Number(pedido.costo_envio || configLocal.costo_envio_fijo || 0);

    abrirModalEditarPedido({
      ...pedido,
      costo_envio: costoEnvio,
    });
  }

  async function cargarTodo() {
    const [
      platosRes,
      categoriasRes,
      guarnicionesRes,
      horariosRes,
      configRes,
      pedidosRes,
    ] = await Promise.all([
      api.get("/platos"),
      api.get("/categorias"),
      api.get("/guarniciones"),
      api.get("/horarios"),
      api.get("/admin/config", getAuthHeaders()),
      api.get("/admin/pedidos", getAuthHeaders()),
    ]);

    setPlatos(Array.isArray(platosRes.data) ? platosRes.data : []);
    setCategorias(Array.isArray(categoriasRes.data) ? categoriasRes.data : []);
    setGuarniciones(Array.isArray(guarnicionesRes.data) ? guarnicionesRes.data : []);
    setHorariosEntrega(Array.isArray(horariosRes.data) ? horariosRes.data : []);
    setPedidos(Array.isArray(pedidosRes.data) ? pedidosRes.data : []);

    setConfigLocal({
      nombre: configRes.data?.nombre || "",
      whatsapp: configRes.data?.whatsapp || "",
      logo_url: configRes.data?.logo_url || "",
      color_primario: configRes.data?.color_primario || "#2f4a3f",
      dominio_personalizado: configRes.data?.dominio_personalizado || "",
      costo_envio_fijo: Number(configRes.data?.costo_envio_fijo || 0),
      activo: Boolean(configRes.data?.activo),
    });
  }

  async function guardarConfigLocal() {
    try {
      await api.put(
        "/admin/config",
        {
          ...configLocal,
          activo: Boolean(configLocal.activo),
        },
        getAuthHeaders()
      );

      alert("Configuración guardada");
      cargarTodo();
    } catch (error) {
      console.error("Error guardando configuración:", error);
      alert("Error guardando configuración");
    }
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

        <AdminConfigLocal
          mostrar={mostrarConfig}
          setMostrar={setMostrarConfig}
          configLocal={configLocal}
          setConfigLocal={setConfigLocal}
          guardarConfigLocal={guardarConfigLocal}
        />

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

        <AdminPedidosPanel
          pedidos={pedidos}
          cambiarEstadoPedido={cambiarEstadoPedido}
          editarPedido={abrirModalEditarPedido}
          agregarEnvioPedido={agregarEnvioPedido}
        />

        {pedidoEditando && (
          <div className="modal-backdrop" onClick={cerrarModalPedido}>
            <div className="pedido-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Editar pedido #{pedidoEditando.codigo}</h3>
                <button type="button" onClick={cerrarModalPedido}>×</button>
              </div>

              <label>
                Cliente
                <input
                  value={pedidoForm.cliente_nombre}
                  onChange={(e) => setPedidoForm({ ...pedidoForm, cliente_nombre: e.target.value })}
                />
              </label>

              <label>
                Teléfono
                <input
                  value={pedidoForm.telefono}
                  onChange={(e) => setPedidoForm({ ...pedidoForm, telefono: e.target.value })}
                />
              </label>

              <label>
                Dirección
                <input
                  value={pedidoForm.direccion}
                  onChange={(e) => setPedidoForm({ ...pedidoForm, direccion: e.target.value })}
                />
              </label>

              <label>
                Horario
                <input
                  value={pedidoForm.horario_entrega}
                  onChange={(e) => setPedidoForm({ ...pedidoForm, horario_entrega: e.target.value })}
                />
              </label>

              <label>
                Costo de envío
                <input
                  type="number"
                  min="0"
                  value={pedidoForm.costo_envio}
                  onChange={(e) => setPedidoForm({ ...pedidoForm, costo_envio: e.target.value })}
                />
              </label>

              <label>
                Observaciones
                <textarea
                  value={pedidoForm.observaciones}
                  onChange={(e) => setPedidoForm({ ...pedidoForm, observaciones: e.target.value })}
                />
              </label>

              <div className="pedido-modal-items">
                <h4>Productos</h4>

                {pedidoItemsEditando.map((item) => (
                  <div key={item.temp_id} className="pedido-item-editable">
                    <div className="pedido-item-cantidad">
                      <button type="button" onClick={() => restarCantidadItem(item.temp_id)}>
                        -
                      </button>

                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizarItemPedido(item.temp_id, {
                            cantidad: Number(e.target.value || 1),
                          })
                        }
                      />

                      <button type="button" onClick={() => sumarCantidadItem(item.temp_id)}>
                        +
                      </button>
                    </div>

                    <div className="pedido-item-datos">
                      <input
                        value={item.nombre_producto}
                        onChange={(e) =>
                          actualizarItemPedido(item.temp_id, {
                            nombre_producto: e.target.value,
                          })
                        }
                      />

                      <input
                        type="number"
                        min="0"
                        value={item.precio_unitario}
                        onChange={(e) =>
                          actualizarItemPedido(item.temp_id, {
                            precio_unitario: Number(e.target.value || 0),
                          })
                        }
                      />

                      <input
                        placeholder="Observación del producto"
                        value={item.observaciones || ""}
                        onChange={(e) =>
                          actualizarItemPedido(item.temp_id, {
                            observaciones: e.target.value,
                          })
                        }
                      />

                      <strong>
                        Subtotal: ${formatMoney(
                          Number(item.precio_unitario || 0) * Number(item.cantidad || 0)
                        )}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="pedido-item-eliminar"
                      onClick={() => eliminarItemPedido(item.temp_id)}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}

                <div className="agregar-producto-pedido">
                  <select
                    value={platoAgregarPedidoId}
                    onChange={(e) => setPlatoAgregarPedidoId(e.target.value)}
                  >
                    <option value="">Agregar producto</option>
                    {platos.map((plato) => (
                      <option key={plato.id} value={plato.id}>
                        {plato.nombre} - ${formatMoney(plato.precio)}
                      </option>
                    ))}
                  </select>

                  <button type="button" onClick={agregarProductoAlPedido}>
                    Agregar
                  </button>
                </div>

                <div className="pedido-modal-totales">
                  <p>Subtotal: ${formatMoney(subtotalPedidoEditando)}</p>
                  <p>Envío: ${formatMoney(pedidoForm.costo_envio)}</p>
                  <strong>Total: ${formatMoney(totalPedidoEditando)}</strong>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={guardarEdicionPedido}>Guardar cambios</button>
                <button type="button" onClick={cerrarModalPedido}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}


// =====================================================
// Admin: pedidos Kanban
// =====================================================

function AdminPedidosPanel({ pedidos, cambiarEstadoPedido, editarPedido, agregarEnvioPedido }) {
  const [mostrarEntregados, setMostrarEntregados] = useState(false);
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const [pedidoDetalleId, setPedidoDetalleId] = useState(null);

  const pedidosPendientes = pedidos.filter(
    (p) => p.estado === "pendiente_confirmacion"
  );

  const pedidosPreparacion = pedidos.filter(
    (p) => p.estado === "en_preparacion"
  );

  const pedidosEnCamino = pedidos.filter(
    (p) => p.estado === "en_camino"
  );

  const pedidosEntregados = pedidos.filter(
    (p) => p.estado === "entregado"
  );

  const pedidosCancelados = pedidos.filter(
    (p) => p.estado === "cancelado"
  );

  function PedidoCard({ pedido, children, compacto = false }) {
    const abierto = pedidoDetalleId === pedido.id;

    if (compacto && !abierto) {
      return (
        <button
          type="button"
          className="pedido-card pedido-card-compacta"
          onClick={() => setPedidoDetalleId(pedido.id)}
        >
          <strong>#{pedido.codigo}</strong>
          <span>{pedido.cliente_nombre}</span>
          <span>${formatMoney(pedido.total)}</span>
        </button>
      );
    }

    return (
      <div className={`pedido-card ${compacto ? "pedido-card-abierta" : ""}`}>
        <div className="pedido-card-header">
          <strong>#{pedido.codigo}</strong>
          {compacto && (
            <button type="button" onClick={() => setPedidoDetalleId(null)}>
              Minimizar
            </button>
          )}
        </div>

        <p>{pedido.cliente_nombre}</p>
        <small>{pedido.telefono}</small>
        <small>{pedido.direccion}</small>
        <small>Horario: {pedido.horario_entrega}</small>

        {pedido.observaciones && <small>Obs: {pedido.observaciones}</small>}

        {pedido.items?.map((item) => (
          <div key={item.id} className="pedido-item-mini">
            {item.cantidad}x {item.nombre_producto}
          </div>
        ))}

        {Number(pedido.costo_envio || 0) > 0 && (
          <small>Envío: ${formatMoney(pedido.costo_envio)}</small>
        )}

        <p><strong>Total: ${formatMoney(pedido.total)}</strong></p>

        {!compacto && (
          <>
            <button type="button" onClick={() => editarPedido(pedido)}>
              Editar
            </button>

            <button type="button" onClick={() => agregarEnvioPedido(pedido)}>
              {Number(pedido.costo_envio || 0) > 0 ? "Editar envío" : "Agregar envío"}
            </button>
          </>
        )}

        <div className="pedido-actions">
          {children}
        </div>
      </div>
    );
  }

  return (
    <section className="admin-section pedidos-section">
      <h2>Pedidos</h2>

      <div className="kanban">
        <div className="kanban-column">
          <h3>Pendientes</h3>

          {pedidosPendientes.map((pedido) => (
            <PedidoCard key={pedido.id} pedido={pedido}>
              <button onClick={() => cambiarEstadoPedido(pedido.id, "en_preparacion")}>
                Confirmar
              </button>

              <button onClick={() => cambiarEstadoPedido(pedido.id, "cancelado")}>
                Cancelar
              </button>
            </PedidoCard>
          ))}
        </div>

        <div className="kanban-column">
          <h3>Preparación</h3>

          {pedidosPreparacion.map((pedido) => (
            <PedidoCard key={pedido.id} pedido={pedido}>
              <button onClick={() => cambiarEstadoPedido(pedido.id, "en_camino")}>
                Pedido salió
              </button>

              <button onClick={() => cambiarEstadoPedido(pedido.id, "cancelado")}>
                Cancelar
              </button>
            </PedidoCard>
          ))}
        </div>

        <div className="kanban-column">
          <h3>En camino</h3>

          {pedidosEnCamino.map((pedido) => (
            <PedidoCard key={pedido.id} pedido={pedido}>
              <button onClick={() => cambiarEstadoPedido(pedido.id, "entregado")}>
                Entregado
              </button>
            </PedidoCard>
          ))}
        </div>

        <div className="kanban-column">
          <button
            type="button"
            className="column-toggle"
            onClick={() => setMostrarEntregados((v) => !v)}
          >
            <span>Entregados </span>
            <strong>{pedidosEntregados.length}</strong>
            <span>{mostrarEntregados ? " Ocultar" : " Ver"}</span>
          </button>

          {mostrarEntregados && pedidosEntregados.map((pedido) => (
            <PedidoCard key={pedido.id} pedido={pedido} compacto />
          ))}
        </div>

        <div className="kanban-column">
          <button
            type="button"
            className="column-toggle"
            onClick={() => setMostrarCancelados((v) => !v)}
          >
            <span>Cancelados </span>
            <strong>{pedidosCancelados.length}</strong>
            <span>{mostrarCancelados ? " Ocultar" : " Ver"}</span>
          </button>

          {mostrarCancelados && pedidosCancelados.map((pedido) => (
            <PedidoCard key={pedido.id} pedido={pedido} compacto />
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================
// Admin: configuración del local
// =====================================================

function AdminConfigLocal({
  mostrar,
  setMostrar,
  configLocal,
  setConfigLocal,
  guardarConfigLocal,
}) {
  return (
    <section className="admin-section">
      <button className="admin-toggle" onClick={() => setMostrar(!mostrar)}>
        Configuración del local {mostrar ? "▲" : "▼"}
      </button>

      {mostrar && (
        <div className="admin-form">
          <input
            placeholder="Nombre del local"
            value={configLocal.nombre}
            onChange={(e) =>
              setConfigLocal({
                ...configLocal,
                nombre: e.target.value,
              })
            }
          />

          <input
            placeholder="WhatsApp. Ej: 5493816796196"
            value={configLocal.whatsapp}
            onChange={(e) =>
              setConfigLocal({
                ...configLocal,
                whatsapp: e.target.value,
              })
            }
          />

          <input
            placeholder="URL del logo"
            value={configLocal.logo_url}
            onChange={(e) =>
              setConfigLocal({
                ...configLocal,
                logo_url: e.target.value,
              })
            }
          />

          <input
            type="color"
            title="Color principal"
            value={configLocal.color_primario}
            onChange={(e) =>
              setConfigLocal({
                ...configLocal,
                color_primario: e.target.value,
              })
            }
          />


          <input
            type="number"
            min="0"
            placeholder="Costo de envío fijo"
            value={configLocal.costo_envio_fijo}
            onChange={(e) =>
              setConfigLocal({
                ...configLocal,
                costo_envio_fijo: e.target.value,
              })
            }
          />

          <label className="check-admin">
            <input
              type="checkbox"
              checked={configLocal.activo}
              onChange={(e) =>
                setConfigLocal({
                  ...configLocal,
                  activo: e.target.checked,
                })
              }
            />
            Local activo
          </label>

          {configLocal.logo_url && (
            <div className="logo-preview-admin">
              <img src={configLocal.logo_url} alt="Logo preview" />
            </div>
          )}

          <button onClick={guardarConfigLocal}>Guardar configuración</button>
        </div>
      )}
    </section>
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
