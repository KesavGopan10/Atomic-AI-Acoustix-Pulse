FROM python:3.11-slim

# libsndfile and ffmpeg are required for audio processing/conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching)
COPY pyproject.toml .
RUN pip install --no-cache-dir \
    fastapi \
    "uvicorn[standard]" \
    librosa \
    numpy \
    pandas \
    scikit-learn \
    joblib \
    python-multipart \
    groq \
    pydantic-settings \
    pydub

# Copy source, model, and dashboard
COPY main.py model_utils.py respiratory_classifier.pkl  ./
COPY app/ ./app/
COPY static/ ./static/

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
