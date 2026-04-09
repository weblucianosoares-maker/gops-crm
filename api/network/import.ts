import { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import fs from 'fs';
import { extractNetworkData } from '../../src/lib/geminiService.js';

export const config = {
  api: {
    bodyParser: false, // Disable Vercel's default body parser to handle multipart/form-data
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const form = formidable({ multiples: false });

  try {
    const { fields, files } = await new Promise<{ fields: any, files: any }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const carrierName = Array.isArray(fields.carrierName) ? fields.carrierName[0] : fields.carrierName;
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    if (!carrierName) {
      return res.status(400).json({ error: 'Nome da operadora é obrigatório.' });
    }

    console.log(`[VERCEL API] Processando arquivo para ${carrierName}...`);
    
    const fileBuffer = fs.readFileSync(file.filepath);
    const extractedData = await extractNetworkData(fileBuffer, file.mimetype || 'application/pdf', carrierName);
    
    return res.status(200).json({ success: true, data: extractedData });
  } catch (error: any) {
    console.error('[VERCEL API ERROR]', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao processar com IA.' });
  }
}
