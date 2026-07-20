# 📄 Project Overview: Law-Maker Web Application

This application aims to be a sophisticated legal document analysis tool, utilizing Retrieval Augmented Generation (RAG) on uploaded documents (PDFs).

## ✨ Core Features
*   **Text Chat:** Conversational Q&A based on the user's provided knowledge base.
*   **PDF Upload & Processing:** Ability for users to upload one or more PDF legal documents.
*   **PDF Renderer/Viewer:** Displaying the content of uploaded PDFs for context and verification.

## 🏗️ System Architecture Plan

We are adopting a decoupled client-server architecture:

1.  **Frontend (Client):** Built with React/Next.js, responsible for UI/UX, file handling, and displaying chat history.
2.  **Backend API (Python):** Built with FastAPI, serves as the orchestration layer, handling all heavy lifting: document parsing, embedding, and interacting with the LLM and Vector Store.

### 🌐 Recommended Technology Stack

| Component | Technology | Purpose / Why? |
| :--- | :--- | :--- |
| **Frontend (Web)** | React/Next.js + Tailwind CSS | Industry standard for complex UIs; Next.js simplifies routing and API integration. |
| **Backend Core** | Python (FastAPI) | Excellent for rapid development, especially with AI/ML libraries (LangChain, LlamaIndex). |
| **RAG Pipeline Logic**| LangChain / LlamaIndex + ChromaDB/Pinecone | Manages robust document loading, chunking, embedding, and vector storage. |
| **PDF Handling** | `pypdf` (Python) + JS PDF Library (Client) | Robust libraries for server-side parsing and client-side rendering. |

---

### 💾 Phase Breakdown & Implementation Plan

#### 📚 Phase 1: Backend Setup & Data Ingestion (The RAG Core)
*   **Goal:** Establish the pipeline to ingest PDFs into a searchable knowledge base.
*   **Key Endpoint:** `POST /api/upload_pdf`
    1.  Accepts uploaded PDF file.
    2.  Uses `pypdf` or similar library to extract raw text, page by page.
    3.  Splits the document into semantically meaningful chunks (e.g., 500 tokens with overlap).
    4.  Generates embeddings for all chunks using an external model (e.g., OpenAI/Cohere).
    5.  Stores the vector and corresponding text chunk metadata in a **Vector Database** (e.g., ChromaDB).

#### 🗣️ Phase 2: Text Chat & Retrieval (RAG Execution)
*   **Goal:** Implement the core Q&A mechanism that uses uploaded documents as context.
*   **Key Endpoint:** `GET /api/chat?query=<user_query>`
    1.  Receives the user's natural language query.
    2.  Generates an embedding for the query.
    3.  Queries the Vector DB to retrieve the $K$ most relevant chunks (the context).
    4.  Sends a detailed prompt to the LLM: "Using ONLY the following context, answer this question."
    5.  Returns the summarized and grounded answer to the frontend.

#### 🖥️ Phase 3: Frontend Integration & UX
*   **Goal:** Build a smooth user experience that ties all services together.
*   **Components:**
    *   **Upload Component:** Handles drag-and-drop file selection and calls `/api/upload_pdf`.
    *   **Chat Interface:** Displays conversation history (user messages vs. AI responses).
    *   **Metadata Display:** Shows which documents are currently loaded into the RAG system.

### 🔗 Feature Mapping Summary

| User Requirement | Technical Implementation | Impacted Phase |
| :--- | :--- | :--- |
| **PDF Upload** | Document Parsing & Vector Store Insertion | Phase 1 |
| **Text Chat (RAG)**| Retrieval and LLM Generation Pipeline | Phase 2 |
| **PDF Renderer** | Client-side rendering of PDF content or page summaries. | Phase 3 |

***

## ✅ Next Steps for Development
To begin building, we must establish the backend foundation. I suggest scaffolding the project structure (FastAPI/Python) and implementing the basic file upload logic first. Would you like me to proceed with creating the files?