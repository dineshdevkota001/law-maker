from __future__ import annotations

import io
from pathlib import Path
import re
import uuid
from dataclasses import dataclass

from deep_translator import GoogleTranslator
import google.generativeai as genai
from langdetect import LangDetectException, detect
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from config import get_settings
from models import Chunk, Document


settings = get_settings()
_embedder: SentenceTransformer | None = None
_RRF_K = 60


@dataclass
class ClauseSegment:
    clause_id: str
    clause_heading: str | None
    page_start: int
    page_end: int
    text: str


def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(settings.embedding_model_name)
    return _embedder


def _detect_lang(text: str) -> str:
    sample = text.strip()[:1000]
    if not sample:
        return "unknown"
    try:
        lang = detect(sample)
    except LangDetectException:
        return "unknown"
    return "ne" if lang == "ne" else "en" if lang == "en" else "unknown"


def _gemini_client() -> bool:
    if not settings.gemini_api_key:
        return False
    genai.configure(api_key=settings.gemini_api_key)
    return True


def _translate(query: str, target_lang: str) -> str | None:
    if _gemini_client():
        try:
            model = genai.GenerativeModel(settings.gemini_model)
            prompt = (
                "Translate the following legal search query to "
                f"{target_lang}. Return translation only.\n\n{query}"
            )
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception:
            pass
    try:
        return GoogleTranslator(target=target_lang).translate(query)
    except Exception:
        return None


def build_query_variants(query: str) -> list[str]:
    query = query.strip()
    if not query:
        return []
    variants = {query}
    query_lang = _detect_lang(query)
    if query_lang == "en":
        ne = _translate(query, "ne")
        if ne:
            variants.add(ne)
    elif query_lang == "ne":
        en = _translate(query, "en")
        if en:
            variants.add(en)
    else:
        maybe_en = _translate(query, "en")
        maybe_ne = _translate(query, "ne")
        if maybe_en:
            variants.add(maybe_en)
        if maybe_ne:
            variants.add(maybe_ne)
    return list(variants)


def _split_clause_text(clause_text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1400,
        chunk_overlap=140,
        separators=["\n\n", "\n", ". ", "। ", " "],
    )
    return [c.strip() for c in splitter.split_text(clause_text) if c and c.strip()]


def _is_clause_heading(line: str) -> bool:
    heading_patterns = [
        r"^दफा\s*\d+",
        r"^धारा\s*\d+",
        r"^उपदफा\s*\(?\d+\)?",
        r"^परिच्छेद\s*\d+",
        r"^अनुसूची\s*\d+",
        r"^section\s*\d+",
        r"^article\s*\d+",
        r"^chapter\s*\d+",
        r"^sub\s*-?section\s*\(?\d+\)?",
        r"^schedule\s*\d+",
    ]
    lowered = line.strip().lower()
    return any(re.match(p, lowered) for p in heading_patterns)


def _segment_page_into_clauses(page_text: str, page_no: int) -> list[ClauseSegment]:
    lines = [line.strip() for line in page_text.splitlines()]
    lines = [line for line in lines if line]
    if not lines:
        return []

    clauses: list[ClauseSegment] = []
    current_heading: str | None = None
    current_lines: list[str] = []
    clause_counter = 0

    def flush() -> None:
        nonlocal clause_counter, current_lines, current_heading
        text = "\n".join(current_lines).strip()
        if not text:
            return
        clause_counter += 1
        clauses.append(
            ClauseSegment(
                clause_id=f"p{page_no}-c{clause_counter}",
                clause_heading=current_heading,
                page_start=page_no,
                page_end=page_no,
                text=text,
            )
        )

    for line in lines:
        if _is_clause_heading(line):
            if current_lines:
                flush()
                current_lines = []
            current_heading = line
        current_lines.append(line)

    flush()
    return clauses


def _extract_pdf_pages(file_bytes: bytes) -> list[tuple[int, str]]:
    reader = PdfReader(io.BytesIO(file_bytes))
    pages: list[tuple[int, str]] = []
    for idx, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        pages.append((idx, text))
    return pages


def _storage_root() -> Path:
    base_dir = Path(__file__).resolve().parent
    path = Path(settings.pdf_storage_dir)
    if not path.is_absolute():
        path = base_dir / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_filename(filename: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename).strip("._")
    return name or "document.pdf"


def _save_pdf_source(document_id: str, filename: str, content: bytes) -> str:
    storage_dir = _storage_root()
    safe_name = _safe_filename(filename)
    file_path = storage_dir / f"{document_id}_{safe_name}"
    with open(file_path, "wb") as fh:
        fh.write(content)
    return str(file_path)


def _tokenize_for_lexical(text: str) -> list[str]:
    return re.findall(r"[\w\u0900-\u097F]+", text.lower())


def _lexical_overlap_score(query: str, text: str) -> float:
    q_terms = {t for t in _tokenize_for_lexical(query) if len(t) >= 2}
    if not q_terms:
        return 0.0
    t_terms = set(_tokenize_for_lexical(text))
    if not t_terms:
        return 0.0
    return len(q_terms & t_terms) / len(q_terms)


def ingest_pdf_document(
    db: Session,
    *,
    filename: str,
    mime_type: str,
    content: bytes,
    level: str,
    subject: str,
    user_id: str | None,
) -> Document:
    doc = Document(
        id=str(uuid.uuid4()),
        name=filename,
        size=len(content),
        mime_type=mime_type,
        status="processing",
        level=level,
        subject=subject,
        user_id=user_id,
        language="unknown",
        chunk_count=0,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        doc.source_path = _save_pdf_source(doc.id, filename, content)
        pages = _extract_pdf_pages(content)
        all_text = "\n".join(text for _, text in pages).strip()
        if not all_text:
            raise ValueError("No extractable text found in this PDF")

        doc.language = _detect_lang(all_text)
        doc.page_count = len(pages)

        embedder = get_embedder()
        chunk_count = 0
        chunk_index = 0
        for page_no, text in pages:
            clauses = _segment_page_into_clauses(text, page_no)
            if not clauses:
                clauses = [
                    ClauseSegment(
                        clause_id=f"p{page_no}-c1",
                        clause_heading=None,
                        page_start=page_no,
                        page_end=page_no,
                        text=text,
                    )
                ]

            for clause in clauses:
                clause_chunks = _split_clause_text(clause.text)
                if not clause_chunks:
                    clause_chunks = [clause.text]
                for chunk_text in clause_chunks:
                    chunk_index += 1
                    vector = embedder.encode(chunk_text, normalize_embeddings=True).tolist()
                    chunk = Chunk(
                        id=str(uuid.uuid4()),
                        document_id=doc.id,
                        page=clause.page_start,
                        page_start=clause.page_start,
                        page_end=clause.page_end,
                        chunk_index=chunk_index,
                        clause_id=clause.clause_id,
                        clause_heading=clause.clause_heading,
                        text=chunk_text,
                        language=doc.language,
                        embedding=vector,
                    )
                    db.add(chunk)
                    chunk_count += 1

        if chunk_count == 0:
            raise ValueError("PDF parsed but produced zero chunks")

        doc.status = "ready"
        doc.chunk_count = chunk_count
        doc.error_message = None
        db.commit()
        db.refresh(doc)
        return doc
    except Exception as exc:
        doc.status = "error"
        doc.error_message = str(exc)
        db.commit()
        db.refresh(doc)
        raise


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    document_name: str
    page: int
    page_start: int
    page_end: int
    clause_id: str | None
    clause_heading: str | None
    text: str
    score: float


def _scope_filter(
    *,
    level: str | None,
    subject: str | None,
    user_id: str | None,
):
    if level == "global":
        return Document.level == "global"
    if level == "per_subject":
        if subject:
            return and_(Document.level == "per_subject", Document.subject == subject)
        return Document.level == "per_subject"
    if level == "personal":
        if not user_id:
            return and_(Document.level == "personal", Document.user_id == "__missing__")
        return and_(Document.level == "personal", Document.user_id == user_id)

    if user_id:
        return or_(
            Document.level == "global",
            Document.level == "per_subject",
            and_(Document.level == "personal", Document.user_id == user_id),
        )
    return or_(Document.level == "global", Document.level == "per_subject")


def search_chunks(
    db: Session,
    *,
    query: str,
    level: str | None,
    subject: str | None,
    user_id: str | None,
    document_id: str | None,
    top_k: int,
) -> list[RetrievedChunk]:
    variants = build_query_variants(query)
    if not variants:
        return []

    embedder = get_embedder()
    best_by_chunk: dict[str, RetrievedChunk] = {}
    fused_scores: dict[str, float] = {}

    for q in variants:
        vec = embedder.encode(q, normalize_embeddings=True).tolist()
        distance = Chunk.embedding.cosine_distance(vec)
        candidate_limit = max(top_k * 10, 40)
        stmt = (
            select(Chunk, Document, distance.label("distance"))
            .join(Document, Chunk.document_id == Document.id)
            .where(Document.status == "ready")
            .where(_scope_filter(level=level, subject=subject, user_id=user_id))
            .order_by(distance)
            .limit(candidate_limit)
        )
        if document_id:
            stmt = stmt.where(Document.id == document_id)
        rows = db.execute(stmt).all()

        vector_rank: dict[str, int] = {}
        for rank, (chunk, doc, dist) in enumerate(rows, start=1):
            vector_rank[chunk.id] = rank
            score = max(0.0, min(1.0, 1.0 - float(dist)))
            current = best_by_chunk.get(chunk.id)
            if current is None or score > current.score:
                best_by_chunk[chunk.id] = RetrievedChunk(
                    chunk_id=chunk.id,
                    document_id=doc.id,
                    document_name=doc.name,
                    page=chunk.page,
                    page_start=chunk.page_start,
                    page_end=chunk.page_end,
                    clause_id=chunk.clause_id,
                    clause_heading=chunk.clause_heading,
                    text=chunk.text,
                    score=score,
                )

        lexical_rank: dict[str, int] = {}
        lexical_terms = [t for t in _tokenize_for_lexical(q) if len(t) >= 2][:8]
        if lexical_terms:
            lexical_predicates = [Chunk.text.ilike(f"%{term}%") for term in lexical_terms]
            lexical_stmt = (
                select(Chunk, Document)
                .join(Document, Chunk.document_id == Document.id)
                .where(Document.status == "ready")
                .where(_scope_filter(level=level, subject=subject, user_id=user_id))
                .where(or_(*lexical_predicates))
                .limit(candidate_limit * 2)
            )
            if document_id:
                lexical_stmt = lexical_stmt.where(Document.id == document_id)
            lexical_rows = db.execute(lexical_stmt).all()
            lexical_scored: list[tuple[str, float]] = []
            for chunk, doc in lexical_rows:
                lex_score = _lexical_overlap_score(q, chunk.text)
                lexical_scored.append((chunk.id, lex_score))
                if chunk.id not in best_by_chunk:
                    best_by_chunk[chunk.id] = RetrievedChunk(
                        chunk_id=chunk.id,
                        document_id=doc.id,
                        document_name=doc.name,
                        page=chunk.page,
                        page_start=chunk.page_start,
                        page_end=chunk.page_end,
                        clause_id=chunk.clause_id,
                        clause_heading=chunk.clause_heading,
                        text=chunk.text,
                        score=0.0,
                    )
            lexical_scored.sort(key=lambda item: item[1], reverse=True)
            for rank, (chunk_id, _) in enumerate(lexical_scored, start=1):
                lexical_rank[chunk_id] = rank

        all_candidates = set(vector_rank) | set(lexical_rank)
        for chunk_id in all_candidates:
            rrf_score = 0.0
            if chunk_id in vector_rank:
                rrf_score += 1.0 / (_RRF_K + vector_rank[chunk_id])
            if chunk_id in lexical_rank:
                rrf_score += 1.0 / (_RRF_K + lexical_rank[chunk_id])
            fused_scores[chunk_id] = fused_scores.get(chunk_id, 0.0) + rrf_score

    ranked = sorted(
        best_by_chunk.values(),
        key=lambda item: (fused_scores.get(item.chunk_id, 0.0), item.score),
        reverse=True,
    )
    return ranked[:top_k]


def generate_answer(query: str, sources: list[RetrievedChunk]) -> str:
    if not sources:
        return (
            "I could not find relevant legal context in the indexed documents. "
            "Please upload more relevant documents or refine your query."
        )

    context_parts = []
    for idx, source in enumerate(sources, start=1):
        heading = f" ({source.clause_heading})" if source.clause_heading else ""
        page_display = (
            str(source.page_start)
            if source.page_start == source.page_end
            else f"{source.page_start}-{source.page_end}"
        )
        context_parts.append(
            f"[{idx}] Document: {source.document_name}{heading}, Page: {page_display}\n{source.text}"
        )
    context = "\n\n".join(context_parts)

    if _gemini_client():
        model = genai.GenerativeModel(settings.gemini_model)
        prompt = (
            "You are a legal assistant for Nepal law documents. "
            "Answer in the same language as the user query (Nepali or English). "
            "Use only the provided context. If uncertain, say what is missing.\n\n"
            f"User query:\n{query}\n\n"
            f"Context:\n{context}\n\n"
            "Provide a concise answer with a short evidence summary."
        )
        try:
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception:
            pass

    return sources[0].text














