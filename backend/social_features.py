"""
Social Platform Features for LuvHive
- Posts (Feed)
- Stories (24-hour content)
- Follow/Unfollow
- Likes, Comments, Shares
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from uuid import uuid4

# Setup logger
logger = logging.getLogger(__name__)

# Create router
social_router = APIRouter(prefix="/api/social", tags=["social"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "luvhive_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Pydantic Models
class CreatePostRequest(BaseModel):
    content: str
    postType: str = "text"  # text, image, video, poll
    isAnonymous: bool = False
    pollOptions: Optional[List[str]] = None
    
class CreateStoryRequest(BaseModel):
    content: str
    storyType: str = "text"  # text, image, video
    isAnonymous: bool = False

class CommentRequest(BaseModel):
    postId: str
    content: str
    isAnonymous: bool = False

class LikeRequest(BaseModel):
    postId: str
    reactionType: str = "like"  # like, love, fire, wow

# Helper Functions
async def get_current_user(token: str):
    """Get current user from token - placeholder"""
    # TODO: Implement proper JWT validation
    user = await db.users.find_one({"id": token})
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# POSTS ENDPOINTS

@social_router.post("/posts")
async def create_post(
    content: str = Form(...),
    postType: str = Form("text"),
    isAnonymous: bool = Form(False),
    image: Optional[UploadFile] = File(None),
    userId: str = Form(...)
):
    """Create a new post"""
    try:
        user = await db.users.find_one({"id": userId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        media_url = None
        image_url = None
        media_type = "image"

        if image:
            upload_dir = "/app/uploads/posts"
            os.makedirs(upload_dir, exist_ok=True)

            # Extract extension (default to .jpg if none)
            import os as _os
            original_name = image.filename or ""
            _, ext = _os.path.splitext(original_name)
            file_ext = ext.lstrip(".").lower() or "jpg"
            filename = f"{uuid4()}.{file_ext}"
            file_path = _os.path.join(upload_dir, filename)

            with open(file_path, "wb") as f:
                content_bytes = await image.read()
                f.write(content_bytes)

            # Return /api/uploads path for frontend
            media_url = f"/api/uploads/posts/{filename}"
            image_url = media_url

            if file_ext in ["mp4", "mov", "avi", "mkv", "webm"]:
                media_type = "video"

        post = {
            "id": str(uuid4()),
            "userId": userId if not isAnonymous else "anonymous",
            "username": user.get("username") if not isAnonymous else "Anonymous",
            "userAvatar": user.get("profileImage") if not isAnonymous else None,
            "userProfileImage": user.get("profileImage") if not isAnonymous else None,
            "content": content if content else "",
            "postType": postType,
            "mediaUrl": media_url,
            "mediaType": media_type,
            "imageUrl": image_url,
            "isAnonymous": isAnonymous,
            "likes": [],
            "comments": [],
            "shares": 0,
            "views": 0,
            "createdAt": datetime.now(timezone.utc),
            "city": user.get("city", "Unknown"),
            "age": user.get("age", 0),
            "gender": user.get("gender", "Unknown")
        }

        await db.posts.insert_one(post)

        return {
            "success": True,
            "message": "Post created successfully",
            "post": {
                "id": post["id"],
                "createdAt": post["createdAt"].isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_router.get("/feed")
async def get_feed(
    userId: str,
    page: int = 1,
    limit: int = 10,
    city: Optional[str] = None
):
    """Get feed with smart mix of new and unseen posts"""
    try:
        skip = (page - 1) * limit
        
        # Get user to check blockedUsers and mutedUsers
        current_user = await db.users.find_one({"id": userId})
        if not current_user:
            return {"success": False, "posts": []}
        
        blocked_users = current_user.get("blockedUsers", [])
        muted_users = current_user.get("mutedUsers", [])
        excluded_users = list(set(blocked_users + muted_users))
        
        # Build query to exclude blocked/muted users and own posts
        query = {
            "userId": {"$nin": excluded_users + [userId]}  # Exclude blocked, muted, and own posts
        }
        
        # Filter by city if provided
        if city:
            query["city"] = city
        
        # Get total posts count for this query
        total_posts = await db.posts.count_documents(query)
        
        # Smart algorithm: Mix of recent posts and older unseen posts
        # 70% recent posts, 30% older posts (randomized)
        recent_limit = int(limit * 0.7)
        older_limit = limit - recent_limit
        
        # Get recent posts
        recent_posts = await db.posts.find(query)\
            .sort("createdAt", -1)\
            .skip(skip)\
            .limit(recent_limit)\
            .to_list(recent_limit)
        
        # Get older posts (randomly sampled from earlier content)
        older_skip = skip + (page * 50)  # Skip further ahead for older content
        older_posts = await db.posts.find(query)\
            .sort("createdAt", -1)\
            .skip(older_skip)\
            .limit(older_limit)\
            .to_list(older_limit)
        
        # Merge and shuffle
        import random
        all_posts = recent_posts + older_posts
        random.shuffle(all_posts)
        
        # Format posts
        formatted_posts = []
        for post in all_posts:
            # Get post author's current profile picture, verification, founder status, and privacy info
            post_author = await db.users.find_one(
                {"id": post.get("userId")}, 
                {"isVerified": 1, "isFounder": 1, "profileImage": 1, "isPrivate": 1, "followers": 1}
            )
            
            # Skip posts from private accounts unless the viewer is a follower or the owner
            if post_author:
                is_private = post_author.get("isPrivate", False)
                followers = post_author.get("followers") or []  # ensure list, not None
                if (
                    is_private
                    and userId not in followers
                    and post.get("userId") != userId  # viewer is not the owner
                ):
                    continue  # do not add this post to the feed
            
            is_verified = post_author.get("isVerified", False) if post_author else False
            is_founder = post_author.get("isFounder", False) if post_author else False
            current_profile_image = post_author.get("profileImage") if post_author else post.get("userAvatar")
            
            # Get like count
            like_count = len(post.get("likes", []))
            comment_count = len(post.get("comments", []))
            
            # Check if current user liked
            user_liked = userId in post.get("likes", [])
            
            formatted_posts.append({
                "id": post["id"],
                "userId": post.get("userId"),
                "username": post.get("username"),
                "userAvatar": current_profile_image,  # Use current profile picture
                "isVerified": is_verified,
                "isFounder": is_founder,
                "content": post.get("content"),
                "postType": post.get("postType"),
                "imageUrl": post.get("imageUrl"),
                "isAnonymous": post.get("isAnonymous", False),
                "likes": like_count,
                "comments": comment_count,
                "shares": post.get("shares", 0),
                "views": post.get("views", 0),
                "userLiked": user_liked,
                "createdAt": post["createdAt"].isoformat(),
                "timeAgo": get_time_ago(post["createdAt"])
            })
        
        return {
            "success": True,
            "posts": formatted_posts,
            "hasMore": len(formatted_posts) == limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_router.post("/posts/{postId}/like")
async def like_post(postId: str, userId: str = Form(...), reactionType: str = Form("like")):
    """Like/Unlike a post"""
    try:
        post = await db.posts.find_one({"id": postId})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Get user who is liking the post
        user = await db.users.find_one({"id": userId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        likes = post.get("likes", [])
        
        if userId in likes:
            # Unlike
            likes.remove(userId)
            action = "unliked"
        else:
            # Like
            likes.append(userId)
            action = "liked"
            
            # Create notification if liking someone else's post
            if post.get("userId") != userId:
                notification = {
                    "id": str(uuid4()),
                    "userId": post.get("userId"),  # Post owner receives notification
                    "fromUserId": userId,
                    "fromUsername": user.get("username", "Unknown"),
                    "fromUserImage": user.get("profileImage"),
                    "type": "like",
                    "postId": postId,
                    "postImage": post.get("imageUrl") or post.get("mediaUrl"),  # Include post image for notification preview
                    "isRead": False,
                    "createdAt": datetime.now(timezone.utc)
                }
                await db.notifications.insert_one(notification)
        
        # Update post
        await db.posts.update_one(
            {"id": postId},
            {"$set": {"likes": likes}}
        )
        
        return {
            "success": True,
            "action": action,
            "likeCount": len(likes)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_router.post("/posts/{postId}/comment")
async def add_comment(
    postId: str,
    userId: str = Form(...),
    content: str = Form(...),
    isAnonymous: bool = Form(False),
    parentCommentId: Optional[str] = Form(None)
):
    """Add comment or reply to a post"""
    try:
        post = await db.posts.find_one({"id": postId})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        user = await db.users.find_one({"id": userId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # If it's a reply, validate parent comment exists
        if parentCommentId:
            parent_exists = any(c.get("id") == parentCommentId for c in post.get("comments", []))
            if not parent_exists:
                raise HTTPException(status_code=404, detail="Parent comment not found")
        
        # UNIFIED COMMENT FORMAT - matches /api/posts endpoint
        comment = {
            "id": str(uuid4()),
            "userId": userId if not isAnonymous else "anonymous",
            "username": user.get("username") if not isAnonymous else "Anonymous",
            "userProfileImage": user.get("profileImage") if not isAnonymous else None,  # Changed from userAvatar
            "text": content,  # Changed from content to text
            "createdAt": datetime.now(timezone.utc).isoformat(),  # Changed to isoformat string
            "isAnonymous": isAnonymous,
            "parentCommentId": parentCommentId,
            "likes": [],
            "likesCount": 0  # Added likesCount
        }
        
        # Add comment to post
        await db.posts.update_one(
            {"id": postId},
            {"$push": {"comments": comment}}
        )
        
        # Create notification for post owner (if not commenting on own post and not anonymous)
        if not isAnonymous and post.get("userId") != userId:
            notification = {
                "id": str(uuid4()),
                "userId": post.get("userId"),
                "fromUserId": userId,
                "fromUsername": user.get("username", "Unknown"),
                "fromUserImage": user.get("profileImage"),
                "type": "comment",
                "postId": postId,
                "commentText": content[:50],  # Store first 50 chars
                "isRead": False,
                "createdAt": datetime.now(timezone.utc)
            }
            await db.notifications.insert_one(notification)
        
        return {
            "success": True,
            "comment": comment  # Return full comment object with all fields
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get comments for a post
@social_router.get("/posts/{postId}/comments")
async def get_post_comments(postId: str, userId: Optional[str] = None):
    """Get all comments for a post with nested replies"""
    try:
        post = await db.posts.find_one({"id": postId})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        comments = post.get("comments", [])
        
        # Organize comments and replies
        comment_map = {}
        root_comments = []
        
        for comment in comments:
            comment_id = comment.get("id")
            likes = comment.get("likes", [])
            user_liked = userId in likes if userId else False
            
            # UNIFIED FORMAT - use same fields as /api/posts endpoint
            comment_data = {
                "id": comment_id,
                "userId": comment.get("userId"),
                "username": comment.get("username"),
                "userProfileImage": comment.get("userProfileImage", comment.get("userAvatar")),  # Support both
                "text": comment.get("text", comment.get("content")),  # Support both
                "createdAt": comment.get("createdAt"),
                "timeAgo": get_time_ago(comment.get("createdAt")),
                "likesCount": len(likes),
                "likes": likes,
                "userLiked": user_liked,
                "parentCommentId": comment.get("parentCommentId"),
                "replies": []
            }
            comment_map[comment_id] = comment_data
            
            if comment.get("parentCommentId"):
                # It's a reply
                parent_id = comment.get("parentCommentId")
                if parent_id in comment_map:
                    comment_map[parent_id]["replies"].append(comment_data)
            else:
                # It's a root comment
                root_comments.append(comment_data)
        
        return {"success": True, "comments": root_comments}
    except Exception as e:
        logger.error(f"Error fetching comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Like a comment
@social_router.post("/comments/{commentId}/like")
async def like_comment(commentId: str, userId: str = Form(...)):
    """Like or unlike a comment"""
    try:
        # Find the post containing this comment
        post = await db.posts.find_one({"comments.id": commentId})
        if not post:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        comments = post.get("comments", [])
        comment_index = None
        
        for idx, comment in enumerate(comments):
            if comment.get("id") == commentId:
                comment_index = idx
                break
        
        if comment_index is None:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        comment = comments[comment_index]
        likes = comment.get("likes", [])
        
        if userId in likes:
            # Unlike
            likes.remove(userId)
        else:
            # Like
            likes.append(userId)
        
        comment["likes"] = likes
        comments[comment_index] = comment
        
        await db.posts.update_one(
            {"id": post["id"]},
            {"$set": {"comments": comments}}
        )
        
        return {"success": True, "likesCount": len(likes)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error liking comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# get_time_ago function is defined in UTILITY FUNCTIONS section

# STORIES ENDPOINTS

@social_router.post("/stories")
async def create_story(
    userId: str = Form(...),
    content: str = Form(""),
    storyType: str = Form("image"),
    isAnonymous: bool = Form(False),
    image: Optional[UploadFile] = File(None)
):
    """Create a 24-hour story"""
    try:
        logger.info(f"Creating story for user: {userId}, type: {storyType}, has_image: {image is not None}")
        
        user = await db.users.find_one({"id": userId})
        if not user:
            logger.error(f"User not found: {userId}")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Handle image upload
        image_url = None
        if image:
            upload_dir = "/app/uploads/stories"
            os.makedirs(upload_dir, exist_ok=True)
            
            file_ext = image.filename.split('.')[-1]
            filename = f"{uuid4()}.{file_ext}"
            file_path = os.path.join(upload_dir, filename)
            
            with open(file_path, "wb") as f:
                content_bytes = await image.read()
                f.write(content_bytes)
            
            # Construct the image URL using the API uploads route. Because
            # api_router uses a prefix of /api, stories are served from
            # /api/uploads/.... Including /api here ensures the URL
            # resolves correctly in both preview and production environments.
            image_url = f"/api/uploads/stories/{filename}"
        
        # Create story
        story = {
            "id": str(uuid4()),
            "userId": userId if not isAnonymous else "anonymous",
            "username": user.get("username") if not isAnonymous else "Anonymous",
            "userAvatar": user.get("profileImage") if not isAnonymous else None,
            "content": content if content else "",  # Allow empty content if image is present
            "storyType": storyType,
            "imageUrl": image_url,
            "isAnonymous": isAnonymous,
            "views": [],
            "createdAt": datetime.now(timezone.utc),
            "expiresAt": datetime.now(timezone.utc) + timedelta(hours=24)
        }
        
        await db.stories.insert_one(story)
        
        return {
            "success": True,
            "message": "Story created successfully",
            "story": {
                "id": story["id"],
                "expiresAt": story["expiresAt"].isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_router.get("/stories")
async def get_stories(userId: str, skip: int = 0, limit: int = 50):
    """Get active stories (not expired)"""
    try:
        # Get non-expired stories
        now = datetime.now(timezone.utc)
        
        stories = await db.stories.find({
            "expiresAt": {"$gt": now}
        }).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
        
        # Format stories
        formatted_stories = []
        for story in stories:
            # Get story author's current profile picture, verification, founder status, and privacy info
            story_author = await db.users.find_one(
                {"id": story.get("userId")}, 
                {"isVerified": 1, "isFounder": 1, "profileImage": 1, "isPrivate": 1, "followers": 1}
            )
            
            # Skip private stories unless the viewer is a follower or the owner
            if story_author:
                is_private = story_author.get("isPrivate", False)
                followers = story_author.get("followers") or []  # ensure list, not None
                if (
                    is_private
                    and userId not in followers
                    and story.get("userId") != userId  # viewer is not the owner
                ):
                    continue  # do not show this story
            
            is_verified = story_author.get("isVerified", False) if story_author else False
            is_founder = story_author.get("isFounder", False) if story_author else False
            current_profile_image = story_author.get("profileImage") if story_author else story.get("userAvatar")
            
            # Check if user viewed
            user_viewed = userId in story.get("views", [])
            
            formatted_stories.append({
                "id": story["id"],
                "userId": story.get("userId"),
                "username": story.get("username"),
                "userAvatar": current_profile_image,  # Use current profile picture
                "isVerified": is_verified,
                "isFounder": is_founder,
                "content": story.get("content"),
                "storyType": story.get("storyType"),
                "imageUrl": story.get("imageUrl"),
                "isAnonymous": story.get("isAnonymous", False),
                "views": len(story.get("views", [])),
                "userViewed": user_viewed,
                "createdAt": story["createdAt"].isoformat(),
                "expiresAt": story["expiresAt"].isoformat(),
                "timeAgo": get_time_ago(story["createdAt"])
            })
        
        return {
            "success": True,
            "stories": formatted_stories
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_router.post("/stories/{storyId}/view")
async def view_story(storyId: str, userId: str = Form(...)):
    """Mark story as viewed"""
    try:
        story = await db.stories.find_one({"id": storyId})
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        views = story.get("views", [])
        
        if userId not in views:
            views.append(userId)
            await db.stories.update_one(
                {"id": storyId},
                {"$set": {"views": views}}
            )
        
        return {
            "success": True,
            "viewCount": len(views)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# FOLLOW SYSTEM

@social_router.post("/follow")
async def follow_user(userId: str = Form(...), targetUserId: str = Form(...)):
    """Follow a user"""
    try:
        if userId == targetUserId:
            raise HTTPException(status_code=400, detail="Cannot follow yourself")
        
        user = await db.users.find_one({"id": userId})
        target = await db.users.find_one({"id": targetUserId})
        
        if not user or not target:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Add to following list
        following = user.get("following", [])
        if targetUserId not in following:
            following.append(targetUserId)
            await db.users.update_one(
                {"id": userId},
                {"$set": {"following": following}}
            )
        
        # Add to followers list
        followers = target.get("followers", [])
        if userId not in followers:
            followers.append(userId)
            await db.users.update_one(
                {"id": targetUserId},
                {"$set": {"followers": followers}}
            )
        
        return {
            "success": True,
            "message": "Followed successfully",
            "following": True
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_router.post("/unfollow")
async def unfollow_user(userId: str = Form(...), targetUserId: str = Form(...)):
    """Unfollow a user"""
    try:
        user = await db.users.find_one({"id": userId})
        target = await db.users.find_one({"id": targetUserId})
        
        if not user or not target:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Remove from following list
        following = user.get("following", [])
        if targetUserId in following:
            following.remove(targetUserId)
            await db.users.update_one(
                {"id": userId},
                {"$set": {"following": following}}
            )
        
        # Remove from followers list
        followers = target.get("followers", [])
        if userId in followers:
            followers.remove(userId)
            await db.users.update_one(
                {"id": targetUserId},
                {"$set": {"followers": followers}}
            )
        
        return {
            "success": True,
            "message": "Unfollowed successfully",
            "following": False
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_router.get("/users/{userId}/followers")
async def get_followers(userId: str):
    """Get user's followers"""
    try:
        user = await db.users.find_one({"id": userId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        follower_ids = user.get("followers", [])
        
        # Get follower details
        followers = []
        for fid in follower_ids:
            follower = await db.users.find_one({"id": fid})
            if follower:
                followers.append({
                    "id": follower["id"],
                    "username": follower.get("username"),
                    "fullName": follower.get("fullName"),
                    "profileImage": follower.get("profileImage"),
                    "bio": follower.get("bio", "")
                })
        
        return {
            "success": True,
            "followers": followers,
            "count": len(followers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_router.get("/users/{userId}/following")
async def get_following(userId: str):
    """Get users that this user follows"""
    try:
        user = await db.users.find_one({"id": userId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        following_ids = user.get("following", [])
        
        # Get following details
        following = []
        for fid in following_ids:
            followed_user = await db.users.find_one({"id": fid})
            if followed_user:
                following.append({
                    "id": followed_user["id"],
                    "username": followed_user.get("username"),
                    "fullName": followed_user.get("fullName"),
                    "profileImage": followed_user.get("profileImage"),
                    "bio": followed_user.get("bio", "")
                })
        
        return {
            "success": True,
            "following": following,
            "count": len(following)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# UTILITY FUNCTIONS

def get_time_ago(dt):
    """Convert datetime to 'time ago' format"""
    # Ensure dt is timezone-aware
    if dt.tzinfo is None:
        from datetime import timezone as tz
        dt = dt.replace(tzinfo=tz.utc)
    
    now = datetime.now(timezone.utc)
    diff = now - dt
    
    seconds = diff.total_seconds()
    
    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"{minutes}m ago"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours}h ago"
    elif seconds < 604800:
        days = int(seconds / 86400)
        return f"{days}d ago"
    else:
        weeks = int(seconds / 604800)
        return f"{weeks}w ago"
