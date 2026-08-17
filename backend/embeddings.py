from __future__ import annotations

import json
import logging
import math
import time
import urllib.error
import urllib.request
from typing import Literal

from config import get_settings


logger = logging.getLogger(__name__)
_API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
_BATCH_SIZE = 50
_MAX_RETRIES = 4

EmbedTask = Literal["document", "query"]


def _embedding_api_key() -> str:
    settings = get_settings()
    key = settings.gemini_embedding_api_key or settings.gemini_api_key
    if not key:
        raise RuntimeError(
            "GEMINI_EMBEDDING_API_KEY (or GEMINI_API_KEY fallback) is required "
            "for embeddings"
        )
    return key


def _model_id() -> str:
    name = get_settings().gemini_embedding_model.strip()
    if name.startswith("models/"):
        return name
    return f"models/{name}"


def _is_embedding_v2(model_id: str) -> bool:
    return "embedding-2" in model_id


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def _prepare_text(
    text: str,
    *,
    task: EmbedTask,
    title: str | None,
    model_id: str,
) -> str:
    cleaned = text.strip()
    if not _is_embedding_v2(model_id):
        return cleaned
    if task == "query":
        return f"task: question answering | query: {cleaned}"
    heading = title.strip() if title and title.strip() else "none"
    return f"title: {heading} | text: {cleaned}"


def _post_json(path: str, payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        request = urllib.request.Request(
            f"{_API_ROOT}/{path}",
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": _embedding_api_key(),
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last_error = exc
            detail = exc.read().decode("utf-8", errors="replace")
            retryable = exc.code in {408, 429, 500, 502, 503, 504}
            logger.warning(
                "Embedding API HTTP %s (attempt %s/%s): %s",
                exc.code,
                attempt + 1,
                _MAX_RETRIES,
                detail[:400],
            )
            if not retryable or attempt == _MAX_RETRIES - 1:
                raise RuntimeError(
                    f"Gemini embedding request failed ({exc.code}): {detail[:800]}"
                ) from exc
            time.sleep(2 ** attempt)
        except urllib.error.URLError as exc:
            last_error = exc
            if attempt == _MAX_RETRIES - 1:
                raise RuntimeError(f"Gemini embedding request failed: {exc}") from exc
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Gemini embedding request failed: {last_error}")


def _extract_values(embedding: dict) -> list[float]:
    values = embedding.get("values")
    if not isinstance(values, list) or not values:
        raise RuntimeError("Gemini embedding response did not include vector values")
    return [float(value) for value in values]


def embed_texts(
    texts: list[str],
    *,
    task: EmbedTask,
    titles: list[str | None] | None = None,
) -> list[list[float]]:
    if not texts:
        return []

    settings = get_settings()
    model_id = _model_id()
    use_v2 = _is_embedding_v2(model_id)
    dimension = settings.embedding_dimension
    heading_list = titles or [None] * len(texts)
    if len(heading_list) != len(texts):
        raise ValueError("titles must be the same length as texts")

    vectors: list[list[float]] = []
    for start in range(0, len(texts), _BATCH_SIZE):
        batch_texts = texts[start : start + _BATCH_SIZE]
        batch_titles = heading_list[start : start + _BATCH_SIZE]
        requests = []
        for text, title in zip(batch_texts, batch_titles):
            item: dict = {
                "model": model_id,
                "content": {
                    "parts": [
                        {
                            "text": _prepare_text(
                                text,
                                task=task,
                                title=title,
                                model_id=model_id,
                            )
                        }
                    ]
                },
                "outputDimensionality": dimension,
            }
            if not use_v2:
                item["taskType"] = (
                    "RETRIEVAL_DOCUMENT" if task == "document" else "RETRIEVAL_QUERY"
                )
                if task == "document" and title and title.strip():
                    item["title"] = title.strip()[:100]
            requests.append(item)

        payload = _post_json(
            f"{model_id}:batchEmbedContents",
            {"requests": requests},
        )
        embeddings = payload.get("embeddings")
        if not isinstance(embeddings, list) or len(embeddings) != len(batch_texts):
            raise RuntimeError(
                "Gemini batch embedding response size did not match request size"
            )
        for embedding in embeddings:
            vector = _extract_values(embedding)
            if len(vector) != dimension:
                raise RuntimeError(
                    f"Expected embedding dimension {dimension}, got {len(vector)}"
                )
            # gemini-embedding-001 needs manual L2 norm below 3072 dims.
            if not use_v2 and dimension != 3072:
                vector = _l2_normalize(vector)
            elif use_v2 and dimension == 3072:
                vector = _l2_normalize(vector)
            vectors.append(vector)
    return vectors


def embed_text(text: str, *, task: EmbedTask, title: str | None = None) -> list[float]:
    return embed_texts([text], task=task, titles=[title])[0]
