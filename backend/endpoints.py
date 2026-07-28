from __future__ import annotations

from datetime import datetime
import json
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from models import ChatMessage as ChatMessageModel, Document
from rag import generate_answer, generate_answer_stream, ingest_pdf_document, search_chunks
from storage import get_pdf_file, delete_pdf_file, file_exists
import google.generativeai as genai


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


class ChatHistoryMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    timestamp: datetime
    sources: list[SourceChunkResponse] = Field(default_factory=list)


class ChatHistoryClearResponse(BaseModel):
    ok: bool
    deleted: int


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


def _decode_sources(sources_json: str | None) -> list[SourceChunkResponse]:
    if not sources_json:
        return []
    try:
        raw = json.loads(sources_json)
    except json.JSONDecodeError:
        return []
    if not isinstance(raw, list):
        return []

    sources: list[SourceChunkResponse] = []
    for item in raw:
        try:
            sources.append(SourceChunkResponse.model_validate(item))
        except Exception:
            continue
    return sources


def _chat_message_to_response(message: ChatMessageModel) -> ChatHistoryMessageResponse:
    return ChatHistoryMessageResponse(
        id=message.id,
        role=message.role,
        content=message.content,
        timestamp=message.created_at,
        sources=_decode_sources(message.sources_json),
    )


def _persist_chat_turn(
    db: Session,
    session_id: str,
    query: str,
    answer: str,
    source_models: list[SourceChunkResponse],
) -> None:
    serialized_sources = json.dumps([item.model_dump() for item in source_models], ensure_ascii=False)
    user_message = ChatMessageModel(
        id=str(uuid4()),
        session_id=session_id,
        role="user",
        content=query,
        sources_json=None,
    )
    assistant_message = ChatMessageModel(
        id=str(uuid4()),
        session_id=session_id,
        role="assistant",
        content=answer,
        sources_json=serialized_sources,
    )
    db.add_all([user_message, assistant_message])
    try:
        db.commit()
    except Exception:
        db.rollback()


@router.get("/chat/history", response_model=list[ChatHistoryMessageResponse])
async def get_chat_history(
    session_id: str = Query(..., alias="sessionId", min_length=8, max_length=120),
    db: Session = Depends(get_db),
):
    stmt = (
        select(ChatMessageModel)
        .where(ChatMessageModel.session_id == session_id)
        .order_by(ChatMessageModel.created_at.asc())
    )
    messages = db.scalars(stmt).all()
    return [_chat_message_to_response(message) for message in messages]


@router.delete("/chat/history", response_model=ChatHistoryClearResponse)
async def clear_chat_history(
    session_id: str = Query(..., alias="sessionId", min_length=8, max_length=120),
    db: Session = Depends(get_db),
):
    stmt = select(ChatMessageModel).where(ChatMessageModel.session_id == session_id)
    messages = db.scalars(stmt).all()
    deleted_count = len(messages)
    for message in messages:
        db.delete(message)
    db.commit()
    return ChatHistoryClearResponse(ok=True, deleted=deleted_count)


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
    
    try:
        if not file_exists(doc.source_path):
            raise HTTPException(
                status_code=404,
                detail={"error": "SOURCE_NOT_FOUND", "detail": "Source file does not exist."},
            )
        
        content = get_pdf_file(doc.source_path)
        
        # Safely encode filename for Content-Disposition header
        filename = doc.name.encode("utf-8").decode("ascii", errors="ignore") or "document.pdf"
        if not filename or not filename.strip():
            filename = "document.pdf"
        
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=\"{filename}\"",
                "Cache-Control": "public, max-age=86400",
            }
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={"error": "SOURCE_NOT_FOUND", "detail": "Source file does not exist."},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "FILE_RETRIEVAL_FAILED", "detail": str(exc)},
        ) from exc


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

    # Delete associated file from storage
    if doc.source_path:
        try:
            delete_pdf_file(doc.source_path)
        except Exception as exc:
            # Log error but don't fail the delete operation
            print(f"Warning: Failed to delete file {doc.source_path}: {exc}")

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
    session_id: str | None = Query(None, alias="sessionId", min_length=8, max_length=120),
    level: str | None = Query(None),
    subject: str | None = Query(None),
    document_id: str | None = Query(None, alias="documentId"),
    stream: bool = Query(True),
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
    source_models = [
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

    if not stream:
        answer = generate_answer(query, sources)
        if session_id:
            _persist_chat_turn(db, session_id, query, answer, source_models)
        return ChatResponse(answer=answer, sources=source_models)

    def event_stream():
        chunks: list[str] = []
        for delta in generate_answer_stream(query, sources):
            chunks.append(delta)
            yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"

        answer = "".join(chunks).strip()
        if not answer:
            answer = generate_answer(query, sources)

        if session_id:
            _persist_chat_turn(db, session_id, query, answer, source_models)

        final_payload = {
            "answer": answer,
            "sources": [item.model_dump() for item in source_models],
        }
        yield f"data: {json.dumps(final_payload, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
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


@router.get("/debug/gemini")
async def debug_gemini():
    """Test Gemini API connectivity and configuration."""
    if not settings.gemini_api_key:
        return {"status": "error", "message": "GEMINI_API_KEY not configured"}
    
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)
        
        # Test with a simple prompt
        test_prompt = "Respond with: 'Gemini API is working correctly.'"
        response = model.generate_content(test_prompt)
        
        return {
            "status": "success",
            "message": "Gemini API is working",
            "model": settings.gemini_model,
            "response": response.text if response else "Empty response",
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Gemini API error: {type(e).__name__}: {str(e)}",
            "model": settings.gemini_model,
        }

