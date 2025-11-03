import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Crown } from "lucide-react";
import { httpClient } from "@/utils/authClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const API = "/api";

const ChatPage = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChatUser();
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll for new messages
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChatUser = async () => {
    try {
      const response = await httpClient.get(`/users/list`);
      const foundUser = response.data.users.find(u => u.id === userId);
      setChatUser(foundUser);
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await httpClient.get(`/chat/messages/${userId}`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!user?.isPremium) {
      setShowPremiumPopup(true);
      return;
    }

    if (!newMessage.trim()) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/chat/send`, 
        `receiverId=${userId}&message=${encodeURIComponent(newMessage)}`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      setNewMessage("");
      fetchMessages();
    } catch (error) {
      if (error.response?.status === 403) {
        setShowPremiumPopup(true);
      } else {
        alert("Failed to send message");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <div className="text-2xl text-pink-600">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 flex flex-col" data-testid="chat-page">
      {/* Header */}
      <header className="glass-effect border-b border-pink-100">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button 
            variant="ghost" 
            className="hover:bg-pink-50"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5 text-pink-600" />
          </Button>
          {chatUser && (
            <>
              <img
                src={chatUser.profileImage || "https://via.placeholder.com/40"}
                alt={chatUser.username}
                className="w-10 h-10 rounded-full object-cover border-2 border-pink-200"
              />
              <div className="flex-1">
                <h2 className="font-bold text-gray-800">{chatUser.fullName}</h2>
                <p className="text-sm text-gray-600">@{chatUser.username}</p>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 container mx-auto px-4 py-6 max-w-2xl overflow-y-auto">
        {!user?.isPremium && (
          <div className="glass-effect rounded-2xl p-4 mb-4 text-center bg-yellow-50 border-2 border-yellow-200">
            <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-yellow-700 font-semibold">Premium Required</p>
            <p className="text-sm text-gray-600">Upgrade to send messages</p>
          </div>
        )}

        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 glass-effect rounded-3xl">
              <p className="text-gray-600">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMyMessage = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMyMessage ? "justify-end" : "justify-start"} animate-fadeIn`}
                >
                  <div
                    className={`max-w-xs md:max-w-md px-4 py-3 rounded-2xl ${
                      isMyMessage
                        ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white"
                        : "glass-effect text-gray-800"
                    }`}
                  >
                    <p>{msg.message}</p>
                    <p className={`text-xs mt-1 ${isMyMessage ? "text-pink-100" : "text-gray-500"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="glass-effect border-t border-pink-100 sticky bottom-0">
        <div className="container mx-auto px-4 py-4 max-w-2xl">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <Input
              type="text"
              data-testid="message-input"
              placeholder={user?.isPremium ? "Type a message..." : "Premium required to chat"}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={!user?.isPremium}
              className="flex-1 border-gray-300 focus:border-pink-500 rounded-full"
            />
            <Button
              type="submit"
              data-testid="send-message-btn"
              disabled={!user?.isPremium}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-full w-12 h-12 p-0 btn-hover"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Premium Popup */}
      <Dialog open={showPremiumPopup} onOpenChange={setShowPremiumPopup}>
        <DialogContent className="bg-white rounded-3xl" data-testid="chat-premium-popup">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-yellow-500">
              Premium Chat
            </DialogTitle>
            <DialogDescription className="text-center text-gray-700 mt-4">
              <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">
                Buy Premium from Bot to Use Chat Service
              </p>
              <p className="text-sm text-gray-600 mb-6">
                Visit our Telegram bot to purchase premium membership and unlock unlimited chat access
              </p>
              <Button
                onClick={() => window.open("https://t.me/your_bot_username", "_blank")}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl"
              >
                Open Telegram Bot
              </Button>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;