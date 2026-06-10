const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');

const app = express();
const PORT = 3456;

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const COVERS_DIR = path.join(DATA_DIR, 'covers');
const BOOKS_FILE = path.join(DATA_DIR, 'books.json');

// 确保目录存在
[DATA_DIR, UPLOADS_DIR, COVERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 初始化书架数据
if (!fs.existsSync(BOOKS_FILE)) {
  fs.writeFileSync(BOOKS_FILE, JSON.stringify([], null, 2));
}

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 配置 multer - PDF 上传
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const id = crypto.randomBytes(8).toString('hex');
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(safeName) || '.pdf';
    cb(null, `${id}${ext}`);
  }
});

const uploadPdf = multer({
  storage: pdfStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' ||
        path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('只支持 PDF 文件格式'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }
});

// 配置 multer - 封面图片上传
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, COVERS_DIR),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const uploadCover = multer({
  storage: coverStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPEG/PNG/WebP 格式'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// 读取书架数据
function getBooks() {
  try {
    return JSON.parse(fs.readFileSync(BOOKS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// 保存书架数据
function saveBooks(books) {
  fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));
}

// ========== 服务器端PDF封面提取（使用系统 sips/ImageMagick） ==========
async function extractCoverServer(pdfPath, coverOutputPath) {
  return new Promise((resolve, reject) => {
    // 尝试用 sips (macOS 内置工具) 或 qlmanage 生成缩略图
    // qlmanage 可以生成 PDF 的缩略图
    const cmd = `qlmanage -t -s 400 -o "${path.dirname(coverOutputPath)}" "${pdfPath}" 2>/dev/null`;
    exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        // qlmanage 生成的是 PNG 格式，文件名是原文件名 + .png
        const expectedFile = path.join(
          path.dirname(coverOutputPath),
          path.basename(pdfPath) + '.png'
        );
        if (fs.existsSync(expectedFile)) {
          // 重命名为目标文件
          fs.renameSync(expectedFile, coverOutputPath);
          resolve(true);
        } else {
          resolve(false);
        }
      } else {
        // 查找生成的文件
        const dir = path.dirname(coverOutputPath);
        const baseName = path.basename(pdfPath);
        const possibleThumb = path.join(dir, baseName + '.png');
        if (fs.existsSync(possibleThumb)) {
          fs.renameSync(possibleThumb, coverOutputPath);
          resolve(true);
        } else {
          resolve(false);
        }
      }
    });
  });
}

// ========== API 路由 ==========

// API: 获取书架列表
app.get('/api/books', (req, res) => {
  const books = getBooks();
  res.json({ success: true, data: books });
});

// API: 上传 PDF（服务器端自动提取封面）
app.post('/api/upload', uploadPdf.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请选择 PDF 文件' });
  }

  const id = path.parse(req.file.filename).name;
  const safeName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const title = path.parse(safeName).name;
  const pdfPath = path.join(UPLOADS_DIR, req.file.filename);

  const book = {
    id,
    title,
    fileName: req.file.filename,
    originalName: safeName,
    fileSize: req.file.size,
    uploadTime: new Date().toISOString(),
    coverPath: null,
    totalPages: 0
  };

  const books = getBooks();
  books.unshift(book);
  saveBooks(books);

  // 服务器端生成封面缩略图（异步，不阻塞响应）
  const coverFilename = `${id}.png`;
  const coverOutputPath = path.join(COVERS_DIR, coverFilename);
  extractCoverServer(pdfPath, coverOutputPath).then(success => {
    if (success) {
      book.coverPath = coverFilename;
      saveBooks(books);
      console.log(`✅ 封面提取成功: ${title}`);
    } else {
      console.log(`⚠️  封面提取失败: ${title}`);
    }
  }).catch(err => {
    console.log(`⚠️  封面提取失败: ${title} - ${err.message}`);
  });

  res.json({ success: true, data: book });
});

// API: 获取 PDF 文件（用于阅读器渲染）
app.get('/api/pdf/:id', (req, res) => {
  const books = getBooks();
  const book = books.find(b => b.id === req.params.id);

  if (!book) {
    return res.status(404).json({ success: false, message: '书籍不存在' });
  }

  const filePath = path.join(UPLOADS_DIR, book.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: '文件不存在' });
  }

  // 设置缓存头和跨域
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(filePath);
});

// API: 更新书籍信息
app.put('/api/books/:id', (req, res) => {
  const books = getBooks();
  const index = books.findIndex(b => b.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: '书籍不存在' });
  }

  books[index] = { ...books[index], ...req.body };
  saveBooks(books);

  res.json({ success: true, data: books[index] });
});

// API: 删除书籍
app.delete('/api/books/:id', (req, res) => {
  const books = getBooks();
  const index = books.findIndex(b => b.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: '书籍不存在' });
  }

  const book = books[index];

  const pdfPath = path.join(UPLOADS_DIR, book.fileName);
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

  if (book.coverPath) {
    const coverPath = path.join(COVERS_DIR, book.coverPath);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  }

  books.splice(index, 1);
  saveBooks(books);

  res.json({ success: true });
});

// API: 保存封面图片（前端上传封面时使用）
app.post('/api/books/:id/cover', uploadCover.single('cover'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请提供封面图片' });
  }

  const books = getBooks();
  const index = books.findIndex(b => b.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: '书籍不存在' });
  }

  books[index].coverPath = req.file.filename;
  saveBooks(books);

  res.json({ success: true, data: books[index] });
});

// 提供封面和PDF静态文件
app.use('/api/covers', express.static(COVERS_DIR, {
  maxAge: '1d',
  etag: true
}));
app.use('/api/uploads', express.static(UPLOADS_DIR));

// 微信验证文件路由（用于公众号"业务域名"/"JS安全域名"验证）
const WECHAT_VERIFY_DIR = path.join(__dirname, 'wechat-verify');
if (!fs.existsSync(WECHAT_VERIFY_DIR)) fs.mkdirSync(WECHAT_VERIFY_DIR, { recursive: true });

app.use('/MP_verify_', (req, res, next) => {
  // 匹配 MP_verify_xxx.txt 格式的微信验证文件
  const fileName = req.path.replace(/^\//, '');
  if (fileName.match(/^MP_verify_[A-Za-z0-9]+\.txt$/)) {
    const filePath = path.join(WECHAT_VERIFY_DIR, fileName);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  next();
});

// 便捷接口：列出需要上传的微信验证文件名
app.get('/api/wechat-verify-info', (req, res) => {
  const existingFiles = fs.readdirSync(WECHAT_VERIFY_DIR).filter(f => f.endsWith('.txt'));
  res.json({
    success: true,
    verifyDir: WECHAT_VERIFY_DIR,
    existingFiles,
    instruction: '将微信公众平台下载的 MP_verify_xxx.txt 文件放入 wechat-verify 目录即可完成验证'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小超过限制（最大500MB）' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📚 石墨烯产业动态（石墨烯联盟CGIA）- 翻页电子书服务`);
  console.log(`📱 本地访问: http://localhost:${PORT}`);

  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(`http://${iface.address}:${PORT}`);
      }
    }
  }
  if (addresses.length > 0) {
    console.log(`🌐 局域网访问地址:`);
    addresses.forEach(addr => console.log(`   ${addr}`));
  }
  console.log(`📂 上传目录: ${UPLOADS_DIR}`);
  console.log(`📊 数据目录: ${DATA_DIR}`);
});
