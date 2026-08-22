"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm your Dental AI Assistant. Ask me anything about your practice.",
    },
  ]);

  const [input, setInput] = useState("");

  async function sendMessage(userMessage: string) {
    if (!userMessage.trim()) return;

    // Add user's message
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setInput("");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't reach the AI assistant. Please try again.",
        },
      ]);
    }
  }

  async function handleSend() {
    await sendMessage(input);
  }

  async function handleSuggestedQuestion(question: string) {
    await sendMessage(question);
  }

  const suggestedQuestions = [
    "💰 How much revenue can I recover?",
    "📋 Which claims should I review first?",
    "📞 Which patients should I call today?",
    "📈 Summarize today's practice performance.",
  ];

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
      }}
    >
      <h1
        style={{
          fontSize: 36,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        🤖 Dental AI Assistant
      </h1>

      <p
        style={{
          color: "#64748b",
          marginBottom: 20,
        }}
      >
        Ask questions about claims, recalls, revenue, and patients.
      </p>

      {/* Suggested Questions */}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {suggestedQuestions.map((question) => (
          <button
            key={question}
            onClick={() => handleSuggestedQuestion(question)}
            style={{
              background: "#eff6ff",
              color: "#2563eb",
              border: "1px solid #bfdbfe",
              borderRadius: 9999,
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {question}
          </button>
        ))}
      </div>

      {/* Chat Window */}

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 20,
          height: 500,
          overflowY: "auto",
          padding: 20,
          marginBottom: 20,
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              justifyContent:
                message.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background:
                  message.role === "user" ? "#2563eb" : "#f1f5f9",
                color:
                  message.role === "user" ? "#fff" : "#0f172a",
                padding: "12px 16px",
                borderRadius: 16,
                maxWidth: "70%",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}

      <div
        style={{
          display: "flex",
          gap: 12,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
          placeholder="Ask the AI..."
          style={{
            flex: 1,
            padding: 16,
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            fontSize: 16,
          }}
        />

        <button
          onClick={handleSend}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "0 28px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}