import React, { useEffect, useRef, useState } from 'react';

import {
  findBestPricelistMatch,
  getCatalogStats,
  getEstimatedItemPricing,
  type EstimatedItemPricing,
  type PricelistItem,
} from '../../services/pricelistService';
import { parseFile } from '../../services/fileParser';
import {
  requestEstimationAiChat,
  type EstimationAiMessage,
} from '../../services/api/estimationAi';
import { MarkdownMessage } from './MarkdownMessage';

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

export const AIChatbotFloating: React.FC<AIChatbotFloatingProps> = ({
  userRole = 'ESTIMATOR',
  activeProjectName,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: `Hello! I am your AA2000 AI Estimation Assistant.\n\nI am connected to the AA2000 product catalog and powered through the AA2000 backend AI service.\n\nYou can chat with me, upload TOR documents, Excel sheets, or equipment photos, and request pricing estimates for specific equipment.\n\nHow can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userTier, setUserTier] = useState<
    'contractor' | 'dealer' | 'endUser' | 'srp'
  >('contractor');
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

            setAttachedFiles((prev) => [
              ...prev,
              {
                id: `attach-${Date.now()}-${Math.random()}`,
                file: blob,
                name: blob.name || `Pasted_Image_${prev.length + 1}.png`,
                type: 'image',
                dataUrl,
              },
            ]);
          };

          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImg = file.type.startsWith('image/');

      if (isImg) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;

          setAttachedFiles((prev) => [
            ...prev,
            {
              id: `attach-${Date.now()}-${Math.random()}`,
              file,
              name: file.name,
              type: 'image',
              dataUrl,
            },
          ]);
        };

        reader.readAsDataURL(file);
      } else {
        try {
          const parsed = await parseFile(file);

          setAttachedFiles((prev) => [
            ...prev,
            {
              id: `attach-${Date.now()}-${Math.random()}`,
              file,
              name: file.name,
              type: 'doc',
              textContext: parsed.content || '',
            },
          ]);
        } catch {
          setAttachedFiles((prev) => [
            ...prev,
            {
              id: `attach-${Date.now()}-${Math.random()}`,
              file,
              name: file.name,
              type: 'doc',
              textContext: '',
            },
          ]);
        }
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputValue;

    if (!textToSend.trim() && attachedFiles.length === 0) {
      return;
    }

    const currentAttachments = [...attachedFiles];

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text:
        textToSend.trim() ||
        (currentAttachments.length > 0
          ? `[Attached ${currentAttachments.length} file(s)]`
          : ''),
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      attachments:
        currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    const updatedMessages = [...messages, userMsg];

    setMessages(updatedMessages);

    if (!customText) {
      setInputValue('');
    }

    setAttachedFiles([]);
    setIsTyping(true);

    try {
      const qTrimmed = textToSend.trim();
      const qLower = qTrimmed.toLowerCase();

      // .xlsx attachments are parsed by the backend (authoritative row data),
      // so they are excluded here to avoid duplicating the sheet in the prompt.
      const docContexts = currentAttachments
        .filter(
          (attachment) =>
            attachment.type === 'doc' &&
            attachment.textContext &&
            !/\.xlsx$/i.test(attachment.name)
        )
        .map(
          (attachment) =>
            `--- DOCUMENT ATTACHMENT: ${attachment.name} ---\n${attachment.textContext?.slice(
              0,
              4000
            )}`
        )
        .join('\n\n');

      const isCasualGreeting = /^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings|thanks|thank\s*you|howdy|what's\s*up|who\s*are\s*you|how\s*are\s*you|kamusta|musta)\b/i.test(
        qTrimmed
      );

      const hasExplicitPricingIntent = /\b(price|prices|cost|costs|how much|srp|dealer|contractor|quote|quotation|rate|rates)\b/i.test(
        qLower
      );

      const hasProductKeyword = /\b(equipment|device|camera|cctv|nvr|dvr|detector|panel|lock|cable|speaker|switch|reader|sensor|controller|access control|fire alarm|fdas)\b/i.test(
        qLower
      );

      const hasEstimateIntent = /\b(estimate|estimates|estimated|estimation|quote|quotation)\b/i.test(
        qLower
      );

      // A model-like code must include at least one letter and one number.
      // This avoids treating normal conversation as a catalog model query.
      const looksLikeModelCode =
        /\b(?=[A-Za-z0-9-]*\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9-]{4,}\b/.test(
          qTrimmed
        );

      const isPricingIntent =
        hasExplicitPricingIntent ||
        (hasEstimateIntent && (hasProductKeyword || looksLikeModelCode)) ||
        looksLikeModelCode;

      const bestMatch =
        !isCasualGreeting && qTrimmed && (isPricingIntent || looksLikeModelCode)
          ? findBestPricelistMatch(qTrimmed)
          : null;

      const isStrongModelMatch =
        !!bestMatch && bestMatch.score >= 0.9 && looksLikeModelCode;

      let estimation: EstimatedItemPricing | null = null;
      let contextStr = '';

      if (
        !isCasualGreeting &&
        (isPricingIntent || isStrongModelMatch) &&
        qTrimmed
      ) {
        estimation = await getEstimatedItemPricing(qTrimmed, userTier);

        if (estimation.foundInPricelist) {
          contextStr += 'MATCHED IN OFFICIAL AA2000 PRODUCT CATALOG:\n';
          contextStr += `- Brand: ${estimation.brand}\n`;
          contextStr += `- Model: ${estimation.model}\n`;
          contextStr += `- Description: ${estimation.description}\n`;
          contextStr += `- Effective Price (${userTier.toUpperCase()}): ₱${estimation.effectivePrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n`;
          contextStr += `- SRP: ₱${estimation.price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })}\n`;
          contextStr += `- Contractor Price: ₱${estimation.contractorPrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n`;
          contextStr += `- Dealer Price: ₱${estimation.dealerPrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n`;
          contextStr += `- End-User Price: ₱${estimation.endUserPrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n`;
          contextStr += `- Source: ${estimation.sourceFile}\n`;
        } else if (estimation.isAlternative) {
          contextStr += 'RECOMMENDED CARRIED CATALOG ALTERNATIVE:\n';
          contextStr += `- Brand: ${estimation.brand}\n`;
          contextStr += `- Model/Spec: ${estimation.model}\n`;
          contextStr += `- Description: ${estimation.description}\n`;
          contextStr += `- Recommended Price (${userTier.toUpperCase()}): ₱${estimation.effectivePrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n`;
          contextStr += `- Source: ${estimation.sourceFile}\n`;
          contextStr += `- Rationale: ${estimation.rationale}\n`;
        } else {
          contextStr +=
            'NOT FOUND IN OFFICIAL AA2000 CATALOG. EXISTING ESTIMATION SERVICE RESULT:\n';
          contextStr += `- Brand: ${estimation.brand}\n`;
          contextStr += `- Model/Spec: ${estimation.model}\n`;
          contextStr += `- Description: ${estimation.description}\n`;
          contextStr += `- Recommended Price (${userTier.toUpperCase()}): ₱${estimation.effectivePrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n`;
          contextStr += `- Market SRP: ₱${estimation.price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })}\n`;
          contextStr += `- Contractor Price: ₱${estimation.contractorPrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n`;
          contextStr += `- Dealer Price: ₱${estimation.dealerPrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n`;
          contextStr += `- Rationale: ${estimation.rationale}\n`;
        }
      }

      if (docContexts) {
        contextStr += `\n${docContexts}\n`;
      }

      let aiText = '';

      const imageAttachments = currentAttachments.filter(
        (attachment) => attachment.type === 'image' && attachment.dataUrl
      );

      const systemPrompt = `You are the official AA2000 AI Estimation Assistant for Electronic Security & Fire Systems in the Philippines.

You converse naturally, intelligently, and helpfully while assisting with project estimation, equipment selection, TOR specifications, and AA2000 pricing information.

CURRENT USER ROLE: ${userRole}
${activeProjectName ? `ACTIVE PROJECT: ${activeProjectName}\n` : ''}
${
        contextStr
          ? `GROUND TRUTH DATA & ATTACHED DOCUMENTS:\n${contextStr}\nUSER PRICING TIER PREFERENCE: ${userTier.toUpperCase()}\n`
          : ''
      }
CONVERSATION & RESPONSE RULES:

1. For greetings and short pleasantries, answer naturally and briefly. Anything beyond that must serve an estimation request.
2. Use catalog or pricing data only when it is actually relevant to the user's request.
3. If official AA2000 catalog data is supplied above, prioritize that data and do not contradict it.
4. Clearly distinguish official catalog pricing from estimates or alternatives.
5. Do not invent an official AA2000 price for an item that is not in the official catalog.
6. Format prices in Philippine Pesos (₱) with commas.
7. Keep responses concise, polite, and technically accurate.
8. Never expose API keys, session tokens, passwords, backend credentials, or other secrets.
9. SCOPE: you answer ONLY estimation-related questions — project estimation, BOQ/BOM takeoffs and quantity surveys (including from attachments), product availability in the AA2000 catalog, product codes/models/specifications, product comparisons, pricing and pricelist tiers, VAT/discount/total computations, TOR and technical specifications, and how to use this app.
10. For anything else (general knowledge, news, sports, entertainment, politics, health/medical/legal/financial advice, homework, coding, creative writing, travel, recipes, unrelated companies or products), do NOT answer. Decline in 1-3 sentences, say you are the AA2000 AI Estimation Assistant limited to estimation, product and pricing topics, then invite the user to ask about their project or equipment.`;

      const historyMessages: EstimationAiMessage[] = updatedMessages
        .slice(-6, -1)
        .map((message) => ({
          role: message.sender === 'user' ? 'user' : 'assistant',
          content: message.text,
        }));

      const apiMessages: EstimationAiMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...historyMessages,
        {
          role: 'user',
          content:
            qTrimmed ||
            'Please analyze the attached information and respond appropriately.',
        },
      ];

      // Attachments are handed to the backend, which runs the same pipeline as
      // its quotation AI: OCR/vision for images, ExcelJS for .xlsx rows.
      const imageFiles = imageAttachments
        .slice(0, 3)
        .map((attachment) => attachment.file);

      const spreadsheetAttachment = currentAttachments.find(
        (attachment) =>
          attachment.type === 'doc' && /\.xlsx$/i.test(attachment.name)
      );

      const result = await requestEstimationAiChat(apiMessages, {
        images: imageFiles.length > 0 ? imageFiles : undefined,
        spreadsheet: spreadsheetAttachment?.file,
      });
      aiText = result.content || '';

      if (!aiText) {
        if (currentAttachments.length > 0) {
          aiText = `Received ${currentAttachments.length} attachment(s): ${currentAttachments
            .map((attachment) => attachment.name)
            .join(
              ', '
            )}.\n\nThe files were received, but the AA2000 backend AI service did not return a response.`;
        } else if (estimation?.foundInPricelist) {
          aiText = `Official Pricelist Match Found!\n\nDevice/Item: ${estimation.brand} ${estimation.model}\nDescription: ${estimation.description}\n\nPrice Breakdown (${userTier.toUpperCase()} Tier):\n- Effective Price: ₱${estimation.effectivePrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n- SRP: ₱${estimation.price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })}\n- Contractor Price: ₱${estimation.contractorPrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n- Dealer Price: ₱${estimation.dealerPrice.toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })}\n- End-User Price: ₱${estimation.endUserPrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n\nSource: ${estimation.sourceFile}\nMatch Confidence: ${estimation.confidence}%`;
        } else if (estimation) {
          aiText = `Item Not Found in Official Catalog\n\nThe item "${textToSend}" was not found as an exact official catalog match.\n\nExisting estimation result (${userTier.toUpperCase()} Tier):\n- Suggested Model/Spec: ${estimation.brand} - ${estimation.model}\n- Description: ${estimation.description}\n- Recommended Price: ₱${estimation.effectivePrice.toLocaleString(
            'en-US',
            { minimumFractionDigits: 2 }
          )}\n\nRationale: ${(estimation.rationale || '').replace(/\*\*/g, '')}`;
        } else {
          aiText =
            'The AA2000 backend AI service did not return a response. Please try again.';
        }
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        estimationData: estimation || undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('[AI ESTIMATOR] Backend AI request failed:', err);

      const message =
        err instanceof Error
          ? err.message
          : 'Unable to reach the AA2000 backend AI service.';

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `AA2000 AI request failed: ${message}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsTyping(false);

      if (!isOpen) {
        setHasUnread(true);
      }
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
          title={
            isOpen ? 'Close AI Assistant' : 'Open AA2000 AI Estimation Assistant'
          }
        >
          {isOpen ? (
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <div className="flex items-center gap-2">
              <svg
                className="w-7 h-7 animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
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
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V17a2.25 2.25 0 01-2.25 2.25H7.25A2.25 2.25 0 015 17v-2.5"
                  />
                </svg>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">
                    AA2000 AI Estimator
                  </h3>

                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Backend AI Connected
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  {stats.totalProducts.toLocaleString()} items indexed • AA2000
                  Catalog Connected
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Pricing Tier Selector Bar */}
          <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Pricing Tier:</span>

            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
              {(['contractor', 'dealer', 'endUser', 'srp'] as const).map(
                (tier) => (
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
                )
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-sm scrollbar-thin scrollbar-thumb-slate-700">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/70 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => (
                        <div key={att.id} className="relative group">
                          {att.type === 'image' && att.dataUrl ? (
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              className="w-32 h-24 object-cover rounded-lg border border-white/20 shadow-sm"
                            />
                          ) : (
                            <div className="px-2.5 py-1.5 bg-slate-900/80 border border-slate-700 rounded-lg text-[11px] font-semibold text-blue-300 flex items-center gap-1.5">
                              <svg
                                className="w-4 h-4 text-blue-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>

                              <span className="truncate max-w-[120px]">
                                {att.name}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <MarkdownMessage>{msg.text}</MarkdownMessage>

                  {msg.estimationData && (
                    <div className="mt-3 pt-3 border-t border-slate-700/80 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          msg.estimationData.foundInPricelist
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                            : 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                        }`}
                      >
                        {msg.estimationData.foundInPricelist
                          ? '✅ Pricelist Verified'
                          : '⚡ Market Estimate'}
                      </span>

                      <button
                        onClick={() => {
                          const plainText = msg.text
                            .replace(/\*\*/g, '')
                            .replace(/`/g, '')
                            .replace(/###\s*/g, '');

                          navigator.clipboard.writeText(plainText);
                        }}
                        className="text-[11px] text-slate-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 p-3 bg-slate-800/60 border border-slate-700/50 rounded-2xl w-fit text-slate-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce delay-100" />
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce delay-200" />
                <span>AA2000 AI analyzing your request...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Attached Files Preview Bar */}
          {attachedFiles.length > 0 && (
            <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 flex gap-2 overflow-x-auto">
              {attachedFiles.map((att) => (
                <div
                  key={att.id}
                  className="relative flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border border-blue-500/40 rounded-lg text-xs text-slate-200"
                >
                  {att.type === 'image' && att.dataUrl ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="w-6 h-6 object-cover rounded"
                    />
                  ) : (
                    <svg
                      className="w-4 h-4 text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}

                  <span className="truncate max-w-[100px] text-[11px] font-medium">
                    {att.name}
                  </span>

                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-950 border-t border-slate-800 flex items-end gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,.pdf,.txt,.csv,.xlsx,.xls,.docx"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors flex items-center justify-center shrink-0"
              title="Attach Excel spreadsheets (.xlsx, .xls), PDF, CSV, TXT files, or floor plan images"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4.5 4.5 0 0 0-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </button>

            <textarea
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);

                // Auto-grow up to 128px, then scroll; collapses when cleared.
                const element = e.currentTarget;
                element.style.height = 'auto';
                element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={1}
              placeholder="Ask anything, paste images (Ctrl+V), or attach Excel/PDF/CSV..."
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none max-h-32 overflow-y-auto leading-5"
            />

            <button
              type="submit"
              disabled={
                (!inputValue.trim() && attachedFiles.length === 0) || isTyping
              }
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-md transition-colors shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
};
