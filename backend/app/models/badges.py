"""Multi-chain badge management models.

These tables support *admin-managed* badge templates (metadata + image CIDs)
and a durable issuance/audit log for admin-controlled minting across
multiple EVM chains (EDU Chain, BNB Smart Chain, etc.).

Design:
- Each template is bound to a specific chain_id at creation time.
- Metadata is treated as effectively immutable once published.
- Minting is recorded as an issuance row to support retries/auditing.
- chain_id defaults to 656476 (EDU Chain Testnet) for backward compatibility.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.database import Base


class BadgeTemplateStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class BadgeIssuanceStatus(str, Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


if TYPE_CHECKING:
    from .user import User


class BadgeTemplate(Base):
    """Admin-managed definition for an ERC1155 badge (token id + immutable metadata).

    Each template is scoped to a single chain via ``chain_id``.
    The same token_id can exist on different chains (separate deployments).
    """

    __tablename__ = "badge_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Multi-chain: identifies which blockchain this template targets
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False, server_default="656476", index=True)

    contract_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    token_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # IPFS assets
    image_cid: Mapped[str | None] = mapped_column(String(128), nullable=True)
    image_mime: Mapped[str | None] = mapped_column(String(64), nullable=True)
    image_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)

    metadata_cid: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_uri: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Optional auto-award trigger metadata (admin-configurable)
    auto_award_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    auto_award_action: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    auto_award_criteria: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="DRAFT")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    issuances: Mapped[list["BadgeIssuance"]] = relationship(
        "BadgeIssuance",
        back_populates="template",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        # A token_id is unique per chain + contract pair
        UniqueConstraint("chain_id", "contract_address", "token_id", name="uq_badge_templates_chain_contract_token"),
        Index("ix_badge_templates_status", "status"),
        Index("ix_badge_templates_chain_id", "chain_id"),
        Index("ix_badge_templates_auto_award_action", "auto_award_action"),
    )


class BadgeIssuance(Base):
    """Durable log of an attempted/successful mint of a badge to a user wallet.

    The chain_id is denormalized from the template for efficient querying
    and to preserve the chain context even if the template is later archived.
    """

    __tablename__ = "badge_issuances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Denormalized chain_id for fast filtering without joining badge_templates
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False, server_default="656476", index=True)

    template_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("badge_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_admin_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    wallet_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")

    tx_hash: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="PENDING")
    error_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    template: Mapped[BadgeTemplate] = relationship("BadgeTemplate", back_populates="issuances")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    requested_by_admin: Mapped[Optional["User"]] = relationship("User", foreign_keys=[requested_by_admin_id])

    __table_args__ = (
        UniqueConstraint("template_id", "user_id", name="uq_badge_issuances_template_user"),
    )
