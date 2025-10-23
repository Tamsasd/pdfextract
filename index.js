// valid json formátum hogy ne nyávogjon az openai
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    allergens: {
      type: "object",
      additionalProperties: false,
      properties: {
        Glutén: { type: "boolean" },
        Tojás: { type: "boolean" },
        Rák: { type: "boolean" },
        Hal: { type: "boolean" },
        Földimogyoró: { type: "boolean" },
        Szója: { type: "boolean" },
        Tej: { type: "boolean" },
        Diófélék: { type: "boolean" },
        Zeller: { type: "boolean" },
        Mustár: { type: "boolean" }
      },
      required: ["Glutén", "Tojás", "Rák", "Hal", "Földimogyoró", "Szója", "Tej", "Diófélék", "Zeller", "Mustár"]
    },
    nutrition: {
      type: "object",
      additionalProperties: false,
      properties: {
        Energia: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                value: { type: "number" },
                unit: { type: "string" }
              },
              required: ["value", "unit"]
            }
          ]
        },
        Zsír: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                value: { type: "number" },
                unit: { type: "string" }
              },
              required: ["value", "unit"]
            }
          ]
        },
        Szénhidrát: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                value: { type: "number" },
                unit: { type: "string" }
              },
              required: ["value", "unit"]
            }
          ]
        },
        Cukor: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                value: { type: "number" },
                unit: { type: "string" }
              },
              required: ["value", "unit"]
            }
          ]
        },
        Fehérje: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                value: { type: "number" },
                unit: { type: "string" }
              },
              required: ["value", "unit"]
            }
          ]
        },
        Nátrium: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                value: { type: "number" },
                unit: { type: "string" }
              },
              required: ["value", "unit"]
            }
          ]
        }
      },
      required: ["Energia", "Zsír", "Szénhidrát", "Cukor", "Fehérje", "Nátrium"]
    }
  },
  required: ["allergens", "nutrition"]
};

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
//const os = require("os");
const tmp = require("tmp");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
process.env.TESSDATA_PREFIX = require("path").join(__dirname, "tessdata");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();

const allowedOrigins = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "https://tamas.horneczki.hu"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

app.get("/", (_req, res) => {
  res.send("Hello, I am running!");
});

app.post("/extract-text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");
    const forceOCR = req.query.force_ocr === "true";
    const { text, usedOCR } = await extractText(req.file.buffer, { forceOCR });
    if (meaningfulLen(text) === 0) return res.status(422).json({ error: "No text extracted" });
    res.json({ usedOCR, text: text.slice(0, 120000) });
  } catch (e) {
    res.status(400).json({ error: e.message || "Error" });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");
    req.file.originalname = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const forceOCR = req.query.force_ocr === "true";

    // szöveg kinyerése
    const { text, usedOCR } = await extractText(req.file.buffer, { forceOCR });
    if (meaningfulLen(text) === 0) {
      return res.status(422).json({ error: "No meaningful text (parse+OCR)." });
    }

    // LLM prompt
    const prompt = `
Feladatod: Az alábbi termékleírás szövegéből nyerd ki az ALLERGÉNEKET és a TÁPÉRTÉKET.
Szöveg zajos lehet (táblázat/felsorolás vegyesen). Ha nem találsz értéket, legyen null.
Allergének booleanok. Tápértékek: szám + egység (g, mg, kJ, kcal).
Kimenet kizárólag a megadott JSON-séma szerint.

Szöveg:
"""${text.slice(0, 120000)}"""
    `.trim();

    // LLM hívás
    const resp = await openai.responses.create({
      model: "gpt-5-nano",
      input: [
        { role: "system", content: "Te egy precíz adat-kinyerő vagy. Mindig a megadott JSON-sémát adod vissza." },
        { role: "user", content: prompt }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "FoodInfo",
          schema: JSON_SCHEMA
        }
      }
    });

    let extracted;
    const c0 = resp.output?.[0]?.content?.[0];
    if (c0 && (c0.type === "json" || c0.type === "output_json")) extracted = c0.json;
    else if (resp.output_text) extracted = JSON.parse(resp.output_text);
    else throw new Error("LLM output parsing error");

    res.json({
      fileName: req.file.originalname,
      usedOCR,
      extracted
    });

  } catch (err) {
    res.status(400).json({ error: err.message || "Error" });
  }
});


app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

const OCR_DPI = 300;
const OCR_LANG = "hun";

function meaningfulLen(s) {
  if (typeof s !== "string") return 0;
  const m = s.match(/[A-Za-zÀ-žÁÉÍÓÖŐÚÜŰáéíóöőúüű0-9]/g);
  return m ? m.length : 0;
}


// PDF -> PNG
function pdfToPngBuffers(pdfBuffer, dpi = OCR_DPI) {
  return new Promise((resolve, reject) => {
    const tmpPdf = tmp.fileSync({ postfix: ".pdf" });
    fs.writeFileSync(tmpPdf.name, pdfBuffer);

    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const outPrefix = path.join(tmpDir.name, "page");

    execFile("pdftoppm", ["-png", "-gray", "-r", String(dpi), tmpPdf.name, outPrefix], (err) => {
      if (err) {
        try { tmpPdf.removeCallback(); tmpDir.removeCallback(); } catch { }
        return reject(new Error("pdftoppm futtatási hiba: " + err.message));
      }

      const files = fs.readdirSync(tmpDir.name)
        .filter(f => f.startsWith("page-") && f.endsWith(".png"))
        .sort((a, b) => {
          const ai = parseInt(a.match(/page-(\d+)\.png/)[1], 10);
          const bi = parseInt(b.match(/page-(\d+)\.png/)[1], 10);
          return ai - bi;
        });

      const buffers = files.map(f => fs.readFileSync(path.join(tmpDir.name, f)));
      try { tmpPdf.removeCallback(); tmpDir.removeCallback(); } catch { }
      resolve(buffers);
    });
  });
}

// PNG -> szöveg
async function ocrPngBuffers(buffers, lang = "hun") {
  let fullText = "";

  for (const buffer of buffers) {
    // kép előfeldolgozás
    const processed = await sharp(buffer)
      .grayscale()
      .normalize()
      .linear(1.3, -20)
      .threshold(130)
      .toBuffer();

    // ocr
    const { data } = await Tesseract.recognize(processed, lang, {
      tessedit_pageseg_mode: 4,
      tessedit_ocr_engine_mode: 3,
      preserve_interword_spaces: 1
    });


    fullText += (data.text || "") + "\n";
  }

  return Cleanup(fullText);
}

// szöveg kitisztítása regexel
function Cleanup(t) {
  return (t || "")
    .replace(/Bncrgia|Bnergia|Enerqia/gi, "Energia")
    .replace(/Carbolydrat[eó]/gi, "Carbohydrate")
    .replace(/S[óo]\s*\/\s*Salt/gi, "Só/ Salt")
    .replace(/(\d)\s+(\d)/g, "$1.$2")
    .replace(/k!\b/gi, "kJ")
    .replace(/\s+/g, " ")
    .trim();
}


// szövegkinyerés: pdf-parse, ha az nem működik (vagy forceOCR) akkor OCR használata
const pdfParse = require("pdf-parse");

async function extractText(pdfBuffer, { forceOCR = false } = {}) {
  let text = "";
  // szöveges pdf
  try {
    const parsed = await pdfParse(pdfBuffer);
    text = parsed.text || "";
  } catch (_) {
    text = "";
  }

  // kell-e ocr
  const parsedMeaningful = meaningfulLen(text);
  const shouldOCR = forceOCR || parsedMeaningful < 80;
  if (!shouldOCR) return { text, usedOCR: false };

  // ocr
  const pngs = await pdfToPngBuffers(pdfBuffer, OCR_DPI);
  if (!pngs || pngs.length === 0) return { text, usedOCR: false };

  const ocrText = await ocrPngBuffers(pngs, OCR_LANG);
  return meaningfulLen(ocrText) > parsedMeaningful
    ? { text: ocrText, usedOCR: true }
    : { text, usedOCR: false };
}