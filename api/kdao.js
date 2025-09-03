export default async function handler(req, res) {
  // CORS Headers erlauben
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    // CoinEx API direkt aufrufen (Server hat kein CORS Problem!)
    const response = await fetch('https://api.coinex.com/v1/market/ticker?market=KDAOUSDT');
    const data = await response.json();
    
    if (data.code === 0 && data.data && data.data.ticker) {
      const ticker = data.data.ticker;
      
      // Formatiere die Daten
      const result = {
        success: true,
        source: 'CoinEx',
        data: {
          price: parseFloat(ticker.last),
          volume24h: parseFloat(ticker.vol) * parseFloat(ticker.last),
          volume24h_raw: parseFloat(ticker.vol),
          high24h: parseFloat(ticker.high),
          low24h: parseFloat(ticker.low),
          open24h: parseFloat(ticker.open),
          change24h: ((parseFloat(ticker.last) - parseFloat(ticker.open)) / parseFloat(ticker.open)) * 100,
          timestamp: Date.now()
        }
      };
      
      return res.status(200).json(result);
    }
    
    // Falls KDAO/USDT nicht existiert, versuche andere Paare
    const altPairs = ['KDAOKAS', 'KDAOBTC', 'KDAOETH'];
    for (const pair of altPairs) {
      const altResponse = await fetch(`https://api.coinex.com/v1/market/ticker?market=${pair}`);
      const altData = await altResponse.json();
      
      if (altData.code === 0 && altData.data) {
        return res.status(200).json({
          success: true,
          source: 'CoinEx',
          pair: pair,
          data: altData.data.ticker
        });
      }
    }
    
    throw new Error('KDAO nicht auf CoinEx gefunden');
    
  } catch (error) {
    console.error('API Error:', error);
    
    // Fallback auf LiveCoinWatch
    try {
      const lcwResponse = await fetch('https://api.livecoinwatch.com/coins/single', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.LCW_API_KEY || '37e816c9-9c25-475e-86aa-ad915969bd5f'
        },
        body: JSON.stringify({
          currency: 'USD',
          code: 'KDAO',
          meta: true
        })
      });
      
      const lcwData = await lcwResponse.json();
      
      return res.status(200).json({
        success: true,
        source: 'LiveCoinWatch',
        data: {
          price: lcwData.rate,
          volume24h: lcwData.volume,
          change24h: lcwData.delta?.day,
          change7d: lcwData.delta?.week,
          change30d: lcwData.delta?.month,
          marketCap: lcwData.cap
        }
      });
      
    } catch (lcwError) {
      // Letzte bekannte Daten zurückgeben
      return res.status(200).json({
        success: false,
        source: 'fallback',
        message: 'Live-Daten nicht verfügbar',
        data: {
          price: 0.00000115,
          volume24h: 3327,
          change24h: 1.01,
          change7d: 15.9,
          change30d: 40.22,
          marketCap: 172400
        }
      });
    }
  }
}