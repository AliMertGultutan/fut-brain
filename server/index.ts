import { createApp } from './app.ts';
const port = Number(process.env.PORT || 3001);
const { app } = createApp();
const server = app.listen(port, '127.0.0.1', () => console.log(`Yerel veri sunucusu hazır: http://127.0.0.1:${port}`));
server.on('error', () => { console.error('Yerel veri sunucusu başlatılamadı; bağlantı noktasını kontrol edin.'); process.exit(1); });
