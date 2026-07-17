from __future__ import annotations

import logging

import pytest

from app.core.logging_config import get_logger


@pytest.mark.unit
def test_context_logger_accepts_positional_args_and_exc_info(caplog: pytest.LogCaptureFixture) -> None:
    logger = get_logger("tests.context_logger", component="lifespan")

    with caplog.at_level(logging.WARNING):
        try:
            raise RuntimeError("transient database timeout")
        except RuntimeError:
            logger.warning(
                "Database init attempt %s/%s failed. Retrying in %.1fs...",
                1,
                5,
                2.0,
                exc_info=True,
                retry_delay=2.0,
            )

    matching_records = [
        record
        for record in caplog.records
        if "Database init attempt 1/5 failed. Retrying in 2.0s..." in record.getMessage()
    ]
    assert matching_records, "Expected startup retry warning to be logged"

    record = matching_records[0]
    assert getattr(record, "component", None) == "lifespan"
    assert getattr(record, "retry_delay", None) == 2.0
    assert record.exc_info is not None
