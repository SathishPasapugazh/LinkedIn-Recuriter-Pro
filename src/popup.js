// Mock chrome API for browser environment
if (typeof chrome === 'undefined' || !chrome.storage) {
  window.chrome = {
    storage: {
      local: {
        get: (keys) => {
          return new Promise((resolve) => {
            const result = {};
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach(key => {
              const val = localStorage.getItem(`mock_chrome_${key}`);
              result[key] = val ? JSON.parse(val) : undefined;
            });
            resolve(result);
          });
        },
        set: (data) => {
          return new Promise((resolve) => {
            Object.entries(data).forEach(([key, value]) => {
              localStorage.setItem(`mock_chrome_${key}`, JSON.stringify(value));
            });
            resolve();
          });
        }
      }
    },
    tabs: {
      query: () => Promise.resolve([{ id: 1, url: 'https://www.linkedin.com/in/test' }]),
      sendMessage: () => Promise.resolve({ success: true })
    },
    runtime: {
      lastError: null
    },
    scripting: {
      executeScript: () => Promise.resolve(),
      insertCSS: () => Promise.resolve()
    }
  };
}

import * as pdfjsLib from './pdf.min.mjs';

let currentJDs = [];
let editingId = null;

// DOM Elements (will be initialized on DOMContentLoaded)
let mainView, jdFormView, settingsView;
let jdSelect, jdList, pdfUpload, analyzeBtn, addJdBtn;
let jdTitleInput, jdContentInput;

// Initialize
async function init() {
  console.log('Popup initializing...');
  
  // Initialize pdf.js worker
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/src/pdf.worker.min.mjs';
  } catch (e) {
    console.warn('PDF.js worker initialization failed:', e);
  }

  // Initialize elements
  mainView = document.getElementById('main-view');
  jdFormView = document.getElementById('jd-form-view');
  settingsView = document.getElementById('settings-view');
  jdSelect = document.getElementById('jd-select');
  jdList = document.getElementById('jd-list');
  pdfUpload = document.getElementById('pdf-upload');
  analyzeBtn = document.getElementById('analyze-btn');
  addJdBtn = document.getElementById('add-jd-btn');
  jdTitleInput = document.getElementById('jd-title');
  jdContentInput = document.getElementById('jd-content');

  console.log('Elements found:', {
    mainView: !!mainView,
    jdFormView: !!jdFormView,
    addJdBtn: !!addJdBtn,
    jdTitleInput: !!jdTitleInput,
    jdContentInput: !!jdContentInput
  });

  // Setup listeners first so UI is interactive even if data loading fails
  setupEventListeners();
  
  try {
    await loadData();
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function loadData() {
  const data = await chrome.storage.local.get(['jDs']);
  currentJDs = data.jDs || [];
  renderJDs();
}

function renderJDs() {
  // Update Select
  jdSelect.innerHTML = '<option value="">-- Select a JD --</option>';
  currentJDs.forEach(jd => {
    const option = document.createElement('option');
    option.value = jd.id;
    option.textContent = jd.title;
    jdSelect.appendChild(option);
  });

  // Update List
  jdList.innerHTML = '';
  currentJDs.forEach(jd => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="jd-title-text">${jd.title}</span>
      <div class="jd-item-actions">
        <button class="icon-btn edit-jd" data-id="${jd.id}">✏️</button>
        <button class="icon-btn delete-jd" data-id="${jd.id}">🗑️</button>
      </div>
    `;
    jdList.appendChild(li);
  });

  checkAnalyzeStatus();
}

function checkAnalyzeStatus() {
  analyzeBtn.disabled = !jdSelect.value || !pdfUpload.files[0];
}

function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Navigation
  if (addJdBtn) {
    console.log('Attaching listener to add-jd-btn');
    addJdBtn.addEventListener('click', () => {
      console.log('New JD button clicked');
      editingId = null;
      if (jdTitleInput) jdTitleInput.value = '';
      if (jdContentInput) jdContentInput.value = '';
      const formTitle = document.getElementById('form-title');
      if (formTitle) formTitle.textContent = 'Add Job Description';
      showView('form');
    });
  } else {
    console.error('add-jd-btn not found during setupEventListeners');
  }

  const cancelJdBtn = document.getElementById('cancel-jd-btn');
  if (cancelJdBtn) {
    cancelJdBtn.addEventListener('click', () => showView('main'));
  }

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => showView('settings'));
  }

  const backSettingsBtn = document.getElementById('back-settings-btn');
  if (backSettingsBtn) {
    backSettingsBtn.addEventListener('click', () => showView('main'));
  }

  // JD Actions
  const saveJdBtn = document.getElementById('save-jd-btn');
  if (saveJdBtn) {
    saveJdBtn.addEventListener('click', saveJD);
  }

  if (jdSelect) {
    jdSelect.addEventListener('change', checkAnalyzeStatus);
  }
  
  if (pdfUpload) {
    pdfUpload.addEventListener('change', checkAnalyzeStatus);
  }

  if (jdList) {
    jdList.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      
      const id = btn.dataset.id;
      console.log('JD list button clicked:', btn.className, 'ID:', id);
      if (btn.classList.contains('delete-jd')) {
        deleteJD(id);
      } else if (btn.classList.contains('edit-jd')) {
        editJD(id);
      }
    });
  }

  // Analysis
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', startAnalysis);
  }
}

function showView(view) {
  console.log('Showing view:', view);
  if (mainView) mainView.classList.add('hidden');
  if (jdFormView) jdFormView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');

  if (view === 'main' && mainView) mainView.classList.remove('hidden');
  if (view === 'form' && jdFormView) jdFormView.classList.remove('hidden');
  if (view === 'settings' && settingsView) settingsView.classList.remove('hidden');
}

async function saveJD() {
  const title = jdTitleInput.value.trim();
  const content = jdContentInput.value.trim();

  if (!title || !content) {
    console.error('Please fill in all fields');
    return;
  }

  if (editingId) {
    currentJDs = currentJDs.map(jd => jd.id === editingId ? { ...jd, title, content } : jd);
  } else {
    currentJDs.push({
      id: Date.now().toString(),
      title,
      content
    });
  }

  await chrome.storage.local.set({ jDs: currentJDs });
  editingId = null;
  jdTitleInput.value = '';
  jdContentInput.value = '';
  renderJDs();
  showView('main');
}

function editJD(id) {
  const jd = currentJDs.find(j => j.id === id);
  if (!jd) return;
  editingId = id;
  jdTitleInput.value = jd.title;
  jdContentInput.value = jd.content;
  document.getElementById('form-title').textContent = 'Edit Job Description';
  showView('form');
}

async function deleteJD(id) {
  if (!confirm('Are you sure you want to delete this JD?')) return;
  currentJDs = currentJDs.filter(jd => jd.id !== id);
  await chrome.storage.local.set({ jDs: currentJDs });
  renderJDs();
}

async function startAnalysis() {
  if (typeof puter === 'undefined') {
    return alert('Puter.js not loaded. Please check your connection.');
  }

  const jdId = jdSelect.value;
  const jd = currentJDs.find(j => j.id === jdId);
  const file = pdfUpload.files[0];

  if (!jd || !file) return alert('Please select a JD and upload a PDF.');
  
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';

  try {
    // Check if authenticated
    if (!puter.auth.isSignedIn()) {
      analyzeBtn.textContent = 'Authenticating...';
      await puter.auth.signIn();
    }

    console.log('Starting analysis for file:', file.name);
    
    // 1. Extract text from PDF using pdf.js
    analyzeBtn.textContent = 'Extracting Text...';
    let resumeText = '';
    try {
      resumeText = await extractTextFromPDF(file);
      console.log('Extracted text length:', resumeText?.length);
    } catch (ocrErr) {
      console.error('PDF Extraction Error:', ocrErr);
      throw new Error('Failed to extract text from PDF: ' + (ocrErr.message || JSON.stringify(ocrErr) || ocrErr));
    }

    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Could not extract any text from the PDF. Please ensure it is a valid, readable document.');
    }

    // 2. Read PDF as Base64 for follow-up context
    const base64 = await fileToBase64(file);
    const pdfData = base64.split(',')[1]; // Remove prefix

    // 3. Save last JD for re-run functionality in content script
    await chrome.storage.local.set({ lastJD: jd.content });

    // 4. Get active tab to show results overlay
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found. Please open a LinkedIn profile page.');
    }

    // 5. Use Puter AI for analysis
    analyzeBtn.textContent = 'AI Analysis...';
    const prompt = `You are an expert technical recruiter.
Compare the following Job Description and the Candidate Resume Text.
Return JSON only with:
- score (0-100)
- matching_skills (array of objects: { "skill": string, "years_of_experience": string })
- missing_skills (array)
- experience_match (short text)
- recommendation (Shortlist / Maybe / Reject)

Extract or infer years of experience per skill from the resume.

Job Description:
${jd.content}

Resume Text:
${resumeText}
`;

    console.log('Sending prompt to Puter AI...');
    let response;
    try {
      response = await puter.ai.chat(prompt);
      console.log('AI Response received');
    } catch (aiErr) {
      console.error('AI Error:', aiErr);
      throw new Error('AI Analysis failed: ' + (aiErr.message || JSON.stringify(aiErr) || aiErr));
    }

    const resultText = response.message.content;
    
    // Clean up JSON if model wrapped it in markdown blocks
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    let result;
    try {
      result = JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
    } catch (parseErr) {
      console.error('JSON Parse Error:', parseErr, 'Raw text:', resultText);
      throw new Error('Failed to parse AI response. The model might have returned invalid JSON.');
    }

    // 6. Send results to content script to display overlay
    try {
      await sendMessageToContentScript(tab.id, { 
        action: 'SHOW_RESULTS', 
        data: result,
        jd: jd.content,
        pdfData: pdfData,
        resumeText: resumeText
      });
      window.close();
    } catch (err) {
      console.error('Content script error:', err);
      alert('Could not display results on the page. Please refresh the page and try again.');
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze Profile';
    }

  } catch (err) {
    console.error('Analysis failed:', err);
    const errorMsg = err.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown error';
    alert('Analysis failed: ' + errorMsg);
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze Profile';
  }
}

async function sendMessageToContentScript(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message;
        if (error.includes('Could not establish connection')) {
          // Content script might not be injected. Try injecting it.
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }).then(() => {
            chrome.scripting.insertCSS({
              target: { tabId: tabId },
              files: ['content.css']
            }).then(() => {
              // Try sending again
              chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(retryResponse);
                }
              });
            });
          }).catch(err => reject(err));
        } else {
          reject(new Error(error));
        }
      } else {
        resolve(response);
      }
    });
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}
