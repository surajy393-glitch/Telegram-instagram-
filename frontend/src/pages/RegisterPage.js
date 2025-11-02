import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { httpClient, setToken } from "@/utils/authClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const API = "/api";

const RegisterPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null); // null, 'checking', 'available', 'taken'
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [emailStatus, setEmailStatus] = useState(null); // null, 'checking', 'available', 'taken'
  const [emailMessage, setEmailMessage] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileVerified, setMobileVerified] = useState(false);
  const [mobileOtpLoading, setMobileOtpLoading] = useState(false);
  const [mobileStatus, setMobileStatus] = useState(null); // null, 'checking', 'available', 'taken'
  const [mobileMessage, setMobileMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    mobileNumber: "",
    age: "",
    gender: "",
    country: "",
    password: "",
    bio: "",
    profileImage: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Check username availability when username changes
    if (name === 'username') {
      checkUsernameAvailability(value);
    }
    
    // Check email availability when email changes
    if (name === 'email') {
      checkEmailAvailability(value);
    }
    
    // Check mobile availability when mobile changes
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
        setUsernameSuggestions(data.suggestions);
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
        description: "This mobile number is already registered. Please use a different number.",
        variant: "destructive"
      });
      return;
    }

    if (mobileStatus !== 'available') {
      toast({
        title: "Error",
        description: "Please wait for mobile number validation to complete",
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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({
          ...formData,
          profileImage: reader.result
        });
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
    
    if (formData.fullName && formData.username && (formData.email || mobileVerified) && formData.age && formData.gender && formData.password) {
      setStep(2);
    }
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First register the user with enhanced endpoint
      // Use plain axios here (not httpClient) to avoid double /api in URL
      // Since this is pre-authentication, no token is needed yet
      const response = await axios.post(`${API}/auth/register-enhanced`, {
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        mobileNumber: formData.mobileNumber || null,
        age: parseInt(formData.age),
        gender: formData.gender,
        country: formData.country || "India",
        password: formData.password,
        profileImage: formData.profileImage || null,
        bio: formData.bio || ""
      });

      // Check if email verification is required
      if (response.data.email_verification_required) {
        toast({
          title: "Check Your Email! 📧",
          description: response.data.message,
        });
        
        // Show success popup with email verification message
        setShowSuccess(true);
        setLoading(false);
        return;
      }

      // Check if auto-login is enabled (mobile-only registration)
      if (response.data.auto_login && response.data.access_token) {
        // Store the token so future API calls include the Authorization header
        setToken(response.data.access_token);
        
        // Auto-login the user
        onLogin(response.data.access_token, response.data.user);
        
        toast({
          title: "Registration Successful! 🎉",
          description: response.data.message,
        });
        
        // Navigate to home
        navigate("/home");
        setLoading(false);
        return;
      }

      const token = response.data.access_token;
      // Store the token so future API calls include the Authorization header
      setToken(token);
      
      // Fetch a complete user profile after registration to avoid missing fields.
      // This prevents issues with missing ID or profileImage immediately after sign-up.
      try {
        const meRes = await httpClient.get(`${API}/auth/me`);
        const fullUser = meRes.data.user || meRes.data;
        
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

        // Always prefer the local base64 preview if user uploaded a photo
        if (formData.profileImage) {
          normalizedUser.profileImage = formData.profileImage;
        }

        console.log("🎉 Registration successful! User data:", normalizedUser);
        console.log("🖼️ Profile Image:", normalizedUser.profileImage);
        console.log("📸 Using base64 preview:", !!formData.profileImage);
        
        setShowSuccess(true);
        setTimeout(() => {
          onLogin(token, normalizedUser);
          navigate("/home");
        }, 2000);
      } catch (err) {
        // If the fetch fails, fall back to the user returned in the response.
        const fallbackUser = response.data.user;
        
        // Apply same normalization and fallback
        const normalizedUser = {
          ...fallbackUser,
          profileImage: fallbackUser.profileImage ?? 
                        fallbackUser.profile_image ?? 
                        fallbackUser.profilePhoto ?? 
                        fallbackUser.profile_photo_url ?? 
                        fallbackUser.photo_url ?? 
                        fallbackUser.profile_photo ?? 
                        null
        };

        // Always prefer local base64 preview
        if (formData.profileImage) {
          normalizedUser.profileImage = formData.profileImage;
        }
        
        setShowSuccess(true);
        setTimeout(() => {
          onLogin(token, normalizedUser);
          navigate("/home");
        }, 2000);
      }
      
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

  const handleTelegramAuth = async () => {
    setTelegramLoading(true);
    
    try {
      // Show info about secure registration
      toast({
        title: "Secure Registration",
        description: "Creating account with Telegram authentication via @Loveekisssbot",
      });

      // Create a div to hold the Telegram Login Widget
      const widgetContainer = document.createElement('div');
      widgetContainer.id = 'telegram-register-widget';
      widgetContainer.style.position = 'fixed';
      widgetContainer.style.top = '50%';
      widgetContainer.style.left = '50%';
      widgetContainer.style.transform = 'translate(-50%, -50%)';
      widgetContainer.style.zIndex = '9999';
      widgetContainer.style.backgroundColor = 'white';
      widgetContainer.style.padding = '20px';
      widgetContainer.style.borderRadius = '10px';
      widgetContainer.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
      
      // Add close button
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '×';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '5px';
      closeButton.style.right = '10px';
      closeButton.style.background = 'none';
      closeButton.style.border = 'none';
      closeButton.style.fontSize = '20px';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = () => {
        document.body.removeChild(widgetContainer);
        setTelegramLoading(false);
      };
      
      widgetContainer.appendChild(closeButton);
      
      // Add title
      const title = document.createElement('h3');
      title.textContent = 'Register with Telegram';
      title.style.marginBottom = '15px';
      title.style.textAlign = 'center';
      widgetContainer.appendChild(title);

      // Create Telegram Login Widget script
      const telegramScript = document.createElement('script');
      telegramScript.async = true;
      telegramScript.src = 'https://telegram.org/js/telegram-widget.js?22';
      telegramScript.setAttribute('data-telegram-login', 'Loveekisssbot');
      telegramScript.setAttribute('data-size', 'large');
      telegramScript.setAttribute('data-radius', '10');
      telegramScript.setAttribute('data-request-access', 'write');
      telegramScript.setAttribute('data-onauth', 'onTelegramRegister(user)');
      
      widgetContainer.appendChild(telegramScript);
      document.body.appendChild(widgetContainer);

      // Global callback function for Telegram registration
      window.onTelegramRegister = async (user) => {
        try {
          // Remove widget
          if (document.getElementById('telegram-register-widget')) {
            document.body.removeChild(widgetContainer);
          }

          // First check if user already exists
          try {
            const checkResponse = await axios.post(`${API}/auth/telegram-signin`, {
              telegramId: user.id
            });
            
            // If we get here, user already exists - redirect to login
            toast({
              title: "Account Already Exists",
              description: "You already have an account! Please use the Login page with Telegram sign-in.",
              variant: "destructive"
            });
            
            // Redirect to login page after 2 seconds
            setTimeout(() => {
              navigate("/login");
            }, 2000);
            
            setTelegramLoading(false);
            return;
            
          } catch (error) {
            // If user doesn't exist (404 error), proceed with registration
            if (error.response?.status !== 404) {
              throw error; // Re-throw if it's a different error
            }
          }

          // User doesn't exist, proceed with registration
          const response = await axios.post(`${API}/auth/telegram`, {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name || "",
            username: user.username || "",
            photo_url: user.photo_url || "",
            auth_date: user.auth_date,
            hash: user.hash
          });
          
          onLogin(response.data.access_token, response.data.user);
          toast({
            title: "Success!",
            description: "Successfully registered with Telegram",
          });
          navigate("/home");
          
        } catch (error) {
          toast({
            title: "Telegram Registration Failed", 
            description: error.response?.data?.detail || "Telegram authentication failed",
            variant: "destructive"
          });
        } finally {
          setTelegramLoading(false);
        }
      };
      
    } catch (error) {
      toast({
        title: "Telegram Registration Failed",
        description: error.response?.data?.detail || "Telegram authentication failed",
        variant: "destructive"
      });
      setTelegramLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fadeIn">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500 mb-2">
            Join LuvHive
          </h1>
          <p className="text-gray-600">Create your anonymous profile</p>
        </div>

        <div className="glass-effect rounded-3xl p-8 shadow-xl animate-scaleIn">
          {step === 1 ? (
            <>
              <form onSubmit={handleStep1Submit} className="space-y-5">
                <div>
                  <Label htmlFor="fullName" className="text-gray-700 font-medium">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    data-testid="fullname-input"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className="mt-2 border-gray-300 focus:border-pink-500 rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="username" className="text-gray-700 font-medium">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    data-testid="username-input"
                    type="text"
                    placeholder="Choose a unique username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    className={`mt-2 rounded-xl ${
                      usernameStatus === 'available' ? 'border-green-500 focus:border-green-500' :
                      usernameStatus === 'taken' ? 'border-red-500 focus:border-red-500' :
                      'border-gray-300 focus:border-pink-500'
                    }`}
                  />
                  
                  {/* Username Status Display */}
                  {usernameStatus && (
                    <div className="mt-2">
                      <p className={`text-sm flex items-center gap-2 ${
                        usernameStatus === 'available' ? 'text-green-600' :
                        usernameStatus === 'taken' ? 'text-red-600' :
                        usernameStatus === 'checking' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {usernameStatus === 'checking' && (
                          <span className="animate-spin">⏳</span>
                        )}
                        {usernameStatus === 'available' && (
                          <span>✅</span>
                        )}
                        {usernameStatus === 'taken' && (
                          <span>❌</span>
                        )}
                        {usernameMessage}
                      </p>
                      
                      {/* Username Suggestions */}
                      {usernameSuggestions.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm font-medium text-blue-800 mb-2">
                            Available suggestions:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {usernameSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => selectSuggestion(suggestion)}
                                className="px-3 py-1 text-sm bg-white border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors"
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
                  <Label htmlFor="email" className="text-gray-700 font-medium">
                    Email {mobileVerified ? <span className="text-gray-500">(optional)</span> : ""}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    data-testid="email-input"
                    type="email"
                    placeholder={mobileVerified ? "Email (optional)" : "Enter your email address"}
                    value={formData.email}
                    onChange={handleChange}
                    required={!mobileVerified}
                    className={`mt-2 rounded-xl ${
                      emailStatus === 'available' ? 'border-green-500 focus:border-green-500' :
                      emailStatus === 'taken' ? 'border-red-500 focus:border-red-500' :
                      'border-gray-300 focus:border-pink-500'
                    }`}
                  />
                  
                  {/* Email Status Display */}
                  {emailStatus && (
                    <div className="mt-2">
                      <p className={`text-sm flex items-center gap-2 ${
                        emailStatus === 'available' ? 'text-green-600' :
                        emailStatus === 'taken' ? 'text-red-600' :
                        emailStatus === 'checking' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {emailStatus === 'checking' && (
                          <span className="animate-spin">⏳</span>
                        )}
                        {emailStatus === 'available' && (
                          <span>✅</span>
                        )}
                        {emailStatus === 'taken' && (
                          <span>❌</span>
                        )}
                        {emailMessage}
                      </p>
                    </div>
                  )}
                  
                  {/* EMAIL OTP VERIFICATION */}
                  {emailStatus === 'available' && !emailVerified && (
                    <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-800 mb-3">
                        {mobileVerified ? '🔐 Email Verification (Optional)' : '🔐 Email Verification Required'}
                      </p>
                      
                      {!emailOtpSent ? (
                        <div>
                          <p className="text-sm text-blue-700 mb-3">
                            {mobileVerified ? 
                              'Optionally verify your email for additional security' :
                              'Click below to send verification code to your email'
                            }
                          </p>
                          <button
                            type="button"
                            onClick={sendEmailOtp}
                            disabled={otpLoading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {otpLoading ? "Sending..." : "Send OTP to Email"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-blue-700">
                            Enter the 6-digit code sent to your email:
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Enter OTP"
                              value={emailOtp}
                              onChange={(e) => setEmailOtp(e.target.value)}
                              className="flex-1 text-center text-lg tracking-widest"
                              maxLength="6"
                            />
                            <button
                              type="button"
                              onClick={verifyEmailOtp}
                              disabled={otpLoading || !emailOtp.trim()}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {otpLoading ? "Verifying..." : "Verify"}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={sendEmailOtp}
                            disabled={otpLoading}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Resend OTP
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* EMAIL VERIFIED SUCCESS */}
                  {emailVerified && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800 flex items-center gap-2">
                        ✅ Email verified successfully! You can now proceed to next step.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="mobileNumber" className="text-gray-700 font-medium">
                    Mobile Number <span className="text-gray-500">(optional)</span>
                  </Label>
                  <Input
                    id="mobileNumber"
                    name="mobileNumber"
                    data-testid="mobile-input"
                    type="tel"
                    placeholder="Enter your mobile number (+91xxxxxxxxxx)"
                    value={formData.mobileNumber}
                    onChange={handleChange}
                    className={`mt-2 rounded-xl ${
                      mobileStatus === 'available' ? 'border-green-500 focus:border-green-500' :
                      mobileStatus === 'taken' ? 'border-red-500 focus:border-red-500' :
                      'border-gray-300 focus:border-pink-500'
                    }`}
                  />
                  
                  {/* Mobile Status Display */}
                  {mobileStatus && (
                    <div className="mt-2">
                      <p className={`text-sm flex items-center gap-2 ${
                        mobileStatus === 'available' ? 'text-green-600' :
                        mobileStatus === 'taken' ? 'text-red-600' :
                        mobileStatus === 'checking' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {mobileStatus === 'checking' && (
                          <span className="animate-spin">⏳</span>
                        )}
                        {mobileStatus === 'available' && (
                          <span>✅</span>
                        )}
                        {mobileStatus === 'taken' && (
                          <span>❌</span>
                        )}
                        {mobileMessage}
                      </p>
                    </div>
                  )}
                  
                  {/* MOBILE OTP VERIFICATION */}
                  {formData.mobileNumber && formData.mobileNumber.trim() && !mobileVerified && (
                    <div className="mt-3 p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-green-800 mb-3">
                        {emailVerified ? '📱 Mobile Verification (Optional)' : '📱 Mobile Verification Required'}
                      </p>
                      
                      {!mobileOtpSent ? (
                        <div>
                          <p className="text-sm text-green-700 mb-3">
                            {emailVerified ? 
                              'Optionally verify your mobile for additional security' :
                              'Click below to send verification code to your mobile'
                            }
                          </p>
                          <button
                            type="button"
                            onClick={sendMobileOtp}
                            disabled={mobileOtpLoading}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {mobileOtpLoading ? "Sending..." : "Send OTP to Mobile"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-green-700">
                            Enter the 6-digit code sent to your mobile:
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Enter OTP"
                              value={mobileOtp}
                              onChange={(e) => setMobileOtp(e.target.value)}
                              className="flex-1 text-center text-lg tracking-widest"
                              maxLength="6"
                            />
                            <button
                              type="button"
                              onClick={verifyMobileOtp}
                              disabled={mobileOtpLoading || !mobileOtp.trim()}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              {mobileOtpLoading ? "Verifying..." : "Verify"}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={sendMobileOtp}
                            disabled={mobileOtpLoading}
                            className="text-sm text-green-600 hover:text-green-800"
                          >
                            Resend OTP
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* MOBILE VERIFIED SUCCESS */}
                  {mobileVerified && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800 flex items-center gap-2">
                        ✅ Mobile number verified successfully!
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="age" className="text-gray-700 font-medium">Age</Label>
                  <Input
                    id="age"
                    name="age"
                    data-testid="age-input"
                    type="number"
                    placeholder="Your age"
                    value={formData.age}
                    onChange={handleChange}
                    required
                    min="18"
                    className="mt-2 border-gray-300 focus:border-pink-500 rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="gender" className="text-gray-700 font-medium">Gender</Label>
                  <select
                    id="gender"
                    name="gender"
                    data-testid="gender-select"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-2 focus:border-pink-500 focus:outline-none"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="country" className="text-gray-700 font-medium">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    data-testid="country-input"
                    type="text"
                    placeholder="Your country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    className="mt-2 border-gray-300 focus:border-pink-500 rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                  <div className="relative mt-2">
                    <Input
                      id="password"
                      name="password"
                      data-testid="password-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="border-gray-300 focus:border-pink-500 rounded-xl pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
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

                <Button 
                  type="submit"
                  data-testid="next-step-btn"
                  disabled={!emailVerified && !mobileVerified}
                  className={`w-full py-6 rounded-xl text-lg btn-hover ${
                    emailVerified || mobileVerified
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {emailVerified || mobileVerified ? 'Next Step' : 'Verify Email or Mobile First'}
                </Button>
              </form>

              {/* OR Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-4 text-gray-500 text-sm">or</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>

              {/* Telegram Registration Button */}
              <Button
                type="button"
                onClick={handleTelegramAuth}
                disabled={telegramLoading}
                data-testid="telegram-register-btn"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-6 text-lg rounded-xl shadow-lg flex items-center justify-center gap-2"
              >
                {telegramLoading ? (
                  "Connecting..."
                ) : (
                  <>
                    <span className="text-xl">📱</span>
                    Register with Telegram
                  </>
                )}
              </Button>
            </>
          ) : (
            <form onSubmit={handleFinalSubmit} className="space-y-5">
              <div>
                <Label htmlFor="bio" className="text-gray-700 font-medium">Bio (Optional)</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  data-testid="bio-input"
                  placeholder="Tell us about yourself..."
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  className="mt-2 border-gray-300 focus:border-pink-500 rounded-xl resize-none"
                />
              </div>

              <div>
                <Label htmlFor="profileImage" className="text-gray-700 font-medium">Profile Picture (Optional)</Label>
                <Input
                  id="profileImage"
                  name="profileImage"
                  data-testid="profile-image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="mt-2 border-gray-300 focus:border-pink-500 rounded-xl"
                />
                {formData.profileImage && (
                  <div className="mt-4">
                    <img 
                      src={formData.profileImage} 
                      alt="Preview" 
                      className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-pink-200"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  type="button"
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1 border-2 border-pink-500 text-pink-600 hover:bg-pink-50 py-6 rounded-xl"
                >
                  Back
                </Button>
                <Button 
                  type="submit"
                  data-testid="complete-registration-btn"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-6 rounded-xl btn-hover"
                >
                  {loading ? "Creating..." : "Complete"}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-gray-600">
            <p>Already have an account? <Link to="/login" className="text-pink-600 font-semibold hover:underline">Sign In</Link></p>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="bg-white rounded-3xl" data-testid="success-popup">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
              Registration Complete!
            </DialogTitle>
            <DialogDescription className="text-center text-xl text-gray-700 mt-4">
              Welcome To LuvHive Social
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-gray-600">Redirecting to your feed...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegisterPage;