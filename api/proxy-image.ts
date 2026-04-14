import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL inválida.' });
  }

  try {
    console.log(`[PROXY] Buscando imagem: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha ao buscar imagem: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Repassar o Content-Type original ou padrão para jpeg
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache de 1 ano
    res.setHeader('Access-Control-Allow-Origin', '*'); // Garantir CORS aberto na API
    
    return res.status(200).send(buffer);
  } catch (error: any) {
    console.error('[PROXY ERROR]', error);
    return res.status(500).json({ error: 'Erro ao processar imagem via proxy.' });
  }
}
