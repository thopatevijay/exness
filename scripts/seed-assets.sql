INSERT INTO assets (symbol, name, binance_symbol, decimals, image_url) VALUES
  ('BTC', 'Bitcoin',  'btcusdt', 4, '/img/btc.svg'),
  ('ETH', 'Ethereum', 'ethusdt', 4, '/img/eth.svg'),
  ('SOL', 'Solana',   'solusdt', 6, '/img/sol.svg')
ON CONFLICT (symbol) DO UPDATE
  SET name = EXCLUDED.name,
      binance_symbol = EXCLUDED.binance_symbol,
      decimals = EXCLUDED.decimals,
      image_url = EXCLUDED.image_url;
