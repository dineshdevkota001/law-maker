Phase 1: Backend Core Logic Refactoring (The Engine)

  The goal is to transform law-maker/backend/main.py from mock stubs into fully functional RAG endpoints.

  Step 1.1: Configuration & Utility Layer (utils/llm_manager.py - To be created)

  - Task: Create a new service file responsible for abstracting all external API calls.
  - Details: Implement get_embedding(text) and generate_response(context, prompt). This function must check which key is available (GEMINI_API_KEY or
  OPENAI_API_KEY) and route the call to the appropriate SDK (Google GenAI SDK or OpenAI client).

  Step 1.2: PDF Ingestion Endpoint Update (law-maker/backend/main.py)

  - Goal: Replace placeholder logic in the /upload endpoint.
  - Steps:
    a. Use pypdf to extract raw text, as before.
    b. Iterate through chunks and call llm_manager.get_embedding(chunk) for each chunk.
    c. Call a function to manage the ChromaDB collection: chroma_client.upsert(...) passing the embeddings and original document metadata (source/page).

  Step 1.3: Chat Query Endpoint Implementation (law-maker/backend/main.py)

  - Goal: Implement the full RAG query cycle for the /chat endpoint.
  - Steps:
    a. Receive user query.
    b. Call llm_manager.get_embedding(query) to get the vector embedding of the query.
    c. Use this query embedding to search ChromaDB: chroma_client.query(...) to retrieve the top $K$ (e.g., 5) relevant document chunks (the context).
    d. Construct a detailed, authoritative system prompt instructing the LLM to use only the provided context and citing sources if possible.
    e. Call llm_manager.generate_response(context, query) to get the final answer text.

  Phase 2: Frontend Integration (The Client)

  The goal is to update the user interface logic in law-maker/frontend to use these live services and manage asynchronous states correctly.

  Step 2.1: API Service Layer Update

  - Task: Isolate all backend interaction into a service layer (e.g., within the frontend project structure).
  - Details: Create two core functions: uploadDocuments(files) and getChatResponse(message). These functions must handle request bodies, streaming responses
  (if possible), error handling, and API key management implicitly via the backend's deployment credentials.

  Step 2.2: UI Component Logic Update (app/page.tsx)

  - Task: Refactor the component state machine to accommodate the asynchronous nature of RAG queries.
  - Details:
    a. The Upload section must show a clear Processing State with an estimated time or progress indication while waiting for chunking and indexing confirmation
  from the backend.
    b. The Chat area needs optimized feedback: A "Searching knowledge base..." state before fetching, and a clean display of the final answer source(s)
  alongside the generated text.
