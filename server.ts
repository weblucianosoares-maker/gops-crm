import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Mock Data
  const dashboardStats = {
    totalLeads: 1284,
    leadsGrowth: 12.5,
    vidasVendidas: 342,
    metaMensal: 85,
    receitaEmRisco: 1200000,
  };

  const funnelData = [
    { stage: "Interesse", value: 450 },
    { stage: "Cotação", value: 368 },
    { stage: "Documentação", value: 292 },
    { stage: "Proposta", value: 215 },
    { stage: "Assinatura", value: 135 },
    { stage: "Pago", value: 82 },
  ];

  const carrierRanking = [
    { name: "Bradesco", value: 450000, percentage: 85 },
    { name: "SulAmérica", value: 380000, percentage: 72 },
    { name: "Amil", value: 310000, percentage: 60 },
    { name: "Unimed", value: 240000, percentage: 45 },
  ];

  const recentProposals = [
    { id: 1, client: "Alimentos Mauá S.A.", initials: "AM", carrier: "Bradesco Saúde", lives: 124, value: 54200, status: "Proposta" },
    { id: 2, client: "Logística Santos", initials: "LS", carrier: "Amil One", lives: 45, value: 18900, status: "Pago" },
    { id: 3, client: "Ferreira & Porto Advogados", initials: "FP", carrier: "SulAmérica", lives: 12, value: 9450, status: "Cotação" },
  ];

  const leads = [
    { id: 1, name: "Marco Aurélio Silva", email: "marco.silva@email.com", initials: "MA", source: "Grupo RH", lastContact: "12 Out, 2023", status: "Em Negociação", birthday: true },
    { id: 2, name: "Beatriz Rocha", email: "b.rocha@techcorp.br", initials: "BR", source: "Leads Eventos", lastContact: "Ontem", status: "Novo Lead", birthday: false },
    { id: 3, name: "Carlos Lima", email: "carlos@finances.com", initials: "CL", source: "Ex-colegas", lastContact: "05 Out, 2023", status: "Inativo", birthday: true },
    { id: 4, name: "Fernanda Mendes", email: "nanda.m@agencia.com", initials: "FM", source: "Grupo RH", lastContact: "10 Out, 2023", status: "Proposta Enviada", birthday: false },
  ];

  // API Routes
  app.get("/api/dashboard/stats", (req, res) => res.json(dashboardStats));
  app.get("/api/dashboard/funnel", (req, res) => res.json(funnelData));
  app.get("/api/dashboard/ranking", (req, res) => res.json(carrierRanking));
  app.get("/api/dashboard/proposals", (req, res) => res.json(recentProposals));
  app.get("/api/leads", (req, res) => res.json(leads));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
