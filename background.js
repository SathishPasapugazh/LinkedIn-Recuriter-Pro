importScripts('puter.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CALL_GEMINI') {
    // This is now handled in popup.js directly, but kept for compatibility if needed
    handlePuterCall(request.jd, request.pdfData, sendResponse);
    return true; 
  }
  if (request.action === 'ASK_FOLLOWUP') {
    handleFollowUp(request.jd, request.pdfData, request.resumeText, request.question, sendResponse);
    return true;
  }
});

async function handlePuterCall(jd, pdfData, sendResponse) {
  try {
    const prompt = `You are an expert technical recruiter.
Compare the following Job Description and the attached Candidate Profile PDF.
Return JSON only with:
- score (0-100)
- matching_skills (array of objects: { "skill": string, "years_of_experience": string })
- missing_skills (array)
- experience_match (short text)
- recommendation (Shortlist / Maybe / Reject)

Extract or infer years of experience per skill from the profile.

Job Description:
${jd}
`;

    // Puter's ai.chat can handle base64 data URLs if we pass them as strings
    // or we can try to pass the data directly.
    // For simplicity, we'll assume popup.js handles the main analysis now.
    const response = await puter.ai.chat(prompt, `data:application/pdf;base64,${pdfData}`);
    const resultText = response.message.content;
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
    
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('Puter Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleFollowUp(jd, pdfData, resumeText, question, sendResponse) {
  try {
    const prompt = `You are a senior technical recruiter.
Given the Job Description and Candidate Profile below, answer the user's question.
Be concise, practical, and recruiter-focused.

Job Description:
${jd}

Candidate Profile Text:
${resumeText || 'Not available'}

Question:
${question}
`;

    // If pdfData is provided, we use it. If not (because we used text extraction), we just use the text.
    // In the new popup.js, we don't pass pdfData to content script, so it might be empty here.
    // But the content script might have the text if we passed it.
    // Let's assume we might have the PDF data if it was a re-run.
    
    let response;
    if (pdfData) {
      response = await puter.ai.chat(prompt, `data:application/pdf;base64,${pdfData}`);
    } else {
      response = await puter.ai.chat(prompt);
    }
    
    const answer = response.message.content;
    sendResponse({ success: true, answer });
  } catch (error) {
    console.error('Puter Follow-up Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}
