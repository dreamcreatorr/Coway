const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const basicAuth = require('express-basic-auth');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const csrf = require('csrf');
const cookieParser = require('cookie-parser');

// 创建 CSRF 实例
const tokens = new csrf();
const { param, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = __dirname;
const productsPath = path.join(rootDir, 'products.json');
const uploadDir = path.join(rootDir, 'images', 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });

// 基本认证中间件
app.use(['/api', '/admin.html', '/admin'], basicAuth({
  users: [{ 
    id: process.env.ADMIN_USERNAME || 'admin', 
    pass: process.env.ADMIN_PASSWORD || 'coway2024' 
  }],
  challenge: true,
  authorizer: (username, password) => {
    const validUser = process.env.ADMIN_USERNAME || 'admin';
    const validPass = process.env.ADMIN_PASSWORD || 'coway2024';
    
    // 使用 timingSafeEqual 防止计时攻击
    const userMatch = crypto.timingSafeEqual(
      Buffer.from(username),
      Buffer.from(validUser)
    );
    
    const passMatch = crypto.timingSafeEqual(
      Buffer.from(password),
      Buffer.from(validPass)
    );
    
    return userMatch && passMatch;
  }
}));

// 安全响应头中间件
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/images/uploads', express.static(uploadDir));
app.use(express.static(rootDir));

// Cookie解析器 (CSRF需要)
app.use(cookieParser());

// CSRF保护中间件
app.use((req, res, next) => {
  // 跳过对GET请求的CSRF保护
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    // 为GET请求生成并存储CSRF secret
    if (req.path.startsWith('/api/')) {
      const secret = tokens.secretSync();
      res.cookie('csrfSecret', secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000 // 1小时
      });
      req.csrfSecret = secret;
    }
    return next();
  }

  // 对于API请求，验证CSRF token
  if (req.path.startsWith('/api/') && req.method !== 'GET') {
    const secret = req.cookies.csrfSecret || req.csrfSecret;
    if (!secret) {
      return res.status(403).json({ error: 'CSRF secret 不存在' });
    }

    const token = req.headers['csrf-token'] || req.body.csrfToken;
    if (!token || !tokens.verify(secret, token)) {
      return res.status(403).json({ error: 'CSRF token验证失败' });
    }
  }
  next();
});

// 提供CSRF token给前端
app.get('/api/csrf-token', (req, res) => {
  const secret = req.csrfSecret || tokens.secretSync();
  const token = tokens.create(secret);
  res.cookie('csrfSecret', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3600000 // 1小时
  });
  res.json({ csrfToken: token });
});

// 速率限制中间件
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 50, // 限制每个IP在15分钟内最多50次请求 (适合管理后台)
  message: {
    error: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = (file.originalname || 'upload').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const timestamp = Date.now();
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // 验证文件类型
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

function readProducts() {
  try {
    const raw = fs.readFileSync(productsPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('无法读取 products.json:', error.message);
    return {};
  }
}

function writeProducts(products) {
  const tempPath = productsPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(products, null, 4) + '\n', 'utf8');
  fs.renameSync(tempPath, productsPath);
}

app.get('/api/products', (req, res) => {
    const products = readProducts();
  const list = Object.entries(products).map(([id, product]) => ({
    id,
    name: product.name || id,
    category: product.category || '',
    image: product.image || '',
    bannerImage: product.bannerImage || '',
    video: product.video || ''
  }));
  res.json(list);
});

app.post('/api/products/:id/image', 
  param('id').notEmpty().isString().escape(),
  upload.single('image'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const products = readProducts();

    if (!products[id]) {
      return res.status(404).json({ message: `Product ${id} not found` });
    }

    let imagePath = req.body.image || '';

    if (req.file) {
      imagePath = `/images/uploads/${req.file.filename}`;
    }

    products[id].image = imagePath;
    writeProducts(products);

    return res.json({
      success: true,
      productId: id,
      image: imagePath
    });
  }
);

app.post('/api/products/:id/banner-image', 
  param('id').notEmpty().isString().escape(),
  upload.single('bannerImage'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const products = readProducts();

    if (!products[id]) {
      return res.status(404).json({ message: `Product ${id} not found` });
    }

    let bannerImagePath = req.body.bannerImage || '';

    if (req.file) {
      bannerImagePath = `/images/uploads/${req.file.filename}`;
    }

    products[id].bannerImage = bannerImagePath;
    writeProducts(products);

    return res.json({
      success: true,
      productId: id,
      bannerImage: bannerImagePath
    });
  }
);

app.post('/api/products/:id/video', 
  param('id').notEmpty().isString().escape(),
  upload.single('video'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const products = readProducts();

    if (!products[id]) {
      return res.status(404).json({ message: `Product ${id} not found` });
    }

    let videoPath = req.body.video || '';

    if (req.file) {
      videoPath = `/images/uploads/${req.file.filename}`;
    }

    products[id].video = videoPath;
    writeProducts(products);

    return res.json({
      success: true,
      productId: id,
      video: videoPath
    });
  }
);

app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Coway admin API is running' });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  
  // 处理 Multer 错误
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: '文件上传错误', details: err.message });
  }
  
  // 处理其他错误
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
  });
});

app.listen(PORT, () => {
  console.log(`Coway admin server is running on http://localhost:${PORT}`);
});
