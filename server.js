import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const ZIKIR_DIR = path.join(__dirname, 'zikir_mp3');
fs.mkdirSync(ZIKIR_DIR, { recursive: true });

const ZIKIR_LIST = [
  'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ',
  'لَا إِلَهَ إِلَّا اللَّهُ',
  'أَسْتَغْفِرُ اللَّهَ',
  'اللَّهُ أَكْبَرُ',
  'اللَّهُمَّ اغْفِرْ لَنَا وَارْحَمْنَا وَلِوَالِدَيْنَا',
  'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
  'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
  'اللَّهُمَّ آتِنِي الْحِكْمَةَ الَّتِي مَنْ أُوتِيَهَا فَقَدْ أُوتِيَ خَيْرًا كَثِيرًا',
  'رَبَّنَا لَا تُؤَاخِذْنَا إِنْ نَسِينَا أَوْ أَخْطَأْنَا',
];

const ZIKIR_TTS_LIST = [
  'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيم.',
  'لَا إِلَٰهَ إِلَّا اللَّهُ.',
  'أَسْتَغْفِرُ اللَّه.',
  'اللَّهُ أَكْبَر.',
  'اللَّهُمَّ اغْفِرْ لَنَا وَارْحَمْنَا وَلِوَالِدَيْنَا.',
  'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ، وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا.',
  'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً، وَفِي الْآخِرَةِ حَسَنَةً، وَقِنَا عَذَابَ النَّار.',
  'اللَّهُمَّ آتِنِي الْحِكْمَةَ، الَّتِي مَنْ أُوتِيَهَا فَقَدْ أُوتِيَ خَيْرًا كَثِيرًا.',
  'رَبَّنَا لَا تُؤَاخِذْنَا إِنْ نَسِينَا أَوْ أَخْطَأْنَا.',
];

const inFlightGenerations = new Map();

async function synthesizeArabicMp3(text, outputMp3Path) {
  const tts = new MsEdgeTTS();
  const tmpPath = `${outputMp3Path}.tmp-${Date.now()}.mp3`;

  try {
    await tts.setMetadata(
      'ar-EG-ShakirNeural',
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    const { audioStream } = tts.toStream(text, { rate: 0.85 });
    const chunks = [];

    await new Promise((resolve, reject) => {
      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    const mp3Buffer = Buffer.concat(chunks);
    if (mp3Buffer.length === 0) {
      throw new Error('Generated MP3 buffer is empty');
    }

    await fs.promises.writeFile(tmpPath, mp3Buffer);
    await fs.promises.rename(tmpPath, outputMp3Path);
    return outputMp3Path;
  } catch (err) {
    try {
      await fs.promises.unlink(tmpPath);
    } catch {}
    throw err;
  } finally {
    try {
      tts.close();
    } catch {}
  }
}

async function ensureZikirMp3(index, force = false) {
  const filename = `zikir-${index + 1}.mp3`;
  const mp3Path = path.join(ZIKIR_DIR, filename);

  if (!force) {
    try {
      const stat = await fs.promises.stat(mp3Path);
      if (stat.isFile() && stat.size > 0) {
        return { mp3Path, filename, cached: true };
      }
    } catch {}
  }

  const flightKey = `${index}:${force ? 'force' : 'normal'}`;
  if (inFlightGenerations.has(flightKey)) {
    return inFlightGenerations.get(flightKey);
  }

  const job = (async () => {
    const text = ZIKIR_TTS_LIST[index] || ZIKIR_LIST[index];
    await synthesizeArabicMp3(text, mp3Path);
    return { mp3Path, filename, cached: false };
  })();

  inFlightGenerations.set(flightKey, job);
  try {
    return await job;
  } finally {
    inFlightGenerations.delete(flightKey);
  }
}

app.use(express.static(__dirname));

app.get('/api/zikir/status', async (req, res) => {
  const items = await Promise.all(
    ZIKIR_LIST.map(async (text, index) => {
      const filename = `zikir-${index + 1}.mp3`;
      const mp3Path = path.join(ZIKIR_DIR, filename);
      let exists = false;
      try {
        const stat = await fs.promises.stat(mp3Path);
        exists = stat.isFile() && stat.size > 0;
      } catch {}
      return {
        index,
        filename,
        exists,
        text,
        url: `/api/zikir/audio/${index}`,
      };
    })
  );
  res.json({ items });
});

app.post('/api/zikir/prepare/:index', async (req, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= ZIKIR_LIST.length) {
    return res.status(400).json({ error: 'Invalid zikir index' });
  }
  const force = req.query.force === '1';
  try {
    const result = await ensureZikirMp3(index, force);
    res.json({
      index,
      filename: result.filename,
      cached: result.cached,
      url: `/api/zikir/audio/${index}`,
    });
  } catch (err) {
    console.error('[Zikir TTS Error]', err);
    res.status(500).json({ error: err?.message || 'Failed to generate zikir MP3' });
  }
});

app.post('/api/zikir/regenerate', async (req, res) => {
  const results = [];
  for (let i = 0; i < ZIKIR_LIST.length; i += 1) {
    try {
      const result = await ensureZikirMp3(i, true);
      results.push({ index: i, filename: result.filename, ok: true });
    } catch (err) {
      console.error(`[Zikir Regenerate Error index=${i}]`, err);
      return res.status(500).json({
        error: err?.message || 'Failed to regenerate zikir MP3s',
        completed: results,
      });
    }
  }
  res.json({ ok: true, items: results });
});

app.get('/api/zikir/audio/:index', async (req, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= ZIKIR_LIST.length) {
    return res.status(400).json({ error: 'Invalid zikir index' });
  }

  try {
    const { mp3Path, filename } = await ensureZikirMp3(index, false);
    res.setHeader('Content-Type', 'audio/mpeg');
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    res.sendFile(mp3Path);
  } catch (err) {
    console.error('[Zikir Audio Error]', err);
    res.status(500).json({ error: err?.message || 'Failed to generate zikir MP3' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
