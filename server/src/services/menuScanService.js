const { GoogleGenAI } = require('@google/genai');
const Tesseract = require('tesseract.js');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Validate and decode image dataUrl or buffer
 */
function decodeImage(dataUrlOrBase64) {
  if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== 'string') {
    const error = new Error('Dữ liệu hình ảnh không hợp lệ');
    error.status = 400;
    throw error;
  }

  let mimeType = 'image/jpeg';
  let base64Data = dataUrlOrBase64;

  const match = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(dataUrlOrBase64);
  if (match) {
    mimeType = match[1];
    base64Data = match[3];
  } else {
    // Check if it starts with base64 directly
    base64Data = dataUrlOrBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    const error = new Error('Dung lượng ảnh vượt quá giới hạn 10MB hoặc dữ liệu rỗng');
    error.status = 400;
    throw error;
  }

  return { buffer, mimeType, base64: base64Data };
}

/**
 * Extract menu items using Google Gemini Vision AI
 */
async function extractWithGemini(base64, mimeType, customApiKey = null) {
  const apiKey = (customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('Chưa cấu hình GEMINI_API_KEY');
    error.code = 'NO_API_KEY';
    throw error;
  }

  const prompt = `
Bạn là chuyên gia trích xuất dữ liệu thực đơn (menu) F&B Việt Nam.
Hãy đọc kỹ hình ảnh thực đơn này và trích xuất danh sách tất cả các món ăn, đồ uống thành mảng JSON.

Yêu cầu chi tiết cho mỗi món:
- name: Tên món ăn hoặc đồ uống (tiếng Việt có dấu chuẩn xác, bỏ các số thứ tự như 1., 2.).
- price: Giá bán dạng số nguyên VND (Ví dụ: "35k" -> 35000, "45.000" -> 45000, "120" -> 120000 nếu bảng giá ghi nghìn đồng). Nếu một món có nhiều kích cỡ (S/M/L) với giá khác nhau, lấy giá cơ bản/nhỏ nhất và ghi kích cỡ vào phần name hoặc description.
- category: Tên danh mục (Ví dụ: "Gà rán", "Món nướng", "Trà sữa", "Cà phê", "Khai vị", "Món chính"... dựa vào tiêu đề nhóm trên menu).
- unit: Đơn vị tính ("Phần", "Ly", "Lon", "Đĩa", "Tô", "Chai", "Combo"...). Mặc định là "Ly" nếu là thức uống, "Phần" nếu là đồ ăn.
- kitchen_type: "BAR" nếu là đồ uống/pha chế, "KITCHEN" nếu là món ăn cần chế biến ở bếp.
- description: Ghi chú, định lượng hoặc thành phần đi kèm nếu menu có ghi (hoặc chuỗi rỗng "").

CHỈ TRẢ VỀ DUY NHẤT MẢNG JSON, không có lời dẫn hay giải thích:
[
  {
    "name": "Tên món",
    "price": 35000,
    "category": "Tên danh mục",
    "unit": "Phần",
    "kitchen_type": "KITCHEN",
    "description": ""
  }
]
`;

  let responseText = '';

  // Try using @google/genai SDK first
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Support current active models: gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.8-flash, etc.
    const modelsToTry = [
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ];
    let lastErr = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64
                  }
                },
                { text: prompt }
              ]
            }
          ],
          config: {
            responseMimeType: 'application/json'
          }
        });

        if (response && response.text) {
          responseText = response.text;
          break;
        }
      } catch (err) {
        lastErr = err;
        console.warn(`Gemini model ${model} failed, trying next model:`, err.message);
      }
    }

    if (!responseText && lastErr) {
      throw lastErr;
    }
  } catch (sdkError) {
    // Fallback: direct REST API call if SDK method had an issue
    console.warn('SDK call failed, trying direct Gemini REST endpoint:', sdkError.message);
    const restModels = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    let restSuccess = false;

    for (const rModel of restModels) {
      try {
        const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${rModel}:generateContent?key=${apiKey}`;
        const restRes = await fetch(restUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64
                    }
                  },
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              response_mime_type: 'application/json'
            }
          })
        });

        if (restRes.ok) {
          const data = await restRes.json();
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (responseText) {
            restSuccess = true;
            break;
          }
        }
      } catch (e) {
        console.warn(`Direct REST fallback with ${rModel} failed:`, e.message);
      }
    }

    if (!restSuccess && !responseText) {
      throw new Error(`Tất cả kết nối Gemini đều thất bại: ${sdkError.message}`);
    }
  }

  // Parse JSON response
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const items = JSON.parse(cleaned);
  if (!Array.isArray(items)) {
    throw new Error('Dữ liệu Gemini trả về không phải là mảng danh sách món ăn');
  }

  return normalizeExtractedItems(items, 'gemini');
}

/**
 * Extract menu items using Tesseract OCR + Smart Vietnamese regex parsing
 */
async function extractWithOcr(buffer) {
  let text = '';
  try {
    // Try Vietnamese language first
    const result = await Tesseract.recognize(buffer, 'vie', {
      errorHandler: e => console.warn('Tesseract worker error:', e)
    });
    text = result.data.text;
  } catch (vieError) {
    console.warn('OCR with vie failed, falling back to eng:', vieError.message);
    const result = await Tesseract.recognize(buffer, 'eng');
    text = result.data.text;
  }

  if (!text || !text.trim()) {
    return { success: true, engine: 'ocr', items: [] };
  }

  const parsedItems = parseMenuTextWithHeuristics(text);
  return normalizeExtractedItems(parsedItems, 'ocr');
}

/**
 * Smart line-by-line parser for raw OCR menu text
 */
function parseMenuTextWithHeuristics(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  let currentCategory = 'Món chung';

  // Common category indicator keywords
  const categoryKeywords = /^(món|khai vị|món chính|món thêm|món nướng|món lẩu|món chiên|món xào|trà|cà phê|cafe|đồ uống|nước ngọt|nước ép|sinh tố|tráng miệng|combo|đặc biệt|topping|bánh|kem|ăn vặt)/i;
  // Drinks keywords for kitchen_type = BAR
  const drinkKeywords = /(trà|cà phê|cafe|nước|sinh tố|soda|bia|sữa|juice|tea|smoothie|matcha|chanh|quất|dừa|cam sả|me đá)/i;

  for (const line of lines) {
    // Ignore lines that are too short
    if (line.length < 3) continue;

    // Check if line looks like a category header:
    // - Starts with category keyword and has no price
    // - Or all uppercase letters and length > 4 and has no price
    // - Or ends with ':'
    const hasDigits = /\d/.test(line);
    const isUppercase = line.length > 4 && line === line.toUpperCase() && /[A-ZÀ-Ỹ]/.test(line);

    if (!hasDigits && (categoryKeywords.test(line) || isUppercase || line.endsWith(':'))) {
      currentCategory = line.replace(/[:\-=_~…]/g, '').trim();
      continue;
    }

    // Try to extract Item Name and Price
    // Patterns:
    // 1. "Gà rán giòn cay ...... 45.000đ"
    // 2. "Trà sữa trân châu 35k"
    // 3. "Khoai tây chiên - 25.000 / phần"
    // 4. "Nem nướng 50k"
    const priceMatch = line.match(/(.+?)\s*[:.\-_~…\s]{1,}\s*(\d{1,3}(?:[.,]\d{3})+|\d{1,3}\s*[kK]|\d{4,7})\s*(đ|Đ|vnđ|VND|vnd)?(?:\s*\/\s*([a-zA-Zà-ỹÀ-Ỹ]+))?$/i)
      || line.match(/(.+?)\s+(\d{1,3}(?:[.,]\d{3})*|\d{2,3})\s*(?:k|K|đ|Đ|vnđ|VND)?$/i);

    if (priceMatch) {
      let rawName = priceMatch[1].trim();
      let rawPrice = priceMatch[2].trim();
      let matchedUnit = priceMatch[4] ? priceMatch[4].trim() : '';

      // Clean up item name: remove leading numbers like "1. ", "02 - ", etc.
      rawName = rawName.replace(/^[\d]+[\s.\-_)]+/, '').trim();
      rawName = rawName.replace(/[:.\-_~…]+$/, '').trim();

      // If name is too short or numeric, skip
      if (rawName.length < 2 || /^\d+$/.test(rawName)) continue;

      // Normalize price
      let price = 0;
      if (/[kK]$/i.test(rawPrice)) {
        price = parseFloat(rawPrice.replace(/[kK]/i, '').trim()) * 1000;
      } else {
        const cleanDigits = rawPrice.replace(/[.,]/g, '').trim();
        price = parseInt(cleanDigits, 10);
        // If price is small like 35 or 45, it represents thousands (35k -> 35000)
        if (price > 0 && price <= 500) {
          price = price * 1000;
        }
      }

      if (isNaN(price) || price <= 0) continue;

      const isDrink = drinkKeywords.test(rawName) || drinkKeywords.test(currentCategory);
      const unit = matchedUnit || (isDrink ? 'Ly' : 'Phần');
      const kitchen_type = isDrink ? 'BAR' : 'KITCHEN';

      items.push({
        name: rawName,
        price,
        category: currentCategory,
        unit,
        kitchen_type,
        description: ''
      });
    }
  }

  return items;
}

/**
 * Standardize extracted items and remove invalid entries
 */
function normalizeExtractedItems(rawItems, engine) {
  const sanitized = [];
  const seen = new Set();

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const name = String(item.name || '').trim();
    if (!name) continue;

    const lowerName = name.toLowerCase();
    if (seen.has(lowerName)) continue;
    seen.add(lowerName);

    let price = Number(item.price);
    if (isNaN(price) || price < 0) price = 0;
    // Format small numbers (e.g. 35 -> 35000)
    if (price > 0 && price <= 500) price = price * 1000;

    const category = String(item.category || 'Món chung').trim() || 'Món chung';
    const unit = String(item.unit || 'Phần').trim() || 'Phần';
    const kitchen_type = item.kitchen_type === 'BAR' ? 'BAR' : 'KITCHEN';
    const description = String(item.description || '').trim();

    sanitized.push({
      name,
      price,
      category,
      unit,
      kitchen_type,
      description
    });
  }

  return {
    success: true,
    engine,
    items: sanitized
  };
}

/**
 * Main dispatcher: extract menu from image
 */
async function extractMenu(dataUrlOrBase64, options = {}) {
  const { buffer, mimeType, base64 } = decodeImage(dataUrlOrBase64);
  const preferredEngine = (options.engine || 'auto').toLowerCase();
  const customApiKey = options.apiKey || null;

  // 1. If user explicitly requested OCR
  if (preferredEngine === 'ocr') {
    return await extractWithOcr(buffer);
  }

  // 2. If user explicitly requested Gemini
  if (preferredEngine === 'gemini') {
    return await extractWithGemini(base64, mimeType, customApiKey);
  }

  // 3. Auto mode: Priority to Gemini if API key is present, fallback to OCR
  const hasGeminiKey = !!(customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

  if (hasGeminiKey) {
    try {
      const geminiResult = await extractWithGemini(base64, mimeType, customApiKey);
      if (geminiResult.items && geminiResult.items.length > 0) {
        return geminiResult;
      }
      console.warn('Gemini returned 0 items, falling back to OCR...');
    } catch (geminiError) {
      console.warn('Gemini processing failed, falling back to Tesseract OCR:', geminiError.message);
    }
  } else {
    console.info('No GEMINI_API_KEY detected, using Tesseract OCR...');
  }

  // Fallback to Tesseract OCR
  return await extractWithOcr(buffer);
}

module.exports = {
  extractMenu,
  extractWithGemini,
  extractWithOcr,
  decodeImage
};
