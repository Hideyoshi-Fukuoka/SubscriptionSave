import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

import deliberationRouter from './routes/deliberation';

// ヘルスチェック用
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Subscription Guardian API is running.' });
});

// 議論用APIルーティング
app.use('/api/v1/deliberation', deliberationRouter);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
