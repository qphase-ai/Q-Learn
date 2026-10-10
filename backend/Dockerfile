FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .
# Bake the embedding model weights into the image so prod never downloads them
# on the first request.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
# From here on the weights come from the baked cache only: no Hub lookups at
# runtime (startup can't hang on, or fail because of, the network).
ENV HF_HUB_OFFLINE=1

COPY . .

EXPOSE 8000

# Shell form so $PORT (set by the host, e.g. Render) is honored; defaults to 8000
# locally. docker-compose overrides this command for dev.
# Run pending Alembic migrations on boot so schema + seed data (e.g. the
# curriculum) are always applied before the API serves — the image previously
# started uvicorn without migrating, leaving new migrations unapplied in prod.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
