const db = require("../models");
const Audio = db.audio;
const User = db.user;
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { getAudioDurationInSeconds } = require("get-audio-duration");

// Konfiguracja multera do obsługi przesyłania plików
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/audio");
    // Upewnij się, że katalog istnieje
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generuj unikalną nazwę pliku z oryginalnym rozszerzeniem
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Filtr plików - akceptuj tylko pliki audio
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error("Tylko pliki audio są dozwolone!"), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 100 * 1024 * 1024, // Zwiększ limit do 100MB
    fieldSize: 50 * 1024 * 1024,  // Limit dla pól formularza
    files: 1, // Maksymalnie 1 plik
    parts: 10 // Maksymalnie 10 części formularza
  }
});

// Middleware do obsługi timeout dla przesyłania plików
const extendTimeout = (req, res, next) => {
  // Zwiększ timeout do 10 minut dla przesyłania plików
  req.setTimeout(10 * 60 * 1000); // 10 minut
  res.setTimeout(10 * 60 * 1000); // 10 minut
  next();
};

// Helper function to save base64 as file
const saveBase64AsFile = (base64Data, fileName, mimeType) => {
  const uploadDir = path.join(__dirname, "../uploads/audio");
  
  // Upewnij się, że katalog istnieje
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Generuj unikalną nazwę pliku
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(fileName) || '.wav';
  const uniqueFileName = uniqueSuffix + ext;
  const filePath = path.join(uploadDir, uniqueFileName);
  
  // Konwertuj base64 na buffer i zapisz plik
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);
  
  return filePath;
};

// Pobieranie listy plików audio
exports.getAudioList = async (req, res) => {
  try {
    const userId = req.userId;
    const audioFiles = await Audio.findAll({
      where: { createdBy: userId },
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).send(audioFiles);
  } catch (err) {
    res.status(500).send({ message: err.message || "Wystąpił błąd podczas pobierania listy plików audio." });
  }
};

// Streaming pliku audio
exports.streamAudio = async (req, res) => {
  try {
    const audioId = req.params.id;
    const audio = await Audio.findByPk(audioId);
    
    if (!audio) {
      return res.status(404).send({ message: "Plik audio nie został znaleziony." });
    }
    
    const filePath = audio.filepath;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send({ message: "Plik fizyczny nie został znaleziony." });
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg'
      });
      
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg'
      });
      
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.status(500).send({ message: err.message || "Wystąpił błąd podczas streamingu pliku audio." });
  }
};

// Pobieranie pliku audio
exports.downloadAudio = async (req, res) => {
  try {
    const audioId = req.params.id;
    const audio = await Audio.findByPk(audioId);
    
    if (!audio) {
      return res.status(404).send({ message: "Plik audio nie został znaleziony." });
    }
    
    const filePath = audio.filepath;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send({ message: "Plik fizyczny nie został znaleziony." });
    }
    
    res.download(filePath, `${audio.name}${path.extname(filePath)}`);
  } catch (err) {
    res.status(500).send({ message: err.message || "Wystąpił błąd podczas pobierania pliku audio." });
  }
};

// Usuwanie pliku audio
exports.deleteAudio = async (req, res) => {
  try {
    const audioId = req.params.id;
    const userId = req.userId;
    
    const audio = await Audio.findByPk(audioId);
    
    if (!audio) {
      return res.status(404).send({ message: "Plik audio nie został znaleziony." });
    }
    
    // Sprawdź, czy użytkownik jest właścicielem pliku
    if (audio.createdBy !== userId) {
      return res.status(403).send({ message: "Nie masz uprawnień do usunięcia tego pliku audio." });
    }
    
    const filePath = audio.filepath;
    
    // Usuń plik z bazy danych
    await audio.destroy();
    
    // Usuń plik fizyczny, jeśli istnieje
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.status(200).send({ message: "Plik audio został pomyślnie usunięty." });
  } catch (err) {
    res.status(500).send({ message: err.message || "Wystąpił błąd podczas usuwania pliku audio." });
  }
};

// Middleware do obsługi przesyłania plików z timeout
exports.uploadMiddleware = [extendTimeout, upload.single('audio')];

// Aktualizacja pliku audio
exports.updateAudio = async (req, res) => {
  try {
    const audioId = req.params.id;
    const userId = req.userId;
    
    const audio = await Audio.findByPk(audioId);
    
    if (!audio) {
      // Jeśli plik został przesłany, usuń go
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).send({ message: "Plik audio nie został znaleziony." });
    }
    
    // Sprawdź, czy użytkownik jest właścicielem pliku
    if (audio.createdBy !== userId) {
      // Jeśli plik został przesłany, usuń go
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).send({ message: "Nie masz uprawnień do aktualizacji tego pliku audio." });
    }
    
    // Aktualizuj nazwę, jeśli została podana
    if (req.body.name) {
      audio.name = req.body.name;
    }
    
    // Jeśli przesłano nowy plik, zaktualizuj ścieżkę i długość
    if (req.file) {
      const oldFilePath = audio.filepath;
      
      // Ustaw nową ścieżkę
      audio.filepath = req.file.path;
      
      // Pobierz długość nowego pliku audio
      const durationInSeconds = await getAudioDurationInSeconds(req.file.path);
      audio.length = Math.round(durationInSeconds).toString();
      
      // Usuń stary plik, jeśli istnieje
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    // Aktualizuj informacje o użytkowniku, który dokonał aktualizacji
    audio.updatedBy = userId;
    
    // Zapisz zmiany
    await audio.save();
    
    res.status(200).send({
      message: "Plik audio został pomyślnie zaktualizowany.",
      audio: audio
    });
  } catch (err) {
    res.status(500).send({ message: err.message || "Wystąpił błąd podczas aktualizacji pliku audio." });
  }
};

// Przesyłanie nowego pliku audio
exports.uploadAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "Proszę przesłać plik audio." });
    }
    
    if (!req.body.name) {
      // Usuń przesłany plik, jeśli nie podano nazwy
      fs.unlinkSync(req.file.path);
      return res.status(400).send({ message: "Proszę podać nazwę pliku audio." });
    }
    
    const userId = req.userId;
    const user = await User.findByPk(userId);
    
    if (!user) {
      // Usuń przesłany plik, jeśli użytkownik nie istnieje
      fs.unlinkSync(req.file.path);
      return res.status(404).send({ message: "Użytkownik nie został znaleziony." });
    }
    
    // Pobierz długość pliku audio
    const durationInSeconds = await getAudioDurationInSeconds(req.file.path);
    
    // Utwórz nowy rekord audio
    const audio = await Audio.create({
      name: req.body.name,
      length: Math.round(durationInSeconds).toString(),
      filepath: req.file.path,
      createdBy: userId
    });
    
    res.status(201).send({
      message: "Plik audio został pomyślnie przesłany.",
      audio: audio
    });
  } catch (err) {
    // Usuń przesłany plik w przypadku błędu
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).send({ message: err.message || "Wystąpił błąd podczas przesyłania pliku audio." });
  }
};

// Przesyłanie nowego pliku audio (base64)
exports.uploadAudioBase64 = async (req, res) => {
  try {
    console.log('📥 Received base64 audio upload request...');
    const { name, audioData, mimeType } = req.body;
    
    console.log('📋 Upload data:', {
      name,
      mimeType: mimeType || 'audio/mp3',
      audioDataSize: audioData ? audioData.length : 0
    });
    
    if (!audioData) {
      console.error('❌ No audio data provided');
      return res.status(400).send({ message: "Brak danych audio." });
    }
    
    if (!name) {
      console.error('❌ No name provided');
      return res.status(400).send({ message: "Proszę podać nazwę pliku audio." });
    }
    
    const userId = req.userId;
    const user = await User.findByPk(userId);
    
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).send({ message: "Użytkownik nie został znaleziony." });
    }
    
    try {
      console.log('💾 Saving base64 as file...');
      // Zapisz base64 jako plik
      const filePath = saveBase64AsFile(audioData, `${name}.mp3`, mimeType || 'audio/mp3');
      console.log('✅ File saved to:', filePath);
      
      console.log('🎵 Getting audio duration...');
      // Pobierz długość pliku audio
      const durationInSeconds = await getAudioDurationInSeconds(filePath);
      console.log('⏱️ Audio duration:', durationInSeconds, 'seconds');
      
      console.log('💾 Creating database record...');
      // Utwórz nowy rekord audio
      const audio = await Audio.create({
        name: name,
        length: Math.round(durationInSeconds).toString(),
        filepath: filePath,
        createdBy: userId
      });
      
      console.log('✅ Database record created successfully:', audio.id);
      
      res.status(201).send({
        message: "Plik audio został pomyślnie przesłany.",
        audio: audio
      });
    } catch (fileError) {
      console.error('❌ Error saving base64 file:', fileError);
      return res.status(500).send({ message: "Błąd podczas zapisywania pliku audio." });
    }
  } catch (err) {
    console.error('❌ Upload failed:', err);
    res.status(500).send({ message: err.message || "Wystąpił błąd podczas przesyłania pliku audio." });
  }
};

// Aktualizacja pliku audio (base64)
exports.updateAudioBase64 = async (req, res) => {
  try {
    const audioId = req.params.id;
    const userId = req.userId;
    const { name, audioData, mimeType } = req.body;
    
    const audio = await Audio.findByPk(audioId);
    
    if (!audio) {
      return res.status(404).send({ message: "Plik audio nie został znaleziony." });
    }
    
    // Sprawdź, czy użytkownik jest właścicielem pliku
    if (audio.createdBy !== userId) {
      return res.status(403).send({ message: "Nie masz uprawnień do aktualizacji tego pliku audio." });
    }
    
    // Aktualizuj nazwę, jeśli została podana
    if (name) {
      audio.name = name;
    }
    
    // Jeśli przesłano nowe dane audio, zaktualizuj plik
    if (audioData) {
      try {
        const oldFilePath = audio.filepath;
        
        // Zapisz nowy plik
        const newFilePath = saveBase64AsFile(audioData, `${name || audio.name}.mp3`, mimeType || 'audio/mp3');
        audio.filepath = newFilePath;
        
        // Pobierz długość nowego pliku audio
        const durationInSeconds = await getAudioDurationInSeconds(newFilePath);
        audio.length = Math.round(durationInSeconds).toString();
        
        // Usuń stary plik, jeśli istnieje
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (fileError) {
        console.error('Error updating base64 file:', fileError);
        return res.status(500).send({ message: "Błąd podczas aktualizacji pliku audio." });
      }
    }
    
    // Aktualizuj informacje o użytkowniku, który dokonał aktualizacji
    audio.updatedBy = userId;
    
    // Zapisz zmiany
    await audio.save();
    
    res.status(200).send({
      message: "Plik audio został pomyślnie zaktualizowany.",
      audio: audio
    });
  } catch (err) {
    res.status(500).send({ message: err.message || "Wystąpił błąd podczas aktualizacji pliku audio." });
  }
};