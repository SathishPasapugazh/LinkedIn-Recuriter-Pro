let currentJDs = [];
let editingId = null;

// DOM Elements
const mainView = document.getElementById('main-view');
const jdFormView = document.getElementById('jd-form-view');
const settingsView = document.getElementById('settings-view');

const jdSelect = document.getElementById('jd-select');
const jdList = document.getElementById('jd-list');
const pdfUpload = document.getElementById('pdf-upload');
const analyzeBtn = document.getElementById('analyze-btn');
const testUiBtn = document.getElementById('test-ui-btn');
const addJdBtn = document.getElementById('add-jd-btn');
const jdContentInput = document.getElementById('jd-content');
const apiKeyInput = document.getElementById('api-key');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  const data = await chrome.storage.local.get(['jDs', 'apiKey']);
  currentJDs = data.jDs || [];
  apiKeyInput.value = data.apiKey || '';
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
  analyzeBtn.disabled = !jdSelect.value || !apiKeyInput.value || !pdfUpload.files[0];
}

function setupEventListeners() {
  // Navigation
  document.getElementById('add-jd-btn').onclick = () => showView('form');
  document.getElementById('cancel-jd-btn').onclick = () => showView('main');
  document.getElementById('settings-btn').onclick = () => showView('settings');
  document.getElementById('back-settings-btn').onclick = () => showView('main');

  // JD Actions
  document.getElementById('save-jd-btn').onclick = saveJD;
  jdSelect.onchange = checkAnalyzeStatus;
  pdfUpload.onchange = checkAnalyzeStatus;

  jdList.onclick = (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('delete-jd')) {
      deleteJD(id);
    } else if (e.target.classList.contains('edit-jd')) {
      editJD(id);
    }
  };

  // Settings
  document.getElementById('save-settings-btn').onclick = saveSettings;

  // Test UI Overlay
  testUiBtn.onclick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const dummyData = {
      score: 85,
      matching_skills: [
        { skill: "React", years_of_experience: "4 years" },
        { skill: "TypeScript", years_of_experience: "3 years" },
        { skill: "Node.js", years_of_experience: "5 years" }
      ],
      missing_skills: ["AWS", "Docker"],
      experience_match: "Strong match with relevant technical stack and seniority.",
      recommendation: "Shortlist"
    };

    try {
      await sendMessageToContentScript(tab.id, { 
        action: 'SHOW_RESULTS', 
        data: dummyData,
        jd: "Sample Job Description for Testing",
        pdfData: "" // Empty for test
      });
      window.close();
    } catch (err) {
      console.error(err);
      alert('Failed to show test overlay. Make sure you are on a valid webpage.');
    }
  };

  // Analysis
  analyzeBtn.onclick = startAnalysis;
}

function showView(view) {
  mainView.classList.add('hidden');
  jdFormView.classList.add('hidden');
  settingsView.classList.add('hidden');

  if (view === 'main') mainView.classList.remove('hidden');
  if (view === 'form') jdFormView.classList.remove('hidden');
  if (view === 'settings') settingsView.classList.remove('hidden');
}

async function saveJD() {
  const title = jdTitleInput.value.trim();
  const content = jdContentInput.value.trim();

  if (!title || !content) return alert('Please fill in all fields');

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

async function saveSettings() {
  const apiKey = apiKeyInput.value.trim();
  await chrome.storage.local.set({ apiKey });
  checkAnalyzeStatus();
  showView('main');
}

async function startAnalysis() {
  const jdId = jdSelect.value;
  const jd = currentJDs.find(j => j.id === jdId);
  const file = pdfUpload.files[0];

  if (!file) return alert('Please select a PDF file.');
  
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';

  try {
    // 1. Read PDF as Base64
    const base64 = await fileToBase64(file);
    const pdfData = base64.split(',')[1]; // Remove prefix

    // 2. Save last JD for re-run functionality in content script
    await chrome.storage.local.set({ lastJD: jd.content });

    // 3. Get active tab to show results overlay
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      alert('No active tab found.');
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze Profile';
      return;
    }

    // 4. Send to background for Gemini analysis
    chrome.runtime.sendMessage({
      action: 'CALL_GEMINI',
      jd: jd.content,
      pdfData: pdfData
    }, async (response) => {
      if (response && response.success) {
        // 5. Send results to content script to display overlay
        try {
          await sendMessageToContentScript(tab.id, { 
            action: 'SHOW_RESULTS', 
            data: response.data,
            jd: jd.content,
            pdfData: pdfData
          });
          window.close();
        } catch (err) {
          console.error('Content script error:', err);
          alert('Could not display results on the page. Please refresh the page and try again.');
          analyzeBtn.disabled = false;
          analyzeBtn.textContent = 'Analyze Profile';
        }
      } else {
        alert('Analysis Error: ' + (response?.error || 'Unknown error'));
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Profile';
      }
    });

  } catch (err) {
    console.error(err);
    alert('Analysis failed: ' + err.message);
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
