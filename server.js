
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Azure App Service 會透過環境變數注入 PORT
const port = process.env.PORT || 3000;

// 託管編譯後的靜態檔案 (Vite 預設輸出資料夾為 dist)
app.use(express.static(path.join(__dirname, 'dist')));

// 處理 SPA 路由：所有請求都回傳 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`王者圓桌伺服器已啟動，監聽端口：${port}`);
});
