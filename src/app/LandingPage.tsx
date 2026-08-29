import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, BarChart3, Boxes, CheckCircle2, ChevronRight,
  FileSpreadsheet, LockKeyhole, Mail, MapPin, Menu, Milk,
  Phone, RefreshCw, ShieldCheck, ShoppingCart, TrendingUp, Users, X,
} from "lucide-react";
import { C } from "@/styles/tokens/colors";

interface LandingPageProps { onLogin?: () => void }

const NAV_LINKS = [
  { label: "Home", id: "home" },
  { label: "Capabilities", id: "features" },
  { label: "How It Works", id: "about" },
  { label: "Contact", id: "contact" },
] as const;

const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5 },
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function NavBar({ onLogin }: { onLogin?: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          // Sort by highest visibility ratio in viewport
          const mostVisible = visible.reduce((prev, curr) =>
            curr.intersectionRatio > prev.intersectionRatio ? curr : prev
          );
          setActiveSection(mostVisible.target.id);
        }
      },
      { rootMargin: "-10% 0px -40% 0px", threshold: [0.1, 0.3, 0.6] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const navigate = (id: string) => {
    scrollToId(id);
    setMobileOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${scrolled ? "shadow-[0_8px_30px_rgba(15,23,42,0.07)]" : "shadow-none"}`}
      style={{ backgroundColor: `${C.white}F2`, borderColor: C.border }}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <button onClick={() => navigate("home")} className="flex min-w-0 items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm" style={{ backgroundColor: C.navy }}>RD</span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold" style={{ color: C.navy, fontFamily: "Poppins, sans-serif" }}>Rosario Dairy</span>
            <span className="block truncate text-xs" style={{ color: C.muted }}>Operations Intelligence</span>
          </span>
        </button>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => {
            const active = activeSection === link.id;
            return (
              <button key={link.id} onClick={() => navigate(link.id)} className="relative py-2 text-sm font-medium transition-colors" style={{ color: active ? C.blue : C.muted }}>
                {link.label}
                <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-0.5 rounded-full transition-all duration-300" style={{ width: active ? "100%" : 0, backgroundColor: C.blue }} />
              </button>
            );
          })}
        </nav>

        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={onLogin} className="hidden rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm md:block" style={{ backgroundColor: C.blue }}>
          Sign in
        </motion.button>
        <button className="rounded-lg p-2 md:hidden" style={{ color: C.navy }} onClick={() => setMobileOpen((open) => !open)} aria-label="Toggle navigation menu" aria-expanded={mobileOpen}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t md:hidden" style={{ borderColor: C.border, backgroundColor: C.white }}>
            <nav className="flex flex-col gap-1 px-5 py-4" aria-label="Mobile navigation">
              {NAV_LINKS.map((link) => (
                <button key={link.id} onClick={() => navigate(link.id)} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium" style={{ color: activeSection === link.id ? C.blue : C.text, backgroundColor: activeSection === link.id ? `${C.blue}0D` : "transparent" }}>
                  {link.label}
                </button>
              ))}
              <button onClick={onLogin} className="mt-2 rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ backgroundColor: C.blue }}>Sign in</button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function DashboardShowcase() {
  const forecast = "0,62 30,55 60,58 90,40 120,44 150,25 180,31 210,12";
  return (
    <motion.div initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.65, delay: 0.15 }} className="relative w-full max-w-xl">
      <div className="absolute -inset-5 -z-10 rounded-[32px] opacity-70 blur-2xl" style={{ background: `linear-gradient(135deg, ${C.blue}20, ${C.green}12)` }} />
      <div className="overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ backgroundColor: C.white, borderColor: C.border, boxShadow: "0 28px 70px -32px rgba(23,55,94,0.42)" }}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: C.muted }}>Executive overview</p>
            <p className="mt-1 text-base font-bold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>Operations Dashboard</p>
          </div>
          <span className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ color: C.green, backgroundColor: `${C.green}12` }}>
            <motion.span className="h-2 w-2 rounded-full" style={{ backgroundColor: C.green }} animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />Live
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Inventory value", value: "₱482K", change: "+4.8%" },
            { label: "Sales today", value: "₱36.4K", change: "+12.1%" },
            { label: "At-risk stock", value: "6", change: "Needs review" },
          ].map((item, index) => (
            <motion.div key={item.label} whileHover={{ y: -3 }} className="rounded-2xl border p-3.5 sm:p-4" style={{ backgroundColor: C.bg, borderColor: C.border }}>
              <p className="text-xs leading-tight" style={{ color: C.muted }}>{item.label}</p>
              <p className="mt-2 text-lg font-bold sm:text-xl" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>{item.value}</p>
              <p className="mt-1 text-xs font-medium" style={{ color: index === 2 ? C.orange : C.green }}>{item.change}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border p-4 sm:p-5" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div><p className="text-sm font-semibold" style={{ color: C.text }}>SARIMA demand forecast</p><p className="mt-1 text-xs" style={{ color: C.muted }}>Projected volume for the next seven days</p></div>
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ color: C.blue, backgroundColor: `${C.blue}10` }}>+12.0%</span>
          </div>
          <svg viewBox="0 0 210 72" className="h-28 w-full" role="img" aria-label="Rising seven-day demand forecast">
            <defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue} stopOpacity="0.2" /><stop offset="100%" stopColor={C.blue} stopOpacity="0" /></linearGradient></defs>
            <polygon points={`0,72 ${forecast} 210,72`} fill="url(#forecastFill)" />
            <motion.polyline points={forecast} fill="none" stroke={C.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, delay: 0.25 }} />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

function HeroSection({ onLogin }: { onLogin?: () => void }) {
  return (
    <section id="home" className="relative overflow-hidden py-20 sm:py-28" style={{ backgroundColor: C.bg }}>
      <div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at 15% 10%, ${C.blue}12, transparent 34%), radial-gradient(circle at 90% 80%, ${C.green}0D, transparent 30%)` }} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ color: C.blue, borderColor: `${C.blue}25`, backgroundColor: `${C.blue}08` }}><ShieldCheck size={14} />Purpose-built operations platform</span>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[3.5rem]" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>Control dairy operations with clarity and confidence.</h1>
          <p className="mt-6 max-w-xl text-base leading-8 sm:text-lg" style={{ color: C.muted }}>Unify batch-level inventory, point-of-sale activity, management reporting, and demand forecasting in one dependable operating system.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={onLogin} className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg" style={{ backgroundColor: C.blue, boxShadow: `0 14px 28px -14px ${C.blue}` }}>Access the platform <ArrowRight size={16} /></motion.button>
            <button onClick={() => scrollToId("features")} className="rounded-xl border px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-white" style={{ color: C.navy, borderColor: C.border }}>Explore capabilities</button>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium" style={{ color: C.muted }}>
            {["FEFO batch control", "Role-based workflows", "Decision-ready analytics"].map((item) => <span key={item} className="flex items-center gap-2"><CheckCircle2 size={15} style={{ color: C.green }} />{item}</span>)}
          </div>
        </motion.div>
        <DashboardShowcase />
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, subtitle, centered = false }: { eyebrow: string; title: string; subtitle: string; centered?: boolean }) {
  return (
    <motion.div {...reveal} className={`max-w-2xl ${centered ? "mx-auto text-center" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: C.blue }}>{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>{title}</h2>
      <p className="mt-4 text-base leading-7" style={{ color: C.muted }}>{subtitle}</p>
    </motion.div>
  );
}

function FeaturesSection() {
  const features = [
    { icon: Boxes, title: "Batch inventory", desc: "Track quantities, expiry dates, and FEFO priority at batch level." },
    { icon: ShoppingCart, title: "Integrated POS", desc: "Record transactions while keeping available stock synchronized." },
    { icon: TrendingUp, title: "Demand forecasting", desc: "Use SARIMA projections to support purchasing and production plans." },
    { icon: BarChart3, title: "Management analytics", desc: "Monitor revenue, stock risk, and product performance from one view." },
    { icon: Users, title: "Customer operations", desc: "Maintain customer profiles, order history, and repeat-service context." },
    { icon: FileSpreadsheet, title: "Structured reporting", desc: "Prepare operational summaries for review, export, and audit." },
  ];
  return (
    <section id="features" className="py-24 sm:py-28" style={{ backgroundColor: C.white }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading eyebrow="Core capabilities" title="One source of truth for daily operations" subtitle="Each module solves a distinct operational need while sharing the same inventory and transaction data." centered />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article key={feature.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: index * 0.05 }} whileHover={{ y: -5 }} className="group rounded-2xl border p-6 sm:p-7" style={{ borderColor: C.border, backgroundColor: C.white, boxShadow: "0 12px 34px -26px rgba(15,23,42,0.35)" }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105" style={{ color: C.blue, backgroundColor: `${C.blue}0D` }}><Icon size={22} /></div>
                <h3 className="mt-5 text-base font-bold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>{feature.title}</h3>
                <p className="mt-2 text-sm leading-6" style={{ color: C.muted }}>{feature.desc}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection({ onLogin }: { onLogin?: () => void }) {
  const steps = [
    { number: "01", icon: Milk, title: "Receive and classify", desc: "Register products and batches with quantity and expiry context." },
    { number: "02", icon: RefreshCw, title: "Operate in real time", desc: "Sales and orders flow through role-appropriate daily workflows." },
    { number: "03", icon: BarChart3, title: "Review performance", desc: "Operational data becomes clear management indicators and reports." },
    { number: "04", icon: TrendingUp, title: "Plan forward", desc: "Forecasts convert historical sales into evidence-based decisions." },
  ];
  return (
    <section id="about" className="py-24 sm:py-28" style={{ backgroundColor: C.bg }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <SectionHeading eyebrow="Operating model" title="A controlled flow from receiving to planning" subtitle="Rosario Dairy replaces disconnected records with a traceable workflow designed around perishable inventory." />
          <motion.div {...reveal} className="grid gap-3 sm:grid-cols-3">
            {[{ icon: LockKeyhole, label: "Role-aware access" }, { icon: ShieldCheck, label: "Traceable records" }, { icon: CheckCircle2, label: "Consistent process" }].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-xl border p-4 text-center" style={{ backgroundColor: C.white, borderColor: C.border }}><Icon className="mx-auto" size={19} style={{ color: C.blue }} /><p className="mt-2 text-xs font-semibold" style={{ color: C.text }}>{label}</p></div>
            ))}
          </motion.div>
        </div>
        <div className="relative mt-14 grid gap-4 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div key={step.number} {...reveal} transition={{ duration: 0.45, delay: index * 0.08 }} className="relative flex">
                <article className="w-full rounded-2xl border p-6" style={{ backgroundColor: C.white, borderColor: C.border, boxShadow: "0 14px 38px -30px rgba(15,23,42,0.4)" }}>
                  <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.18em]" style={{ color: C.blue }}>{step.number}</span><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: C.navy, backgroundColor: `${C.blue}0D` }}><Icon size={19} /></div></div>
                  <h3 className="mt-6 text-base font-bold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>{step.title}</h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: C.muted }}>{step.desc}</p>
                </article>
                {index < steps.length - 1 && <ChevronRight className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 lg:block" size={17} style={{ color: C.blue }} />}
              </motion.div>
            );
          })}
        </div>
        <motion.div {...reveal} className="mt-16 overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-12" style={{ background: `linear-gradient(135deg, ${C.navy}, #244D7C)` }}>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#93C5FD" }}>Rosario Dairy Management System</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-bold text-white sm:text-3xl" style={{ fontFamily: "Poppins, sans-serif" }}>Move from manual coordination to informed operational control.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6" style={{ color: "#CBD5E1" }}>Access inventory, POS, analytics, and forecasting through one secure workspace.</p>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={onLogin} className="mt-7 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white" style={{ backgroundColor: C.blue }}>Sign in to continue <ArrowRight size={16} /></motion.button>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contact" className="border-t pt-14 pb-7" style={{ backgroundColor: "#0F1E33", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 border-b pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr]" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="max-w-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: C.blue }}>RD</div><div><p className="text-sm font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>Rosario Dairy</p><p className="text-xs" style={{ color: "#94A3B8" }}>Integrated Inventory &amp; POS System</p></div></div><p className="mt-4 text-sm leading-6" style={{ color: "#94A3B8" }}>A unified operations platform for perishable inventory, sales control, and forward planning.</p></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "#64748B" }}>Navigate</p><div className="mt-4 flex flex-col gap-3">{NAV_LINKS.map((link) => <button key={link.id} onClick={() => scrollToId(link.id)} className="text-left text-sm transition-colors hover:text-white" style={{ color: "#CBD5E1" }}>{link.label}</button>)}</div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "#64748B" }}>Contact</p><div className="mt-4 flex flex-col gap-3 text-sm" style={{ color: "#CBD5E1" }}><a className="flex items-center gap-2 hover:text-white" href="mailto:rocerojaymark31@gmail.com"><Mail size={15} />rocerojaymark31@gmail.com</a><a className="flex items-center gap-2 hover:text-white" href="tel:+639125096057"><Phone size={15} />0912 509 6057</a><p className="flex items-center gap-2"><MapPin size={15} />Rosario, Batangas, Philippines</p></div></div>
        </div>
        <p className="pt-6 text-center text-xs" style={{ color: "#64748B" }}>© {new Date().getFullYear()} Rosario Dairy Management System · FEFO and SARIMA Analytics</p>
      </div>
    </footer>
  );
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: C.bg }}>
      <NavBar onLogin={onLogin} />
      <main>
        <HeroSection onLogin={onLogin} />
        <FeaturesSection />
        <WorkflowSection onLogin={onLogin} />
      </main>
      <Footer />
    </div>
  );
}