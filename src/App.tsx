export default function App() {
  return (
    <div className="min-h-screen bg-[#f3f2ef] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 border border-gray-200">
        <header className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-[#0a66c2] rounded-lg flex items-center justify-center text-white text-2xl font-bold">AI</div>
          <div>
            <h1 className="text-2xl font-bold text-[#0a66c2]">LinkedIn AI Recruiter Pro</h1>
            <p className="text-gray-600">Chrome Extension for Smart Profile Analysis</p>
          </div>
        </header>

        <section className="space-y-6">
          <div className="bg-blue-50 border-l-4 border-[#0a66c2] p-4 rounded">
            <h2 className="font-bold text-[#004182] mb-1">How to Install</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Download the project files as a ZIP.</li>
              <li>Open Chrome and go to <code className="bg-gray-100 px-1 rounded">chrome://extensions/</code></li>
              <li>Enable <strong>Developer mode</strong> (top right toggle).</li>
              <li>Click <strong>Load unpacked</strong> and select the project folder.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">🎯 JD Storage</h3>
              <p className="text-sm text-gray-600">Save multiple job descriptions and manage them easily from the popup.</p>
            </div>
            <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">🤖 Gemini Analysis</h3>
              <p className="text-sm text-gray-600">Uses semantic matching to compare skills and experience, not just keywords.</p>
            </div>
            <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">📊 In-Page Overlay</h3>
              <p className="text-sm text-gray-600">See scores and insights directly on the LinkedIn profile page.</p>
            </div>
            <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">🔒 Secure & Private</h3>
              <p className="text-sm text-gray-600">Your API key is stored locally in your browser's secure storage.</p>
            </div>
          </div>
        </section>

        <footer className="mt-10 pt-6 border-t border-gray-100 text-center text-gray-400 text-sm">
          Built with Gemini AI & Manifest V3
        </footer>
      </div>
    </div>
  );
}
