from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Counterpart(BaseModel):
    """Who's on the other end of a thread — a brand's profile for a creator's
    thread, or a creator's profile for a brand's thread."""

    user_id: int
    name: str
    #: Creator: category. Brand: industry. Both are the natural "what are they" field.
    subtitle: Optional[str] = None
    location: Optional[str] = None


class MessageOut(BaseModel):
    id: int
    sender_id: int
    body: str
    created_at: datetime
    read_at: Optional[datetime] = None
    #: Convenience for the frontend, so it doesn't need the viewer's own id to
    #: decide which side of the thread a bubble renders on.
    is_mine: bool

    class Config:
        from_attributes = True


class ThreadSummary(BaseModel):
    interest_id: int
    counterpart: Counterpart
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int
    interest_status: str


class ThreadDetail(BaseModel):
    interest_id: int
    counterpart: Counterpart
    interest_status: str
    messages: list[MessageOut]


class SendMessageRequest(BaseModel):
    body: str
