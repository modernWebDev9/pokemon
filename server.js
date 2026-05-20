const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PROJECT_ROOT = __dirname;
const DB_PATH = path.join(PROJECT_ROOT, 'db.json');
const AVATARS_DIR = path.join(PROJECT_ROOT, 'src', 'assets', 'avatars');

console.log('========================================');
console.log('Project Root:', PROJECT_ROOT);
console.log('DB Path:', DB_PATH);
console.log('DB exists:', fs.existsSync(DB_PATH));
console.log('Avatars Dir:', AVATARS_DIR);
console.log('========================================');

// Create avatars directory if not exists
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
  console.log('Created avatars directory:', AVATARS_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATARS_DIR);
  },
  filename: (req, file, cb) => {
    const trainerId = req.body.trainerId;
    console.log('Generating filename for trainer:', trainerId);
    
    if (!trainerId || trainerId === 'undefined') {
      console.error('Invalid trainerId, using timestamp fallback');
      const filename = `avatar_${Date.now()}${path.extname(file.originalname)}`;
      cb(null, filename);
      return;
    }
    
    const ext = path.extname(file.originalname);
    const filename = `trainer_${trainerId}${ext}`;
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

// 파일 쓰기 확인을 위한 함수
function updateDBFile(trainerId, avatarUrl) {
  console.log('=== updateDBFile called ===');
  console.log('trainerId:', trainerId);
  console.log('avatarUrl:', avatarUrl);
  
  try {
    // 1. 현재 db.json 읽기
    if (!fs.existsSync(DB_PATH)) {
      console.error('db.json does not exist at:', DB_PATH);
      return false;
    }
    
    const dbContent = fs.readFileSync(DB_PATH, 'utf8');
    console.log('Current db.json content length:', dbContent.length);
    
    const db = JSON.parse(dbContent);
    console.log('Trainers in db:', db.trainers.map(t => ({ id: t.id, name: t.name, avatar_url: t.avatar_url })));
    
    // 2. 트레이너 찾기
    const trainerIndex = db.trainers.findIndex(t => String(t.id) === String(trainerId));
    console.log('Trainer index:', trainerIndex);
    
    if (trainerIndex === -1) {
      console.error(`Trainer ${trainerId} not found`);
      return false;
    }
    
    // 3. avatar_url 업데이트
    const oldAvatarUrl = db.trainers[trainerIndex].avatar_url;
    db.trainers[trainerIndex].avatar_url = avatarUrl;
    console.log('Updated avatar_url from:', oldAvatarUrl, 'to:', avatarUrl);
    
    // 4. 파일에 쓰기
    const newContent = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_PATH, newContent, 'utf8');
    console.log('File written successfully');
    
    // 5. 쓰기 확인
    const verifyContent = fs.readFileSync(DB_PATH, 'utf8');
    const verifyDb = JSON.parse(verifyContent);
    const savedUrl = verifyDb.trainers[trainerIndex].avatar_url;
    console.log('Verification - saved avatar_url:', savedUrl);
    
    return savedUrl === avatarUrl;
  } catch (error) {
    console.error('Error in updateDBFile:', error);
    return false;
  }
}

// Upload endpoint
app.post('/api/upload-avatar', (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    
    console.log('=== Upload Request ===');
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);
    
    const trainerId = req.body.trainerId;
    const file = req.file;
    
    if (!file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!trainerId || trainerId === 'undefined') {
      console.error('Invalid trainerId');
      return res.status(400).json({ error: 'Invalid trainerId' });
    }
    
    const filename = file.filename;
    const avatarUrl = `/assets/avatars/${filename}`;
    
    console.log('Final filename:', filename);
    console.log('Avatar URL:', avatarUrl);
    
    // db.json 업데이트
    const updateSuccess = updateDBFile(trainerId, avatarUrl);
    
    if (updateSuccess) {
      console.log('✅ db.json updated successfully');
      
      // 다시 읽어서 확인
      const verifyContent = fs.readFileSync(DB_PATH, 'utf8');
      const verifyDb = JSON.parse(verifyContent);
      const trainer = verifyDb.trainers.find(t => String(t.id) === String(trainerId));
      console.log('Final trainer data in db.json:', trainer);
      
      res.json({ 
        success: true, 
        avatarUrl: avatarUrl,
        filename: filename
      });
    } else {
      console.error('❌ Failed to update db.json');
      res.status(500).json({ 
        error: 'Failed to update database',
        avatarUrl: avatarUrl  // 그래도 URL은 반환
      });
    }
  });
});

// Get avatar file endpoint
app.get('/assets/avatars/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(AVATARS_DIR, filename);
  
  console.log('Avatar requested:', filename);
  
  if (fs.existsSync(filepath)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(filepath);
  } else {
    console.log('File not found:', filepath);
    res.status(404).json({ error: 'File not found' });
  }
});

// db.json 직접 확인용 엔드포인트
app.get('/api/check-db', (req, res) => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf8');
      const db = JSON.parse(content);
      res.json({
        path: DB_PATH,
        exists: true,
        trainers: db.trainers.map(t => ({
          id: t.id,
          name: t.name,
          avatar_url: t.avatar_url
        }))
      });
    } else {
      res.json({ path: DB_PATH, exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  const avatarsDir = fs.existsSync(AVATARS_DIR) ? fs.readdirSync(AVATARS_DIR) : [];
  
  res.json({ 
    message: 'Avatar server is running!',
    avatarsDir: AVATARS_DIR,
    avatars: avatarsDir
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log('========================================');
  console.log(`✅ Avatar server running on http://localhost:${PORT}`);
  console.log('Upload: POST http://localhost:3000/api/upload-avatar');
  console.log('Check DB: GET http://localhost:3000/api/check-db');
  console.log('========================================');
});