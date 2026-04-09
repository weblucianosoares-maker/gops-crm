import express from "express";
import multer from "multer";
import { extractNetworkData } from "../lib/geminiService.js";

const router = express.Router();

// Multer config for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

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
router.get("/dashboard/stats", (req, res) => res.json(dashboardStats));
router.get("/dashboard/funnel", (req, res) => res.json(funnelData));
router.get("/dashboard/ranking", (req, res) => res.json(carrierRanking));
router.get("/dashboard/proposals", (req, res) => res.json(recentProposals));
router.get("/leads", (req, res) => res.json(leads));

// Intelligent Network Import
router.post("/network/import", upload.single("file"), async (req: any, res) => {
  try {
    const { carrierName } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    if (!carrierName) return res.status(400).json({ error: "Nome da operadora é obrigatório." });

    console.log(`[AI IMPORT] Processando arquivo para ${carrierName}...`);
    
    const extractedData = await extractNetworkData(file.buffer, file.mimetype, carrierName);
    
    res.json({ success: true, data: extractedData });
  } catch (error: any) {
    console.error("[AI IMPORT ERROR]", error);
    res.status(500).json({ error: error.message || "Erro interno ao processar com IA." });
  }
});

export default router;
