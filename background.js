chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CALL_GEMINI') {
    handleGeminiCall(request.jd, request.pdfData, sendResponse);
    return true; // Keep channel open for async response
  }
  if (request.action === 'ASK_FOLLOWUP') {
    handleFollowUp(request.jd, request.pdfData, request.question, sendResponse);
    return true;
  }
});

async function handleGeminiCall(jd, pdfData, sendResponse) {
  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) throw new Error('API Key missing');

    const model = "gemini-3-flash-preview"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { data: pdfData, mimeType: "application/pdf" } }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Gemini API Error');
    }

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(resultText);
    
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('Gemini Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleFollowUp(jd, pdfData, question, sendResponse) {
  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) throw new Error('API Key missing');

    const model = "gemini-3-flash-preview"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `You are a senior technical recruiter.
Given the Job Description and Candidate Profile below, answer the user's question.
Be concise, practical, and recruiter-focused.

Job Description:
${jd}

Question:
${question}
`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { data: pdfData, mimeType: "application/pdf" } }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Gemini API Error');
    }

    const data = await response.json();
    const answer = data.candidates[0].content.parts[0].text;
    
    sendResponse({ success: true, answer });
  } catch (error) {
    console.error('Gemini Follow-up Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}
