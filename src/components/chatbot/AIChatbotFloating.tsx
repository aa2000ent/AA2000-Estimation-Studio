import React, { useState, useRef, useEffect } from 'react';
import {
  getEstimatedItemPricing,
  searchPricelist,
  findBestPricelistMatch,
  getCatalogStats,
  EstimatedItemPricing,
  PricelistItem
} from '../../services/pricelistService';
import { parseFile } from '../../services/fileParser';

export interface AttachedFile {
  id: string;
  file: File;
  name: string;
  type: 'image' | 'doc';
  dataUrl?: string;
  textContext?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  attachments?: AttachedFile[];
  estimationData?: EstimatedItemPricing;
  pricelistResults?: PricelistItem[];
}

export interface AIChatbotFloatingProps {
  userRole?: string;
  activeProjectName?: string;
}

/**
 * Cleanly renders message text without raw markdown syntax (asterisks, hashes, backticks).
 * Converts markdown patterns into native React JSX elements.
 */
function renderFormattedMessage(text: string) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed font-sans text-xs md:text-sm">
      {lines.map((line, lineIdx) => {
        let trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} className="h-1.5" />;

        // Header check (### or ## or #)
        if (trimmed.startsWith('#')) {
          const cleanHeader = trimmed.replace(/^#+\s*/, '').replace(/\*+/g, '');
          return (
            <div key={lineIdx} className="font-bold text-sm text-indigo-300 pt-1 pb-0.5 border-b border-slate-700/50">
              {cleanHeader}
            </div>
          );
        }

        // Bullet check (- or * or numbered 1.)
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const numBulletMatch = trimmed.match(/^(\d+)\.\s+/);

        if (isBullet) {
          trimmed = trimmed.replace(/^[-*]\s*/, '');
        } else if (numBulletMatch) {
          trimmed = trimmed.replace(/^(\d+)\.\s+/, '');
        }

        // Clean any remaining markdown symbols like ** or ` from text segment
        const parts = trimmed.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-white">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code key={pIdx} className="px-1.5 py-0.5 bg-slate-900 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">
                {part.slice(1, -1)}
              </code>
            );
          }
          // Strip any accidental stray asterisks or backticks
          return part.replace(/\*\*/g, '').replace(/`/g, '');
        });

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-2 text-slate-200">
              <span className="text-indigo-400 mt-1">•</span>
              <span>{renderedLine}</span>
            </div>
          );
        }

        if (numBulletMatch) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-2 text-slate-200">
              <span className="font-bold text-indigo-400 text-xs mt-0.5">{numBulletMatch[1]}.</span>
              <span>{renderedLine}</span>
            </div>
          );
        }

        return <p key={lineIdx} className="text-slate-200">{renderedLine}</p>;
      })}
    </div>
  );
}

export const AIChatbotFloating: React.FC<AIChatbotFloatingProps> = ({
  userRole = 'ESTIMATOR',
  activeProjectName
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: `Hello! I am your AA2000 AI Estimation Assistant.\n\nI am connected to all 41 official pricelist CSV files (7,710 equipment records) and powered by Mistral AI with Vision & Document analysis.\n\nYou can chat with me freely like ChatGPT — ask me questions, paste images/screenshots, upload TOR files or floor plans, or request pricing estimates for specific equipment!\n\nHow can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userTier, setUserTier] = useState<'contractor' | 'dealer' | 'endUser' | 'srp'>('contractor');
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stats = getCatalogStats();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  // Handle clipboard paste (images)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            setAttachedFiles(prev => [
              ...prev,
              {
                id: `attach-${Date.now()}-${Math.random()}`,
                file: blob,
                name: blob.name || `Pasted_Image_${prev.length + 1}.png`,
                type: 'image',
                dataUrl
              }
            ]);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  // Handle file selection via input
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImg = file.type.startsWith('image/');

      if (isImg) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAttachedFiles(prev => [
            ...prev,
            {
              id: `attach-${Date.now()}-${Math.random()}`,
              file,
              name: file.name,
              type: 'image',
              dataUrl
            }
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        try {
          const parsed = await parseFile(file);
          setAttachedFiles(prev => [
            ...prev,
            {
              id: `attach-${Date.now()}-${Math.random()}`,
              file,
              name: file.name,
              type: 'doc',
              textContext: parsed.content || ''
            }
          ]);
        } catch {
          setAttachedFiles(prev => [
            ...prev,
            {
              id: `attach-${Date.now()}-${Math.random()}`,
              file,
              name: file.name,
              type: 'doc',
              textContext: ''
            }
          ]);
        }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputValue;
    if (!textToSend.trim() && attachedFiles.length === 0) return;

    const currentAttachments = [...attachedFiles];

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim() || (currentAttachments.length > 0 ? `[Attached ${currentAttachments.length} file(s)]` : ''),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!customText) setInputValue('');
    setAttachedFiles([]);
    setIsTyping(true);

    try {
      const qTrimmed = textToSend.trim();
      const qLower = qTrimmed.toLowerCase();

      // Extract document text content from attached docs
      const docContexts = currentAttachments
        .filter(a => a.type === 'doc' && a.textContext)
        .map(a => `--- DOCUMENT ATTACHMENT: ${a.name} ---\n${a.textContext?.slice(0, 4000)}`)
        .join('\n\n');

      // Check if this is casual greeting or general conversation (ChatGPT style)
      const isCasualGreeting = /^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings|thanks|thank\s*you|howdy|what's\s*up|who\s*are\s*you|how\s*are\s*you|kamusta|musta)\b/i.test(qTrimmed);
      
      // Check explicit pricing intent
      const isPricingIntent = /\b(price|prices|cost|costs|estimate|estimation|how much|srp|dealer|contractor|quote|rate|rates|tor|specs|specification|equipment|device|camera|detector|panel|lock|cable|speaker|switch)\b/i.test(qLower);

      const bestMatch = (!isCasualGreeting && qTrimmed) ? findBestPricelistMatch(qTrimmed) : null;
      const isStrongModelMatch = bestMatch && bestMatch.score >= 0.85;

      let estimation: EstimatedItemPricing | null = null;
      let contextStr = '';

      if (!isCasualGreeting && (isPricingIntent || isStrongModelMatch) && qTrimmed) {
        estimation = await getEstimatedItemPricing(qTrimmed, userTier);

        if (estimation.foundInPricelist) {
          contextStr += `MATCHED IN OFFICIAL PRICELIST FOLDER:\n`;
          contextStr += `- Brand: ${estimation.brand}\n- Model: ${estimation.model}\n- Description: ${estimation.description}\n- Effective Price (${userTier.toUpperCase()}): ₱${estimation.effectivePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- SRP: ₱${estimation.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Contractor Price: ₱${estimation.contractorPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Dealer Price: ₱${estimation.dealerPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- End-User Price: ₱${estimation.endUserPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Source CSV File: ${estimation.sourceFile}\n`;
        } else if (estimation.isAlternative) {
          contextStr += `RECOMMENDED CARRIED CATALOG ALTERNATIVE:\n`;
          contextStr += `- Brand: ${estimation.brand}\n- Model/Spec: ${estimation.model}\n- Description: ${estimation.description}\n- Recommended Price (${userTier.toUpperCase()}): ₱${estimation.effectivePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Source File: ${estimation.sourceFile}\n- Rationale: ${estimation.rationale}\n`;
        } else {
          contextStr += `NOT FOUND IN OFFICIAL PRICELIST FOLDER. RECOMMENDED AVERAGE MARKET VALUE ESTIMATE:\n`;
          contextStr += `- Brand: ${estimation.brand}\n- Model/Spec: ${estimation.model}\n- Description: ${estimation.description}\n- Recommended Price (${userTier.toUpperCase()}): ₱${estimation.effectivePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Market SRP: ₱${estimation.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Contractor Price: ₱${estimation.contractorPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Dealer Price: ₱${estimation.dealerPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Rationale: ${estimation.rationale}\n`;
        }
      }

      if (docContexts) {
        contextStr += `\n${docContexts}\n`;
      }

      // Call Mistral AI API for natural, conversational response generation
      const apiKey = import.meta.env.VITE_MISTRAL_API_KEY || localStorage.getItem('mistral_api_key') || '';
      let aiText = '';

      if (apiKey) {
        const imageAttachments = currentAttachments.filter(a => a.type === 'image' && a.dataUrl);
        const useVisionModel = imageAttachments.length > 0;
        const targetModel = useVisionModel ? 'pixtral-12b-2409' : 'mistral-small-latest';

        const systemPrompt = `You are the official AA2000 AI Estimation Assistant for Electronic Security & Fire Systems in the Philippines.
You converse naturally, intelligently, and helpfully like ChatGPT, while also analyzing images, documents, TOR specs, and product estimations.

${contextStr ? `GROUND TRUTH DATA & ATTACHED DOCUMENTS:\n${contextStr}\nUSER PRICING TIER PREFERENCE: ${userTier.toUpperCase()}\n` : ''}

CONVERSATION & RESPONSE RULES:
1. For general chat, greetings (e.g. "Hi", "Hello", "How are you?"), or conceptual questions, respond warmly, naturally, and conversationally like ChatGPT!
2. If the user attached an image, floor plan, or photo, inspect it carefully. Identify equipment, layout, resolution, brand markings, device counts, or TOR requirements.
3. If ground-truth pricelist data is provided above for a product query, prioritize exact items from the official AA2000 pricelist folder. Quote exact prices, brand, model, description, and source CSV file name.
4. If an item requested is not in the pricelist folder or is a non-carried brand, recommend AA2000's Next Best Carried Catalog Alternative (e.g. Asenware AW series for FDAS, Hikvision for CCTV, ZKTeco for Access Control).
5. DO NOT output raw markdown symbols like ** double asterisks or ### triple hashes. Use clean plain text formatting with clear line breaks and bullet points.
6. Format all prices in Philippine Pesos (₱) with commas (e.g. ₱3,507.39).
7. Keep responses concise, polite, and technical.`;

        // Format user turn content with vision parts if images exist
        let lastUserContent: any = qTrimmed || 'Please analyze the attached file(s)/image(s).';
        if (useVisionModel) {
          lastUserContent = [
            ...imageAttachments.map(img => ({
              type: 'image_url',
              image_url: { url: img.dataUrl }
            })),
            { type: 'text', text: qTrimmed || 'Please analyze the attached image/floor plan/equipment photo and provide pricing or estimation breakdown.' }
          ];
        }

        const historyMessages = updatedMessages.slice(-6, -1).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

        const apiMessages = [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: lastUserContent }
        ];

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: apiMessages,
            temperature: 0.3
          })
        });

        if (response.ok) {
          const json = await response.json();
          aiText = json.choices?.[0]?.message?.content || '';
        }
      }

      // Fallback response if no API key is available or API call fails
      if (!aiText) {
        if (currentAttachments.length > 0) {
          aiText = `Received ${currentAttachments.length} attachment(s): ${currentAttachments.map(a => a.name).join(', ')}.\n\nI have parsed the document/image data. Connect your VITE_MISTRAL_API_KEY to enable full AI visual & TOR analysis!`;
        } else if (isCasualGreeting) {
          aiText = `Hello! How can I assist you today with your security systems, equipment specs, or project estimation?`;
        } else if (estimation) {
          if (estimation.foundInPricelist) {
            aiText = `Official Pricelist Match Found!\n\nDevice/Item: ${estimation.brand} ${estimation.model}\nDescription: ${estimation.description}\n\nPrice Breakdown (${userTier.toUpperCase()} Tier):\n- Effective Price: ₱${estimation.effectivePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- SRP: ₱${estimation.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Contractor Price: ₱${estimation.contractorPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- Dealer Price: ₱${estimation.dealerPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- End-User Price: ₱${estimation.endUserPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\nSource File: ${estimation.sourceFile}\nMatch Confidence: ${estimation.confidence}%`;
          } else {
            aiText = `Item Not in Pricelist Folder — Market Value Estimate\n\nThe item "${textToSend}" was not found in the official pricelist files.\n\nRecommended Average Market Value (${userTier.toUpperCase()} Tier):\n- Suggested Model/Spec: ${estimation.brand} - ${estimation.model}\n- Description: ${estimation.description}\n- Recommended Price: ₱${estimation.effectivePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\nRationale: ${(estimation.rationale || '').replace(/\*\*/g, '')}`;
          }
        } else {
          aiText = `I am here to help you with your project estimations, TOR analysis, and equipment queries. How can I assist you?`;
        }
      }

      // Strip any raw markdown symbols that AI model might produce
      aiText = aiText.replace(/\*\*/g, '').replace(/###\s*/g, '').replace(/`/g, '');

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        estimationData: estimation || undefined
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `Hello! I am your AA2000 AI Estimation Assistant. How can I assist you today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
      if (!isOpen) setHasUnread(true);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {!isOpen && hasUnread && (
          <div className="mb-2 px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full shadow-lg animate-bounce flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            New AI Response
          </div>
        )}

        <button
          onClick={() => {
            setIsOpen(!isOpen);
            setHasUnread(false);
          }}
          className={`group relative flex items-center justify-center p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 ${
            isOpen
              ? 'bg-slate-800 text-slate-200 ring-2 ring-slate-600'
              : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white ring-4 ring-blue-500/30 hover:ring-blue-500/60 shadow-lg shadow-blue-500/25'
          }`}
          title={isOpen ? 'Close AI Assistant' : 'Open AA2000 AI Estimation Assistant'}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="w-7 h-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <span className="hidden md:inline font-bold text-sm tracking-wide pr-1">
                AI Estimator
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[460px] h-[640px] max-h-[85vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V17a2.25 2.25 0 01-2.25 2.25H7.25A2.25 2.25 0 015 17v-2.5" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">AA2000 AI Estimator</h3>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Vision & Docs Active
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {stats.totalProducts.toLocaleString()} items indexed • 41 Pricelists Connected
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Pricing Tier Selector Bar */}
          <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Pricing Tier:</span>
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
              {(['contractor', 'dealer', 'endUser', 'srp'] as const).map(tier => (
                <button
                  key={tier}
                  onClick={() => setUserTier(tier)}
                  className={`px-2.5 py-1 rounded-md capitalize font-medium text-[11px] transition-all ${
                    userTier === tier
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  {tier === 'endUser' ? 'End User' : tier}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-sm scrollbar-thin scrollbar-thumb-slate-700">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/70 rounded-bl-none shadow-sm'
                  }`}
                >
                  {/* Attachments preview inside message bubble */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {msg.attachments.map(att => (
                        <div key={att.id} className="relative group">
                          {att.type === 'image' && att.dataUrl ? (
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              className="w-32 h-24 object-cover rounded-lg border border-white/20 shadow-sm"
                            />
                          ) : (
                            <div className="px-2.5 py-1.5 bg-slate-900/80 border border-slate-700 rounded-lg text-[11px] font-semibold text-blue-300 flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="truncate max-w-[120px]">{att.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {renderFormattedMessage(msg.text)}

                  {/* Estimation Badge — Only shown when an actual item was priced */}
                  {msg.estimationData && (
                    <div className="mt-3 pt-3 border-t border-slate-700/80 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          msg.estimationData.foundInPricelist
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                            : 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                        }`}
                      >
                        {msg.estimationData.foundInPricelist ? '✅ Pricelist Verified' : '⚡ Market Estimate'}
                      </span>
                      <button
                        onClick={() => {
                          const plainText = msg.text.replace(/\*\*/g, '').replace(/`/g, '').replace(/###\s*/g, '');
                          navigator.clipboard.writeText(plainText);
                        }}
                        className="text-[11px] text-slate-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 p-3 bg-slate-800/60 border border-slate-700/50 rounded-2xl w-fit text-slate-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce delay-100" />
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce delay-200" />
                <span>Mistral AI analyzing input & vision data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attached Files Preview Bar (before input) */}
          {attachedFiles.length > 0 && (
            <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 flex gap-2 overflow-x-auto">
              {attachedFiles.map(att => (
                <div key={att.id} className="relative flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border border-blue-500/40 rounded-lg text-xs text-slate-200">
                  {att.type === 'image' && att.dataUrl ? (
                    <img src={att.dataUrl} alt={att.name} className="w-6 h-6 object-cover rounded" />
                  ) : (
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <span className="truncate max-w-[100px] text-[11px] font-medium">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Form with File Upload & Image Paste */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
          >
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,.pdf,.txt,.csv,.xlsx,.xls,.docx"
              className="hidden"
            />

            {/* Paperclip Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors flex items-center justify-center shrink-0"
              title="Attach Excel spreadsheets (.xlsx, .xls), PDF, CSV, TXT files, or floor plan images"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4.5 4.5 0 0 0-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {/* Input Field with Paste Event Listener */}
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onPaste={handlePaste}
              placeholder="Ask anything, paste images (Ctrl+V), or attach Excel/PDF/CSV..."
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!inputValue.trim() && attachedFiles.length === 0) || isTyping}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-md transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
};
