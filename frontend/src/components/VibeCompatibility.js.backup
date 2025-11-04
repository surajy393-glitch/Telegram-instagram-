import React, { useState, useEffect } from "react";
import axios from "axios";

const API = "/api";

const VibeCompatibility = ({ partnerUserId, messageCount, showAt = 30 }) => {
  const [compatibility, setCompatibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show compatibility after certain message count
    if (messageCount >= showAt && !compatibility) {
      fetchCompatibility();
    }
  }, [messageCount]);

  const fetchCompatibility = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/auth/calculate-compatibility/${partnerUserId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setCompatibility(response.data);
      setVisible(true);
    } catch (error) {
      console.error("Error fetching compatibility:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!visible || loading) {
    return null;
  }

  if (!compatibility) {
    return null;
  }

  const getCompatibilityColor = (percentage) => {
    if (percentage >= 80) return "from-red-500 to-pink-500";
    if (percentage >= 60) return "from-orange-500 to-yellow-500";
    if (percentage >= 40) return "from-blue-500 to-purple-500";
    return "from-green-500 to-teal-500";
  };

  const getEmoji = (percentage) => {
    if (percentage >= 80) return "🔥";
    if (percentage >= 60) return "✨";
    if (percentage >= 40) return "💫";
    return "🌟";
  };

  return (
    <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-5 border-2 border-white border-opacity-20 shadow-xl">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-3xl">{getEmoji(compatibility.compatibility_percentage)}</span>
          <h3 className="text-white font-bold text-xl">Vibe Compatibility</h3>
          <span className="text-3xl">{getEmoji(compatibility.compatibility_percentage)}</span>
        </div>
        <p className="text-white text-opacity-80 text-sm">
          Your personality match score revealed!
        </p>
      </div>

      {/* Main Score */}
      <div className="relative mb-6">
        <div className="flex items-center justify-center mb-3">
          <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${getCompatibilityColor(compatibility.compatibility_percentage)} flex items-center justify-center shadow-lg`}>
            <div className="absolute inset-2 bg-white bg-opacity-20 rounded-full backdrop-blur-sm"></div>
            <div className="relative z-10">
              <div className="text-4xl font-bold text-white">
                {compatibility.compatibility_percentage}%
              </div>
            </div>
          </div>
        </div>
        <p className="text-white text-center font-medium text-lg">
          {compatibility.message}
        </p>
      </div>

      {/* Breakdown */}
      <div className="space-y-3 mb-4">
        <div className="bg-white bg-opacity-10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-medium flex items-center gap-2">
              <span>🎯</span> Interest Match
            </span>
            <span className="text-white font-bold">{compatibility.interest_score}%</span>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-400 to-cyan-400 h-full transition-all"
              style={{ width: `${compatibility.interest_score}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white bg-opacity-10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-medium flex items-center gap-2">
              <span>🧠</span> Personality Match
            </span>
            <span className="text-white font-bold">{compatibility.personality_score}%</span>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-400 to-pink-400 h-full transition-all"
              style={{ width: `${compatibility.personality_score}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Common Interests */}
      {compatibility.common_interests && compatibility.common_interests.length > 0 && (
        <div className="bg-white bg-opacity-10 rounded-xl p-3 mb-3">
          <div className="text-white font-medium text-sm mb-2 flex items-center gap-2">
            <span>❤️</span> What You Both Love
          </div>
          <div className="flex flex-wrap gap-2">
            {compatibility.common_interests.map((interest, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-pink-500 bg-opacity-80 text-white text-xs rounded-full font-medium"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Matching Answers Hint */}
      {compatibility.matching_answers && compatibility.matching_answers.length > 0 && (
        <div className="bg-white bg-opacity-10 rounded-xl p-3">
          <div className="text-white text-sm flex items-start gap-2">
            <span className="text-lg">🎉</span>
            <div>
              <p className="font-medium mb-1">Personality Matches</p>
              <p className="text-white text-opacity-80 text-xs">
                You both answered {compatibility.matching_answers.length} personality questions the same way!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Weight Info */}
      <div className="mt-4 pt-4 border-t border-white border-opacity-20">
        <p className="text-white text-opacity-60 text-xs text-center">
          Score based on: {compatibility.details.interests_weight}% interests + {compatibility.details.personality_weight}% personality
        </p>
      </div>
    </div>
  );
};

export default VibeCompatibility;
