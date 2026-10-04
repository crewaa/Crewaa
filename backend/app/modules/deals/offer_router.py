"""
Deal terms API (V2 §1.2).

Every route resolves the negotiation through `opportunity_interests` and
confirms the caller is one of its two parties — the same explicit-ownership
pattern as `messaging/router.py` and `campaigns/router.py`, and for the same
reason: a check that can be forgotten is how the unauthenticated profile routes
happened.

The state machine lives here rather than in the model because every transition
depends on *who is asking*:

    propose   — either party, when nothing is live and nothing is agreed
    counter   — the party who did NOT make the live offer
    accept    — the party who did NOT make the live offer
    decline   — the party who did NOT make the live offer
    withdraw  — only the party who DID make it

The recurring rule is that nobody may respond to their own offer. Without it, a
brand could propose and immediately "accept", manufacturing an agreement the
creator never saw.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_current_user, get_db
from app.common.rate_limit import rate_limit_user
from app.core.logging import logger
from app.modules.deals.models import InterestStatus, OpportunityInterest
from collections import defaultdict

from app.modules.deals.deliveries import DealDelivery, DeliveryStatus, delivery_state
from app.modules.deals.reviews import DealReview, is_revealed, summarise
from app.modules.deals.offer_schemas import (
    DealTerms, DeliveryOut, DeliveryState, OfferOut, ProposeOfferRequest,
    ReviewDeliveryRequest, SubmitDeliveryRequest,
    PublicReviews, ReviewOut, ReviewState, SubmitReviewRequest,
)
from app.modules.deals.offers import DealOffer, OfferParty, OfferStatus
from app.modules.notifications.models import NotificationKind
from app.modules.notifications.service import counterpart_id, notify, thread_link
from app.modules.users.models import User

router = APIRouter(prefix="/deals", tags=["Deal terms"])


async def _party_interest(
    db: AsyncSession, user_id: int, interest_id: int
) -> OpportunityInterest:
    interest = (await db.execute(
        select(OpportunityInterest).where(OpportunityInterest.id == interest_id)
    )).scalar()

    # 404 rather than 403, matching campaigns and messaging: a negotiation this
    # user is not part of must not be distinguishable from one that is not there.
    if interest is None or user_id not in (interest.creator_id, interest.brand_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deal not found")

    return interest


def _role_of(user_id: int, interest: OpportunityInterest) -> str:
    return OfferParty.CREATOR if user_id == interest.creator_id else OfferParty.BRAND


async def _offers(db: AsyncSession, interest_id: int) -> list[DealOffer]:
    return list((await db.execute(
        select(DealOffer)
        .where(DealOffer.interest_id == interest_id)
        .order_by(DealOffer.created_at.desc(), DealOffer.id.desc())
    )).scalars().all())


def _to_out(offer: DealOffer, viewer_id: int) -> OfferOut:
    deliverables = None
    if offer.deliverables:
        try:
            parsed = json.loads(offer.deliverables)
            deliverables = parsed if isinstance(parsed, list) else None
        except (json.JSONDecodeError, TypeError):
            deliverables = None

    return OfferOut(
        id=offer.id,
        status=offer.status,
        proposed_by_id=offer.proposed_by_id,
        proposed_by_role=offer.proposed_by_role,
        is_mine=offer.proposed_by_id == viewer_id,
        fee=offer.fee,
        currency=offer.currency,
        deliverables=deliverables,
        deadline=offer.deadline,
        note=offer.note,
        supersedes_id=offer.supersedes_id,
        created_at=offer.created_at,
        responded_at=offer.responded_at,
    )


def _build_terms(offers: list[DealOffer], viewer_id: int, interest_id: int) -> DealTerms:
    """Assemble the negotiation state, including what this viewer may do."""
    agreed = next((o for o in offers if o.status == OfferStatus.ACCEPTED), None)
    current = next((o for o in offers if o.status == OfferStatus.PROPOSED), None)

    # Whatever is neither live nor agreed is history.
    live_ids = {o.id for o in (agreed, current) if o}
    history = [o for o in offers if o.id not in live_ids]

    terms = DealTerms(
        interest_id=interest_id,
        current=_to_out(current, viewer_id) if current else None,
        agreed=_to_out(agreed, viewer_id) if agreed else None,
        history=[_to_out(o, viewer_id) for o in history],
    )

    if agreed is not None:
        # Settled. Nothing further can be proposed or responded to.
        return terms

    if current is None:
        terms.can_propose = True
    elif current.proposed_by_id == viewer_id:
        # Your own offer: you can pull it, not accept it.
        terms.can_withdraw = True
    else:
        terms.can_respond = True   # accept, decline, or counter

    return terms


def _require_open(interest: OpportunityInterest) -> None:
    if interest.status != InterestStatus.INTERESTED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This interest was withdrawn — terms can no longer be negotiated.",
        )


@router.get("/{interest_id}/terms", response_model=DealTerms)
async def get_terms(
    interest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The full negotiation on one interest, from this party's point of view."""
    await _party_interest(db, current_user.id, interest_id)
    offers = await _offers(db, interest_id)
    return _build_terms(offers, current_user.id, interest_id)


@router.post(
    "/{interest_id}/terms",
    response_model=DealTerms,
    status_code=201,
    dependencies=[rate_limit_user(40, 3600, "propose_offer")],
)
async def propose_or_counter(
    interest_id: int,
    data: ProposeOfferRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Put terms on the table — an opening offer, or a counter to the live one.

    Countering supersedes rather than edits: the previous offer is marked
    `superseded` and the new row points back at it, so the whole negotiation
    stays readable afterwards.
    """
    interest = await _party_interest(db, current_user.id, interest_id)
    _require_open(interest)

    offers = await _offers(db, interest_id)

    if any(o.status == OfferStatus.ACCEPTED for o in offers):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "These terms are already agreed. Withdraw is not possible — "
            "start a new campaign to renegotiate.",
        )

    live = next((o for o in offers if o.status == OfferStatus.PROPOSED), None)

    if live is not None and live.proposed_by_id == current_user.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Your offer is still awaiting a response. Withdraw it first to "
            "replace it.",
        )

    now = datetime.now(timezone.utc)
    offer = DealOffer(
        interest_id=interest_id,
        proposed_by_id=current_user.id,
        proposed_by_role=_role_of(current_user.id, interest),
        supersedes_id=live.id if live else None,
        fee=data.fee,
        currency=data.currency,
        deliverables=json.dumps(data.deliverables) if data.deliverables else None,
        deadline=data.deadline,
        note=(data.note or "").strip() or None,
        status=OfferStatus.PROPOSED,
    )

    if live is not None:
        live.status = OfferStatus.SUPERSEDED
        live.responded_at = now

    db.add(offer)

    await notify(
        db,
        user_id=counterpart_id(interest, current_user.id),
        kind=NotificationKind.OFFER,
        title="Counter-offer received" if live else "New offer received",
        body=f"{data.currency} {data.fee:,.0f} proposed for this deal.",
        link=thread_link(interest_id),
        interest_id=interest_id,
    )

    await db.commit()

    logger.info(
        "User {} {} terms on interest {}",
        current_user.id, "countered" if live else "proposed", interest_id,
    )

    return _build_terms(await _offers(db, interest_id), current_user.id, interest_id)


async def _respond(
    db: AsyncSession,
    current_user: User,
    interest_id: int,
    offer_id: int,
    new_status: str,
) -> DealTerms:
    """Shared path for accept / decline / withdraw — the guards are identical."""
    interest = await _party_interest(db, current_user.id, interest_id)
    _require_open(interest)

    offer = (await db.execute(
        select(DealOffer).where(
            DealOffer.id == offer_id, DealOffer.interest_id == interest_id
        )
    )).scalar()

    if offer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Offer not found")

    if offer.status != OfferStatus.PROPOSED:
        # Covers the stale-tab case: someone countered while this page was open,
        # and the button they clicked refers to an offer that is no longer live.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "These terms are no longer open — the deal has moved on. Reload to "
            "see the latest.",
        )

    is_proposer = offer.proposed_by_id == current_user.id

    if new_status == OfferStatus.WITHDRAWN and not is_proposer:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the party who made an offer can withdraw it."
        )

    if new_status in (OfferStatus.ACCEPTED, OfferStatus.DECLINED) and is_proposer:
        # The rule the whole state machine rests on. Without it a brand could
        # propose and instantly "accept", producing an agreement the creator
        # never saw.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You cannot respond to your own offer."
        )

    offer.status = new_status
    offer.responded_at = datetime.now(timezone.utc)
    offer.responded_by_id = current_user.id

    # Withdrawing is the one case with nobody to tell: it takes back your own
    # offer before the other side has acted on it, so there is no news.
    if new_status != OfferStatus.WITHDRAWN:
        headline = {
            OfferStatus.ACCEPTED: "Terms agreed",
            OfferStatus.DECLINED: "Offer declined",
        }[new_status]
        detail = {
            OfferStatus.ACCEPTED: "Your offer was accepted. Payment is arranged "
                                  "directly between you for now.",
            OfferStatus.DECLINED: "Your offer was declined. Either side can "
                                  "still propose new terms.",
        }[new_status]
        await notify(
            db,
            user_id=counterpart_id(interest, current_user.id),
            kind=NotificationKind.OFFER,
            title=headline,
            body=detail,
            link=thread_link(interest_id),
            interest_id=interest_id,
        )

    try:
        await db.commit()
    except IntegrityError:
        # `uq_deal_offers_one_accepted` fired: another request agreed this deal
        # between our read and our write. The database is the authority on
        # "exactly one agreed deal", so defer to it rather than retrying.
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "These terms are no longer open — the deal has moved on. Reload to "
            "see the latest.",
        )

    logger.info(
        "User {} set offer {} on interest {} to {}",
        current_user.id, offer_id, interest_id, new_status,
    )

    return _build_terms(await _offers(db, interest_id), current_user.id, interest_id)


@router.post("/{interest_id}/terms/{offer_id}/accept", response_model=DealTerms)
async def accept_offer(
    interest_id: int,
    offer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agree the terms. This is the record both sides rely on afterwards."""
    return await _respond(db, current_user, interest_id, offer_id, OfferStatus.ACCEPTED)


@router.post("/{interest_id}/terms/{offer_id}/decline", response_model=DealTerms)
async def decline_offer(
    interest_id: int,
    offer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject without countering.

    Declining does not close the negotiation — either side may propose again.
    Ending a conversation because one number was wrong would be a worse product
    than letting them keep talking.
    """
    return await _respond(db, current_user, interest_id, offer_id, OfferStatus.DECLINED)


@router.post("/{interest_id}/terms/{offer_id}/withdraw", response_model=DealTerms)
async def withdraw_offer(
    interest_id: int,
    offer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pull your own offer back before the other side responds."""
    return await _respond(db, current_user, interest_id, offer_id, OfferStatus.WITHDRAWN)


# ===========================================================================
# Delivery (V2 §1.4)
#
# Roles are asymmetric here, unlike the offer negotiation: the **creator**
# submits work and the **brand** reviews it. A brand approving its own
# submission, or a creator approving their own delivery, would make the record
# worthless as proof that anything happened.
# ===========================================================================

async def _agreed_offer(db: AsyncSession, interest_id: int) -> DealOffer | None:
    return (await db.execute(
        select(DealOffer).where(
            DealOffer.interest_id == interest_id,
            DealOffer.status == OfferStatus.ACCEPTED,
        )
    )).scalar()


async def _submissions(db: AsyncSession, offer_id: int) -> list[DealDelivery]:
    return list((await db.execute(
        select(DealDelivery)
        .where(DealDelivery.offer_id == offer_id)
        .order_by(DealDelivery.created_at.desc(), DealDelivery.id.desc())
    )).scalars().all())


def _delivery_out(d: DealDelivery, viewer_id: int) -> DeliveryOut:
    return DeliveryOut(
        id=d.id, label=d.label, url=d.url, note=d.note, status=d.status,
        feedback=d.feedback, submitted_by_id=d.submitted_by_id,
        is_mine=d.submitted_by_id == viewer_id, supersedes_id=d.supersedes_id,
        created_at=d.created_at, reviewed_at=d.reviewed_at,
    )


def _build_delivery_state(
    offer: DealOffer | None,
    submissions: list[DealDelivery],
    viewer_id: int,
    interest: OpportunityInterest,
) -> DeliveryState:
    if offer is None:
        # Nothing agreed, so nothing to deliver against.
        return DeliveryState()

    agreed = _safe_list(offer.deliverables)
    state = delivery_state(agreed, submissions)

    is_creator = viewer_id == interest.creator_id

    return DeliveryState(
        offer_id=offer.id,
        complete=state["complete"],
        outstanding=state["outstanding"],
        approved_count=state["approved_count"],
        expected_count=state["expected_count"],
        submissions=[_delivery_out(s, viewer_id) for s in submissions],
        # The creator delivers; the brand reviews. Neither may do the other's job.
        can_submit=is_creator and not state["complete"],
        can_review=(not is_creator) and any(
            s.status == DeliveryStatus.SUBMITTED for s in submissions
        ),
    )


def _safe_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    return [str(x) for x in parsed] if isinstance(parsed, list) else []


@router.get("/{interest_id}/delivery", response_model=DeliveryState)
async def get_delivery(
    interest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delivery progress against the agreed terms."""
    interest = await _party_interest(db, current_user.id, interest_id)
    offer = await _agreed_offer(db, interest_id)
    submissions = await _submissions(db, offer.id) if offer else []
    return _build_delivery_state(offer, submissions, current_user.id, interest)


@router.post(
    "/{interest_id}/delivery",
    response_model=DeliveryState,
    status_code=201,
    dependencies=[rate_limit_user(60, 3600, "submit_delivery")],
)
async def submit_delivery(
    interest_id: int,
    data: SubmitDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Creator submits a link for one agreed deliverable.

    Resubmitting supersedes the previous attempt rather than editing it — the
    original submission and its timestamp are the evidence that settles "you
    never posted it".
    """
    interest = await _party_interest(db, current_user.id, interest_id)

    if current_user.id != interest.creator_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the creator submits deliverables."
        )

    offer = await _agreed_offer(db, interest_id)
    if offer is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Agree the terms before submitting work.",
        )

    agreed = _safe_list(offer.deliverables)
    label = data.label.strip()
    if agreed and label not in agreed:
        # Otherwise "1x Reel (45s)" could be satisfied by something called
        # anything at all, and `outstanding` would never empty.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"'{label}' is not one of the agreed deliverables.",
        )

    existing = await _submissions(db, offer.id)
    live = next(
        (s for s in existing
         if s.label == label and s.status != DeliveryStatus.SUPERSEDED),
        None,
    )

    if live is not None and live.status == DeliveryStatus.APPROVED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This deliverable has already been approved.",
        )

    now = datetime.now(timezone.utc)
    submission = DealDelivery(
        offer_id=offer.id,
        submitted_by_id=current_user.id,
        label=label,
        url=data.url,
        note=(data.note or "").strip() or None,
        status=DeliveryStatus.SUBMITTED,
        supersedes_id=live.id if live else None,
    )
    if live is not None:
        live.status = DeliveryStatus.SUPERSEDED
        live.reviewed_at = live.reviewed_at or now

    db.add(submission)

    await notify(
        db,
        user_id=interest.brand_id,
        kind=NotificationKind.DELIVERY,
        title="Work submitted for review",
        body=f"The creator submitted \u201c{label}\u201d. Approve it or request changes.",
        link=thread_link(interest_id),
        interest_id=interest_id,
    )

    await db.commit()

    logger.info(
        "Creator {} submitted '{}' on interest {}", current_user.id, label, interest_id
    )

    return _build_delivery_state(
        offer, await _submissions(db, offer.id), current_user.id, interest
    )


@router.post(
    "/{interest_id}/delivery/{delivery_id}/review",
    response_model=DeliveryState,
)
async def review_delivery(
    interest_id: int,
    delivery_id: int,
    data: ReviewDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Brand approves a submission, or asks for changes with a reason."""
    interest = await _party_interest(db, current_user.id, interest_id)

    if current_user.id != interest.brand_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the brand reviews deliverables."
        )

    offer = await _agreed_offer(db, interest_id)
    if offer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Delivery not found")

    submission = (await db.execute(
        select(DealDelivery).where(
            DealDelivery.id == delivery_id, DealDelivery.offer_id == offer.id
        )
    )).scalar()

    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Delivery not found")

    if submission.status != DeliveryStatus.SUBMITTED:
        # Covers the stale-tab case and any replayed request.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This submission has already been reviewed or replaced. Reload to "
            "see the latest.",
        )

    feedback = (data.feedback or "").strip() or None
    if not data.approve and not feedback:
        # "Rejected" with no reason gives the creator nothing to act on.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Say what needs changing so the creator can fix it.",
        )

    submission.status = (
        DeliveryStatus.APPROVED if data.approve else DeliveryStatus.CHANGES_REQUESTED
    )
    submission.feedback = feedback
    submission.reviewed_at = datetime.now(timezone.utc)
    submission.reviewed_by_id = current_user.id

    await notify(
        db,
        user_id=interest.creator_id,
        kind=NotificationKind.DELIVERY,
        title="Delivery approved" if data.approve else "Changes requested",
        body=(
            f"\u201c{submission.label}\u201d was approved."
            if data.approve
            # The reason is carried into the notification rather than left in
            # the thread: "changes requested" with no explanation is the thing
            # the reason field was added to prevent.
            else f"\u201c{submission.label}\u201d needs changes: {feedback[:120]}"
        ),
        link=thread_link(interest_id),
        interest_id=interest_id,
    )

    await db.commit()

    logger.info(
        "Brand {} {} delivery {} on interest {}",
        current_user.id, "approved" if data.approve else "requested changes on",
        delivery_id, interest_id,
    )

    return _build_delivery_state(
        offer, await _submissions(db, offer.id), current_user.id, interest
    )


# ===========================================================================
# Reviews (V2 §1.5)
# ===========================================================================

async def _reviews_for_interest(db: AsyncSession, interest_id: int) -> list[DealReview]:
    return list((await db.execute(
        select(DealReview).where(DealReview.interest_id == interest_id)
    )).scalars().all())


def _review_out(r: DealReview) -> ReviewOut:
    return ReviewOut(
        id=r.id, rating=r.rating, comment=r.comment,
        author_role=r.author_role, created_at=r.created_at,
    )


async def _delivery_is_complete(db: AsyncSession, interest_id: int) -> bool:
    offer = await _agreed_offer(db, interest_id)
    if offer is None:
        return False
    submissions = await _submissions(db, offer.id)
    return delivery_state(_safe_list(offer.deliverables), submissions)["complete"]


@router.get("/{interest_id}/review", response_model=ReviewState)
async def get_reviews(
    interest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """This deal's reviews, respecting the double-blind reveal rule."""
    interest = await _party_interest(db, current_user.id, interest_id)
    reviews = await _reviews_for_interest(db, interest_id)

    mine = next((r for r in reviews if r.author_id == current_user.id), None)
    theirs = next((r for r in reviews if r.author_id != current_user.id), None)
    both_submitted = mine is not None and theirs is not None

    state = ReviewState(
        mine=_review_out(mine) if mine else None,
        revealed=bool(theirs and is_revealed(theirs, both_submitted)),
    )
    if theirs and state.revealed:
        state.received = _review_out(theirs)

    if mine is not None:
        state.blocked_reason = "You have already reviewed this deal."
    elif not await _delivery_is_complete(db, interest_id):
        state.blocked_reason = "You can review once the work is delivered and approved."
    else:
        state.can_review = True

    return state


@router.post(
    "/{interest_id}/review",
    response_model=ReviewState,
    status_code=201,
    dependencies=[rate_limit_user(30, 3600, "submit_review")],
)
async def submit_review(
    interest_id: int,
    data: SubmitReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Rate the other party. One review each, and only after delivery is complete.

    Gating on delivery is what keeps ratings meaningful: a review written before
    any work happened is an opinion about a conversation, not a track record.
    """
    interest = await _party_interest(db, current_user.id, interest_id)

    if not await _delivery_is_complete(db, interest_id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You can review once the work is delivered and approved.",
        )

    is_creator = current_user.id == interest.creator_id
    review = DealReview(
        interest_id=interest_id,
        author_id=current_user.id,
        subject_id=interest.brand_id if is_creator else interest.creator_id,
        rating=data.rating,
        comment=(data.comment or "").strip() or None,
        author_role=OfferParty.CREATOR if is_creator else OfferParty.BRAND,
    )
    db.add(review)

    # Deliberately says nothing about the rating. Reviews are double-blind
    # until both sides submit or REVIEW_REVEAL_DAYS passes, and a notification
    # reading "you got 2 stars" would walk straight through that.
    await notify(
        db,
        user_id=counterpart_id(interest, current_user.id),
        kind=NotificationKind.REVIEW,
        title="You have a review waiting",
        body="The other side reviewed this deal. Yours stays hidden from them "
             "until you submit, and theirs stays hidden from you.",
        link=thread_link(interest_id),
        interest_id=interest_id,
    )

    try:
        await db.commit()
    except IntegrityError:
        # uq_review_author_interest — a double submit, or two tabs.
        await db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "You have already reviewed this deal."
        )

    logger.info(
        "User {} reviewed interest {} ({} stars)", current_user.id, interest_id, data.rating
    )

    return await get_reviews(interest_id, db, current_user)


@router.get("/reviews/user/{user_id}", response_model=PublicReviews)
async def public_reviews(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    A user's track record: revealed reviews only.

    Hidden reviews are excluded from the count as well as the list — including
    them would leak their contents, since an average that shifts the moment
    somebody submits says exactly what they wrote.
    """
    received = list((await db.execute(
        select(DealReview).where(DealReview.subject_id == user_id)
        .order_by(DealReview.created_at.desc())
    )).scalars().all())

    if not received:
        return PublicReviews(user_id=user_id)

    # A review reveals once its counterpart exists, so check per deal.
    by_interest: dict[int, list[DealReview]] = defaultdict(list)
    for r in (await db.execute(
        select(DealReview).where(
            DealReview.interest_id.in_([r.interest_id for r in received])
        )
    )).scalars().all():
        by_interest[r.interest_id].append(r)

    visible = [
        r for r in received
        if is_revealed(r, both_submitted=len(by_interest.get(r.interest_id, [])) >= 2)
    ]

    summary = summarise(visible)
    return PublicReviews(
        user_id=user_id,
        average_rating=summary["average_rating"],
        review_count=summary["review_count"],
        reviews=[_review_out(r) for r in visible],
    )
