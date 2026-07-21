from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from models import Document
from rag import generate_answer, ingest_pdf_document, search_chunks


router = APIRouter(prefix="/api")
settings = get_settings()
ALLOWED_LEVELS = {"global", "per_subject", "personal"}


class ErrorResponse(BaseModel):
    error: str
    detail: str


class DocumentResponse(BaseModel):
    id: str
    name: str
    size: int
    uploadedAt: datetime
    status: str
    pageCount: int | None = None
    level: str
    subject: str
    userId: str | None = None
    language: str
    sourceFileUrl: str | None = None


class SourceChunkResponse(BaseModel):
    chunkId: str
    documentId: str
    documentName: str
    page: int
    pageStart: int
    pageEnd: int
    clauseId: str | None = None
    clauseHeading: str | None = None
    text: str
    score: float
    sourceUrl: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceChunkResponse]


def _to_document_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        name=doc.name,
        size=doc.size,
        uploadedAt=doc.created_at,
        status=doc.status,
        pageCount=doc.page_count,
        level=doc.level,
        subject=doc.subject,
        userId=doc.user_id,
        language=doc.language,
        sourceFileUrl=f"/api/documents/{doc.id}/file" if doc.source_path else None,
    )


def _scope_clause(user_id: str | None):
    if user_id:
        return or_(
            Document.level == "global",
            Document.level == "per_subject",
            and_(Document.level == "personal", Document.user_id == user_id),
        )
    return or_(Document.level == "global", Document.level == "per_subject")


def _authorized_document(
    db: Session,
    document_id: str,
    user_id: str | None,
) -> Document:
    stmt = select(Document).where(Document.id == document_id).where(_scope_clause(user_id))
    doc = db.scalar(stmt)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_NOT_FOUND", "detail": "Document not found."},
        )
    return doc


@router.post(
    "/upload_pdf",
    response_model=DocumentResponse,
    responses={400: {"model": ErrorResponse}, 413: {"model": ErrorResponse}},
)
async def upload_pdf(
    file: UploadFile = File(...),
    level: str = Form("global"),
    subject: str | None = Form(None),
    user_id: str | None = Header(None, alias="x-user-id"),
    db: Session = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail={"error": "UNSUPPORTED_FILE_TYPE", "detail": "Only PDF uploads are supported."},
        )
    level = level.strip().lower()
    if level not in ALLOWED_LEVELS:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_LEVEL", "detail": "level must be global, per_subject, or personal."},
        )
    if level == "personal" and not user_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "USER_ID_REQUIRED", "detail": "x-user-id header is required for personal uploads."},
        )

    content = await file.read()
    limit = settings.max_upload_mb * 1024 * 1024
    if len(content) > limit:
        raise HTTPException(
            status_code=413,
            detail={
                "error": "UPLOAD_SIZE_EXCEEDED",
                "detail": f"File exceeds {settings.max_upload_mb} MB upload limit.",
            },
        )

    try:
        document = ingest_pdf_document(
            db,
            filename=file.filename or "document.pdf",
            mime_type=file.content_type,
            content=content,
            level=level,
            subject=(subject or settings.default_subject).strip() or settings.default_subject,
            user_id=user_id,
        )
        return _to_document_response(document)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "PDF_PARSE_FAILED", "detail": str(exc)},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "UPLOAD_PROCESSING_FAILED", "detail": str(exc)},
        ) from exc


@router.get("/documents", response_model=list[DocumentResponse])
async def list_documents(
    user_id: str | None = Header(None, alias="x-user-id"),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Document)
        .where(_scope_clause(user_id))
        .order_by(desc(Document.created_at))
    )
    docs = db.scalars(stmt).all()
    return [_to_document_response(doc) for doc in docs]


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    user_id: str | None = Header(None, alias="x-user-id"),
    db: Session = Depends(get_db),
):
    doc = _authorized_document(db, document_id, user_id)
    return _to_document_response(doc)


@router.get("/documents/{document_id}/source-link")
async def get_document_source_link(
    document_id: str,
    page: int = Query(1, ge=1),
    user_id: str | None = Header(None, alias="x-user-id"),
    db: Session = Depends(get_db),
):
    doc = _authorized_document(db, document_id, user_id)
    if not doc.source_path:
        raise HTTPException(
            status_code=404,
            detail={"error": "SOURCE_NOT_FOUND", "detail": "Source file not found."},
        )
    return {
        "documentId": doc.id,
        "sourceUrl": f"/api/documents/{doc.id}/file?page={page}",
        "expiresInSeconds": settings.source_url_ttl_seconds,
    }


@router.get("/documents/{document_id}/file")
async def stream_document_file(
    document_id: str,
    user_id: str | None = Header(None, alias="x-user-id"),
    db: Session = Depends(get_db),
):
    doc = _authorized_document(db, document_id, user_id)
    if not doc.source_path:
        raise HTTPException(
            status_code=404,
            detail={"error": "SOURCE_NOT_FOUND", "detail": "Source file path missing."},
        )
    file_path = Path(doc.source_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": "SOURCE_NOT_FOUND", "detail": "Source file does not exist."},
        )
    return FileResponse(
        path=str(file_path),
        filename=doc.name,
        media_type=doc.mime_type,
    )


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    user_id: str | None = Header(None, alias="x-user-id"),
    db: Session = Depends(get_db),
):
    stmt = select(Document).where(Document.id == document_id)
    doc = db.scalar(stmt)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail={"error": "DOCUMENT_NOT_FOUND", "detail": "Document not found."},
        )

    if doc.level == "personal" and doc.user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail={"error": "FORBIDDEN", "detail": "Cannot delete another user's personal document."},
        )

    db.delete(doc)
    db.commit()
    return {"ok": True, "deletedDocumentId": document_id}


@router.get(
    "/chat",
    response_model=ChatResponse,
    responses={400: {"model": ErrorResponse}},
)
async def chat(
    query: str = Query(..., min_length=2),
    level: str | None = Query(None),
    subject: str | None = Query(None),
    document_id: str | None = Query(None, alias="documentId"),
    user_id: str | None = Header(None, alias="x-user-id"),
    db: Session = Depends(get_db),
):
    if level is not None:
        level = level.strip().lower()
        if level not in ALLOWED_LEVELS:
            raise HTTPException(
                status_code=400,
                detail={"error": "INVALID_LEVEL", "detail": "Invalid level filter."},
            )
    if level == "personal" and not user_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "USER_ID_REQUIRED", "detail": "x-user-id header is required for personal scope."},
        )

    sources = search_chunks(
        db,
        query=query,
        level=level,
        subject=subject,
        user_id=user_id,
        document_id=document_id,
        top_k=settings.default_top_k,
    )
    answer = generate_answer(query, sources)
    return ChatResponse(
        answer=answer,
        sources=[
            SourceChunkResponse(
                chunkId=item.chunk_id,
                documentId=item.document_id,
                documentName=item.document_name,
                page=item.page,
                pageStart=item.page_start,
                pageEnd=item.page_end,
                clauseId=item.clause_id,
                clauseHeading=item.clause_heading,
                text=item.text,
                score=round(item.score, 4),
                sourceUrl=f"/api/documents/{item.document_id}/file?page={item.page}",
            )
            for item in sources
        ],
    )


@router.get("/search", response_model=list[SourceChunkResponse])
async def search(
    query: str = Query(..., min_length=2),
    level: str | None = Query(None),
    subject: str | None = Query(None),
    document_id: str | None = Query(None, alias="documentId"),
    limit: int = Query(6, ge=1, le=25),
    user_id: str | None = Header(None, alias="x-user-id"),
    db: Session = Depends(get_db),
):
    sources = search_chunks(
        db,
        query=query,
        level=level,
        subject=subject,
        user_id=user_id,
        document_id=document_id,
        top_k=limit,
    )
    return [
        SourceChunkResponse(
            chunkId=item.chunk_id,
            documentId=item.document_id,
            documentName=item.document_name,
            page=item.page,
            pageStart=item.page_start,
            pageEnd=item.page_end,
            clauseId=item.clause_id,
            clauseHeading=item.clause_heading,
            text=item.text,
            score=round(item.score, 4),
            sourceUrl=f"/api/documents/{item.document_id}/file?page={item.page}",
        )
        for item in sources
    ]

