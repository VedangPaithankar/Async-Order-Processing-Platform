import { useEffect, useMemo, useState } from "react";
import api from "./services/api";
import "./App.css";

const formatINR = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const statusLabels = {
  RECEIVED: "Received",
  QUEUED: "Queued",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  COMPLETED: "Completed",
  FAILED: "Needs attention",
};

const paymentOptions = [
  { id: "UPI_GPAY", label: "GPay", helper: "UPI intent" },
  { id: "UPI_PHONEPE", label: "PhonePe", helper: "UPI intent" },
  { id: "UPI_PAYTM", label: "Paytm", helper: "UPI intent" },
  { id: "CARD", label: "Card", helper: "Credit / debit" },
  { id: "CASH_AT_COUNTER", label: "Counter", helper: "Pay on pickup" },
];

const statusSteps = [
  "RECEIVED",
  "QUEUED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

const architectureSteps = [
  {
    title: "React Ordering UI",
    body: "Customer chooses menu items, modifiers, fulfillment, and UPI-first payment option.",
  },
  {
    title: "JWT Protected API",
    body: "Express verifies the token, attaches userId, and accepts only authenticated checkouts.",
  },
  {
    title: "PostgreSQL Source of Truth",
    body: "Order, line items, totals, GST, tip, payment method, and status are stored first.",
  },
  {
    title: "BullMQ Queue on Redis",
    body: "The API publishes a preparation job and returns quickly instead of blocking the request.",
  },
  {
    title: "Cafe Worker",
    body: "The worker moves the order through queued, preparing, and ready with retries and DLQ support.",
  },
  {
    title: "Customer Tracking",
    body: "The tracking page polls order status and lets the customer mark the order picked up.",
  },
];

const defaultModifierIds = {
  size: "12oz",
  milk: "regular",
  espresso: "standard",
  sweetener: "white-sugar",
  addons: [],
};

function findOption(options, group, id) {
  return options[group]?.find((option) => option.id === id);
}

function buildDefaultModifiers(options) {
  return {
    size: findOption(options, "size", defaultModifierIds.size),
    milk: findOption(options, "milk", defaultModifierIds.milk),
    espresso: findOption(options, "espresso", defaultModifierIds.espresso),
    sweetener: findOption(options, "sweetener", defaultModifierIds.sweetener),
    addons: [],
  };
}

function getModifierPrice(modifiers) {
  if (!modifiers) {
    return 0;
  }

  return (
    (modifiers.size?.price || 0) +
    (modifiers.milk?.price || 0) +
    (modifiers.espresso?.price || 0) +
    (modifiers.sweetener?.price || 0) +
    (modifiers.addons || []).reduce((sum, addon) => sum + addon.price, 0)
  );
}

function modifierSummary(modifiers) {
  if (!modifiers || Object.keys(modifiers).length === 0) {
    return "No customizations";
  }

  const parts = [
    modifiers.size?.label,
    modifiers.milk?.label,
    modifiers.espresso?.label,
    modifiers.sweetener?.label,
    ...(modifiers.addons || []).map((addon) => addon.label),
  ].filter(Boolean);

  return parts.join(", ");
}

function App() {
  const [menu, setMenu] = useState({
    categories: [],
    items: [],
    modifierOptions: {},
  });
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem("brewflow-cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [fulfillment, setFulfillment] = useState("PICKUP");
  const [paymentMethod, setPaymentMethod] = useState("UPI_GPAY");
  const [tip, setTip] = useState(0);
  const [auth, setAuth] = useState(() => {
    const savedAuth = localStorage.getItem("brewflow-auth");
    return savedAuth ? JSON.parse(savedAuth) : null;
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [orders, setOrders] = useState([]);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [view, setView] = useState("home");
  const [customer, setCustomer] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    notes: "",
  });
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPrototypeNotice, setShowPrototypeNotice] = useState(
    () => !localStorage.getItem("brewflow-prototype-notice-dismissed"),
  );

  const dismissPrototypeNotice = () => {
    localStorage.setItem("brewflow-prototype-notice-dismissed", "true");
    setShowPrototypeNotice(false);
  };

  useEffect(() => {
    api
      .get("/menu")
      .then((response) => {
        setMenu(response.data);
        setActiveCategory(response.data.categories[0]?.id || "all");
      })
      .catch(() => {
        setError("Menu is temporarily unavailable. Please try again.");
      });
  }, []);

  useEffect(() => {
    localStorage.setItem("brewflow-cart", JSON.stringify(cart));
  }, [cart]);

  const loadOrderHistory = async () => {
    if (!auth?.token) {
      setOrders([]);
      return;
    }

    const response = await api.get("/orders/mine");
    setOrders(response.data);
  };

  useEffect(() => {
    if (!confirmation?.id) {
      return undefined;
    }

    const intervalId = setInterval(async () => {
      const response = await api.get(`/orders/${confirmation.id}`);
      setConfirmation(response.data);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [confirmation?.id]);

  useEffect(() => {
    if (!trackingOrder?.id || view !== "tracking") {
      return undefined;
    }

    const intervalId = setInterval(async () => {
      const response = await api.get(`/orders/${trackingOrder.id}`);
      setTrackingOrder(response.data);
      setConfirmation(response.data);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [trackingOrder?.id, view]);

  const featuredItems = useMemo(
    () => menu.items.filter((item) => item.featured).slice(0, 3),
    [menu.items],
  );

  const visibleItems = useMemo(() => {
    if (activeCategory === "all") {
      return menu.items;
    }

    return menu.items.filter((item) => item.categoryId === activeCategory);
  }, [activeCategory, menu.items]);

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.lineTotal, 0),
    [cart],
  );
  const gst = Math.round(cartSubtotal * 0.05);
  const deliveryFee = fulfillment === "DELIVERY" ? 40 : 0;
  const total = cartSubtotal + gst + Number(tip || 0) + deliveryFee;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const saveAuth = (authResult) => {
    localStorage.setItem("token", authResult.token);
    localStorage.setItem("brewflow-auth", JSON.stringify(authResult));
    setAuth(authResult);
    setAuthOpen(false);
    setAuthError("");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("brewflow-auth");
    setAuth(null);
    setOrders([]);
    setView("home");
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthError("");

    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/signup";
      const payload =
        authMode === "login"
          ? {
              email: authForm.email,
              password: authForm.password,
            }
          : authForm;

      const response = await api.post(endpoint, payload);
      saveAuth(response.data);
      setCustomer((current) => ({
        ...current,
        customerName: response.data.user.name || current.customerName,
        customerEmail: response.data.user.email || current.customerEmail,
      }));
    } catch (err) {
      setAuthError(
        err.response?.data?.message ||
          "Authentication failed. Please check your details.",
      );
    }
  };

  const openCheckout = () => {
    if (!auth?.token) {
      setAuthMode("login");
      setAuthOpen(true);
      setError("Please login before checkout so we can save your order history.");
      return;
    }

    setError("");
    setCheckoutOpen(true);
  };

  const openTrackingPage = (order) => {
    setTrackingOrder(order);
    setConfirmation(order);
    setView("tracking");
    setCartOpen(false);
    setCheckoutOpen(false);
  };

  const markPickedUp = async () => {
    if (!trackingOrder?.id) {
      return;
    }

    try {
      const response = await api.patch(`/orders/${trackingOrder.id}/pickup`);
      setTrackingOrder(response.data);
      setConfirmation(response.data);
      await loadOrderHistory();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not mark this order as picked up yet.",
      );
    }
  };

  const openItem = (item) => {
    setSelectedItem(item);
    setSelectedModifiers(
      item.customizable
        ? buildDefaultModifiers(menu.modifierOptions)
        : { addons: [] },
    );
  };

  const updateModifier = (group, option) => {
    setSelectedModifiers((current) => ({
      ...current,
      [group]: option,
    }));
  };

  const toggleAddon = (addon) => {
    setSelectedModifiers((current) => {
      const addons = current.addons || [];
      const exists = addons.some((item) => item.id === addon.id);

      return {
        ...current,
        addons: exists
          ? addons.filter((item) => item.id !== addon.id)
          : [...addons, addon],
      };
    });
  };

  const addToCart = (item = selectedItem, modifiers = selectedModifiers) => {
    if (!item) {
      return;
    }

    const unitPrice = item.price + getModifierPrice(modifiers);
    const cartItem = {
      cartId: `${item.id}-${Date.now()}`,
      menuItemId: item.id,
      name: item.name,
      image: item.image,
      quantity: 1,
      unitPrice,
      lineTotal: unitPrice,
      modifiers: item.customizable ? modifiers : {},
    };

    setCart((current) => [...current, cartItem]);
    setSelectedItem(null);
    setCartOpen(true);
  };

  const updateQuantity = (cartId, direction) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.cartId !== cartId) {
            return item;
          }

          const quantity = Math.max(0, item.quantity + direction);
          return {
            ...item,
            quantity,
            lineTotal: item.unitPrice * quantity,
          };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const submitOrder = async (event) => {
    event.preventDefault();

    if (!auth?.token) {
      setCheckoutOpen(false);
      setAuthMode("login");
      setAuthOpen(true);
      setError("Please login before placing your order.");
      return;
    }

    if (cart.length === 0) {
      setError("Add at least one item before checkout.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        ...customer,
        fulfillment,
        paymentMethod,
        tip: Number(tip || 0),
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          modifiers: item.modifiers?.size
            ? {
                size: item.modifiers.size.id,
                milk: item.modifiers.milk.id,
                espresso: item.modifiers.espresso.id,
                sweetener: item.modifiers.sweetener.id,
                addons: item.modifiers.addons.map((addon) => addon.id),
              }
            : {},
        })),
      };

      const response = await api.post("/orders", payload);
      setConfirmation(response.data);
      setTrackingOrder(response.data);
      setView("tracking");
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
      await loadOrderHistory();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not place the order. Please check your details.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#2A1B18]">
      {showPrototypeNotice && (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-4">
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-sm sm:rounded-lg">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#BF5F45]">
              Heads up
            </p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-[#3E2723]">
              This is a learning prototype
            </h2>
            <p className="mt-3 text-sm text-[#5D4037]">
              BrewFlow is a portfolio project built to demonstrate backend
              architecture — queues, workers, retries, and a real cloud
              deployment. It's not a real cafe, and no real payments are
              processed.
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <a
                className="text-sm font-bold text-[#5D4037] underline underline-offset-2"
                href="https://github.com/VedangPaithankar/Async-Order-Processing-Platform"
                rel="noreferrer"
                target="_blank"
              >
                View the code
              </a>
              <button
                className="rounded-full bg-[#3E2723] px-5 py-2 text-sm font-bold text-white"
                onClick={dismissPrototypeNotice}
                type="button"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-[#eaded9] bg-[#FAFAFA]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a className="font-serif text-xl font-bold text-[#3E2723]" href="#home">
            BrewFlow
          </a>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#5D4037] md:flex">
            <button
              onClick={() => setView("home")}
              type="button"
            >
              Home
            </button>
            <a href="#menu">Menu</a>
            <a href="#story">Our Story</a>
            <a href="#locations">Locations</a>
            {auth && (
              <button
                onClick={() => {
                  setView("history");
                  loadOrderHistory();
                }}
                type="button"
              >
                Order History
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {auth ? (
              <button
                className="hidden rounded-full border border-[#D7CCC8] px-3 py-2 text-sm font-bold text-[#3E2723] sm:block"
                onClick={logout}
                type="button"
              >
                Logout
              </button>
            ) : (
              <button
                className="hidden rounded-full border border-[#D7CCC8] px-3 py-2 text-sm font-bold text-[#3E2723] sm:block"
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
                type="button"
              >
                Login
              </button>
            )}

            <button
              className="relative rounded-full bg-[#3E2723] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#2A1B18]"
              onClick={() => setCartOpen(true)}
              type="button"
            >
              Cart
              <span className="ml-2 rounded-full bg-[#FF8A65] px-2 py-0.5 text-xs text-[#2A1B18]">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {view === "tracking" && trackingOrder ? (
        <TrackingPage
          error={error}
          formatINR={formatINR}
          markPickedUp={markPickedUp}
          order={trackingOrder}
          setView={setView}
          statusLabels={statusLabels}
        />
      ) : view === "history" ? (
        <HistoryPage
          formatINR={formatINR}
          openTrackingPage={openTrackingPage}
          orders={orders}
          setAuthMode={setAuthMode}
          setAuthOpen={setAuthOpen}
          setView={setView}
          user={auth?.user}
        />
      ) : (
        <>
      <section
        className="relative overflow-hidden bg-[#3E2723] text-white"
        id="home"
      >
        <img
          alt="Spiced jaggery latte at BrewFlow"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          src="/menu-images/spiced-jaggery-latte.png"
        />
        <div className="relative mx-auto grid min-h-[86vh] max-w-7xl content-end px-4 pb-12 pt-24 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-[#FFCCBC]">
              Chikmagalur arabica, brewed for India
            </p>
            <h1 className="font-serif text-5xl font-black leading-tight sm:text-6xl lg:text-7xl">
              Crafted Caffeine, Roasted for You.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#FBE9E7]">
              Skip the line. Order ahead for pickup or get it delivered fresh
              with UPI-first checkout.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="rounded-full bg-[#FF8A65] px-6 py-3 font-bold text-[#2A1B18] shadow-lg transition hover:bg-[#ff7043]"
                href="#menu"
              >
                Start Your Order
              </a>
              <a
                className="rounded-full border border-white/60 px-6 py-3 font-bold text-white transition hover:bg-white/10"
                href="#story"
              >
                Explore the cafe
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#BF5F45]">
              Customer favourites
            </p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-[#3E2723]">
              Fresh picks for today
            </h2>
          </div>
          <button
            className="hidden rounded-full border border-[#D7CCC8] px-4 py-2 text-sm font-bold text-[#3E2723] sm:block"
            onClick={() => setCartOpen(true)}
            type="button"
          >
            Review cart
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {featuredItems.map((item) => (
            <article
              className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#eaded9]"
              key={item.id}
            >
              <img
                alt={item.name}
                className="h-48 w-full object-cover"
                src={item.image}
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-xl font-bold text-[#3E2723]">
                    {item.name}
                  </h3>
                  <span className="font-bold text-[#BF5F45]">
                    {formatINR(item.price)}
                  </span>
                </div>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[#6D4C41]">
                  {item.description}
                </p>
                <button
                  className="mt-4 w-full rounded-full bg-[#3E2723] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2A1B18]"
                  onClick={() => openItem(item)}
                  type="button"
                >
                  Add to order
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="border-y border-[#eaded9] bg-[#F7F0ED] py-12"
        id="menu"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#BF5F45]">
              Order online
            </p>
            <h2 className="mt-2 font-serif text-4xl font-bold text-[#3E2723]">
              Menu built for pickup, delivery, and quick cravings
            </h2>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-4">
            {menu.categories.map((category) => (
              <button
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                  activeCategory === category.id
                    ? "bg-[#3E2723] text-white"
                    : "bg-white text-[#5D4037] ring-1 ring-[#eaded9]"
                }`}
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-[#FFAB91] bg-[#FBE9E7] px-4 py-3 text-sm font-semibold text-[#8D3E2F]">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <article
                className="grid min-h-44 grid-cols-[116px_1fr] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#eaded9]"
                key={item.id}
              >
                <img
                  alt={item.name}
                  className="h-full min-h-44 w-full object-cover"
                  src={item.image}
                />
                <div className="flex min-w-0 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-serif text-lg font-bold leading-6 text-[#3E2723]">
                      {item.name}
                    </h3>
                    <span className="shrink-0 text-sm font-black text-[#BF5F45]">
                      {formatINR(item.price)}
                    </span>
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[#6D4C41]">
                    {item.description}
                  </p>
                  <button
                    className="mt-4 rounded-full bg-[#FF8A65] px-4 py-2 text-sm font-black text-[#2A1B18] transition hover:bg-[#ff7043]"
                    onClick={() => openItem(item)}
                    type="button"
                  >
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8"
        id="story"
      >
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#BF5F45]">
            Our story
          </p>
          <h2 className="mt-2 font-serif text-4xl font-bold text-[#3E2723]">
            Western specialty technique, Indian comfort flavours.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#5D4037]">
            BrewFlow serves 100% Arabica espresso sourced from
            Chikmagalur, then pairs it with local signatures like jaggery,
            cardamom, tender coconut, saffron chai, and bakery favourites.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <img
            alt="Tender coconut cold brew"
            className="h-56 w-full rounded-lg object-cover"
            src="/menu-images/tender-coconut-cold-brew.png"
          />
          <img
            alt="Gulab jamun cheesecake"
            className="h-56 w-full rounded-lg object-cover sm:mt-10"
            src="/menu-images/gulab-jamun-cheesecake.png"
          />
        </div>
      </section>

      <section className="bg-[#3E2723] px-4 py-12 text-white" id="locations">
        <div className="mx-auto grid max-w-7xl gap-6 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            ["Bandra", "8:00 AM - 11:00 PM", "Linking Road, Mumbai"],
            ["Koregaon Park", "7:30 AM - 10:30 PM", "Lane 6, Pune"],
            ["Indiranagar", "8:00 AM - 11:30 PM", "12th Main, Bengaluru"],
          ].map(([area, hours, address]) => (
            <div
              className="rounded-lg border border-white/15 bg-white/8 p-5"
              key={area}
            >
              <h3 className="font-serif text-2xl font-bold">{area}</h3>
              <p className="mt-2 text-[#FFCCBC]">{hours}</p>
              <p className="mt-4 text-sm leading-6 text-[#FBE9E7]">{address}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#2A1B18] px-4 py-8 text-sm text-[#D7CCC8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-serif text-xl font-bold text-white">
            BrewFlow
          </p>
          <p>Join the Mug Club for roast drops, tasting notes, and cafe offers.</p>
        </div>
      </footer>
        </>
      )}

      {authOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-4">
          <form
            className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-lg"
            onSubmit={submitAuth}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#BF5F45]">
                  BrewFlow account
                </p>
                <h2 className="mt-1 font-serif text-3xl font-bold text-[#3E2723]">
                  {authMode === "login" ? "Login" : "Create account"}
                </h2>
              </div>
              <button
                className="rounded-full border border-[#D7CCC8] px-3 py-1 text-sm font-bold"
                onClick={() => setAuthOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-[#F7F0ED] p-1">
              {["login", "signup"].map((mode) => (
                <button
                  className={`rounded-full px-3 py-2 text-sm font-black ${
                    authMode === mode
                      ? "bg-[#3E2723] text-white"
                      : "text-[#5D4037]"
                  }`}
                  key={mode}
                  onClick={() => {
                    setAuthMode(mode);
                    setAuthError("");
                  }}
                  type="button"
                >
                  {mode === "login" ? "Login" : "Signup"}
                </button>
              ))}
            </div>

            {authMode === "signup" && (
              <input
                className="mb-3 w-full rounded-lg border border-[#D7CCC8] px-4 py-3"
                onChange={(event) =>
                  setAuthForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Name"
                required
                value={authForm.name}
              />
            )}
            <input
              className="mb-3 w-full rounded-lg border border-[#D7CCC8] px-4 py-3"
              onChange={(event) =>
                setAuthForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="Email"
              required
              type="email"
              value={authForm.email}
            />
            <input
              className="mb-3 w-full rounded-lg border border-[#D7CCC8] px-4 py-3"
              onChange={(event) =>
                setAuthForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Password"
              required
              type="password"
              value={authForm.password}
            />

            {authError && (
              <p className="mb-3 rounded-lg bg-[#FBE9E7] p-3 text-sm font-semibold text-[#8D3E2F]">
                {authError}
              </p>
            )}

            <button
              className="w-full rounded-full bg-[#3E2723] px-4 py-3 font-black text-white"
              type="submit"
            >
              {authMode === "login" ? "Login" : "Create account"}
            </button>
          </form>
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-lg">
            <img
              alt={selectedItem.name}
              className="h-56 w-full object-cover"
              src={selectedItem.image}
            />
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-3xl font-bold text-[#3E2723]">
                    {selectedItem.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#6D4C41]">
                    {selectedItem.description}
                  </p>
                </div>
                <button
                  className="rounded-full border border-[#D7CCC8] px-3 py-1 text-sm font-bold"
                  onClick={() => setSelectedItem(null)}
                  type="button"
                >
                  Close
                </button>
              </div>

              {selectedItem.customizable ? (
                <div className="mt-5 space-y-5">
                  {["size", "milk", "espresso", "sweetener"].map((group) => (
                    <div key={group}>
                      <p className="mb-2 text-sm font-black uppercase tracking-[0.14em] text-[#8D6E63]">
                        {group}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {menu.modifierOptions[group]?.map((option) => (
                          <button
                            className={`rounded-full px-3 py-2 text-sm font-bold ring-1 ring-[#eaded9] ${
                              selectedModifiers?.[group]?.id === option.id
                                ? "bg-[#3E2723] text-white"
                                : "bg-[#FAFAFA] text-[#5D4037]"
                            }`}
                            key={option.id}
                            onClick={() => updateModifier(group, option)}
                            type="button"
                          >
                            {option.label}
                            {option.price > 0 ? ` +${formatINR(option.price)}` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div>
                    <p className="mb-2 text-sm font-black uppercase tracking-[0.14em] text-[#8D6E63]">
                      Add-ons
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {menu.modifierOptions.addons?.map((addon) => {
                        const active = selectedModifiers?.addons?.some(
                          (item) => item.id === addon.id,
                        );

                        return (
                          <button
                            className={`rounded-full px-3 py-2 text-sm font-bold ring-1 ring-[#eaded9] ${
                              active
                                ? "bg-[#FF8A65] text-[#2A1B18]"
                                : "bg-[#FAFAFA] text-[#5D4037]"
                            }`}
                            key={addon.id}
                            onClick={() => toggleAddon(addon)}
                            type="button"
                          >
                            {addon.label} +{formatINR(addon.price)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-5 rounded-lg bg-[#F7F0ED] p-4 text-sm font-semibold text-[#5D4037]">
                  Fresh from the counter. No customization needed.
                </p>
              )}

              <button
                className="mt-6 w-full rounded-full bg-[#3E2723] px-5 py-3 font-black text-white"
                onClick={() => addToCart()}
                type="button"
              >
                Add to Cart -{" "}
                {formatINR(
                  selectedItem.price + getModifierPrice(selectedModifiers),
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <aside className="fixed inset-0 z-40 flex justify-end bg-black/40">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#eaded9] p-4">
              <h2 className="font-serif text-2xl font-bold text-[#3E2723]">
                Your Cart
              </h2>
              <button
                className="rounded-full border border-[#D7CCC8] px-3 py-1 text-sm font-bold"
                onClick={() => setCartOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {cart.length === 0 ? (
                <p className="rounded-lg bg-[#F7F0ED] p-4 text-sm font-semibold text-[#5D4037]">
                  Your cart is empty. Add a latte, brownie, or something with
                  cardamom.
                </p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-[#eaded9] p-3"
                      key={item.cartId}
                    >
                      <img
                        alt={item.name}
                        className="h-20 w-20 rounded-md object-cover"
                        src={item.image}
                      />
                      <div>
                        <div className="flex justify-between gap-3">
                          <h3 className="font-bold text-[#3E2723]">
                            {item.name}
                          </h3>
                          <p className="font-black text-[#BF5F45]">
                            {formatINR(item.lineTotal)}
                          </p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#6D4C41]">
                          {modifierSummary(item.modifiers)}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            className="h-8 w-8 rounded-full border border-[#D7CCC8] font-black"
                            onClick={() => updateQuantity(item.cartId, -1)}
                            type="button"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold">
                            {item.quantity}
                          </span>
                          <button
                            className="h-8 w-8 rounded-full border border-[#D7CCC8] font-black"
                            onClick={() => updateQuantity(item.cartId, 1)}
                            type="button"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[#eaded9] p-4">
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-[#F7F0ED] p-1">
                {["PICKUP", "DELIVERY"].map((option) => (
                  <button
                    className={`rounded-full px-3 py-2 text-sm font-black ${
                      fulfillment === option
                        ? "bg-[#3E2723] text-white"
                        : "text-[#5D4037]"
                    }`}
                    key={option}
                    onClick={() => setFulfillment(option)}
                    type="button"
                  >
                    {option === "PICKUP" ? "Pickup" : "Delivery"}
                  </button>
                ))}
              </div>

              <div className="space-y-2 text-sm text-[#5D4037]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <strong>{formatINR(cartSubtotal)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>GST 5%</span>
                  <strong>{formatINR(gst)}</strong>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <strong>{formatINR(deliveryFee)}</strong>
                  </div>
                )}
                <div className="flex justify-between text-lg text-[#3E2723]">
                  <span className="font-black">Total</span>
                  <strong>{formatINR(total)}</strong>
                </div>
              </div>

              <button
                className="mt-4 w-full rounded-full bg-[#FF8A65] px-4 py-3 font-black text-[#2A1B18] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cart.length === 0}
                onClick={openCheckout}
                type="button"
              >
                Checkout
              </button>
            </div>
          </div>
        </aside>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 sm:place-items-center">
          <form
            className="max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-3xl sm:rounded-lg"
            onSubmit={submitOrder}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-3xl font-bold text-[#3E2723]">
                  Checkout
                </h2>
                <p className="mt-1 text-sm text-[#6D4C41]">
                  UPI options are first so ordering feels natural in India.
                </p>
              </div>
              <button
                className="rounded-full border border-[#D7CCC8] px-3 py-1 text-sm font-bold"
                onClick={() => setCheckoutOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="rounded-lg border border-[#D7CCC8] px-4 py-3"
                    onChange={(event) =>
                      setCustomer((current) => ({
                        ...current,
                        customerName: event.target.value,
                      }))
                    }
                    placeholder="Name"
                    required
                    value={customer.customerName}
                  />
                  <input
                    className="rounded-lg border border-[#D7CCC8] px-4 py-3"
                    inputMode="numeric"
                    maxLength={10}
                    onChange={(event) =>
                      setCustomer((current) => ({
                        ...current,
                        customerPhone: event.target.value,
                      }))
                    }
                    placeholder="10 digit phone"
                    required
                    value={customer.customerPhone}
                  />
                </div>
                <input
                  className="w-full rounded-lg border border-[#D7CCC8] px-4 py-3"
                  onChange={(event) =>
                    setCustomer((current) => ({
                      ...current,
                      customerEmail: event.target.value,
                    }))
                  }
                  placeholder="Email for receipt"
                  type="email"
                  value={customer.customerEmail}
                />

                <div>
                  <p className="mb-2 text-sm font-black uppercase tracking-[0.14em] text-[#8D6E63]">
                    Payment
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {paymentOptions.map((option) => (
                      <button
                        className={`rounded-lg border px-3 py-3 text-left ${
                          paymentMethod === option.id
                            ? "border-[#FF8A65] bg-[#FBE9E7]"
                            : "border-[#D7CCC8] bg-white"
                        }`}
                        key={option.id}
                        onClick={() => setPaymentMethod(option.id)}
                        type="button"
                      >
                        <span className="block font-black text-[#3E2723]">
                          {option.label}
                        </span>
                        <span className="text-xs text-[#6D4C41]">
                          {option.helper}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-black uppercase tracking-[0.14em] text-[#8D6E63]">
                    Barista tip
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[0, 10, 20, 50].map((amount) => (
                      <button
                        className={`rounded-full px-4 py-2 text-sm font-black ${
                          Number(tip) === amount
                            ? "bg-[#3E2723] text-white"
                            : "bg-[#F7F0ED] text-[#5D4037]"
                        }`}
                        key={amount}
                        onClick={() => setTip(amount)}
                        type="button"
                      >
                        {amount === 0 ? "No tip" : formatINR(amount)}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  className="min-h-24 w-full rounded-lg border border-[#D7CCC8] px-4 py-3"
                  onChange={(event) =>
                    setCustomer((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Pickup/delivery notes, e.g. bring it to my car"
                  value={customer.notes}
                />
              </div>

              <div className="rounded-lg bg-[#F7F0ED] p-4">
                <h3 className="font-serif text-2xl font-bold text-[#3E2723]">
                  Order summary
                </h3>
                <div className="mt-4 space-y-3">
                  {cart.map((item) => (
                    <div className="flex justify-between gap-3" key={item.cartId}>
                      <span className="text-sm text-[#5D4037]">
                        {item.quantity} x {item.name}
                      </span>
                      <strong>{formatINR(item.lineTotal)}</strong>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2 border-t border-[#D7CCC8] pt-4 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <strong>{formatINR(cartSubtotal)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>GST</span>
                    <strong>{formatINR(gst)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Tip</span>
                    <strong>{formatINR(tip)}</strong>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>Delivery</span>
                      <strong>{formatINR(deliveryFee)}</strong>
                    </div>
                  )}
                  <div className="flex justify-between text-lg text-[#3E2723]">
                    <span className="font-black">Total</span>
                    <strong>{formatINR(total)}</strong>
                  </div>
                </div>
                {error && (
                  <p className="mt-3 rounded-lg bg-[#FBE9E7] p-3 text-sm font-semibold text-[#8D3E2F]">
                    {error}
                  </p>
                )}
                <button
                  className="mt-4 w-full rounded-full bg-[#3E2723] px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "Placing order..." : `Place Order - ${formatINR(total)}`}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {confirmation && (
        <div className="fixed bottom-4 left-4 right-4 z-30 mx-auto max-w-xl rounded-lg border border-[#D7CCC8] bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#BF5F45]">
                Order confirmed
              </p>
              <h3 className="mt-1 font-serif text-2xl font-bold text-[#3E2723]">
                #{confirmation.id.slice(0, 8)} -{" "}
                {statusLabels[confirmation.status] || confirmation.status}
              </h3>
              <p className="mt-1 text-sm text-[#6D4C41]">
                ETA {confirmation.etaMinutes} minutes. We will keep this status
                fresh while the worker prepares your order.
              </p>
            </div>
            <button
              className="rounded-full border border-[#D7CCC8] px-3 py-1 text-sm font-bold"
              onClick={() => setConfirmation(null)}
              type="button"
            >
              Hide
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function TrackingPage({
  error,
  formatINR,
  markPickedUp,
  order,
  setView,
  statusLabels,
}) {
  const currentStepIndex = statusSteps.indexOf(order.status);
  const isReady = order.status === "READY";
  const isCompleted = order.status === "COMPLETED";

  return (
    <section className="bg-[#FAFAFA] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#BF5F45]">
              Live order tracking
            </p>
            <h1 className="mt-2 font-serif text-4xl font-black text-[#3E2723]">
              Order #{order.id.slice(0, 8)}
            </h1>
          </div>
          <button
            className="rounded-full border border-[#D7CCC8] px-4 py-2 text-sm font-bold text-[#3E2723]"
            onClick={() => setView("home")}
            type="button"
          >
            Back to menu
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-[#eaded9]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#8D6E63]">Current status</p>
                <h2 className="mt-1 font-serif text-3xl font-bold text-[#3E2723]">
                  {statusLabels[order.status] || order.status}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6D4C41]">
                  ETA {order.etaMinutes} minutes. The worker intentionally waits
                  about 20 seconds between status changes so you can observe the
                  async queue lifecycle.
                </p>
              </div>
              <span className="rounded-full bg-[#FBE9E7] px-3 py-1 text-sm font-black text-[#BF5F45]">
                {order.fulfillment}
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {statusSteps.map((step, index) => {
                const complete = currentStepIndex >= index || isCompleted;
                const current = currentStepIndex === index && !isCompleted;

                return (
                  <div
                    className={`timeline-step flex items-center gap-3 rounded-lg p-2 ${
                      complete ? "timeline-step-complete" : ""
                    } ${current ? "timeline-step-current" : ""}`}
                    key={step}
                  >
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full text-sm font-black ${
                        complete
                          ? "bg-[#3E2723] text-white"
                          : "bg-[#F7F0ED] text-[#8D6E63]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-black text-[#3E2723]">
                        {statusLabels[step]}
                      </p>
                      <p className="text-xs text-[#6D4C41]">
                        {step === "RECEIVED" && "API accepted the checkout."}
                        {step === "QUEUED" && "BullMQ job is waiting/claimed."}
                        {step === "PREPARING" && "Worker is preparing the order."}
                        {step === "READY" && "Customer can pick up the order."}
                        {step === "COMPLETED" && "Order lifecycle is closed."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-[#FBE9E7] p-3 text-sm font-semibold text-[#8D3E2F]">
                {error}
              </p>
            )}

            <button
              className="mt-6 w-full rounded-full bg-[#FF8A65] px-4 py-3 font-black text-[#2A1B18] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isReady}
              onClick={markPickedUp}
              type="button"
            >
              {isCompleted
                ? "Order picked up"
                : isReady
                  ? "I picked up my order"
                  : "Pickup available when ready"}
            </button>
          </div>

          <div className="rounded-lg bg-[#3E2723] p-5 text-white shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#FFCCBC]">
              System design view
            </p>
            <h2 className="mt-2 font-serif text-3xl font-bold">
              What happens after checkout?
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {architectureSteps.map((step, index) => (
                <div
                  className="rounded-lg border border-white/15 bg-white/8 p-4"
                  key={step.title}
                >
                  <span className="text-sm font-black text-[#FFAB91]">
                    0{index + 1}
                  </span>
                  <h3 className="mt-2 font-serif text-xl font-bold">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#FBE9E7]">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg bg-[#2A1B18] p-4 font-mono text-xs leading-6 text-[#FBE9E7]">
              React UI -&gt; Express JWT API -&gt; PostgreSQL -&gt; BullMQ/Redis
              -&gt; Worker -&gt; status update -&gt; tracking page
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-[#eaded9]">
          <h2 className="font-serif text-2xl font-bold text-[#3E2723]">
            Order details
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {order.items?.map((item) => (
              <div
                className="rounded-lg border border-[#eaded9] p-4"
                key={item.id}
              >
                <div className="flex justify-between gap-3">
                  <p className="font-black text-[#3E2723]">
                    {item.quantity} x {item.name}
                  </p>
                  <p className="font-black text-[#BF5F45]">
                    {formatINR(item.lineTotal)}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#6D4C41]">
                  {modifierSummary(item.modifiers)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 border-t border-[#eaded9] pt-4 text-sm text-[#5D4037] sm:grid-cols-2 lg:grid-cols-5">
            <SummaryValue label="Subtotal" value={formatINR(order.subtotal)} />
            <SummaryValue label="GST" value={formatINR(order.gst)} />
            <SummaryValue label="Tip" value={formatINR(order.tip)} />
            <SummaryValue
              label="Delivery"
              value={formatINR(order.deliveryFee)}
            />
            <SummaryValue label="Total" value={formatINR(order.total)} strong />
          </div>
        </div>
      </div>
    </section>
  );
}

function HistoryPage({
  formatINR,
  openTrackingPage,
  orders,
  setAuthMode,
  setAuthOpen,
  setView,
  user,
}) {
  if (!user) {
    return (
      <section className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-4 py-12 text-center">
        <div>
          <h1 className="font-serif text-4xl font-black text-[#3E2723]">
            Login to view order history
          </h1>
          <p className="mt-3 text-[#6D4C41]">
            Your coffee trail is tied to your JWT account.
          </p>
          <button
            className="mt-6 rounded-full bg-[#3E2723] px-5 py-3 font-black text-white"
            onClick={() => {
              setAuthMode("login");
              setAuthOpen(true);
            }}
            type="button"
          >
            Login
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-[78vh] max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#BF5F45]">
            Account history
          </p>
          <h1 className="mt-2 font-serif text-4xl font-black text-[#3E2723]">
            {user.name || user.email}'s orders
          </h1>
        </div>
        <button
          className="rounded-full border border-[#D7CCC8] px-4 py-2 text-sm font-bold text-[#3E2723]"
          onClick={() => setView("home")}
          type="button"
        >
          Back to menu
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg bg-[#F7F0ED] p-6 text-[#5D4037]">
          No orders yet. Your next latte will appear here.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <article
              className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-[#eaded9]"
              key={order.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#8D6E63]">
                    #{order.id.slice(0, 8)}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-bold text-[#3E2723]">
                    {statusLabels[order.status] || order.status}
                  </h2>
                </div>
                <p className="font-black text-[#BF5F45]">
                  {formatINR(order.total)}
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#6D4C41]">
                {order.items?.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
              </p>
              <button
                className="mt-4 w-full rounded-full bg-[#3E2723] px-4 py-2.5 text-sm font-black text-white"
                onClick={() => openTrackingPage(order)}
                type="button"
              >
                Track order
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryValue({ label, value, strong = false }) {
  return (
    <div className="rounded-lg bg-[#F7F0ED] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8D6E63]">
        {label}
      </p>
      <p
        className={`mt-1 ${
          strong
            ? "text-xl font-black text-[#3E2723]"
            : "font-bold text-[#5D4037]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default App;
