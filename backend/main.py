"""
Batwa — FastAPI Application Entry Point
Initializes the database, registers all routes, and configures CORS.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import init_db

# Route modules
from routes.customers import router as customers_router
from routes.wallet import router as wallet_router
from routes.cards import router as cards_router
from routes.transactions import router as transactions_router
from routes.admin import router as admin_router


# ---------------------------------------------------------------------------
# Lifespan: run setup on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    init_db()
    print("[OK] Database initialized -- tables created (if not already present)")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Batwa API",
    description="Non-mobile digital payment system — Cognizant NPN Nurture Program",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins during development so the frontend team isn't blocked
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(customers_router)
app.include_router(wallet_router)
app.include_router(cards_router)
app.include_router(transactions_router)
app.include_router(admin_router)


# Health check
@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Batwa API", "version": "1.0.0"}


# ---------------------------------------------------------------------------
# Run with: uvicorn main:app --reload
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
