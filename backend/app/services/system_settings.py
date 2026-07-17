"""System settings service for managing configuration."""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from app.models.system import SystemSettings
from app.core.settings import settings

logger = logging.getLogger(__name__)

class SystemSettingsService:
    """Service for managing system-wide configuration settings with DB persistence."""
    
    async def get_override(self, db: AsyncSession, key: str) -> Optional[Any]:
        """Get a single setting override from DB."""
        stmt = select(SystemSettings).where(SystemSettings.key == key)
        result = await db.execute(stmt)
        setting = result.scalar_one_or_none()
        if setting:
            return setting.value.get("value")
        return None
        
    async def set_override(
        self, 
        db: AsyncSession, 
        key: str, 
        value: Any, 
        category: str, 
        admin_id: int
    ) -> None:
        """Set a single setting override in DB."""
        stmt = insert(SystemSettings).values(
            key=key,
            value={"value": value},
            category=category,
            updated_by=admin_id,
            updated_at=datetime.now(timezone.utc)
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=['key'],
            set_={
                'value': {"value": value},
                'category': category,
                'updated_by': admin_id,
                'updated_at': datetime.now(timezone.utc)
            }
        )
        await db.execute(stmt)
        await db.commit()
        
    async def get_all_overrides(
        self, 
        db: AsyncSession, 
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get all setting overrides from DB, optionally filtered by category."""
        stmt = select(SystemSettings)
        if category:
            stmt = stmt.where(SystemSettings.category == category)
            
        result = await db.execute(stmt)
        settings_list = result.scalars().all()
        
        overrides = {}
        for s in settings_list:
            overrides[s.key] = s.value.get("value")
            
        return overrides
        
    async def update_category_settings(
        self, 
        db: AsyncSession, 
        category: str, 
        settings_dict: Dict[str, Any], 
        admin_id: int
    ) -> bool:
        """Update multiple settings for a category."""
        try:
            for key, value in settings_dict.items():
                await self.set_override(db, key, value, category, admin_id)
            return True
        except Exception as e:
            logger.error(f"Error updating category settings: {e}")
            await db.rollback()
            return False

    async def export_settings(self, db: AsyncSession) -> Dict[str, Any]:
        """Export all settings overrides and current env defaults."""
        overrides = await self.get_all_overrides(db)
        
        # We also export the current settings for context
        env_settings = settings.model_dump(exclude={
            "database_url", "secret_key", "internal_api_key",
            "email_encryption_key", "backend_minter_private_key",
            "google_genai_api_key", "azure_openai_api_key", 
            "together_api_key", "n8n_api_key", "redis_password",
            "email_password"
        })
        
        return {
            "overrides": overrides,
            "env_defaults": env_settings,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "version": "2.0"
        }
        
    async def import_settings(
        self, 
        db: AsyncSession, 
        data: Dict[str, Any], 
        admin_id: int
    ) -> Dict[str, Any]:
        """Import settings overrides from backup."""
        results = {"success": [], "errors": []}
        
        overrides = data.get("overrides", {})
        if not overrides:
            return {"success": [], "errors": ["No overrides found in import data"]}
            
        try:
            for key, value in overrides.items():
                # We don't have category info in the simple export mapping easily accessible,
                # but we can look it up or default to "imported"
                await self.set_override(db, key, value, "imported", admin_id)
                results["success"].append(key)
        except Exception as e:
            logger.error(f"Error importing settings: {e}")
            results["errors"].append(str(e))
            
        return results

# Global instance
settings_service = SystemSettingsService()
