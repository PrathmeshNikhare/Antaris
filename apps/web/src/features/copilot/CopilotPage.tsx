import React, { useState, useRef, useEffect, useCallback } from "react";
import { twinApi } from "../../services/api";
import type { CopilotApiResponse, CopilotToolTrace } from "../../services/api";

// ── Types ────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: CopilotToolTrace[];
  modelInfo?: CopilotApiResponse["modelInfo"];
  processingMs?: number;
  timestamp: Date;
}

// ── Suggested prompts for new users ──────────────────────────────────
const SUGGESTED_PROMPTS = [
  { text: "What is happening at Maitri?", category: "Overview" },
  { text: "Why is GEN-01 at risk?", category: "Asset" },
  { text: "What assets are affected if GEN-01 fails?", category: "Impact" },
  { text: "How long will current fuel last?", category: "Logistics" },
  { text: "What if we lose GEN-01 for 90 minutes?", category: "Simulation" },
  { text: "Why is energy risk increasing?", category: "Analysis" },
];

export function CopilotPage(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Check Ollama health on mount ───────────────────────────────
  useEffect(() => {
    twinApi
      .copilotHealth()
      .then((h) => setOllamaAvailable(h.available))
      .catch(() => setOllamaAvailable(false));
  }, []);

  // ── Auto-scroll to bottom ─────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setIsLoading(true);

      try {
        // Build conversation history for context
        const history = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await twinApi.copilotChat(text.trim(), history);

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          toolCalls: response.toolCalls,
          modelInfo: response.modelInfo,
          processingMs: response.processingMs,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setOllamaAvailable(response.modelInfo.available);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Error communicating with the Copilot backend.**\n\n${(err as Error).message}\n\n*The dashboard remains fully operational. You can continue using all other features.*`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [messages, isLoading]
  );

  // ── Handle keyboard ───────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // ── Toggle tool trace expansion ───────────────────────────────
  const toggleToolExpand = (id: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Render safe markdown-like content (zero dangerouslySetInnerHTML) ───────
  const parseFormattedText = (raw: string): React.ReactNode[] => {
    const tokens: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(raw.slice(lastIndex, match.index));
      }
      const token = match[0];
      const key = `${match.index}-${token.length}`;
      if (token.startsWith("`") && token.endsWith("`")) {
        tokens.push(
          <code key={key} className="copilot-code-inline">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith("**") && token.endsWith("**")) {
        tokens.push(<strong key={key}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("*") && token.endsWith("*")) {
        tokens.push(<em key={key}>{token.slice(1, -1)}</em>);
      } else {
        tokens.push(token);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < raw.length) {
      tokens.push(raw.slice(lastIndex));
    }
    return tokens.length > 0 ? tokens : [raw];
  };

  const renderContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("### ")) {
        return (
          <h4 key={i} className="copilot-msg-h4">
            {parseFormattedText(line.slice(4))}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={i} className="copilot-msg-h3">
            {parseFormattedText(line.slice(3))}
          </h3>
        );
      }
      if (line.startsWith("- ") || line.startsWith("• ")) {
        return (
          <li key={i} className="copilot-msg-li">
            {parseFormattedText(line.slice(2))}
          </li>
        );
      }
      if (line.trim() === "") return <br key={i} />;
      return (
        <p key={i} className="copilot-msg-p">
          {parseFormattedText(line)}
        </p>
      );
    });
  };

  // ── Render tool call trace ────────────────────────────────────
  const renderToolTrace = (trace: CopilotToolTrace, idx: number, msgId: string) => {
    const traceId = `${msgId}-tool-${idx}`;
    const isExpanded = expandedTools.has(traceId);
    const provenance = trace.result.provenance;

    return (
      <div key={traceId} className="copilot-tool-trace">
        <button
          className="copilot-tool-trace-header"
          onClick={() => toggleToolExpand(traceId)}
          aria-expanded={isExpanded}
        >
          <span className="copilot-tool-icon">
            {trace.result.success ? "✅" : "❌"}
          </span>
          <span className="copilot-tool-name">{trace.toolName}</span>
          <span className={`copilot-tool-badge copilot-tool-badge--${provenance.dataType.toLowerCase()}`}>
            {provenance.dataType}
          </span>
          <span className="copilot-tool-duration">{trace.durationMs}ms</span>
          <span className="copilot-tool-chevron">{isExpanded ? "▾" : "▸"}</span>
        </button>
        {isExpanded && (
          <div className="copilot-tool-trace-body">
            <div className="copilot-tool-section">
              <span className="copilot-tool-label">Arguments:</span>
              <pre className="copilot-tool-pre">
                {JSON.stringify(trace.args, null, 2)}
              </pre>
            </div>
            <div className="copilot-tool-section">
              <span className="copilot-tool-label">Source:</span>
              <span className="copilot-tool-value">{provenance.source}</span>
            </div>
            {provenance.disclaimer && (
              <div className="copilot-tool-disclaimer">
                ⚠️ {provenance.disclaimer}
              </div>
            )}
            <div className="copilot-tool-section">
              <span className="copilot-tool-label">Result:</span>
              <pre className="copilot-tool-pre copilot-tool-pre--result">
                {JSON.stringify(trace.result.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="copilot-page">
      {/* Header */}
      <div className="copilot-header">
        <div className="copilot-header-left">
          <div className="copilot-logo">
            <span className="copilot-logo-icon">◈</span>
            <div>
              <h1 className="copilot-title">Operations Copilot</h1>
              <p className="copilot-subtitle">
                AI-powered station assistant · Evidence-backed answers
              </p>
            </div>
          </div>
        </div>
        <div className="copilot-header-right">
          <div
            className={`copilot-status ${
              ollamaAvailable === null
                ? "copilot-status--checking"
                : ollamaAvailable
                ? "copilot-status--online"
                : "copilot-status--offline"
            }`}
          >
            <span className="copilot-status-dot" />
            <span>
              {ollamaAvailable === null
                ? "Checking…"
                : ollamaAvailable
                ? "LLM Online"
                : "LLM Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="copilot-chat-area">
        {messages.length === 0 ? (
          <div className="copilot-welcome">
            <div className="copilot-welcome-icon">◈</div>
            <h2>Welcome to Operations Copilot</h2>
            <p>
              Ask questions about station operations, asset health, energy status,
              or run what-if simulations. All answers are backed by live Digital Twin data.
            </p>
            <div className="copilot-suggestions">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  className="copilot-suggestion-btn"
                  onClick={() => sendMessage(prompt.text)}
                  disabled={isLoading}
                >
                  <span className="copilot-suggestion-text">{prompt.text}</span>
                  <span className="copilot-suggestion-category">{prompt.category}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="copilot-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`copilot-message copilot-message--${msg.role}`}
              >
                <div className="copilot-message-avatar">
                  {msg.role === "user" ? "USR" : "◈"}
                </div>
                <div className="copilot-message-body">
                  <div className="copilot-message-content">
                    {renderContent(msg.content)}
                  </div>

                  {/* Tool call traces */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="copilot-tool-traces">
                      <div className="copilot-tool-traces-header">
                        <span>Tool Calls ({msg.toolCalls.length})</span>
                      </div>
                      {msg.toolCalls.map((trace, idx) =>
                        renderToolTrace(trace, idx, msg.id)
                      )}
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="copilot-message-meta">
                    <span>{msg.timestamp.toLocaleTimeString()}</span>
                    {msg.processingMs && (
                      <span className="copilot-meta-processing">
                        {(msg.processingMs / 1000).toFixed(1)}s
                      </span>
                    )}
                    {msg.modelInfo && (
                      <span className="copilot-meta-model">
                        {msg.modelInfo.model}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="copilot-message copilot-message--assistant copilot-message--loading">
                <div className="copilot-message-avatar">◈</div>
                <div className="copilot-message-body">
                  <div className="copilot-loading-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="copilot-loading-text">
                    Querying Digital Twin & analyzing data…
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="copilot-input-area">
        <div className="copilot-input-container">
          <textarea
            ref={inputRef}
            className="copilot-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              ollamaAvailable === false
                ? "Copilot is offline — Ollama not available"
                : "Ask about station operations, asset health, energy, logistics…"
            }
            disabled={isLoading}
            rows={1}
          />
          <button
            className="copilot-send-btn"
            onClick={() => sendMessage(inputValue)}
            disabled={isLoading || !inputValue.trim()}
            title="Send message (Enter)"
          >
            {isLoading ? "..." : "➤"}
          </button>
        </div>
        <div className="copilot-input-footer">
          <span>All answers are backed by Digital Twin data · Read-only operations · No physical control</span>
        </div>
      </div>
    </div>
  );
}
