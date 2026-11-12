"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Strip parentheses wrapping URLs so remark-gfm can autolink them
function preprocessLinks(text: string): string {
  return text.replace(/\((https?:\/\/[^\s)]+)\)/g, " $1 ");
}

const SUGGESTED_QUESTIONS = [
  "מה הציון הכי גבוה שניב נתן?",
  "מה הציון הכי נמוך שניב נתן?",
  "כמה מסעדות ניב סקר?",
  "מה הציון הממוצע של כל הביקורות?",
];

export default function Chat() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");

  const isLoading = status === "streaming" || status === "submitted";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto text-right">
          <h1 className="text-2xl font-bold text-gray-900">GilBot 🍽️</h1>
          <p className="text-sm text-gray-500">
            שאלו אותי הכל על ביקורות המסעדות של ניב גלבוע
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-4xl mb-4">🍽️</p>
              <p className="text-lg mb-6">ברוכים הבאים ל-GilBot!</p>
              <p className="text-sm mb-4">נסו לשאול:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      sendMessage({ text: q });
                    }}
                    className="px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition text-sm text-gray-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-right ${
                  message.role === "user"
                    ? "bg-orange-500 text-white"
                    : "bg-white text-gray-900 shadow"
                }`}
                dir="rtl"
              >
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    if (message.role === "user") {
                      return (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      );
                    }
                    return (
                      <div key={i} className="prose prose-sm max-w-none prose-a:text-orange-600 prose-a:underline">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-600 underline hover:text-orange-800 break-all"
                              >
                                {href}
                              </a>
                            ),
                            p: ({ children }) => (
                              <p className="whitespace-pre-wrap mb-2 last:mb-0">
                                {children}
                              </p>
                            ),
                          }}
                        >
                          {preprocessLinks(part.text)}
                        </ReactMarkdown>
                      </div>
                    );
                  }
                  if ("state" in part) {
                    const state = (part as { state: string }).state;
                    return (
                      <p
                        key={i}
                        className="text-xs text-gray-400 italic my-1"
                      >
                        {state === "result"
                          ? "✅ חיפוש הושלם"
                          : "🔍 מחפש בביקורות..."}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-end">
              <div className="bg-white rounded-2xl px-4 py-3 shadow animate-pulse text-gray-400">
                חושב...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t bg-white px-6 py-4">
        <div className="flex gap-3 max-w-3xl mx-auto" dir="ltr">
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="shrink-0 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 transition font-medium"
          >
            שלח
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="שאלו על ביקורת מסעדה..."
            className="min-w-0 flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-right"
            dir="rtl"
            disabled={isLoading}
          />
        </div>
      </form>
    </div>
  );
}
