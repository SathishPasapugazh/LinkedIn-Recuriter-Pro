import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { AnnotationEditorType, AnnotationEditorLayer, AnnotationLayer, PDFWorker } from 'pdfjs-dist';
import { 
  FileUp, 
  ChevronLeft, 
  ChevronRight, 
  Type, 
  Highlighter, 
  Pen, 
  Eraser, 
  Download,
  ZoomIn,
  ZoomOut,
  MousePointer2,
  MessageSquare
} from 'lucide-react';
import { ChatPanel } from './components/ChatPanel';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFViewerProps {
  file?: File;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ file: initialFile }) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [editorType, setEditorType] = useState<number>(AnnotationEditorType.NONE);
  const [isRendering, setIsRendering] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pdfText, setPdfText] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationLayerRef = useRef<HTMLDivElement>(null);
  const annotationEditorLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  const extractText = async (doc: pdfjsLib.PDFDocumentProxy) => {
    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += `Page ${i}:\n${pageText}\n\n`;
    }
    setPdfText(fullText);
  };

  const loadPDF = async (file: File | string) => {
    try {
      let loadingTask;
      if (typeof file === 'string') {
        loadingTask = pdfjsLib.getDocument(file);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      }
      
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setPageNum(1);
      extractText(doc);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  useEffect(() => {
    if (initialFile) {
      loadPDF(initialFile);
    }
  }, [initialFile]);

  const renderPage = async (num: number, currentScale: number) => {
    if (!pdfDoc || !canvasRef.current || !annotationLayerRef.current || !annotationEditorLayerRef.current) return;

    setIsRendering(true);
    
    // Cancel previous render task if any
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    try {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale: currentScale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      // Render Annotation Layer
      const annotations = await page.getAnnotations();
      annotationLayerRef.current.innerHTML = '';
      annotationLayerRef.current.style.width = `${viewport.width}px`;
      annotationLayerRef.current.style.height = `${viewport.height}px`;
      
      const annotationLayer = new AnnotationLayer({
        div: annotationLayerRef.current,
        accessibilityManager: null,
        annotationCanvasMap: null,
        annotationEditorUIManager: (pdfDoc as any).annotationEditorUIManager || null,
        page: page,
        viewport: viewport.clone({ dontFlip: true }),
        structTreeLayer: null,
        commentManager: null,
        linkService: null as any,
        annotationStorage: (pdfDoc as any).annotationStorage || null,
      });

      await annotationLayer.render({
        viewport: viewport.clone({ dontFlip: true }),
        div: annotationLayerRef.current,
        annotations: annotations,
        page: page,
        linkService: null as any,
        renderForms: true,
      });

      // Render Annotation Editor Layer
      annotationEditorLayerRef.current.innerHTML = '';
      annotationEditorLayerRef.current.style.width = `${viewport.width}px`;
      annotationEditorLayerRef.current.style.height = `${viewport.height}px`;

      const annotationEditorLayer = new AnnotationEditorLayer({
        uiManager: (pdfDoc as any).annotationEditorUIManager || null,
        div: annotationEditorLayerRef.current,
        accessibilityManager: null,
        pageIndex: page.pageNumber - 1,
        viewport: viewport.clone({ dontFlip: true }),
        l10n: null as any,
        annotationLayer: annotationLayer,
        textLayer: null,
        drawLayer: null as any,
        structTreeLayer: null as any,
        enabled: true,
        mode: editorType,
      });
      
      await annotationEditorLayer.render({
        viewport: viewport.clone({ dontFlip: true }),
      });

      if (editorType !== AnnotationEditorType.NONE) {
        annotationEditorLayer.updateMode(editorType);
      }

    } catch (error) {
      if ((error as any).name === 'RenderingCancelledException') {
        console.log('Rendering cancelled');
      } else {
        console.error('Error rendering page:', error);
      }
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum, scale);
    }
  }, [pdfDoc, pageNum, scale]);

  useEffect(() => {
    if (pdfDoc && (pdfDoc as any).annotationEditorUIManager) {
      (pdfDoc as any).annotationEditorUIManager.mode = editorType;
    }
  }, [editorType, pdfDoc]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadPDF(file);
    }
  };

  const goToPrevPage = () => {
    if (pageNum > 1) setPageNum(pageNum - 1);
  };

  const goToNextPage = () => {
    if (pageNum < numPages) setPageNum(pageNum + 1);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  const downloadAnnotatedPDF = async () => {
    if (!pdfDoc) return;
    try {
      const data = await pdfDoc.saveDocument();
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'annotated.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error saving PDF:', error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium text-gray-700">
            <FileUp size={20} />
            <span>Open PDF</span>
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
          </label>
          
          <div className="h-6 w-px bg-gray-200 mx-2" />
          
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg">
            <button 
              onClick={() => setEditorType(AnnotationEditorType.NONE)}
              className={`p-2 rounded-md transition-all ${editorType === AnnotationEditorType.NONE ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Select"
            >
              <MousePointer2 size={20} />
            </button>
            <button 
              onClick={() => setEditorType(AnnotationEditorType.FREETEXT)}
              className={`p-2 rounded-md transition-all ${editorType === AnnotationEditorType.FREETEXT ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Text"
            >
              <Type size={20} />
            </button>
            <button 
              onClick={() => setEditorType(AnnotationEditorType.HIGHLIGHT)}
              className={`p-2 rounded-md transition-all ${editorType === AnnotationEditorType.HIGHLIGHT ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Highlight"
            >
              <Highlighter size={20} />
            </button>
            <button 
              onClick={() => setEditorType(AnnotationEditorType.INK)}
              className={`p-2 rounded-md transition-all ${editorType === AnnotationEditorType.INK ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Draw"
            >
              <Pen size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg">
            <button onClick={zoomOut} className="p-1 hover:bg-white rounded transition-all text-gray-600">
              <ZoomOut size={18} />
            </button>
            <span className="text-xs font-mono w-12 text-center text-gray-500">{Math.round(scale * 100)}%</span>
            <button onClick={zoomIn} className="p-1 hover:bg-white rounded transition-all text-gray-600">
              <ZoomIn size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={goToPrevPage} 
              disabled={pageNum <= 1}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 text-gray-600"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-medium text-gray-700">
              Page {pageNum} of {numPages || '?'}
            </span>
            <button 
              onClick={goToNextPage} 
              disabled={pageNum >= numPages}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 text-gray-600"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <button 
            onClick={() => setIsChatOpen(true)}
            disabled={!pdfDoc}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium ${
              isChatOpen 
                ? 'bg-blue-100 text-blue-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            <MessageSquare size={18} />
            <span>Chat</span>
          </button>

          <button 
            onClick={downloadAnnotatedPDF}
            disabled={!pdfDoc}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <Download size={18} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8 flex justify-center bg-gray-200/50 relative">
        {!pdfDoc && (
          <div className="flex flex-col items-center justify-center text-gray-400 mt-20">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <FileUp size={40} />
            </div>
            <p className="text-lg font-medium">Upload a PDF to start annotating</p>
            <p className="text-sm">Highlight, add text, or draw directly on the document</p>
          </div>
        )}
        
        <div 
          ref={containerRef}
          className="relative shadow-2xl bg-white"
          style={{ 
            display: pdfDoc ? 'block' : 'none',
            width: 'fit-content',
            height: 'fit-content'
          }}
        >
          <canvas ref={canvasRef} className="block" />
          <div 
            ref={annotationLayerRef} 
            className="annotationLayer absolute top-0 left-0"
          />
          <div 
            ref={annotationEditorLayerRef} 
            className="annotationEditorLayer absolute top-0 left-0"
          />
        </div>

        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px] pointer-events-none">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      <ChatPanel 
        pdfText={pdfText} 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </div>
  );
};
