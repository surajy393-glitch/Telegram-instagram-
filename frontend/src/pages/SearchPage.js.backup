import { useState, useEffect, memo, useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Search, 
  TrendingUp, 
  Users, 
  Hash, 
  Image, 
  Crown,
  Heart,
  MessageCircle,
  Bookmark,
  Filter,
  X,
  Send
} from "lucide-react";
import axios from "axios";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import HashtagText from "@/components/HashtagText";
import SearchSkeleton from "@/components/LoadingSkeleton";
import { searchCache, trendingCache } from "@/utils/cache";

const API = "/api";

const SearchPage = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({
    users: [],
    posts: [],
    hashtags: [],
    query: ""
  });
  const [trendingContent, setTrendingContent] = useState({
    trending_hashtags: []
  });
  const [explorePosts, setExplorePosts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [followingInProgress, setFollowingInProgress] = useState(new Set());
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    fetchTrendingContent();
    fetchExplorePosts(); // Fetch explore posts on page load
    
    // Check for URL parameters
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    const type = params.get('type') || 'all';
    
    if (query) {
      setSearchQuery(query);
      setActiveTab(type);
      handleSearch(query, type);
    }
  }, [location]);

  const fetchTrendingContent = useCallback(async () => {
    const cacheKey = 'trending_content';
    
    // Check cache first
    const cachedResult = trendingCache.get(cacheKey);
    if (cachedResult) {
      setTrendingContent(cachedResult);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      console.log('Fetching trending content with token:', token ? 'present' : 'missing');
      
      const response = await axios.get(`${API}/search/trending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Trending response:', response.data);
      
      // Cache the result
      trendingCache.set(cacheKey, response.data);
      setTrendingContent(response.data);
    } catch (error) {
      console.error("Error fetching trending content:", error);
      console.error("Error details:", error.response?.data);
      // Set empty data to avoid showing loading state forever
      setTrendingContent({trending_hashtags: [], trending_users: []});
    }
  }, []);

  const fetchExplorePosts = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      console.log('🔍 Fetching explore posts');
      
      const response = await axios.get(`${API}/search/explore`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Explore posts response:', response.data);
      setExplorePosts(response.data.posts || []);
    } catch (error) {
      console.error("❌ Error fetching explore posts:", error);
      setExplorePosts([]);
    }
  }, []);

  const handleSearch = useCallback(async (query = searchQuery, type = activeTab) => {
    if (!query.trim()) return;

    const cacheKey = `search_${query.trim()}_${type}`;
    
    // Check cache first
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult) {
      console.log('🔍 Using cached results:', cachedResult);
      setSearchResults(cachedResult);
      return;
    }

    setLoading(true);
    setShowSuggestions(false);

    try {
      const token = localStorage.getItem("token");
      
      if (!token) {
        console.error('❌ No token found in localStorage');
        alert('Please log in again to search');
        return;
      }
      
      console.log('🔍 Searching:', { query, type, hasToken: !!token });
      
      const response = await axios.post(`${API}/search`, {
        query: query.trim(),
        type: type === "all" ? "all" : type
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Search API Response:', response.data);
      console.log('📊 Users count:', response.data.users?.length || 0);
      console.log('📊 Posts count:', response.data.posts?.length || 0);
      console.log('📊 Hashtags count:', response.data.hashtags?.length || 0);
      console.log('👥 Users data:', response.data.users);
      
      // Cache the result
      searchCache.set(cacheKey, response.data);
      setSearchResults(response.data);
    } catch (error) {
      console.error("❌ Error searching:", error);
      console.error("❌ Error response:", error.response?.data);
      console.error("❌ Token present:", !!localStorage.getItem("token"));
      alert(`Search failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeTab]);

  // Debounced search suggestions to reduce API calls
  const fetchSuggestions = useCallback(async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/search/suggestions?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestions(response.data.suggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  }, []);

  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (value.trim()) {
      // Debounce suggestions by 300ms
      const newTimeout = setTimeout(() => {
        fetchSuggestions(value);
        setShowSuggestions(true);
      }, 300);
      setSearchTimeout(newTimeout);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [searchTimeout, fetchSuggestions]);

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.value);
    setShowSuggestions(false);
    handleSearch(suggestion.value);
  };

  const handleFollowToggle = async (targetUserId, isFollowing) => {
    // Prevent multiple simultaneous follow actions on same user
    if (followingInProgress.has(targetUserId)) {
      console.log("Follow action already in progress for user:", targetUserId);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No authentication token found");
        alert("Please log in to follow users");
        return;
      }

      console.log(`Starting follow action for user ${targetUserId}, currently following: ${isFollowing}`);

      // Add to following in progress
      setFollowingInProgress(prev => new Set(prev).add(targetUserId));

      // OPTIMISTIC UI UPDATE - Update immediately before API call
      const updateUserFollowStatus = (users, userId, newFollowStatus) => {
        return users.map(user => 
          user.id === userId 
            ? { 
                ...user, 
                isFollowing: newFollowStatus,
                followersCount: newFollowStatus 
                  ? user.followersCount + 1 
                  : Math.max(0, user.followersCount - 1)
              }
            : user
        );
      };

      // Immediately update the UI
      if (searchResults.users.length > 0) {
        setSearchResults(prev => ({
          ...prev,
          users: updateUserFollowStatus(prev.users, targetUserId, !isFollowing)
        }));
        console.log("Updated search results optimistically");
      }

      if (trendingContent.trending_users && trendingContent.trending_users.length > 0) {
        setTrendingContent(prev => ({
          ...prev,
          trending_users: updateUserFollowStatus(prev.trending_users, targetUserId, !isFollowing)
        }));
        console.log("Updated trending users optimistically");
      }

      // Make API call in background
      const endpoint = isFollowing ? "unfollow" : "follow";
      console.log(`Making API call to: ${API}/users/${targetUserId}/${endpoint}`);
      
      const response = await axios.post(`${API}/users/${targetUserId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log("Follow action successful:", response.data);
      
    } catch (error) {
      console.error("Error toggling follow:", error);
      
      // ROLLBACK optimistic update on error
      const updateUserFollowStatus = (users, userId, newFollowStatus) => {
        return users.map(user => 
          user.id === userId 
            ? { 
                ...user, 
                isFollowing: newFollowStatus,
                followersCount: newFollowStatus 
                  ? user.followersCount + 1 
                  : Math.max(0, user.followersCount - 1)
              }
            : user
        );
      };

      if (searchResults.users.length > 0) {
        setSearchResults(prev => ({
          ...prev,
          users: updateUserFollowStatus(prev.users, targetUserId, isFollowing) // Revert back
        }));
      }

      if (trendingContent.trending_users && trendingContent.trending_users.length > 0) {
        setTrendingContent(prev => ({
          ...prev,
          trending_users: updateUserFollowStatus(prev.trending_users, targetUserId, isFollowing) // Revert back
        }));
      }

      if (error.response) {
        console.error("Response error:", error.response.data);
        alert(`Failed to ${isFollowing ? 'unfollow' : 'follow'} user: ${error.response.data.detail || 'Unknown error'}`);
      } else {
        alert(`Failed to ${isFollowing ? 'unfollow' : 'follow'} user. Please try again.`);
      }
    } finally {
      // Remove from following in progress
      setFollowingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
      console.log("Follow action completed for user:", targetUserId);
    }
  };

  // Memoized user card component for better performance
  const UserCard = memo(({ userItem }) => (
    <div
      key={userItem.id}
      className="flex items-center gap-3 p-4 rounded-xl hover:bg-pink-50 transition-colors bg-white shadow-sm border border-pink-100"
    >
      <Link to={`/profile/${userItem.id}`}>
        <img
          src={
            userItem.profileImage
              ? (userItem.profileImage.startsWith('data:') || userItem.profileImage.startsWith('http')
                  ? userItem.profileImage
                  : userItem.profileImage)
              : "https://via.placeholder.com/48"
          }
          alt={userItem.username}
          className="w-12 h-12 rounded-full object-cover border-2 border-pink-200 cursor-pointer hover:border-pink-400 transition-colors"
          onError={(e) => e.target.src = "https://via.placeholder.com/48"}
        />
      </Link>
      <div className="flex-1">
        <Link to={`/profile/${userItem.id}`} className="font-semibold text-gray-800 hover:text-pink-600 transition-colors flex items-center gap-2">
          {userItem.fullName}
          {userItem.isPremium && <Crown className="w-4 h-4 text-yellow-500" />}
        </Link>
        <p className="text-sm text-gray-600">@{userItem.username}</p>
        <p className="text-xs text-gray-500">{userItem.followersCount} followers</p>
        {userItem.bio && (
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{userItem.bio}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => handleFollowToggle(userItem.id, userItem.isFollowing)}
          size="sm"
          variant={userItem.isFollowing ? "outline" : "default"}
          disabled={followingInProgress.has(userItem.id)}
          className={userItem.isFollowing 
            ? "border-pink-500 text-pink-600 hover:bg-pink-50 rounded-full min-w-[80px]" 
            : "bg-pink-500 hover:bg-pink-600 text-white rounded-full min-w-[80px]"
          }
        >
          {followingInProgress.has(userItem.id) ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">{userItem.isFollowing ? 'Unfollowing...' : 'Following...'}</span>
            </div>
          ) : (
            userItem.isFollowing ? "Following" : "Follow"
          )}
        </Button>
      </div>
    </div>
  ));

  const renderUserCard = useCallback((userItem) => (
    <UserCard key={userItem.id} userItem={userItem} />
  ), []);

  const renderPostCard = (post) => (
    <div key={post.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-pink-100">
      {/* Post Header */}
      <div className="flex items-center gap-3 p-4 border-b border-pink-50">
        <Link to={`/profile/${post.userId}`}>
          <img
            src={
              post.userProfileImage
                ? (post.userProfileImage.startsWith('data:') || post.userProfileImage.startsWith('http')
                    ? post.userProfileImage
                    : post.userProfileImage)
                : "https://via.placeholder.com/40"
            }
            alt={post.username}
            className="w-10 h-10 rounded-full object-cover border border-pink-200"
            onError={(e) => e.target.src = "https://via.placeholder.com/40"}
          />
        </Link>
        <div className="flex-1">
          <Link to={`/profile/${post.userId}`} className="font-semibold text-gray-800 hover:text-pink-600">
            {post.username}
          </Link>
          <p className="text-xs text-gray-500">
            {new Date(post.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Post Media */}
      {post.imageUrl && (
        <div className="aspect-square">
          <img 
            src={
              post.imageUrl
                ? (post.imageUrl.startsWith('data:') || post.imageUrl.startsWith('http')
                    ? post.imageUrl
                    : post.imageUrl)
                : "https://via.placeholder.com/400"
            }
            alt="Post" 
            className="w-full h-full object-cover"
            onError={(e) => e.target.src = "https://via.placeholder.com/400"}
          />
        </div>
      )}

      {/* Post Actions */}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleLikePost(post.id)}
            className={post.isLiked ? "text-red-500 hover:text-red-600" : "text-gray-600 hover:text-red-500"}
          >
            <Heart className={`w-5 h-5 ${post.isLiked ? "fill-current" : ""}`} />
            {post.likes}
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-pink-600">
            <MessageCircle className="w-5 h-5" />
            {post.comments}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSavePost(post.id)}
            className={post.isSaved ? "text-pink-500 hover:text-pink-600" : "text-gray-600 hover:text-pink-500"}
          >
            <Bookmark className={`w-5 h-5 ${post.isSaved ? "fill-current" : ""}`} />
          </Button>
        </div>
        {post.caption && (
          <p className="text-sm text-gray-700">
            <HashtagText text={post.caption} />
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100">
      {/* Header */}
      <header className="glass-effect border-b border-pink-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/home">
              <Button variant="ghost" className="hover:bg-pink-50">
                <ArrowLeft className="w-5 h-5 text-pink-600" />
              </Button>
            </Link>
            
            {/* Search Bar */}
            <div className="flex-1 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search users, posts, hashtags..."
                  value={searchQuery}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 pr-4 py-3 rounded-xl border-pink-200 focus:border-pink-500 focus:ring-pink-500"
                />
                {loading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* Search Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-white rounded-xl shadow-lg border border-pink-100 z-50 max-h-60 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="flex items-center gap-3 p-3 hover:bg-pink-50 cursor-pointer border-b border-pink-50 last:border-b-0"
                    >
                      {suggestion.avatar && (
                        <img
                          src={
                            suggestion.avatar.startsWith('data:') || suggestion.avatar.startsWith('http')
                              ? suggestion.avatar
                              : suggestion.avatar
                          }
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => e.target.src = "https://via.placeholder.com/32"}
                        />
                      )}
                      {suggestion.type === "hashtag" && (
                        <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                          <Hash className="w-4 h-4 text-pink-600" />
                        </div>
                      )}
                      {suggestion.type === "user" && !suggestion.avatar && (
                        <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-pink-600" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{suggestion.text}</p>
                        <p className="text-xs text-gray-500 capitalize">{suggestion.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={() => handleSearch()}
              disabled={!searchQuery.trim() || loading}
              className="bg-pink-500 hover:bg-pink-600 text-white rounded-xl px-6"
            >
              Search
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {searchResults.query ? (
          // Search Results
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Search Results for "{searchResults.query}"
              </h2>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-pink-50 rounded-xl">
                  <TabsTrigger 
                    value="all" 
                    onClick={() => handleSearch(searchResults.query, "all")}
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-pink-600"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger 
                    value="users"
                    onClick={() => handleSearch(searchResults.query, "users")}
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-pink-600"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Users
                  </TabsTrigger>
                  <TabsTrigger 
                    value="posts"
                    onClick={() => handleSearch(searchResults.query, "posts")}
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-pink-600"
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Posts
                  </TabsTrigger>
                  <TabsTrigger 
                    value="hashtags"
                    onClick={() => handleSearch(searchResults.query, "hashtags")}
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-pink-600"
                  >
                    <Hash className="w-4 h-4 mr-2" />
                    Tags
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Users Column */}
                    {searchResults.users.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <Users className="w-5 h-5 text-pink-600" />
                          Users ({searchResults.users.length})
                        </h3>
                        <div className="space-y-3">
                          {searchResults.users.slice(0, 5).map(renderUserCard)}
                        </div>
                      </div>
                    )}

                    {/* Posts Column */}
                    {searchResults.posts.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <Image className="w-5 h-5 text-pink-600" />
                          Posts ({searchResults.posts.length})
                        </h3>
                        <div className="space-y-4">
                          {searchResults.posts.slice(0, 3).map(renderPostCard)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hashtags */}
                  {searchResults.hashtags.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Hash className="w-5 h-5 text-pink-600" />
                        Hashtags ({searchResults.hashtags.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {searchResults.hashtags.map((hashtag, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            className="rounded-full border-pink-200 text-pink-600 hover:bg-pink-50"
                            onClick={() => handleSearch(hashtag, "posts")}
                          >
                            {hashtag}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="users" className="mt-6">
                  <div className="space-y-4">
                    {loading ? (
                      <SearchSkeleton count={5} type="user" />
                    ) : searchResults.users.length > 0 ? (
                      searchResults.users.map(renderUserCard)
                    ) : (
                      <p className="text-center text-gray-600 py-8">No users found for "{searchResults.query}"</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="posts" className="mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                      <div className="col-span-full">
                        <SearchSkeleton count={6} type="post" />
                      </div>
                    ) : searchResults.posts.length > 0 ? (
                      searchResults.posts.map(renderPostCard)
                    ) : (
                      <div className="col-span-full text-center text-gray-600 py-8">
                        No posts found for "{searchResults.query}"
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="hashtags" className="mt-6">
                  {searchResults.hashtags.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {searchResults.hashtags.map((hashtag, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="p-4 h-auto rounded-xl border-pink-200 text-pink-600 hover:bg-pink-50 flex flex-col items-center gap-2"
                          onClick={() => handleSearch(hashtag, "posts")}
                        >
                          <Hash className="w-6 h-6" />
                          {hashtag}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-600 py-8">No hashtags found for "{searchResults.query}"</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : (
          // Explore Posts Grid (Instagram-style Default View)
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-pink-600" />
                Explore
              </h2>
              <p className="text-gray-600">Discover posts from the community</p>
            </div>

            {/* Explore Posts Grid */}
            {explorePosts.length > 0 ? (
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                {explorePosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => navigate(`/post/${post.id}`)}
                    className="aspect-square relative group overflow-hidden rounded-sm hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    {/* Post Image */}
                    {post.imageUrl || post.mediaUrl ? (
                      <img
                        src={post.imageUrl || post.mediaUrl}
                        alt={post.caption || "Post"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/400x400?text=No+Image";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                        <Image className="w-12 h-12 text-pink-300" />
                      </div>
                    )}
                    
                    {/* Hover Overlay with Stats */}
                    <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
                      <div className="flex items-center gap-2 text-white">
                        <Heart className="w-6 h-6 fill-white" />
                        <span className="font-semibold">{post.likesCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white">
                        <MessageCircle className="w-6 h-6 fill-white" />
                        <span className="font-semibold">{post.commentsCount || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Image className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600 text-lg">No posts to explore yet</p>
                <p className="text-gray-500 text-sm mt-2">Check back later for content from the community</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;