import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from services.analytics_reader import AnalyticsArtifactsNotFound, load_analytics


def _write_outputs(root: Path) -> None:
    outputs = root / "outputs"
    outputs.mkdir(parents=True)
    (outputs / "kpis_overview.csv").write_text(
        "cash_digitized,payments_received,txn_count,success_count,failed_count,"
        "active_customers,active_cards,blocked_cards,first_txn_date,last_txn_date\n"
        "4915.0,3060.0,180,132,48,5,5,2,2026-08-19,2026-09-02\n",
        encoding="utf-8",
    )
    (outputs / "daily_volume.csv").write_text(
        "date_key,type,status,txn_count,amount_total\n"
        "2026-08-19,TOPUP,SUCCESS,1,63.0\n"
        "2026-08-19,PAYMENT,FAILED,4,345.0\n",
        encoding="utf-8",
    )
    (outputs / "failure_by_reason.csv").write_text(
        "failure_reason,attempts,pct_of_failures\n"
        "WRONG_PIN,13,27.08\n",
        encoding="utf-8",
    )
    (outputs / "top_merchants.csv").write_text(
        "merchant_name,payments,total_received\n"
        "Sharma Kirana,6,410.0\n",
        encoding="utf-8",
    )
    (outputs / "run_status.json").write_text(
        json.dumps({
            "run_id": "run_test", "source": "demo", "ran_at": "2026-09-02T13:01:12+00:00",
            "quality_checks": {"passed": 7, "total": 7, "ok": True},
        }),
        encoding="utf-8",
    )


class AnalyticsReaderTests(unittest.TestCase):
    def test_load_analytics_parses_all_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_outputs(root)
            with patch.dict("os.environ", {"BATWA_ANALYTICS_OUTPUTS": str(root / "outputs")}, clear=False):
                payload = load_analytics()

        self.assertEqual(payload["kpis"]["txn_count"], 180)
        self.assertEqual(payload["kpis"]["first_txn_date"], "2026-08-19")
        self.assertEqual(len(payload["daily_volume"]), 2)
        self.assertEqual(payload["daily_volume"][0]["type"], "TOPUP")
        self.assertEqual(payload["failure_by_reason"][0]["attempts"], 13)
        self.assertEqual(payload["top_merchants"][0]["merchant_name"], "Sharma Kirana")
        self.assertEqual(payload["run_status"]["quality_checks"]["passed"], 7)

    def test_missing_directory_raises_friendly_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.dict("os.environ", {"BATWA_ANALYTICS_OUTPUTS": str(Path(tmp) / "nope")}, clear=False):
                with self.assertRaises(AnalyticsArtifactsNotFound):
                    load_analytics()

    def test_top_merchants_and_run_status_are_optional(self):
        with tempfile.TemporaryDirectory() as tmp:
            outputs = Path(tmp) / "outputs"
            outputs.mkdir()
            (outputs / "kpis_overview.csv").write_text(
                "cash_digitized,payments_received,txn_count,success_count,failed_count,"
                "active_customers,active_cards,blocked_cards,first_txn_date,last_txn_date\n"
                "10.0,5.0,2,2,0,1,1,0,2026-09-01,2026-09-01\n",
                encoding="utf-8",
            )
            (outputs / "daily_volume.csv").write_text("date_key,type,status,txn_count,amount_total\n", encoding="utf-8")
            (outputs / "failure_by_reason.csv").write_text("failure_reason,attempts,pct_of_failures\n", encoding="utf-8")
            with patch.dict("os.environ", {"BATWA_ANALYTICS_OUTPUTS": str(outputs)}, clear=False):
                payload = load_analytics()

        self.assertEqual(payload["top_merchants"], [])
        self.assertIsNone(payload["run_status"])


if __name__ == "__main__":
    unittest.main()
