FROM python:3.11-slim

WORKDIR /app

COPY simulator/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY simulator .

CMD ["python", "main.py"]
