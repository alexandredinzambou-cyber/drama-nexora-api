FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY reelshort.py ./

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "gunicorn reelshort:app --bind 0.0.0.0:${PORT:-5002}"]