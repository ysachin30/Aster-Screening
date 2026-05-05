FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    portaudio19-dev \
    libasound-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY agent.py .
COPY .env.example .env

# Expose health check port (Railway uses PORT env var)
ENV PORT=8080
EXPOSE 8080

# Run the agent (production mode, not dev)
CMD ["python", "agent.py"]
