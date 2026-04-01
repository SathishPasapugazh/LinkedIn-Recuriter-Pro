/**
 * LinkedIn UI Overlay
 */

let currentJD = '';
let currentPdfData = '';
let currentResumeText = '';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SHOW_RESULTS') {
    currentJD = request.jd || '';
    currentPdfData = request.pdfData || '';
    currentResumeText = request.resumeText || '';
    showResultsOverlay(request.data);
    sendResponse({ status: 'displayed' });
  }
});

function showResultsOverlay(data) {
  // Remove existing
  const existing = document.getElementById('ai-recruiter-results');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'ai-recruiter-results';
  
  const scoreColor = data.score > 70 ? '#057642' : (data.score > 40 ? '#c37d16' : '#d11124');
  const recClass = data.recommendation.toLowerCase();

  panel.innerHTML = `
    <div class="ai-panel-header" id="ai-panel-drag-handle">
      <h2>AI Match Analysis</h2>
      <button id="ai-panel-close">×</button>
    </div>
    <div class="ai-panel-body">
      <div class="ai-score-container">
        <div class="ai-score-circle" style="border-color: ${scoreColor}; color: ${scoreColor}">
          <span class="score-val">${data.score}</span>
          <span class="score-label">Match</span>
        </div>
        <div class="ai-recommendation ${recClass}">
          ${data.recommendation}
        </div>
      </div>

      <div class="ai-section">
        <h3>Experience Relevance</h3>
        <p>${data.experience_match}</p>
      </div>

      <div class="ai-section">
        <h3>Matching Skills</h3>
        <div class="ai-tags">
          ${data.matching_skills.map(s => `
            <span class="tag match">
              ${s.skill} <small>(${s.years_of_experience})</small>
            </span>
          `).join('')}
        </div>
      </div>

      <div class="ai-section">
        <h3>Missing Skills</h3>
        <div class="ai-tags">
          ${data.missing_skills.map(s => `<span class="tag missing">${s}</span>`).join('')}
        </div>
      </div>

      <div class="ai-section ai-chat-section">
        <h3>Follow-up Questions</h3>
        <div id="ai-chat-history" class="ai-chat-history"></div>
        <div class="ai-chat-input-container">
          <input type="text" id="ai-chat-input" placeholder="Ask a question about the candidate...">
          <button id="ai-chat-send">Ask</button>
        </div>
      </div>
    </div>
    <div class="ai-panel-footer">
      <p style="font-size: 11px; color: #666; margin: 0; text-align: center;">Analyzed from Uploaded PDF</p>
    </div>
  `;

  document.body.appendChild(panel);

  // Dragging Logic
  makeDraggable(panel, document.getElementById('ai-panel-drag-handle'));

  // Close Logic
  document.getElementById('ai-panel-close').onclick = () => panel.remove();

  // Chat Logic
  const chatInput = document.getElementById('ai-chat-input');
  const chatSend = document.getElementById('ai-chat-send');
  const chatHistory = document.getElementById('ai-chat-history');

  chatSend.onclick = () => handleChatSubmit(chatInput, chatSend, chatHistory);
  chatInput.onkeypress = (e) => {
    if (e.key === 'Enter') handleChatSubmit(chatInput, chatSend, chatHistory);
  };
}

async function handleChatSubmit(input, btn, history) {
  const question = input.value.trim();
  if (!question) return;

  // Add user message
  addChatMessage(history, 'user', question);
  input.value = '';
  
  // Show loading
  const loadingMsg = addChatMessage(history, 'ai', 'Thinking...');
  btn.disabled = true;

  try {
    const { lastJD } = await chrome.storage.local.get('lastJD');
    // We need the pdfData too. In a real scenario, we'd store it or pass it.
    // For this enhancement, let's assume popup passed it or we store it in memory.
    
    chrome.runtime.sendMessage({
      action: 'ASK_FOLLOWUP',
      jd: lastJD,
      pdfData: currentPdfData,
      resumeText: currentResumeText,
      question: question
    }, (response) => {
      btn.disabled = false;
      if (response && response.success) {
        loadingMsg.textContent = response.answer;
      } else {
        loadingMsg.textContent = 'Error: ' + (response?.error || 'Failed to get answer');
        loadingMsg.classList.add('error');
      }
      history.scrollTop = history.scrollHeight;
    });
  } catch (err) {
    btn.disabled = false;
    loadingMsg.textContent = 'Error: ' + err.message;
    loadingMsg.classList.add('error');
  }
}

function addChatMessage(history, role, text) {
  const msg = document.createElement('div');
  msg.className = `ai-chat-msg ${role}`;
  
  if (role === 'ai') {
    // Simple markdown-to-html for bold, italics, and lists
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\* (.*$)/gm, '<li>$1</li>');
    
    // Wrap list items if they exist
    if (html.includes('<li>')) {
      html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    }
    
    msg.innerHTML = html.replace(/\n/g, '<br>');
  } else {
    msg.textContent = text;
  }
  
  history.appendChild(msg);
  history.scrollTop = history.scrollHeight;
  return msg;
}

function makeDraggable(el, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    el.style.top = (el.offsetTop - pos2) + "px";
    el.style.left = (el.offsetLeft - pos1) + "px";
    el.style.right = 'auto'; // Disable right alignment once dragged
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}
