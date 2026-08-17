from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from database import init_db
from endpoints import router


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI(title="Law Maker Backend", version="0.2.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
	return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
	init_db()


app.include_router(router)

