import tweepy # type: ignore
import logging
import os
from dotenv import load_dotenv, find_dotenv

# Load environment variables from .env file
load_dotenv(find_dotenv())

# Retrieve Twitter API keys
TWITTER_API_KEY = os.getenv("TWITTER_API_KEY")
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_SECRET = os.getenv("TWITTER_ACCESS_SECRET")

class TwitterManager:
    def __init__(self):
        try:
            # Set up authentication
            self.auth = tweepy.OAuth1UserHandler(
                TWITTER_API_KEY, 
                TWITTER_API_SECRET,
                TWITTER_ACCESS_TOKEN, 
                TWITTER_ACCESS_SECRET
            )
            # Create API object
            self.api = tweepy.API(self.auth)
            # Verify credentials
            self.api.verify_credentials()
            logging.info("Twitter API authentication successful")
        except Exception as e:
            logging.error(f"Twitter API authentication failed: {e}")
            self.api = None
    
    def post_tweet(self, content):
        """Post a tweet with the given content"""
        if not self.api:
            return {"success": False, "error": "Twitter API not initialized"}
        
        try:
            tweet = self.api.update_status(content)
            return {"success": True, "tweet_id": tweet.id}
        except Exception as e:
            logging.error(f"Failed to post tweet: {e}")
            return {"success": False, "error": str(e)}
    
    # Add more methods for different Twitter functionality
    def get_user_timeline(self, username, count=10):
        """Get recent tweets from a user"""
        if not self.api:
            return {"success": False, "error": "Twitter API not initialized"}
        
        try:
            tweets = self.api.user_timeline(screen_name=username, count=count)
            return {"success": True, "tweets": [t._json for t in tweets]}
        except Exception as e:
            logging.error(f"Failed to get user timeline: {e}")
            return {"success": False, "error": str(e)}