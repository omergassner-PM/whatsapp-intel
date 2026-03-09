"""
Article notes routes — create, list, update, delete notes per article.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.auth import get_current_user
from src.api.database import get_db
from src.api.schemas import CreateNoteRequest, NoteOut, UpdateNoteRequest
from src.database.models import Article, ArticleNote, User

router = APIRouter(prefix="/articles", tags=["notes"])


@router.get("/{article_id}/notes", response_model=list[NoteOut])
def list_notes(
    article_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
) -> list[NoteOut]:
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    notes = (
        db.query(ArticleNote, User)
        .join(User, User.id == ArticleNote.user_id)
        .filter(ArticleNote.article_id == article_id)
        .order_by(ArticleNote.created_at.desc())
        .all()
    )
    return [
        NoteOut(
            id=note.id,
            article_id=note.article_id,
            user_id=note.user_id,
            username=user.display_name or user.username,
            content=note.content,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
        for note, user in notes
    ]


@router.post("/{article_id}/notes", response_model=NoteOut, status_code=201)
def create_note(
    article_id: UUID,
    body: CreateNoteRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NoteOut:
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    note = ArticleNote(
        article_id=article_id,
        user_id=current_user.id,
        content=body.content,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return NoteOut(
        id=note.id,
        article_id=note.article_id,
        user_id=note.user_id,
        username=current_user.display_name or current_user.username,
        content=note.content,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.put("/notes/{note_id}", response_model=NoteOut)
def update_note(
    note_id: UUID,
    body: UpdateNoteRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NoteOut:
    note = db.query(ArticleNote).filter(ArticleNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed to edit this note")

    note.content = body.content
    db.commit()
    db.refresh(note)

    user = db.query(User).filter(User.id == note.user_id).first()
    return NoteOut(
        id=note.id,
        article_id=note.article_id,
        user_id=note.user_id,
        username=user.display_name or user.username if user else None,
        content=note.content,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(
    note_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    note = db.query(ArticleNote).filter(ArticleNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed to delete this note")

    db.delete(note)
    db.commit()
