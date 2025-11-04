import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Grid, Bookmark, Crown, Settings, Shield } from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import { httpClient, getUser, setUser as setUserStorage } from "../utils/authClient";

const MyProfilePage = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [myPosts, setMyPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  
  // Followers/Following dialog states
  const [showFollowersDialog, setShowFollowersDialog] = useState(false);
  const [showFollowingDialog, setShowFollowingDialog] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => {
    // Wrap in an async function to ensure proper sequencing
    const loadProfile = async () => {
      console.log("📱 MyProfilePage: Loading profile, user prop:", user);
      // Use user prop as immediate fallback (do not toggle loading here)
      if (user) {
        console.log("✅ Setting profile from user prop, profileImage:", user.profileImage);
        setProfile(user);
      }
      await fetchProfileData(); // This will set loading to false in its finally block
    };
    loadProfile();
  }, [user]);

  const fetchProfileData = async () => {
    try {
      console.log("🔑 Fetching profile data with httpClient");

      const [profileRes, postsRes, savedRes, archivedRes] = await Promise.all([
        httpClient.get(`/auth/me`).catch((err) => {
          console.error("❌ /auth/me failed:", err.response?.status, err.message);
          return { data: user };
        }),
        httpClient.get(`/profile/posts`).catch(() => ({ data: { posts: [] } })),
        httpClient.get(`/profile/saved`).catch(() => ({ data: { posts: [] } })),
        httpClient.get(`/profile/archived`).catch(() => ({ data: { archived: [] } }))
      ]);

      if (profileRes.data) {
        console.log("✅ Profile data fetched, profileImage:", profileRes.data.profileImage);
        
        // Merge with locally stored user to preserve a base64 profile image
        // if the backend returns a null/empty profileImage (e.g. right after registration).
        let mergedProfile = { ...profileRes.data };
        try {
          const localUser = getUser();
          if (localUser) {
            // Always prefer a base64 image stored locally (from registration)
            // over a null or missing server image.
            if (localUser.profileImage && localUser.profileImage.startsWith('data:')) {
              console.log("📸 Using local base64 preview (preferred over server response)");
              mergedProfile.profileImage = localUser.profileImage;
            } else if (!mergedProfile.profileImage && localUser.profileImage) {
              console.log("📸 No profileImage from server; using local preview");
              mergedProfile.profileImage = localUser.profileImage;
            }
          }
        } catch (mergeErr) {
          console.error("❌ Failed to merge local profile image:", mergeErr);
        }
        
        // Persist merged profile in Telegram-scoped storage so other components see the image
        try {
          const localUser2 = getUser();
          if (localUser2) {
            const updatedUser = { ...localUser2, ...mergedProfile };
            setUserStorage(updatedUser);
            console.log("✅ Updated Telegram-scoped storage with merged profile");
          }
        } catch (updateErr) {
          console.error("❌ Failed to update Telegram-scoped storage with merged profile:", updateErr);
        }
        
        setProfile(mergedProfile);
      }
      setMyPosts(postsRes.data.posts || []);
      setSavedPosts(savedRes.data.posts || []);
      setArchivedItems(archivedRes.data.archived || []);
    } catch (error) {
      console.error("❌ Error fetching profile:", error);
      // Use user prop as fallback
      if (user && !profile) {
        console.log("⚠️ Using user prop as fallback");
        setProfile(user);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShowFollowers = async () => {
    if (!profile?.id) return;
    
    setShowFollowersDialog(true);
    setLoadingFollowers(true);
    
    try {
      const response = await httpClient.get(`/users/${profile.id}/followers`);
      setFollowersList(response.data.followers || []);
    } catch (error) {
      console.error("Error fetching followers:", error);
      alert("Failed to load followers");
    } finally {
      setLoadingFollowers(false);
    }
  };

  const handleShowFollowing = async () => {
    if (!profile?.id) return;
    
    setShowFollowingDialog(true);
    setLoadingFollowing(true);
    
    try {
      const response = await httpClient.get(`/users/${profile.id}/following`);
      setFollowingList(response.data.following || []);
    } catch (error) {
      console.error("Error fetching following:", error);
      alert("Failed to load following");
    } finally {
      setLoadingFollowing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <div className="text-2xl text-pink-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100" data-testid="my-profile-page">
      {/* Header */}
      <header className="glass-effect border-b border-pink-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/home">
            <Button variant="ghost" className="hover:bg-pink-50">
              <ArrowLeft className="w-5 h-5 text-pink-600" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
            My Profile
          </h1>
          <div className="flex gap-2">
            <Link to="/social-settings">
              <Button 
                variant="ghost" 
                className="hover:bg-pink-50"
                title="Social Settings"
              >
                <Settings className="w-5 h-5 text-pink-600" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header */}
        <div className="glass-effect rounded-3xl p-8 mb-6 shadow-xl animate-fadeIn">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Profile Image */}
            <div className="relative">
              <img
                src={
                  profile?.profileImage 
                    ? (profile.profileImage.startsWith('data:') || profile.profileImage.startsWith('http') 
                        ? profile.profileImage 
                        : profile.profileImage)  // Use path as-is from backend
                    : "https://via.placeholder.com/150"
                }
                alt={profile?.username}
                className="w-32 h-32 rounded-full object-cover border-4 border-pink-200 shadow-lg"
                onError={(e) => {
                  console.error('❌ Profile image failed to load:', profile?.profileImage);
                  console.error('   Image src attempted:', e.target.src);
                  e.target.src = "https://via.placeholder.com/150";
                }}
                onLoad={() => {
                  console.log('✅ Profile image loaded successfully');
                  console.log('   Image path:', profile?.profileImage);
                  console.log('   Rendered src:', profile?.profileImage);
                }}
              />
              {profile?.isPremium && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <span className="premium-badge text-xs">
                    <Crown className="w-3 h-3 inline mr-1" />
                    PREMIUM
                  </span>
                </div>
              )}
            </div>

            {/* Profile Stats */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-bold text-gray-800 mb-1">{profile?.fullName || 'No Name'}</h2>
              <div className="flex items-center justify-center md:justify-start gap-1 mb-4">
                <p className="text-lg text-gray-600">@{profile?.username || 'username'}</p>
                {profile?.isVerified && <VerifiedBadge size="md" />}
                {profile?.isFounder && (
                  <span className="text-2xl" title="Official LuvHive Account">
                    👑
                  </span>
                )}
              </div>
              
              {/* Official Account Badge */}
              {profile?.isFounder && (
                <div className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-3 shadow-md">
                  🏢 Official LuvHive Account
                </div>
              )}

              {/* Stats */}
              <div className="flex justify-center md:justify-start gap-8 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-pink-600">{myPosts.length}</p>
                  <p className="text-sm text-gray-600">Posts</p>
                </div>
                <div 
                  className="text-center cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={handleShowFollowers}
                >
                  <p className="text-2xl font-bold text-pink-600">{profile?.followersCount || 0}</p>
                  <p className="text-sm text-gray-600">Followers</p>
                </div>
                <div 
                  className="text-center cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={handleShowFollowing}
                >
                  <p className="text-2xl font-bold text-pink-600">{profile?.followingCount || 0}</p>
                  <p className="text-sm text-gray-600">Following</p>
                </div>
              </div>

              {/* Bio */}
              {profile?.bio && (
                <div className="bg-pink-50 rounded-2xl p-4">
                  <p className="text-gray-700">{profile.bio}</p>
                </div>
              )}

              {/* Edit Profile Button */}
              <Link to="/edit-profile" className="block mt-4">
                <Button
                  data-testid="edit-profile-button"
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-xl py-3"
                >
                  Edit Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass-effect rounded-3xl p-6 shadow-xl animate-slideIn">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-pink-100 rounded-xl p-1">
              <TabsTrigger 
                value="posts" 
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-pink-600"
                data-testid="my-posts-tab"
              >
                <Grid className="w-4 h-4 mr-2" />
                Posts
              </TabsTrigger>
              <TabsTrigger 
                value="saved" 
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-pink-600"
                data-testid="saved-posts-tab"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Saved
              </TabsTrigger>
              <TabsTrigger 
                value="archived" 
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-pink-600"
                data-testid="archived-tab"
              >
                <Grid className="w-4 h-4 mr-2" />
                Archive
              </TabsTrigger>
            </TabsList>

            {/* My Posts Tab */}
            <TabsContent value="posts" className="mt-0">
              {myPosts.length === 0 ? (
                <div className="text-center py-12">
                  <Grid className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 text-lg">No posts yet</p>
                  <Link to="/home">
                    <Button className="mt-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white">
                      Create Your First Post
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {myPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="aspect-square relative group cursor-pointer overflow-hidden rounded-xl"
                      data-testid={`my-post-${post.id}`}
                    >
                      {post.mediaType === "video" ? (
                        <video src={post.mediaUrl || post.imageUrl} className="w-full h-full object-cover" />
                      ) : (
                        <img 
                          src={post.imageUrl || post.mediaUrl} 
                          alt="Post" 
                          className="w-full h-full object-cover"
                          onError={(e) => e.target.src = "https://via.placeholder.com/400"}
                        />
                      )}
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                        <div className="flex items-center gap-1">
                          <span>❤️</span>
                          <span className="font-semibold">{post.likesCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>💬</span>
                          <span className="font-semibold">{post.commentsCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Saved Posts Tab */}
            <TabsContent value="saved" className="mt-0">
              {savedPosts.length === 0 ? (
                <div className="text-center py-12">
                  <Bookmark className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 text-lg">No saved posts yet</p>
                  <p className="text-gray-500 text-sm mt-2">Save posts to view them here later</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {savedPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="aspect-square relative group cursor-pointer overflow-hidden rounded-xl"
                      data-testid={`saved-post-${post.id}`}
                    >
                      {post.mediaType === "video" ? (
                        <video src={post.mediaUrl || post.imageUrl} className="w-full h-full object-cover" />
                      ) : (
                        <img 
                          src={post.imageUrl || post.mediaUrl} 
                          alt="Post" 
                          className="w-full h-full object-cover"
                          onError={(e) => e.target.src = "https://via.placeholder.com/400"}
                        />
                      )}
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <span>❤️</span>
                            <span className="font-semibold">{post.likesCount || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>💬</span>
                            <span className="font-semibold">{post.commentsCount || 0}</span>
                          </div>
                        </div>
                        <p className="text-xs">@{post.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Archived Tab */}
            <TabsContent value="archived" className="mt-0">
              {archivedItems.length === 0 ? (
                <div className="text-center py-12">
                  <Grid className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 text-lg">No archived items</p>
                  <p className="text-gray-500 text-sm mt-2">Archive posts and stories to view them here</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {archivedItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => item.type === 'post' && navigate(`/post/${item.id}`)}
                      className="aspect-square relative group cursor-pointer overflow-hidden rounded-xl"
                      data-testid={`archived-${item.id}`}
                    >
                      {item.mediaType === "video" ? (
                        <video src={item.mediaUrl || item.imageUrl} className="w-full h-full object-cover" />
                      ) : (
                        <img 
                          src={item.imageUrl || item.mediaUrl} 
                          alt={item.type} 
                          className="w-full h-full object-cover"
                          onError={(e) => e.target.src = "https://via.placeholder.com/400"}
                        />
                      )}
                      <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                        {item.type}
                      </div>
                      {item.type === 'post' && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                          <div className="flex items-center gap-1">
                            <span>❤️</span>
                            <span className="font-semibold">{item.likesCount || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>💬</span>
                            <span className="font-semibold">{item.commentsCount || 0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Followers Dialog */}
      <Dialog open={showFollowersDialog} onOpenChange={setShowFollowersDialog}>
        <DialogContent className="bg-white rounded-3xl max-w-md max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">Followers</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-96">
            {loadingFollowers ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
              </div>
            ) : followersList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No followers yet
              </div>
            ) : (
              <div className="space-y-3">
                {followersList.map(follower => (
                  <div key={follower.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                    <img 
                      src={follower.profileImage || "https://via.placeholder.com/40"} 
                      alt={follower.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{follower.fullName}</p>
                      <p className="text-sm text-gray-600 truncate">@{follower.username}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={follower.isFollowing ? "outline" : "default"}
                      className={follower.isFollowing 
                        ? "border-pink-500 text-pink-600 hover:bg-pink-50 rounded-full text-xs" 
                        : "bg-pink-500 hover:bg-pink-600 text-white rounded-full text-xs"
                      }
                      onClick={() => navigate(`/profile/${follower.id}`)}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Following Dialog */}
      <Dialog open={showFollowingDialog} onOpenChange={setShowFollowingDialog}>
        <DialogContent className="bg-white rounded-3xl max-w-md max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">Following</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-96">
            {loadingFollowing ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
              </div>
            ) : followingList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Not following anyone yet
              </div>
            ) : (
              <div className="space-y-3">
                {followingList.map(following => (
                  <div key={following.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                    <img 
                      src={following.profileImage || "https://via.placeholder.com/40"} 
                      alt={following.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{following.fullName}</p>
                      <p className="text-sm text-gray-600 truncate">@{following.username}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={following.isFollowing ? "outline" : "default"}
                      className={following.isFollowing 
                        ? "border-pink-500 text-pink-600 hover:bg-pink-50 rounded-full text-xs" 
                        : "bg-pink-500 hover:bg-pink-600 text-white rounded-full text-xs"
                      }
                      onClick={() => navigate(`/profile/${following.id}`)}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyProfilePage;
