# تېخنىكىلىق لايىھە ئۆلچىمى (SPEC) — بىلىك قۇرالى

## 1. سىستېما بىناكارلىقى
بىلىك قۇرالى Chrome كېڭەيتىلمىسى (`manifest_version: 3`) ۋە Node.js/Express تور مۇلازىمېتىرىدىن تەركىب تاپقان قوش قاتلاملىق قوللىنىشچان پروگرامما:

```
┌──────────────────────────────────────────────────────────┐
│ ئالدى تەرەپ (Browser / Extension Content Script)          │
│  - index.html (Web Host + chrome.* API Shim)             │
│  - background.js (ئوڭ چېكىش تىزىملىكى لوگىكىسى)          │
│  - content.js (تېكىست فورماتلاش، تاختا، MP3 قويغۇچ)      │
│  - styles.css (كۇنۇپكا ئۇسلۇبلىرى)                       │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTP / REST (Audio & Status)
┌───────────────────────────▼──────────────────────────────┐
│ ئارقا تەرەپ مۇلازىمېتىرى (Node.js 22 + Express, :3000)   │
│  - server.js                                             │
│  - msedge-tts (ar-EG-ShakirNeural, 24kHz 96kbps MP3)      │
│  - zikir_mp3/zikir-1..9.mp3 (دىسكا ساقلاش قىسقۇچى)      │
└───────────────────────────┴──────────────────────────────┘
```

---

## 2. ھۆججەت قۇرۇلمىسى ۋە ۋەزىپىسى

| ھۆججەت | ۋەزىپىسى |
|---|---|
| `manifest.json` | Chrome MV3 سەپلىمىسى (`contextMenus`, `activeTab`, `background`, `content_scripts`) |
| `background.js` | ئوڭ چېكىش تىزىملىكىنى تىزىملاش ۋە `formatText` ئۇچۇرى ئەۋەتىش |
| `content.js` | خەت فورماتلاش، ئەسلىگە قايتۇرۇش، TTS ئوقۇش، زىكىر تەتۈر سانىقى ۋە MP3 قويۇش |
| `styles.css` | `.uyghur-format-button` ئۇسلۇبى |
| `index.html` | تور مۇھىتىدا `chrome.*` API نى تەقلىدلەش ۋە سىناق تېكىست بەت قېلىپى |
| `server.js` | Express تۇراقلىق ھۆججەت مۇلازىمىتى، نېرۋا تورى ئەرەبچە ئاۋاز بىرىكتۈرۈش ۋە MP3 ساقلاش API |
| `package.json` | Node.js قۇرۇلما ۋە بېقىنىشلار (`express`, `msedge-tts`) |
| `metadata.json` | قوللىنىشچان پروگرامما ئۇچۇرى |

---

## 3. مۇلازىمېتىر API لايىھەسى (`server.js`)

### 3.1 `GET /api/zikir/status`
بارلىق 9 زىكىرنىڭ تېكىستى، MP3 ھۆججەت نامى، دىسكىدا بار-يوقلۇقى (`exists`) ۋە ئاۋاز URL نى قايتۇرىدۇ.

### 3.2 `POST /api/zikir/prepare/:index`
- **پارامېتىر**: `index` (`0`–`8`)، ئىختىيارىي `?force=1` (بار بولغان MP3 نى قايتا ھاسىللاش).
- **ھەرىكەت**:
  1. `zikir_mp3/zikir-${index + 1}.mp3` مەۋجۇت بولۇپ `force !== '1'` بولسا دەرھال `{ index, filename, cached: true, url }` قايتۇرىدۇ.
  2. بولمىسا نېرۋا تورى ئەرەبچە ئاۋاز بىرىكتۈرۈش (`ar-EG-ShakirNeural`) ئارقىلىق MP3 ھاسىللاپ ساقلايدۇ.
- **جاۋاب (`200`)**:
  ```json
  { "index": 0, "filename": "zikir-1.mp3", "cached": false, "url": "/api/zikir/audio/0" }
  ```

### 3.3 `POST /api/zikir/regenerate`
بارلىق 9 زىكىر MP3 ھۆججىتىنى (`zikir-1.mp3` – `zikir-9.mp3`) قايتا ھاسىللاپ ساقلايدۇ.

### 3.4 `GET /api/zikir/audio/:index`
- `Content-Type: audio/mpeg` سەرلەۋھىسى بىلەن `zikir_mp3/zikir-${index + 1}.mp3` نى يوللايدۇ (`res.sendFile`).
- `?download=1` بولسا `Content-Disposition: attachment` قوشىدۇ.

---

## 4. ئاۋاز بىرىكتۈرۈش ۋە MP3 ساقلاش ئېقىمى

1. **نېرۋا تورى ئەرەبچە ئاۋازى**: `ar-EG-ShakirNeural` (`OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3`, `rate: 0.92`).
2. **ئاتوملۇق ساقلاش**: `.tmp` ھۆججەتكە يېزىپ `fs.promises.rename` ئارقىلىق `zikir_mp3/zikir-N.mp3` غا ئۆزگەرتىلىدۇ.
3. **پاراللېل قۇلۇپ (`inFlightGenerations`)**: بىرلا `index` ئۈچۈن تەڭ كەلگەن كۆپ تەلەپلەر بىر قېتىملىق بىرىكتۈرۈشنى ئورتاقلىشىدۇ.

---

## 5. ئالدى تەرەپ ھالەت باشقۇرۇش (`content.js`)

### 5.1 فورماتلاش ھالىتى
- `DEFAULT_SETTINGS`: `{ font: "'UKIJ Tuz', 'Alkatip', sans-serif", size: 18, lineHeight: 1.6, direction: 'rtl', align: 'justify' }`
- `updateStyleTag()`: `activeElement` غا `.uyghur-formatted-text` قوشۇپ، `#uyg-custom-dynamic-style` نى يېڭىلايدۇ.
- `resetFormatting()`: بارلىق `.uyghur-formatted-text` كلاسلىرىنى ۋە `#uyg-custom-dynamic-style` نى ئۆچۈرۈپ، `currentSettings` نى `DEFAULT_SETTINGS` قا قايتۇرىدۇ.

### 5.2 زىكىر ھالىتى ۋە ۋاقىت كونترولى
- `zikirEnabled` (`boolean`, سۈكۈتتە `true`)
- `zikirMinutes` (`number`, سۈكۈتتە `7`, ئەڭ كىچىك `1`, ئەڭ چوڭ `180`)
- `zikirRemainingSeconds` (سېكۇنت بويىچە تەتۈر ساناق)
- `zikirAudio` (`HTMLAudioElement` — ئالدىنقى قويۇلۇۋاتقان MP3 نى توختىتىپ يېڭىسىنى قويىدۇ، `#uyg-volume-range` بىلەن ئاۋازى ماسلىشىدۇ)
- `speakZikir(forcePlay)`:
  1. `POST /api/zikir/prepare/${currentIdx}` نى چاقىرىپ MP3 نىڭ مۇلازىمېتىردا ساقلانغانلىقىنى جەزملەيدۇ.
  2. `#uyg-zikir-text` تا ئەرەبچە تېكىستنى، `#uyg-zikir-mp3-info` دا MP3 ھۆججەت نامى ۋە چۈشۈرۈش ئۇلىنىشىنى كۆرسىتىدۇ.
  3. `new Audio(data.url)` ئارقىلىق ساقلانغان MP3 نى قويىدۇ ھەم كېيىنكى زىكىرنى ئارقا سۇپىدا تەييارلايدۇ (`prewarmNextZikirMp3`).

---

## 6. خاتالىق بىر تەرەپ قىلىش ۋە بىخەتەرلىك
- `GEMINI_API_KEY` كەم بولسا ياكى Gemini API خاتالىق (`400`/`403`/`429`) قايتۇرسا، مۇلازىمېتىر شۇ HTTP ھالەت كودى ۋە خاتالىق ئۇچۇرىنى قايتۇرىدۇ؛ يالغان ياكى توركۆرگۈ TTS غا يوشۇرۇن چۈشۈپ كېتىش بولمايدۇ.
- بارلىق ئابونتلارنىڭ قىممەت كىرگۈزۈشى (`index`, `zikirMinutes`) تەكشۈرۈلىدۇ.

---

## 7. تەكشۈرۈش تىزىملىكى
- `npm run build` ۋە `npm run lint` خاتالىقسىز ئۆتۈشى كېرەك.
- `GET /api/zikir/status` بارلىق 9 زىكىر تىزىملىكىنى `200` بىلەن قايتۇرۇشى كېرەك.
- `POST /api/zikir/prepare/:index` Gemini TTS دىن MP3 ھاسىللاپ `zikir_mp3/zikir-N.mp3` قىلىپ ساقلىشى ۋە `GET /api/zikir/audio/:index` نىڭ `audio/mpeg` قايتۇرۇشى كېرەك.
- `ئەسلى ھالەتكە قايتۇرۇش` كۇنۇپكىسى بارلىق CSS تەڭشەكلىرىنى تازىلىشى كېرەك.
