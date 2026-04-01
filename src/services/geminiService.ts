import { GoogleGenAI } from "@google/genai";

export async function chatWithPDF(
  pdfText: string, 
  userMessage: string, 
  history: { role: string, parts: { text: string }[] }[]
) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are a helpful assistant that answers questions about a PDF document. 
  The text content of the PDF is provided below. 
  Use this context to answer the user's questions accurately. 
  If the answer is not in the PDF, say so, but try to be as helpful as possible.
  
  PDF CONTENT:
  ${pdfText}`;

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction,
    },
    history: history,
  });

  const response = await chat.sendMessage({
    message: userMessage,
  });

  return response.text;
}
