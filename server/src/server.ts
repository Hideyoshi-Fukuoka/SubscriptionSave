import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS設定: Railway等の本番環境からAPIが叩けるように許可
// 將来的には VITE_CLIENT_URL 等で厳格化することを推奨
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

import deliberationRouter from './routes/deliberation';

// ヘルスチェック用
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Subscription Guardian API is running.' });
});

// 議論用APIルーティング
app.use('/api/v1/deliberation', deliberationRouter);

app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
