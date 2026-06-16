# syntax=docker/dockerfile:1

FROM python:3.12-alpine AS builder
WORKDIR /app
RUN apk add --no-cache gcc musl-dev libffi-dev
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.12-alpine
WORKDIR /app
RUN apk add --no-cache curl && \
    adduser -D -u 10001 appuser
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY main.py .
ENV PYTHONUNBUFFERED=1
EXPOSE 9000
USER appuser
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]

