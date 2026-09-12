"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bot, X, Send, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi there! I'm your DeployX AI assistant. How can I help you with your deployments today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      let responseContent = "I'm a simulated AI assistant for this demo. To actually implement me, you could hook me up to OpenAI or Google Gemini!";
      
      const lowerInput = userMessage.content.toLowerCase();
      if (lowerInput.includes("deployment") || lowerInput.includes("build")) {
        responseContent = "If your build is failing, I recommend checking the 'Build Logs' in the Deployments tab. Make sure your build and install commands match your framework!";
      } else if (lowerInput.includes("env") || lowerInput.includes("secret")) {
        responseContent = "Environment variables can be added in the 'Environment Variables' tab of your project settings. They are securely encrypted at rest.";
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseContent
      }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-20 right-6 w-80 sm:w-96 shadow-2xl z-50 flex flex-col h-[500px] border-primary/20 animate-in slide-in-from-bottom-5">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between bg-muted/30">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm font-medium">DeployX Assistant</CardTitle>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-4 overflow-y-auto space-y-4" ref={scrollRef}>
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={cn("flex space-x-2", msg.role === "user" ? "flex-row-reverse space-x-reverse" : "flex-row")}
              >
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {msg.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                </div>
                <div className={cn("rounded-lg px-3 py-2 max-w-[80%] text-sm", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex space-x-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-3 h-3" />
                </div>
                <div className="rounded-lg px-3 py-2 bg-muted text-sm flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "0.2s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="p-3 border-t">
            <form onSubmit={handleSend} className="flex w-full space-x-2">
              <Input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Ask me anything..." 
                className="flex-1"
                disabled={isTyping}
              />
              <Button type="submit" size="icon" disabled={!input.trim() || isTyping}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      {/* Floating Toggle Button */}
      <Button 
        onClick={() => setIsOpen(!isOpen)}
        size="icon-lg" 
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 transition-transform hover:scale-105"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </Button>
    </>
  );
}
