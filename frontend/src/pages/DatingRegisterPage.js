import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

const API = "/api";

const DatingRegisterPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // OTP and verification states
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileVerified, setMobileVerified] = useState(false);
  const [mobileOtpLoading, setMobileOtpLoading] = useState(false);
  const [mobileStatus, setMobileStatus] = useState(null);
  const [mobileMessage, setMobileMessage] = useState("");
  
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "",
    age: "",
    gender: "",
    city: "",
    country: "",
    interests: [],
    profilePhoto: null,
    personalityAnswers: {}
  });
  
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const interestOptions = [
    "Chatting", "Friends", "Relationship", "Love", "Games", "Anime",
    "Travel", "Food", "Music", "Movies", "Sports", "Reading"
  ];

  // Personality questions for vibe compatibility
  const personalityQuestions = [
    {
      id: "friday_night",
      question: "What's your ideal Friday night?",
      emoji: "🎉",
      options: [
        { value: "party", label: "Party with friends", emoji: "🎊" },
        { value: "movie", label: "Cozy movie night", emoji: "🎬" },
        { value: "gaming", label: "Gaming session", emoji: "🎮" },
        { value: "chill", label: "Relaxing at home", emoji: "🏠" }
      ]
    },
    {
      id: "morning_type",
      question: "Are you a morning person or night owl?",
      emoji: "⏰",
      options: [
        { value: "early_bird", label: "Early bird", emoji: "🌅" },
        { value: "night_owl", label: "Night owl", emoji: "🌙" },
        { value: "flexible", label: "I adapt", emoji: "🔄" }
      ]
    },
    {
      id: "beverage",
      question: "Coffee or Tea?",
      emoji: "☕",
      options: [
        { value: "coffee", label: "Coffee lover", emoji: "☕" },
        { value: "tea", label: "Tea enthusiast", emoji: "🍵" },
        { value: "both", label: "Both are great", emoji: "😊" },
        { value: "neither", label: "Neither", emoji: "🥤" }
      ]
    },
    {
      id: "vacation",
      question: "Beach or Mountains?",
      emoji: "🏖️",
      options: [
        { value: "beach", label: "Beach paradise", emoji: "🏖️" },
        { value: "mountains", label: "Mountain adventure", emoji: "⛰️" },
        { value: "city", label: "City exploration", emoji: "🌆" },
        { value: "countryside", label: "Peaceful countryside", emoji: "🌾" }
      ]
    },
    {
      id: "pet_preference",
      question: "Dogs or Cats?",
      emoji: "🐾",
      options: [
        { value: "dogs", label: "Dog person", emoji: "🐕" },
        { value: "cats", label: "Cat person", emoji: "🐈" },
        { value: "both", label: "Love both", emoji: "❤️" },
        { value: "other", label: "Other pets", emoji: "🦎" }
      ]
    },
    {
      id: "social_type",
      question: "Introvert or Extrovert?",
      emoji: "🎭",
      options: [
        { value: "introvert", label: "Introvert", emoji: "📚" },
        { value: "extrovert", label: "Extrovert", emoji: "🎤" },
        { value: "ambivert", label: "Ambivert", emoji: "⚖️" }
      ]
    },
    {
      id: "adventure_level",
      question: "Adventure or Relaxation?",
      emoji: "🎢",
      options: [
        { value: "thrill_seeker", label: "Thrill seeker", emoji: "🎢" },
        { value: "balanced", label: "Balanced mix", emoji: "🎯" },
        { value: "chill_vibes", label: "Chill vibes", emoji: "😌" }
      ]
    },
    {
      id: "planning_style",
      question: "Planner or Spontaneous?",
      emoji: "📅",
      options: [
        { value: "planner", label: "Love planning", emoji: "📋" },
        { value: "spontaneous", label: "Go with the flow", emoji: "🌊" },
        { value: "mix", label: "Bit of both", emoji: "🎲" }
      ]
    }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Check username availability
    if (name === 'username') {
      checkUsernameAvailability(value);
    }
    
    // Check email availability
    if (name === 'email') {
      checkEmailAvailability(value);
    }
    
    // Check mobile availability
    if (name === 'mobileNumber') {
      checkMobileAvailability(value);
    }
  };

  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameStatus(null);
      setUsernameSuggestions([]);
      setUsernameMessage("");
      return;
    }

    setUsernameStatus('checking');
    setUsernameMessage("Checking availability...");
    
    try {
      const response = await axios.get(`${API}/auth/check-username/${encodeURIComponent(username)}`);
      const data = response.data;
      
      if (data.available) {
        setUsernameStatus('available');
        setUsernameMessage(data.message);
        setUsernameSuggestions([]);
      } else {
        setUsernameStatus('taken');
        setUsernameMessage(data.message);
        setUsernameSuggestions(data.suggestions || []);
      }
    } catch (error) {
      setUsernameStatus('error');
      setUsernameMessage("Error checking username");
      setUsernameSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion) => {
    setFormData({
      ...formData,
      username: suggestion
    });
    checkUsernameAvailability(suggestion);
  };

  const checkEmailAvailability = async (email) => {
    if (!email || !email.includes('@')) {
      setEmailStatus(null);
      setEmailMessage("");
      return;
    }

    setEmailStatus('checking');
    setEmailMessage("Checking email...");
    
    try {
      const response = await axios.get(`${API}/auth/check-email/${encodeURIComponent(email)}`);
      const data = response.data;
      
      if (data.available) {
        setEmailStatus('available');
        setEmailMessage(data.message);
      } else {
        setEmailStatus('taken');
        setEmailMessage(data.message);
      }
    } catch (error) {
      setEmailStatus('error');
      setEmailMessage("Error checking email");
    }
  };

  const checkMobileAvailability = async (mobile) => {
    if (!mobile || mobile.length < 10) {
      setMobileStatus(null);
      setMobileMessage("");
      return;
    }

    setMobileStatus('checking');
    setMobileMessage("Checking mobile number...");
    
    try {
      const response = await axios.get(`${API}/auth/check-mobile/${encodeURIComponent(mobile)}`);
      const data = response.data;
      
      if (data.available) {
        setMobileStatus('available');
        setMobileMessage(data.message);
      } else {
        setMobileStatus('taken');
        setMobileMessage(data.message);
      }
    } catch (error) {
      setMobileStatus('error');
      setMobileMessage("Error checking mobile number");
    }
  };

  const sendEmailOtp = async () => {
    if (!formData.email || emailStatus !== 'available') {
      toast({
        title: "Error",
        description: "Please enter a valid available email first",
        variant: "destructive"
      });
      return;
    }

    setOtpLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/send-email-otp`, {
        email: formData.email
      });
      
      if (response.data.otpSent) {
        setEmailOtpSent(true);
        toast({
          title: "OTP Sent! 📧",
          description: "Check your email for the verification code",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to send OTP",
        variant: "destructive"
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!emailOtp.trim()) {
      toast({
        title: "Error",
        description: "Please enter the OTP",
        variant: "destructive"
      });
      return;
    }

    setOtpLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/verify-email-otp`, {
        email: formData.email,
        otp: emailOtp.trim()
      });
      
      if (response.data.verified) {
        setEmailVerified(true);
        toast({
          title: "Email Verified! ✅",
          description: "You can now proceed to the next step",
        });
      }
    } catch (error) {
      toast({
        title: "Invalid OTP",
        description: error.response?.data?.detail || "OTP verification failed",
        variant: "destructive"
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const sendMobileOtp = async () => {
    if (!formData.mobileNumber || !formData.mobileNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter your mobile number first",
        variant: "destructive"
      });
      return;
    }

    if (mobileStatus === 'taken') {
      toast({
        title: "Error",
        description: "This mobile number is already registered",
        variant: "destructive"
      });
      return;
    }

    if (mobileStatus !== 'available') {
      toast({
        title: "Error",
        description: "Please wait for mobile number validation",
        variant: "destructive"
      });
      return;
    }

    setMobileOtpLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/send-mobile-otp`, {
        mobileNumber: formData.mobileNumber
      });
      
      if (response.data.otpSent) {
        setMobileOtpSent(true);
        toast({
          title: "OTP Sent! 📱",
          description: "Check your mobile for the verification code",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to send mobile OTP",
        variant: "destructive"
      });
    } finally {
      setMobileOtpLoading(false);
    }
  };

  const verifyMobileOtp = async () => {
    if (!mobileOtp.trim()) {
      toast({
        title: "Error",
        description: "Please enter the mobile OTP",
        variant: "destructive"
      });
      return;
    }

    setMobileOtpLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/verify-mobile-otp`, {
        mobileNumber: formData.mobileNumber,
        otp: mobileOtp.trim()
      });
      
      if (response.data.verified) {
        setMobileVerified(true);
        toast({
          title: "Mobile Verified! ✅",
          description: "Mobile number verified successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Invalid OTP",
        description: error.response?.data?.detail || "Mobile OTP verification failed",
        variant: "destructive"
      });
    } finally {
      setMobileOtpLoading(false);
    }
  };

  const toggleInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };
  
  const selectPersonalityAnswer = (questionId, value) => {
    setFormData(prev => ({
      ...prev,
      personalityAnswers: {
        ...prev.personalityAnswers,
        [questionId]: value
      }
    }));
  };
  
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File too large",
          description: "Please upload a photo smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      
      setFormData(prev => ({ ...prev, profilePhoto: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    
    // REQUIRE either email OR mobile verification before proceeding
    if (!emailVerified && !mobileVerified) {
      toast({
        title: "Verification Required",
        description: "Please verify either your email or mobile number before proceeding",
        variant: "destructive"
      });
      return;
    }
    
    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords don't match. Please check and try again.",
        variant: "destructive"
      });
      return;
    }
    
    if (formData.fullName && formData.username && (formData.email || mobileVerified) && formData.age && formData.gender && formData.password) {
      setStep(2);
    }
  };

  const handleStep2Submit = (e) => {
    e.preventDefault();
    
    if (!formData.city) {
      toast({
        title: "City Required",
        description: "Please enter your city",
        variant: "destructive"
      });
      return;
    }

    if (!formData.country) {
      toast({
        title: "Country Required",
        description: "Please enter your country",
        variant: "destructive"
      });
      return;
    }

    if (formData.interests.length === 0) {
      toast({
        title: "Interests Required",
        description: "Please select at least one interest",
        variant: "destructive"
      });
      return;
    }
    
    // Move to step 3 for personality questions
    setStep(3);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    
    // Check if all personality questions are answered
    const unansweredQuestions = personalityQuestions.filter(
      q => !formData.personalityAnswers[q.id]
    );
    
    if (unansweredQuestions.length > 0) {
      toast({
        title: "Answer All Questions",
        description: `Please answer all ${personalityQuestions.length} personality questions to continue`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Register user in web app (MongoDB) AND bot database (PostgreSQL)
      const formDataToSend = new FormData();
      formDataToSend.append("fullName", formData.fullName);
      formDataToSend.append("username", formData.username);
      formDataToSend.append("email", formData.email || "");
      formDataToSend.append("mobileNumber", formData.mobileNumber || "");
      formDataToSend.append("password", formData.password);
      formDataToSend.append("age", parseInt(formData.age));
      formDataToSend.append("gender", formData.gender);
      formDataToSend.append("city", formData.city);
      formDataToSend.append("country", formData.country);
      formDataToSend.append("interests", formData.interests.join(", "));
      formDataToSend.append("emailVerified", emailVerified);
      formDataToSend.append("mobileVerified", mobileVerified);
      formDataToSend.append("personalityAnswers", JSON.stringify(formData.personalityAnswers));
      
      // Add profile photo if uploaded
      if (formData.profilePhoto) {
        formDataToSend.append("profilePhoto", formData.profilePhoto);
      }

      const response = await axios.post(`${API}/auth/register-enhanced`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      const token = response.data.access_token;
      let fullUser;
      try {
        // Attempt to fetch the complete user record using the new token.
        const meResponse = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        fullUser = meResponse.data.user || meResponse.data;
      } catch (err) {
        // Fall back to the user returned from registration if /auth/me fails.
        fullUser = response.data.user;
      }

      // Normalize the user object to ensure profileImage field exists
      const normalizedUser = {
        ...fullUser,
        profileImage: fullUser.profileImage ?? 
                      fullUser.profile_image ?? 
                      fullUser.profilePhoto ?? 
                      fullUser.profile_photo_url ?? 
                      fullUser.photo_url ?? 
                      fullUser.profile_photo ?? 
                      null
      };

      // Always prefer the local base64 preview of the uploaded photo if it exists.
      // This guarantees the image is visible immediately after registration
      // (the server may not return a valid path on the first fetch).
      if (photoPreview) {
        normalizedUser.profileImage = photoPreview;
      }

      // Save token and normalized user to localStorage.
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));

      console.log("🎉 Registration successful! User data:", normalizedUser);
      console.log("🖼️ Profile Image:", normalizedUser.profileImage);
      console.log("📸 Using base64 preview:", !fullUser.profileImage && !!photoPreview);

      // Update React state immediately so downstream components have access to the correct user.
      onLogin(token, normalizedUser);

      toast({
        title: "Registration Successful! 🎉",
        description: "Welcome to LuvHive!",
      });

      // Redirect the user to the feed.
      navigate("/home");
      
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: error.response?.data?.detail || "Registration failed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fadeIn">
          <h1 className="text-5xl font-bold text-white mb-2">
            🎭 LuvHive Mystery Match
          </h1>
          <p className="text-white text-opacity-90">Create your anonymous dating profile</p>
        </div>

        <div className="glass-effect rounded-3xl p-8 shadow-xl">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-pink-500' : 'bg-gray-300'} text-white font-bold`}>
              1
            </div>
            <div className={`w-12 h-1 ${step >= 2 ? 'bg-pink-500' : 'bg-gray-300'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-pink-500' : 'bg-gray-300'} text-white font-bold`}>
              2
            </div>
            <div className={`w-12 h-1 ${step >= 3 ? 'bg-pink-500' : 'bg-gray-300'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-pink-500' : 'bg-gray-300'} text-white font-bold`}>
              3
            </div>
          </div>

          {step === 1 ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Basic Info</h2>
              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div>
                  <Label htmlFor="fullName" className="text-white font-medium">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className="mt-2 bg-white bg-opacity-90 text-gray-900 placeholder:text-gray-500 border-white border-opacity-30 focus:border-pink-400 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <Label htmlFor="username" className="text-white font-medium">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Choose a unique username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    className={`mt-2 bg-white bg-opacity-90 text-gray-900 placeholder:text-gray-500 rounded-xl font-medium ${
                      usernameStatus === 'available' ? 'border-green-400 border-2' :
                      usernameStatus === 'taken' ? 'border-red-400 border-2' :
                      'border-white border-opacity-30'
                    }`}
                  />
                  
                  {/* Username Status Display */}
                  {usernameStatus && (
                    <div className="mt-2">
                      <p className={`text-sm flex items-center gap-2 ${
                        usernameStatus === 'available' ? 'text-green-300' :
                        usernameStatus === 'taken' ? 'text-red-300' :
                        usernameStatus === 'checking' ? 'text-blue-300' :
                        'text-white text-opacity-70'
                      }`}>
                        {usernameStatus === 'checking' && <span className="animate-spin">⏳</span>}
                        {usernameStatus === 'available' && <span>✅</span>}
                        {usernameStatus === 'taken' && <span>❌</span>}
                        {usernameMessage}
                      </p>
                      
                      {/* Username Suggestions */}
                      {usernameSuggestions.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-500 bg-opacity-20 rounded-lg border border-blue-300 border-opacity-30">
                          <p className="text-sm font-medium text-blue-200 mb-2">
                            Available suggestions:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {usernameSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => selectSuggestion(suggestion)}
                                className="px-3 py-1 text-sm bg-white bg-opacity-20 border border-white border-opacity-30 rounded-lg text-white hover:bg-opacity-30 transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className="text-white font-medium">
                    Email {mobileVerified ? <span className="text-white text-opacity-60">(optional)</span> : ""}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={mobileVerified ? "Email (optional)" : "your@email.com"}
                    value={formData.email}
                    onChange={handleChange}
                    required={!mobileVerified}
                    className={`mt-2 bg-white bg-opacity-90 text-gray-900 placeholder:text-gray-500 rounded-xl font-medium ${
                      emailStatus === 'available' ? 'border-green-400 border-2' :
                      emailStatus === 'taken' ? 'border-red-400 border-2' :
                      'border-white border-opacity-30'
                    }`}
                  />
                  
                  {/* Email Status Display */}
                  {emailStatus && (
                    <div className="mt-2">
                      <p className={`text-sm flex items-center gap-2 ${
                        emailStatus === 'available' ? 'text-green-300' :
                        emailStatus === 'taken' ? 'text-red-300' :
                        emailStatus === 'checking' ? 'text-blue-300' :
                        'text-white text-opacity-70'
                      }`}>
                        {emailStatus === 'checking' && <span className="animate-spin">⏳</span>}
                        {emailStatus === 'available' && <span>✅</span>}
                        {emailStatus === 'taken' && <span>❌</span>}
                        {emailMessage}
                      </p>
                    </div>
                  )}
                  
                  {/* EMAIL OTP VERIFICATION */}
                  {emailStatus === 'available' && !emailVerified && (
                    <div className="mt-3 p-4 bg-blue-500 bg-opacity-20 rounded-lg border border-blue-300 border-opacity-30">
                      <p className="text-sm font-medium text-blue-200 mb-3">
                        {mobileVerified ? '🔐 Email Verification (Optional)' : '🔐 Email Verification Required'}
                      </p>
                      
                      {!emailOtpSent ? (
                        <div>
                          <p className="text-sm text-blue-100 mb-3">
                            {mobileVerified ? 
                              'Optionally verify your email for additional security' :
                              'Click below to send verification code to your email'
                            }
                          </p>
                          <button
                            type="button"
                            onClick={sendEmailOtp}
                            disabled={otpLoading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                          >
                            {otpLoading ? "Sending..." : "Send OTP to Email"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-blue-100">
                            Enter the 6-digit code sent to your email:
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Enter OTP"
                              value={emailOtp}
                              onChange={(e) => setEmailOtp(e.target.value)}
                              className="flex-1 text-center text-lg tracking-widest bg-white text-gray-800"
                              maxLength="6"
                            />
                            <button
                              type="button"
                              onClick={verifyEmailOtp}
                              disabled={otpLoading || !emailOtp.trim()}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                            >
                              {otpLoading ? "Verifying..." : "Verify"}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={sendEmailOtp}
                            disabled={otpLoading}
                            className="text-sm text-blue-200 hover:text-blue-100 underline"
                          >
                            Resend OTP
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* EMAIL VERIFIED SUCCESS */}
                  {emailVerified && (
                    <div className="mt-3 p-3 bg-green-500 bg-opacity-20 rounded-lg border border-green-300 border-opacity-30">
                      <p className="text-sm text-green-200 flex items-center gap-2">
                        ✅ Email verified successfully!
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="password" className="text-white font-medium">Password</Label>
                  <div className="relative mt-2">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="bg-white bg-opacity-90 text-gray-900 placeholder:text-gray-500 border-white border-opacity-30 focus:border-pink-400 rounded-xl pr-12 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-700 hover:text-gray-900 focus:outline-none bg-white rounded-full p-1"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M14.12 14.12l1.414 1.414M9.878 9.878l-4.414-4.414m14.071 14.071L20.95 20.95M9.878 9.878l4.242 4.242" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-white font-medium">Confirm Password</Label>
                  <div className="relative mt-2">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      className={`bg-white bg-opacity-90 text-gray-900 placeholder:text-gray-500 border-white border-opacity-30 focus:border-pink-400 rounded-xl pr-12 font-medium ${
                        formData.confirmPassword && formData.password !== formData.confirmPassword 
                          ? 'border-red-500' 
                          : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-700 hover:text-gray-900 focus:outline-none bg-white rounded-full p-1"
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M14.12 14.12l1.414 1.414M9.878 9.878l-4.414-4.414m14.071 14.071L20.95 20.95M9.878 9.878l4.242 4.242" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-red-300 text-sm mt-1">Passwords don't match</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="mobileNumber" className="text-white font-medium">
                    Mobile Number <span className="text-white text-opacity-60">(optional)</span>
                  </Label>
                  <Input
                    id="mobileNumber"
                    name="mobileNumber"
                    type="tel"
                    placeholder="Enter your mobile (+91xxxxxxxxxx)"
                    value={formData.mobileNumber}
                    onChange={handleChange}
                    className={`mt-2 bg-white bg-opacity-90 text-gray-900 placeholder:text-gray-500 rounded-xl font-medium ${
                      mobileStatus === 'available' ? 'border-green-400 border-2' :
                      mobileStatus === 'taken' ? 'border-red-400 border-2' :
                      'border-white border-opacity-30'
                    }`}
                  />
                  
                  {/* Mobile Status Display */}
                  {mobileStatus && (
                    <div className="mt-2">
                      <p className={`text-sm flex items-center gap-2 ${
                        mobileStatus === 'available' ? 'text-green-300' :
                        mobileStatus === 'taken' ? 'text-red-300' :
                        mobileStatus === 'checking' ? 'text-blue-300' :
                        'text-white text-opacity-70'
                      }`}>
                        {mobileStatus === 'checking' && <span className="animate-spin">⏳</span>}
                        {mobileStatus === 'available' && <span>✅</span>}
                        {mobileStatus === 'taken' && <span>❌</span>}
                        {mobileMessage}
                      </p>
                    </div>
                  )}
                  
                  {/* MOBILE OTP VERIFICATION */}
                  {formData.mobileNumber && formData.mobileNumber.trim() && !mobileVerified && (
                    <div className="mt-3 p-4 bg-green-500 bg-opacity-20 rounded-lg border border-green-300 border-opacity-30">
                      <p className="text-sm font-medium text-green-200 mb-3">
                        {emailVerified ? '📱 Mobile Verification (Optional)' : '📱 Mobile Verification Required'}
                      </p>
                      
                      {!mobileOtpSent ? (
                        <div>
                          <p className="text-sm text-green-100 mb-3">
                            {emailVerified ? 
                              'Optionally verify your mobile for additional security' :
                              'Click below to send verification code to your mobile'
                            }
                          </p>
                          <button
                            type="button"
                            onClick={sendMobileOtp}
                            disabled={mobileOtpLoading}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                          >
                            {mobileOtpLoading ? "Sending..." : "Send OTP to Mobile"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-green-100">
                            Enter the 6-digit code sent to your mobile:
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Enter OTP"
                              value={mobileOtp}
                              onChange={(e) => setMobileOtp(e.target.value)}
                              className="flex-1 text-center text-lg tracking-widest bg-white text-gray-800"
                              maxLength="6"
                            />
                            <button
                              type="button"
                              onClick={verifyMobileOtp}
                              disabled={mobileOtpLoading || !mobileOtp.trim()}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                            >
                              {mobileOtpLoading ? "Verifying..." : "Verify"}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={sendMobileOtp}
                            disabled={mobileOtpLoading}
                            className="text-sm text-green-200 hover:text-green-100 underline"
                          >
                            Resend OTP
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* MOBILE VERIFIED SUCCESS */}
                  {mobileVerified && (
                    <div className="mt-3 p-3 bg-green-500 bg-opacity-20 rounded-lg border border-green-300 border-opacity-30">
                      <p className="text-sm text-green-200 flex items-center gap-2">
                        ✅ Mobile number verified successfully!
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="age" className="text-white font-medium">Age</Label>
                    <Input
                      id="age"
                      name="age"
                      type="number"
                      placeholder="18+"
                      value={formData.age}
                      onChange={handleChange}
                      required
                      min="18"
                      className="mt-2 bg-white bg-opacity-90 text-gray-900 placeholder:text-gray-500 border-white border-opacity-30 focus:border-pink-400 rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gender" className="text-white font-medium">Gender</Label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full bg-white bg-opacity-90 text-gray-900 border-white border-opacity-30 rounded-xl px-4 py-2 focus:border-pink-400 focus:outline-none font-medium"
                    >
                      <option value="" className="text-gray-800">Select</option>
                      <option value="Male" className="text-gray-800">Male</option>
                      <option value="Female" className="text-gray-800">Female</option>
                      <option value="Other" className="text-gray-800">Other</option>
                    </select>
                  </div>
                </div>

                <Button 
                  type="submit"
                  disabled={!emailVerified && !mobileVerified}
                  className={`w-full py-6 rounded-xl text-lg font-bold shadow-2xl ${
                    emailVerified || mobileVerified
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white' 
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                >
                  {emailVerified || mobileVerified ? 'Next Step →' : 'Verify Email or Mobile First'}
                </Button>
              </form>
            </>
          ) : step === 2 ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Dating Profile</h2>
              <form onSubmit={handleStep2Submit} className="space-y-5">
                <div>
                  <Label htmlFor="city" className="text-white font-medium">City</Label>
                  <Input
                    id="city"
                    name="city"
                    type="text"
                    placeholder="Enter your city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    className="mt-2 bg-white bg-opacity-90 text-gray-900 placeholder:text-gray-500 border-white border-opacity-30 focus:border-pink-400 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <Label htmlFor="country" className="text-white font-medium">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    type="text"
                    placeholder="Enter your country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    className="mt-2 bg-white bg-opacity-90 text-gray-900 placeholder:text-gray-500 border-white border-opacity-30 focus:border-pink-400 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <Label className="text-white font-medium mb-3 block">Interests (Select at least 1)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {interestOptions.map(interest => (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition break-words text-center w-full ${
                          formData.interests.includes(interest)
                            ? 'bg-pink-500 text-white'
                            : 'bg-white bg-opacity-20 text-white border border-white border-opacity-30 hover:bg-opacity-30'
                        }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-white font-medium mb-3 block">Profile Photo (Optional - for reveals)</Label>
                  <div className="bg-white bg-opacity-10 rounded-xl p-4 border-2 border-dashed border-white border-opacity-30">
                    <input
                      type="file"
                      id="profilePhoto"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="profilePhoto"
                      className="cursor-pointer flex flex-col items-center justify-center text-center"
                    >
                      {photoPreview ? (
                        <div className="relative">
                          <img
                            src={photoPreview}
                            alt="Preview"
                            className="w-32 h-32 rounded-full object-cover border-4 border-pink-400"
                          />
                          <div className="mt-3 text-sm text-white">
                            ✅ Photo uploaded! Click to change
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-5xl mb-3">📸</div>
                          <div className="text-white font-medium mb-2">
                            Upload Your Photo
                          </div>
                          <div className="text-sm text-white text-opacity-70">
                            Will be revealed progressively after 120 messages
                          </div>
                        </div>
                      )}
                    </label>
                  </div>
                  <p className="text-xs text-white text-opacity-70 mt-2">
                    💡 Your photo stays hidden until you chat enough. Other users can request to see it after 120 messages.
                  </p>
                </div>

                <div className="bg-white bg-opacity-10 rounded-xl p-4 text-white text-sm">
                  <div className="flex items-start space-x-2">
                    <span className="text-xl">🎭</span>
                    <div>
                      <p className="font-semibold mb-1">LuvHive Mystery Match Privacy</p>
                      <p className="text-white text-opacity-80 mb-2">Your profile stays completely hidden! Reveal happens progressively:</p>
                      <ul className="text-xs text-white text-opacity-70 space-y-1 ml-4">
                        <li>• 20 msgs → Gender & Age revealed</li>
                        <li>• 60 msgs → Blurred Photo revealed</li>
                        <li>• 100 msgs → Interests & Bio revealed</li>
                        <li>• 150 msgs → Full Profile unlocked</li>
                      </ul>
                      <p className="text-white text-opacity-80 mt-2 text-xs">
                        ⚠️ <strong>Important:</strong> Don't manually share your age, gender, or photo in chat. Let the system reveal it naturally!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 py-6 rounded-xl"
                  >
                    ← Back
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white py-6 rounded-xl text-lg font-bold shadow-2xl"
                  >
                    Next Step →
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-extrabold text-white mb-6 text-center drop-shadow-lg">Personality Questions</h2>
              <form onSubmit={handleFinalSubmit} className="space-y-6">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 bg-opacity-90 rounded-xl p-4 shadow-lg mb-6">
                  <div className="flex items-start space-x-2">
                    <span className="text-2xl">🧠</span>
                    <div>
                      <p className="font-bold text-white text-lg mb-1">Personality Matching</p>
                      <p className="text-white text-opacity-95 font-medium">Answer these questions to help us find your perfect vibe match!</p>
                    </div>
                  </div>
                </div>

                {personalityQuestions.map((question, index) => (
                  <div key={question.id} className="bg-white rounded-xl p-5 shadow-lg">
                    <div className="mb-4">
                      <h3 className="text-gray-900 font-bold text-xl flex items-center gap-2">
                        <span className="text-3xl">{question.emoji}</span>
                        {question.question}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {question.options.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => selectPersonalityAnswer(question.id, option.value)}
                          className={`p-4 rounded-lg text-left transition-all duration-200 flex items-center gap-3 ${
                            formData.personalityAnswers[question.id] === option.value
                              ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-xl transform scale-105 border-2 border-pink-700'
                              : 'bg-gray-100 text-gray-900 font-semibold border-2 border-gray-300 hover:bg-gray-200 hover:border-gray-400 shadow-md'
                          }`}
                        >
                          <span className="text-2xl">{option.emoji}</span>
                          <span className="font-bold text-lg">{option.label}</span>
                          {formData.personalityAnswers[question.id] === option.value && (
                            <span className="ml-auto text-2xl">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="bg-gradient-to-r from-blue-600 to-purple-600 bg-opacity-90 rounded-xl p-4 shadow-lg">
                  <div className="flex items-start space-x-2">
                    <span className="text-2xl">💡</span>
                    <div>
                      <p className="font-bold text-white text-lg mb-2">How It Works</p>
                      <p className="text-white font-medium mb-2">Your answers help us match you with people who share similar vibes and interests.</p>
                      <p className="text-white font-semibold text-sm">
                        ✨ The more honest you are, the better your matches will be!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 py-6 rounded-xl"
                  >
                    ← Back
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white py-6 rounded-xl text-lg font-bold shadow-2xl"
                  >
                    {loading ? "Creating..." : "Complete 🎉"}
                  </Button>
                </div>
              </form>
            </>
          )}

          <div className="mt-6 text-center text-white text-opacity-90">
            <p>Already have an account? <Link to="/login" className="text-pink-200 font-semibold hover:underline">Sign In</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatingRegisterPage;