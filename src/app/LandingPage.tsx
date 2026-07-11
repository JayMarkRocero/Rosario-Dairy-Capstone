import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Boxes,
  ShoppingCart,
  BarChart3,
  TrendingUp,
  Users,
  FileSpreadsheet,
  Bell,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  Milk,
  PackageCheck,
} from "lucide-react";
import { C } from "../constants/colors";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */

interface LandingPageProps {
  onLogin?: () => void;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Small count-up hook, used by the Stats section. */
function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    let raf = 0;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return value;
}

/* ------------------------------------------------------------------ */
/*  1. Navigation Bar                                                  */
/* ------------------------------------------------------------------ */

function NavBar({ onLogin }: { onLogin?: () => void }) {
  const [scrolled, setScrolled]           = useState(false);
  const [mobileOpen, setMobileOpen]       = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  const links = [
    { label: "Home", id: "home" },
    { label: "Features", id: "features" },
    { label: "About", id: "about" },
    { label: "Contact", id: "contact" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Scroll-spy: highlight whichever section is currently in view ─────────
  useEffect(() => {
    const sections = links
      .map(l => document.getElementById(l.id))
      .filter((el): el is HTMLElement => !!el);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: "-30% 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    sections.forEach(s => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-shadow duration-300 ${
        scrolled ? "shadow-[0_2px_20px_rgba(15,23,42,0.08)]" : "shadow-none"
      }`}
      style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.border}` }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-[72px] flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
            style={{ backgroundColor: C.navy }}
          >
            RD
          </div>
          <div className="leading-tight min-w-0">
            <p
              className="font-bold text-sm sm:text-base truncate"
              style={{ color: C.navy, fontFamily: "Poppins, sans-serif" }}
            >
              Rosario Dairy
            </p>
            <p className="text-[11px] sm:text-xs truncate" style={{ color: C.muted }}>
              Integrated Inventory &amp; POS System
            </p>
          </div>
        </div>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => {
            const isActive = activeSection === l.id;
            return (
              <button
                key={l.id}
                onClick={() => scrollToId(l.id)}
                className="relative text-sm font-medium transition-colors hover:opacity-80 py-1.5"
                style={{ color: isActive ? C.blue : C.text }}
              >
                {l.label}
                <span
                  className="absolute left-0 -bottom-0.5 h-0.5 rounded-full transition-all duration-300"
                  style={{
                    width: isActive ? "100%" : "0%",
                    backgroundColor: C.blue,
                  }}
                />
              </button>
            );
          })}
        </nav>

        <div className="hidden md:block flex-shrink-0">
          <button
            onClick={onLogin}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{ backgroundColor: C.blue }}
          >
            Login
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg flex-shrink-0"
          style={{ color: C.navy }}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden overflow-hidden"
            style={{ backgroundColor: C.white, borderTop: `1px solid ${C.border}` }}
          >
            <div className="px-5 py-4 flex flex-col gap-1">
              {links.map((l) => {
                const isActive = activeSection === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      scrollToId(l.id);
                      setMobileOpen(false);
                    }}
                    className="text-left text-sm font-medium py-2.5 px-3 rounded-lg transition-colors"
                    style={{
                      color: isActive ? C.blue : C.text,
                      backgroundColor: isActive ? C.blue + "0D" : "transparent",
                    }}
                  >
                    {l.label}
                  </button>
                );
              })}
              <button
                onClick={onLogin}
                className="mt-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white w-full"
                style={{ backgroundColor: C.blue }}
              >
                Login
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard mockup used inside the Hero                              */
/* ------------------------------------------------------------------ */

function DashboardShowcase() {
  const bars = [40, 65, 50, 80, 60, 95, 70];
  const forecastPoints = "0,38 20,32 40,34 60,22 80,26 100,14 120,18 140,6";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15 }}
      className="relative w-full max-w-md rounded-2xl overflow-hidden"
      style={{ backgroundColor: C.white, border: `1px solid ${C.border}`, boxShadow: "0 20px 60px -20px rgba(23,55,94,0.25)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.red }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.orange }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.green }} />
        </div>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
          <motion.span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: C.green }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          Live dashboard
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Stock Value", value: "₱482K", icon: <Boxes size={13} /> },
            { label: "Today's Sales", value: "₱36.4K", icon: <ShoppingCart size={13} /> },
            { label: "Low Stock", value: "6 items", icon: <Bell size={13} /> },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl p-2.5"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center gap-1 mb-1" style={{ color: C.blue }}>
                {kpi.icon}
              </div>
              <p className="text-[13px] font-bold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
                {kpi.value}
              </p>
              <p className="text-[10px]" style={{ color: C.muted }}>
                {kpi.label}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-3" style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
            <p className="text-[10px] font-semibold mb-2" style={{ color: C.muted }}>
              REVENUE ANALYTICS
            </p>
            <div className="flex items-end gap-1 h-14">
              {bars.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  whileInView={{ height: `${h}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="flex-1 rounded-t-sm"
                  style={{ backgroundColor: i === 5 ? C.blue : "#BFDBFE" }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
            <p className="text-[10px] font-semibold mb-2" style={{ color: C.muted }}>
              SARIMA FORECAST
            </p>
            <svg viewBox="0 0 140 44" className="w-full h-14">
              <polyline
                points={forecastPoints}
                fill="none"
                stroke={C.green}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-[10px] font-medium" style={{ color: C.green }}>
              ▲ 12% next week
            </p>
          </div>
        </div>

        <div className="rounded-xl p-3" style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] font-semibold mb-2" style={{ color: C.muted }}>
            INVENTORY SUMMARY
          </p>
          <div className="space-y-1.5">
            {[
              { label: "Fresh Milk", pct: 78 },
              { label: "Cheese", pct: 54 },
              { label: "Yogurt", pct: 33 },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="text-[10px] w-16 shrink-0" style={{ color: C.text }}>
                  {row.label}
                </span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${row.pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: C.blue }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-3" style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] font-semibold mb-2" style={{ color: C.muted }}>
            RECENT ORDERS
          </p>
          <div className="space-y-1.5">
            {[
              { id: "#OR-2481", item: "Fresh Milk 1L ×20", status: "Completed" },
              { id: "#OR-2480", item: "Cheese Block ×8", status: "Processing" },
            ].map((o) => (
              <div key={o.id} className="flex items-center justify-between text-[10.5px]">
                <span style={{ color: C.text }}>{o.id} · {o.item}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-semibold"
                  style={{
                    backgroundColor: o.status === "Completed" ? "#DCFCE7" : "#DBEAFE",
                    color: o.status === "Completed" ? C.green : C.blue,
                  }}
                >
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Hero Section                                                    */
/* ------------------------------------------------------------------ */

function HeroSection({ onLogin }: { onLogin?: () => void }) {
  return (
    <section id="home" className="pt-16 sm:pt-24 pb-20" style={{ backgroundColor: C.bg }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-5"
            style={{ backgroundColor: "#DBEAFE", color: C.blue }}
          >
            Rosario Dairy · Operations Platform
          </span>
          <h1
            className="text-4xl sm:text-5xl font-bold leading-[1.1] mb-6"
            style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
          >
            Smarter Dairy Inventory &amp; Sales Management
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-lg" style={{ color: C.muted }}>
            Rosario Dairy runs its stock, sales, and reporting from one system.
            Track raw milk and finished goods with FEFO batch monitoring, process
            sales through an integrated POS, generate reports on demand, and
            forecast demand ahead of time using the SARIMA time-series model.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:shadow-xl hover:-translate-y-0.5"
              style={{ backgroundColor: C.blue }}
            >
              Get Started <ArrowRight size={16} />
            </button>
            <button
              onClick={() => scrollToId("features")}
              className="px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:bg-white"
              style={{ color: C.navy, border: `1px solid ${C.border}` }}
            >
              Learn More
            </button>
          </div>
        </motion.div>

        <div className="flex justify-center lg:justify-end">
          <DashboardShowcase />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Features Section                                                */
/* ------------------------------------------------------------------ */

function FeaturesSection() {
  const features = [
    {
      icon: <Boxes size={22} />,
      title: "Inventory Management",
      desc: "Track raw milk, finished goods, and packaging with real-time visibility and FEFO batch tracking.",
    },
    {
      icon: <ShoppingCart size={22} />,
      title: "Point of Sale",
      desc: "Process walk-in and wholesale orders quickly with a POS built for daily dairy operations.",
    },
    {
      icon: <BarChart3 size={22} />,
      title: "Sales Analytics",
      desc: "See revenue trends, best-selling products, and branch performance in one dashboard.",
    },
    {
      icon: <TrendingUp size={22} />,
      title: "Demand Forecasting (SARIMA)",
      desc: "Anticipate seasonal demand shifts and plan production using SARIMA time-series forecasting.",
    },
    {
      icon: <Users size={22} />,
      title: "Customer Management",
      desc: "Keep customer records, order history, and preferences organized for faster repeat service.",
    },
    {
      icon: <FileSpreadsheet size={22} />,
      title: "Reports & Export",
      desc: "Generate inventory, sales, and forecast reports and export them whenever you need them.",
    },
  ];

  return (
    <section id="features" className="py-20" style={{ backgroundColor: C.white }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <SectionHeading
          eyebrow="Platform"
          title="Everything Rosario Dairy needs to run daily operations"
          subtitle="One system for inventory, sales, and forecasting — built around how dairy stock actually moves."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="group p-6 rounded-2xl transition-all hover:-translate-y-1"
              style={{ backgroundColor: C.white, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors group-hover:text-white"
                style={{ backgroundColor: "#EFF6FF", color: C.blue }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.blue)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#EFF6FF")}
              >
                {f.icon}
              </div>
              <h3
                className="font-bold text-base mb-2"
                style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Reusable section heading */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  light,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="max-w-2xl"
    >
      <span
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: light ? "#93C5FD" : C.blue }}
      >
        {eyebrow}
      </span>
      <h2
        className="text-2xl sm:text-3xl font-bold mt-2 mb-3 leading-tight"
        style={{ color: light ? C.white : C.text, fontFamily: "Poppins, sans-serif" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: light ? "#CBD5E1" : C.muted }}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. Why Choose Rosario Dairy                                        */
/* ------------------------------------------------------------------ */

function WhyChooseSection() {
  const checklist = [
    "Inventory Monitoring",
    "POS Integration",
    "Low Stock Alerts",
    "Sales Dashboard",
    "Demand Forecasting",
    "Reports",
    "Role-Based Access",
  ];

  const batches = [
    { name: "Fresh Milk 1L — Batch #A214", status: "Fresh", days: "12 days left", color: C.green },
    { name: "Yogurt Cup — Batch #C098", status: "Near Expiry", days: "3 days left", color: C.orange },
    { name: "Cheese Block — Batch #B152", status: "Fresh", days: "20 days left", color: C.green },
  ];

  return (
    <section className="py-20" style={{ backgroundColor: C.bg }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="rounded-2xl p-6"
          style={{ backgroundColor: C.white, border: `1px solid ${C.border}`, boxShadow: "0 20px 50px -25px rgba(23,55,94,0.2)" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <PackageCheck size={18} style={{ color: C.blue }} />
            <p className="font-bold text-sm" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
              Batch Expiry Tracker
            </p>
          </div>
          <div className="space-y-3">
            {batches.map((b) => (
              <div
                key={b.name}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: C.white, border: `1px solid ${C.border}` }}
                  >
                    <Milk size={16} style={{ color: C.blue }} />
                  </div>
                  <div>
                    <p className="text-[12.5px] font-medium" style={{ color: C.text }}>
                      {b.name}
                    </p>
                    <p className="text-[11px]" style={{ color: C.muted }}>
                      {b.days}
                    </p>
                  </div>
                </div>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ backgroundColor: `${b.color}1A`, color: b.color }}
                >
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: C.blue }}>
            Why Rosario Dairy Chose This System
          </span>
          <h2
            className="text-2xl sm:text-3xl font-bold mt-2 mb-6 leading-tight"
            style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
          >
            Built specifically for how dairy stock moves
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {checklist.map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <CheckCircle2 size={18} style={{ color: C.green }} className="shrink-0" />
                <span className="text-sm font-medium" style={{ color: C.text }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  5. System Workflow                                                 */
/* ------------------------------------------------------------------ */

function WorkflowSection() {
  const steps = [
    { icon: <Boxes size={20} />, label: "Inventory", desc: "Stock is recorded and tracked by batch." },
    { icon: <ShoppingCart size={20} />, label: "POS", desc: "Sales deduct stock automatically." },
    { icon: <BarChart3 size={20} />, label: "Analytics", desc: "Sales data becomes reports." },
    { icon: <TrendingUp size={20} />, label: "Forecasting", desc: "SARIMA projects future demand." },
  ];

  return (
    <section className="py-20" style={{ backgroundColor: C.white }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From stockroom to forecast, in one flow"
          subtitle="Every sale updates inventory in real time, and every day of sales sharpens the forecast."
        />

        <div className="mt-14 flex flex-col lg:flex-row items-stretch gap-4">
          {steps.map((s, i) => (
            <div key={s.label} className="flex flex-1 items-center gap-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="flex-1 p-6 rounded-2xl text-center"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}
              >
                <div
                  className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-4"
                  style={{ backgroundColor: C.navy, color: C.white }}
                >
                  {s.icon}
                </div>
                <p className="font-bold text-sm mb-1.5" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
                  {s.label}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
                  {s.desc}
                </p>
              </motion.div>

              {i < steps.length - 1 && (
                <div className="hidden lg:flex items-center justify-center shrink-0" style={{ color: C.border }}>
                  <ChevronRight size={22} style={{ color: C.blue }} />
                </div>
              )}
              {i < steps.length - 1 && (
                <div className="flex lg:hidden justify-center py-1" style={{ color: C.blue }}>
                  <ArrowDown size={18} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  6. Statistics Section                                              */
/* ------------------------------------------------------------------ */

function StatCard({ target, suffix, label, decimals = 0 }: { target: number; suffix: string; label: string; decimals?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const value = useCountUp(target, inView);

  return (
    <div
      ref={ref}
      className="p-8 rounded-2xl text-center"
      style={{ backgroundColor: C.white, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
    >
      <p className="text-3xl sm:text-4xl font-bold" style={{ color: C.blue, fontFamily: "Poppins, sans-serif" }}>
        {decimals ? value.toFixed(decimals) : value.toLocaleString()}
        {suffix}
      </p>
      <p className="text-sm mt-2 font-medium" style={{ color: C.muted }}>
        {label}
      </p>
    </div>
  );
}

function StatsSection() {
  return (
    <section className="py-20" style={{ backgroundColor: C.bg }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard target={10000} suffix="+" label="Transactions Processed" />
          <StatCard target={98} suffix="%" label="Inventory Accuracy" />
          <StatCard target={95} suffix="%" label="Forecast Confidence" />
          <StatCard target={24} suffix="/7" label="System Availability" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  7. About Section                                                   */
/* ------------------------------------------------------------------ */

function AboutSection() {
  const points = [
    "Inventory Management across raw milk and finished goods",
    "Point of Sale for daily transactions",
    "Sales monitoring across branches and channels",
    "Analytics that turn transactions into insight",
    "SARIMA forecasting for seasonal demand planning",
    "Role-based access for admin and staff",
    "Modern, exportable reporting",
  ];

  return (
    <section id="about" className="py-20" style={{ backgroundColor: C.white }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-14">
        <SectionHeading
          eyebrow="About the system"
          title="A single system built around Rosario Dairy's operations"
          subtitle="The Rosario Dairy Integrated Inventory & POS System was built to replace manual stock counts and disconnected sales records with one connected platform — from the stockroom to the register to the forecast."
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid sm:grid-cols-2 gap-3"
        >
          {points.map((p) => (
            <div
              key={p}
              className="flex items-start gap-2.5 p-3.5 rounded-xl"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}
            >
              <CheckCircle2 size={16} style={{ color: C.blue }} className="shrink-0 mt-0.5" />
              <span className="text-[13px] leading-snug" style={{ color: C.text }}>
                {p}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  8. Call to Action                                                   */
/* ------------------------------------------------------------------ */

function CTASection({ onLogin }: { onLogin?: () => void }) {
  return (
    <section className="py-20" style={{ backgroundColor: C.navy }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto px-5 sm:px-8 text-center"
      >
        <h2
          className="text-3xl sm:text-4xl font-bold mb-4 leading-tight"
          style={{ color: C.white, fontFamily: "Poppins, sans-serif" }}
        >
          Ready to Modernize Rosario Dairy?
        </h2>
        <p className="text-sm sm:text-base mb-8" style={{ color: "#CBD5E1" }}>
          Log in to manage inventory, process sales, and view forecasts — all in one place.
        </p>
        <button
          onClick={onLogin}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-xl hover:-translate-y-0.5"
          style={{ backgroundColor: C.blue, color: C.white }}
        >
          Login <ArrowRight size={16} />
        </button>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  9. Footer                                                           */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer id="contact" className="pt-16 pb-8" style={{ backgroundColor: "#0F1E33" }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: C.blue }}
              >
                RD
              </div>
              <p className="font-bold text-sm text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
                Rosario Dairy
              </p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
              Integrated Inventory &amp; POS System for daily dairy operations.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#64748B" }}>
              Quick Links
            </p>
            <div className="flex flex-col gap-2.5">
              {[
                { label: "Home", id: "home" },
                { label: "Features", id: "features" },
                { label: "About", id: "about" },
                { label: "Contact", id: "contact" },
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => scrollToId(l.id)}
                  className="text-left text-sm transition-colors hover:text-white"
                  style={{ color: "#CBD5E1" }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#64748B" }}>
              Contact
            </p>
            <div className="flex flex-col gap-2.5 text-sm" style={{ color: "#CBD5E1" }}>
              <div className="flex items-center gap-2">
                <Mail size={14} /> support@rosariodairy.ph
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} /> +63 917 000 0000
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} /> Rosario, Batangas, Philippines
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#64748B" }}>
              System
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>
              Inventory · POS · Analytics · SARIMA Forecasting
            </p>
          </div>
        </div>

        <p className="text-center text-xs pt-6" style={{ color: "#64748B" }}>
          © {new Date().getFullYear()} Rosario Dairy Management System — FEFO + SARIMA Analytics
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Default export                                                      */
/* ------------------------------------------------------------------ */

export default function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen w-full " style={{ backgroundColor: C.bg }}>
      <NavBar onLogin={onLogin} />
      <HeroSection onLogin={onLogin} />
      <FeaturesSection />
      <WhyChooseSection />
      <WorkflowSection />
      <StatsSection />
      <AboutSection />
      <CTASection onLogin={onLogin} />
      <Footer />
    </div>
  );
}