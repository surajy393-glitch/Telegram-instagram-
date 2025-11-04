import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Camera, AlertCircle } from "lucide-react";
import { httpClient, getToken } from "@/utils/authClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

const EditProfilePage = ({ user, onLogin, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [canChangeUsername, setCanChangeUsername] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    bio: "",
    country: "",
    profileImage: ""
  });

  useEffect(() => {
    console.log("📝 EditProfilePage mounted, user prop:", user);
    // If user prop exists, use it as fallback
    if (user) {
      console.log("✅ Setting profile from user prop");
      setProfile(user);
      setFormData({
        fullName: user.fullName || "",
        username: user.username || "",
        bio: user.bio || "",
        country: user.country || "",
        profileImage: user.profileImage || ""
      });
    }
    fetchProfile();
    checkUsernameChange();
  }, [user]);

  const fetchProfile = async () => {
    try {      // Token check removed - httpClient handles auth
      
      console.log("📝 EditProfile: Fetching profile with token...");
      const response = await httpClient.get(`/auth/me`);
      
      console.log("✅ EditProfile: Profile data received");
      console.log("   Full Name:", response.data.fullName);
      console.log("   Username:", response.data.username);
      console.log("   Profile Image:", response.data.profileImage);
      
      // Merge profile image with any base64 preview saved in localStorage
      let mergedData = { ...response.data };
      try {
        const localUserString = localStorage.getItem("user");
        if (localUserString) {
          const localUser = JSON.parse(localUserString);
          // Prefer local base64 image if available
          if (localUser.profileImage && localUser.profileImage.startsWith('data:')) {
            console.log("📸 EditProfile: Using local base64 preview (preferred)");
            mergedData.profileImage = localUser.profileImage;
          } else if (!mergedData.profileImage && localUser.profileImage) {
            console.log("📸 EditProfile: Using local preview from registration");
            mergedData.profileImage = localUser.profileImage;
          }
        }
      } catch (mergeErr) {
        console.error("❌ Failed to merge profile image in EditProfile:", mergeErr);
      }
      
      // Update localStorage with merged profile so other pages stay consistent
      try {
        const localUserString2 = localStorage.getItem("user");
        if (localUserString2) {
          const localUser2 = JSON.parse(localUserString2);
          const updatedUser = { ...localUser2, ...mergedData };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          console.log("✅ EditProfile: Updated localStorage with merged profile");
        }
      } catch (err) {
        console.error("❌ Failed to update localStorage in EditProfile:", err);
      }
      
      setProfile(mergedData);
      setFormData({
        fullName: mergedData.fullName || "",
        username: mergedData.username || "",
        bio: mergedData.bio || "",
        country: mergedData.country || "",
        profileImage: mergedData.profileImage || ""
      });
    } catch (error) {
      console.error("❌ EditProfile: Error fetching profile:", error);
      console.error("   Error status:", error.response?.status);
      console.error("   Error detail:", error.response?.data?.detail);
      
      if (error.response?.status === 401) {
        console.error("❌ Authentication failed, redirecting to login");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
      } else {
        alert("Failed to load profile. Please try again.");
      }
    }
  };

  const checkUsernameChange = async () => {
    try {      const response = await httpClient.get(`/auth/can-change-username`);
      setCanChangeUsername(response.data.canChange);
      setDaysRemaining(response.data.daysRemaining);
    } catch (error) {
      console.error("Error checking username:", error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {      const formDataToSend = new FormData();
      
      formDataToSend.append("fullName", formData.fullName);
      formDataToSend.append("username", formData.username);
      formDataToSend.append("bio", formData.bio);
      formDataToSend.append("country", formData.country);
      if (formData.profileImage && formData.profileImage !== profile.profileImage) {
        formDataToSend.append("profileImage", formData.profileImage);
      }

      const response = await httpClient.put(`/auth/profile`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      // Update local storage with the response data
      const updatedUser = response.data.user || response.data;
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      // Update app state by calling onLogin with existing token and updated user
      if (onLogin) {
        onLogin(getToken(), updatedUser);
      }

      alert("Profile updated successfully!");
      
      // Navigate back to profile page
      navigate("/my-profile", { replace: true });
    } catch (error) {
      console.error("Profile update error:", error);
      alert(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <div className="text-2xl text-pink-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100" data-testid="edit-profile-page">
      {/* Header */}
      <header className="glass-effect border-b border-pink-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/my-profile">
            <Button variant="ghost" className="hover:bg-pink-50">
              <ArrowLeft className="w-5 h-5 text-pink-600" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
            Edit Profile
          </h1>
          <div className="w-10"></div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="glass-effect rounded-3xl p-8 shadow-xl animate-fadeIn">
          {/* Profile Image */}
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <img
                src={
                  formData.profileImage 
                    ? (formData.profileImage.startsWith('data:') || formData.profileImage.startsWith('http') 
                        ? formData.profileImage 
                        : formData.profileImage)
                    : "https://via.placeholder.com/120"
                }
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-pink-200 shadow-lg"
                onError={(e) => e.target.src = "https://via.placeholder.com/120"}
              />
              <label
                htmlFor="profileImageInput"
                className="absolute bottom-0 right-0 bg-pink-500 hover:bg-pink-600 text-white rounded-full p-3 cursor-pointer shadow-lg transition-colors"
              >
                <Camera className="w-5 h-5" />
                <input
                  id="profileImageInput"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  data-testid="profile-image-input"
                />
              </label>
            </div>
            <p className="text-sm text-gray-600 mt-3">Click camera icon to change photo</p>
          </div>

          <div className="space-y-6">
            {/* Full Name */}
            <div>
              <Label htmlFor="fullName" className="text-gray-700 font-medium">
                Full Name
              </Label>
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

            {/* Username */}
            <div>
              <Label htmlFor="username" className="text-gray-700 font-medium">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                data-testid="username-input"
                type="text"
                placeholder="Choose a unique username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={!canChangeUsername}
                className={`mt-2 border-gray-300 focus:border-pink-500 rounded-xl ${
                  !canChangeUsername ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
              />
              {!canChangeUsername && (
                <Alert className="mt-3 bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700 text-sm">
                    You can change your username again in <strong>{daysRemaining} days</strong>. 
                    Username can be changed once every 15 days.
                  </AlertDescription>
                </Alert>
              )}
              {canChangeUsername && (
                <p className="text-sm text-gray-600 mt-2">
                  ✓ You can change your username now
                </p>
              )}
            </div>

            {/* Bio */}
            <div>
              <Label htmlFor="bio" className="text-gray-700 font-medium">
                Bio
              </Label>
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
              <p className="text-sm text-gray-600 mt-2">
                {formData.bio.length}/150 characters
              </p>
            </div>

            {/* Country */}
            <div>
              <Label htmlFor="country" className="text-gray-700 font-medium">
                Country
              </Label>
              <Input
                id="country"
                name="country"
                data-testid="country-input"
                type="text"
                placeholder="Enter your country"
                value={formData.country}
                onChange={handleChange}
                required
                className="mt-2 border-gray-300 focus:border-pink-500 rounded-xl"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              data-testid="save-profile-btn"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-6 rounded-xl text-lg btn-hover"
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>

            {/* Cancel Button */}
            <Link to="/my-profile">
              <Button
                type="button"
                variant="outline"
                className="w-full border-2 border-pink-500 text-pink-600 hover:bg-pink-50 py-6 rounded-xl"
              >
                Cancel
              </Button>
            </Link>
          </div>
        </form>

        {/* Info Card */}
        <div className="glass-effect rounded-3xl p-6 mt-6 shadow-xl animate-slideIn">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Profile Update Rules</h3>
          <ul className="space-y-2 text-gray-700 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-pink-500">✓</span>
              <span><strong>Full Name:</strong> Can be changed anytime</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-500">✓</span>
              <span><strong>Username:</strong> Can be changed once every 15 days</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-500">✓</span>
              <span><strong>Bio:</strong> Can be changed anytime (max 150 characters)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-500">✓</span>
              <span><strong>Profile Picture:</strong> Can be changed anytime</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EditProfilePage;
