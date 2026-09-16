import Tesseract from 'tesseract.js';

export async function extractTextFromImage(dataUrl: string): Promise<string> {
  try {
    const result = await Tesseract.recognize(
      dataUrl,
      'ita', // Italian language
      {
        logger: m => console.log(m)
      }
    );
    return result.data.text;
  } catch (error) {
    console.error('Tesseract OCR error:', error);
    throw new Error('Errore durante il riconoscimento del testo dall\'immagine.');
  }
}
