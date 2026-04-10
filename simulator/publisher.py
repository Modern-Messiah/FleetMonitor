from __future__ import annotations

import json
from typing import Any, Dict

import pika


class RabbitPublisher:
    def __init__(self, rabbitmq_url: str) -> None:
        self.rabbitmq_url = rabbitmq_url
        self.connection = None
        self.channel = None

    def connect(self) -> None:
        parameters = pika.URLParameters(self.rabbitmq_url)
        self.connection = pika.BlockingConnection(parameters)
        self.channel = self.connection.channel()
        self.channel.exchange_declare(exchange="fleet", exchange_type="topic", durable=True)

    def publish(self, routing_key: str, payload: Dict[str, Any]) -> None:
        if self.channel is None or self.channel.is_closed:
            self.connect()

        assert self.channel is not None
        self.channel.basic_publish(
            exchange="fleet",
            routing_key=routing_key,
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2),
        )

    def close(self) -> None:
        if self.connection and self.connection.is_open:
            self.connection.close()
