import express from "express";
import apiRoutes from "../src/server/routes.js";
import "dotenv/config";

const app = express();

app.use(express.json({ limit: '50mb' }));

// For real Vercel deployments, the path is /api/*
// Our routes are defined relative to /api in server.ts, 
// but in the serverless function, the path prefix might be different.
// Vercel routes /api/network/import to this function.
app.use("/api", apiRoutes);

export default app;
