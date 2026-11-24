"""Benchmark reproduzível: Processamento Sequencial vs Paralelo (ProcessPoolExecutor).

Executa duas baterias reais e independentes:
1. Algoritmo isolado (`engine.py`): mede apenas o custo computacional (compute_ms)
   para o catálogo original (real/local) e catálogos sintéticos determinísticos
   (seed=42) de tamanhos crescentes (N=200, 500, 1000, 2000), com 1, 2, 4 e 8 processos.
2. Comunicação HTTP distribuída (quando os serviços estão ativos em :3001 e :3002):
   mede separadamente latência HTTP total, tempo de fetch HTTP do catálogo
   (`catalog_fetch_ms`) e tempo de processamento algorítmico (`compute_ms`).

Uso:
  .venv/Scripts/python.exe benchmarks/benchmark_recommendations.py
  .venv/Scripts/python.exe benchmarks/benchmark_recommendations.py --with-http
"""

from __future__ import annotations

import argparse
import csv
import ctypes
import json
import os
import platform
import statistics
import subprocess
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parent.parent
REC_SERVICE_DIR = REPO_ROOT / "services" / "recommendation-service"
CAT_DATA_FILE = REPO_ROOT / "services" / "catalog-service" / "data" / "catalogo.json"
RESULTS_DIR = Path(__file__).resolve().parent / "results"

if str(REC_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(REC_SERVICE_DIR))

from app.engine import (  # noqa: E402
    compute_batch_digest,
    recommend_batch_parallel,
    recommend_batch_sequential,
)
from app.synthetic import expand_catalog_deterministically  # noqa: E402


def _get_windows_ram_gb() -> float | None:
    if platform.system() != "Windows":
        return None

    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    stat = MEMORYSTATUSEX()
    stat.dwLength = ctypes.sizeof(stat)
    if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
        return round(stat.ullTotalPhys / (1024**3), 2)
    return None


def _get_cpu_brand() -> str:
    if platform.system() == "Windows":
        try:
            out = subprocess.check_output(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "(Get-CimInstance Win32_Processor | Select-Object -First 1).Name",
                ],
                text=True,
                timeout=5,
            ).strip()
            if out:
                return out
        except Exception:
            pass
    return platform.processor() or "Desconhecido"


def _get_physical_cores() -> int | None:
    if platform.system() == "Windows":
        try:
            out = subprocess.check_output(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "(Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum).Sum",
                ],
                text=True,
                timeout=5,
            ).strip()
            if out.isdigit():
                return int(out)
        except Exception:
            pass
    return None


def collect_machine_specs() -> dict[str, Any]:
    return {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "os": platform.platform(),
        "architecture": platform.machine(),
        "cpu_model": _get_cpu_brand(),
        "physical_cores": _get_physical_cores(),
        "logical_cores": os.cpu_count(),
        "ram_gb": _get_windows_ram_gb(),
        "python_version": platform.python_version(),
        "multiprocessing_start_method": "spawn" if platform.system() == "Windows" else "fork",
    }


def load_base_catalog(catalog_url: str) -> tuple[list[dict[str, Any]], list[list[str]], str]:
    try:
        with httpx.Client(timeout=5.0) as client:
            p_resp = client.get(f"{catalog_url}/api/v1/produtos?limit=2000")
            c_resp = client.get(f"{catalog_url}/api/v1/cestas")
            if p_resp.status_code == 200 and c_resp.status_code == 200:
                p_json = p_resp.json()
                c_json = c_resp.json()
                return (
                    p_json["dados"],
                    c_json["cestas"],
                    f"http_catalog_service ({p_json.get('dataSource', 'unknown')})",
                )
    except Exception:
        pass

    local_payload = json.loads(CAT_DATA_FILE.read_text(encoding="utf-8"))
    return local_payload["produtos"], local_payload["cestas"], "local_json_fallback"


def verify_digest(expected: str | None, actual: str, context: str) -> str:
    if not actual or (expected is not None and actual != expected):
        raise AssertionError(f"Digest divergente em {context}: esperado {expected}, recebido {actual}")
    return actual


def run_algorithmic_benchmark(
    base_produtos: list[dict[str, Any]],
    base_cestas: list[list[str]],
    base_source: str,
    repeats: int = 5,
    warmups: int = 1,
) -> list[dict[str, Any]]:
    cpu_limit = os.cpu_count() or 2
    worker_counts = [w for w in (1, 2, 4, 8) if w <= cpu_limit]
    if 1 not in worker_counts:
        worker_counts.insert(0, 1)

    scenarios: list[tuple[str, bool, list[dict[str, Any]], list[list[str]]]] = [
        (f"original_n{len(base_produtos)}", False, base_produtos, base_cestas),
    ]
    for size in (200, 500, 1000, 2000):
        syn_p, syn_c = expand_catalog_deterministically(
            base_produtos, base_cestas, target_size=size, seed=42
        )
        scenarios.append((f"synthetic_n{size}", True, syn_p, syn_c))

    rows: list[dict[str, Any]] = []

    # Mantemos um pool por worker_count fora do loop de medição para medir
    # paralelismo de execução (e não o spawn repetido do Python no Windows),
    # exatamente como o serviço FastAPI mantém no lifespan.
    pools: dict[int, ProcessPoolExecutor] = {
        w: ProcessPoolExecutor(max_workers=w) for w in worker_counts if w > 1
    }

    try:
        # Pré-aquece os processos do pool uma vez antes da bateria
        for w, pool in pools.items():
            _ = recommend_batch_parallel(
                base_produtos, base_cestas, pool, workers=w, limite=4
            )

        for dataset_label, is_synthetic, produtos, cestas in scenarios:
            n_items = len(produtos)
            baseline_mean_ms: float | None = None
            baseline_digest: str | None = None

            print(
                f"\n[Algoritmo] Cenário {dataset_label} (N={n_items}, sintético={is_synthetic})"
            )

            for workers in worker_counts:
                mode = "sequential" if workers == 1 else "parallel"

                timings_ms: list[float] = []
                for sample in range(warmups + repeats):
                    t0 = time.perf_counter()
                    if workers == 1:
                        res = recommend_batch_sequential(produtos, cestas, limite=4)
                    else:
                        res = recommend_batch_parallel(
                            produtos, cestas, pools[workers], workers=workers, limite=4
                        )
                    elapsed_ms = (time.perf_counter() - t0) * 1000
                    baseline_digest = verify_digest(
                        baseline_digest, compute_batch_digest(res),
                        f"{dataset_label}, workers={workers}, amostra {sample + 1}",
                    )
                    if sample >= warmups:
                        timings_ms.append(elapsed_ms)

                mean_ms = statistics.mean(timings_ms)
                median_ms = statistics.median(timings_ms)
                stddev_ms = statistics.stdev(timings_ms) if len(timings_ms) > 1 else 0.0
                throughput = (n_items / (mean_ms / 1000.0)) if mean_ms > 0 else 0.0

                if baseline_mean_ms is None:
                    baseline_mean_ms = mean_ms

                speedup = baseline_mean_ms / mean_ms if mean_ms > 0 else 0.0
                efficiency = (speedup / workers) if workers > 0 else 0.0

                row = {
                    "dataset": dataset_label,
                    "is_synthetic": is_synthetic,
                    "data_source": base_source if not is_synthetic else f"synthetic_seed42_from_{base_source}",
                    "catalog_size": n_items,
                    "mode": mode,
                    "workers": workers,
                    "warmups": warmups,
                    "repeats": repeats,
                    "mean_ms": round(mean_ms, 3),
                    "median_ms": round(median_ms, 3),
                    "stddev_ms": round(stddev_ms, 3),
                    "min_ms": round(min(timings_ms), 3),
                    "max_ms": round(max(timings_ms), 3),
                    "throughput_items_per_sec": round(throughput, 2),
                    "speedup": round(speedup, 4),
                    "efficiency": round(efficiency, 4),
                    "equivalent_to_sequential": True,
                    "result_digest": baseline_digest[:16],
                }
                rows.append(row)
                print(
                    f"  workers={workers} ({mode:10s}) | mean={row['mean_ms']:8.3f} ms | "
                    f"median={row['median_ms']:8.3f} ms | std={row['stddev_ms']:6.3f} ms | "
                    f"speedup={row['speedup']:5.2f}x | eff={row['efficiency']*100:5.1f}% | eq={row['equivalent_to_sequential']}"
                )
    finally:
        for pool in pools.values():
            pool.shutdown(wait=True)

    return rows


def run_http_e2e_benchmark(
    catalog_url: str,
    rec_url: str,
    repeats: int = 5,
    warmups: int = 1,
) -> dict[str, Any]:
    cpu_limit = os.cpu_count() or 2
    worker_counts = [w for w in (1, 2, 4, 8) if w <= cpu_limit]

    gateway_rows: list[dict[str, Any]] = []
    batch_http_rows: list[dict[str, Any]] = []

    with httpx.Client(timeout=60.0) as client:
        # 1. Gateway distribuído (Frontend -> Catalog :3001 -> Recommendation :3002 -> Catalog :3001)
        print("\n[HTTP E2E] Gateway GET /api/v1/produtos/p01/recomendacoes")
        baseline_total: float | None = None
        baseline_ids: list[str] | None = None
        for workers in worker_counts:
            mode = "sequential" if workers == 1 else "parallel"
            url = f"{catalog_url}/api/v1/produtos/p01/recomendacoes?limit=4&mode={mode}&workers={workers}"

            for _ in range(warmups):
                r = client.get(url)
                r.raise_for_status()

            http_totals: list[float] = []
            compute_times: list[float] = []
            fetch_times: list[float] = []
            gateway_times: list[float] = []
            last_ids: list[str] = []
            last_source = ""
            last_size = 0

            for _ in range(repeats):
                t0 = time.perf_counter()
                r = client.get(url)
                client_ms = (time.perf_counter() - t0) * 1000
                r.raise_for_status()
                body = r.json()
                m = body["metrics"]
                http_totals.append(client_ms)
                compute_times.append(float(m["computeMs"]))
                fetch_times.append(float(m["catalogFetchMs"]))
                gateway_times.append(float(m["gatewayHttpMs"]))
                last_ids = [it["id"] for it in body["items"]]
                last_source = m["dataSource"]
                last_size = int(m["catalogSize"])

            if baseline_ids is None:
                baseline_ids = last_ids
            mean_total = statistics.mean(http_totals)
            if baseline_total is None:
                baseline_total = mean_total

            row = {
                "endpoint": "/api/v1/produtos/p01/recomendacoes",
                "mode": mode,
                "workers": workers,
                "catalog_size": last_size,
                "data_source": last_source,
                "is_synthetic": False,
                "client_total_mean_ms": round(mean_total, 3),
                "client_total_median_ms": round(statistics.median(http_totals), 3),
                "client_total_stddev_ms": round(statistics.stdev(http_totals), 3),
                "gateway_http_mean_ms": round(statistics.mean(gateway_times), 3),
                "catalog_fetch_mean_ms": round(statistics.mean(fetch_times), 3),
                "compute_mean_ms": round(statistics.mean(compute_times), 3),
                "equivalent_ids": last_ids == baseline_ids,
                "recommended_ids": last_ids,
            }
            gateway_rows.append(row)
            print(
                f"  workers={workers} ({mode:10s}) | e2e={row['client_total_mean_ms']:7.3f} ms | "
                f"fetch={row['catalog_fetch_mean_ms']:6.3f} ms | compute={row['compute_mean_ms']:6.3f} ms | eq={row['equivalent_ids']}"
            )

        # 2. Batch distribuído via HTTP (Recommendation Service :3002 buscando catálogo via HTTP do :3001)
        print("\n[HTTP E2E] Recommendation Service POST /recommendations/batch")
        for syn_size in (None, 500, 1000):
            label = "original" if syn_size is None else f"synthetic_n{syn_size}"
            baseline_compute: float | None = None
            baseline_digest: str | None = None
            baseline_input: str | None = None

            for workers in worker_counts:
                mode = "sequential" if workers == 1 else "parallel"
                payload: dict[str, Any] = {"mode": mode, "workers": workers, "limit": 4}
                if syn_size is not None:
                    payload["synthetic_size"] = syn_size

                e2e_times: list[float] = []
                fetch_times: list[float] = []
                compute_times: list[float] = []
                last_size = 0
                last_source = ""

                for sample in range(warmups + repeats):
                    t0 = time.perf_counter()
                    r = client.post(f"{rec_url}/recommendations/batch", json=payload)
                    e2e_ms = (time.perf_counter() - t0) * 1000
                    r.raise_for_status()
                    body = r.json()
                    m = body["metrics"]
                    context = f"{label}, workers={workers}, amostra {sample + 1}"
                    baseline_input = verify_digest(baseline_input, body["input_digest"], f"carga {context}")
                    baseline_digest = verify_digest(baseline_digest, body["result_digest"], f"resultado {context}")
                    if sample < warmups:
                        continue
                    e2e_times.append(e2e_ms)
                    fetch_times.append(float(m["catalog_fetch_ms"]))
                    compute_times.append(float(m["compute_ms"]))
                    last_size = int(m["catalog_size"])
                    last_source = m["data_source"]

                mean_comp = statistics.mean(compute_times)
                if baseline_compute is None:
                    baseline_compute = mean_comp
                speedup_comp = baseline_compute / mean_comp if mean_comp > 0 else 0.0

                row = {
                    "dataset": label,
                    "is_synthetic": syn_size is not None,
                    "data_source": last_source,
                    "catalog_size": last_size,
                    "mode": mode,
                    "workers": workers,
                    "http_total_mean_ms": round(statistics.mean(e2e_times), 3),
                    "http_total_median_ms": round(statistics.median(e2e_times), 3),
                    "catalog_fetch_mean_ms": round(statistics.mean(fetch_times), 3),
                    "compute_mean_ms": round(mean_comp, 3),
                    "compute_median_ms": round(statistics.median(compute_times), 3),
                    "compute_stddev_ms": round(statistics.stdev(compute_times), 3),
                    "compute_speedup": round(speedup_comp, 4),
                    "compute_efficiency": round(speedup_comp / workers, 4),
                    "equivalent_to_sequential": True,
                    "result_digest": baseline_digest[:16],
                }
                batch_http_rows.append(row)
                print(
                    f"  [{label:14s}] workers={workers} | http_total={row['http_total_mean_ms']:8.3f} ms | "
                    f"fetch={row['catalog_fetch_mean_ms']:6.3f} ms | compute={row['compute_mean_ms']:8.3f} ms | "
                    f"speedup_compute={row['compute_speedup']:5.2f}x | eq={row['equivalent_to_sequential']}"
                )

    return {
        "gateway_single_product": gateway_rows,
        "recommendation_batch_http": batch_http_rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark Origem FCCPD U2")
    parser.add_argument("--catalog-url", default="http://localhost:3001")
    parser.add_argument("--recommendation-url", default="http://localhost:3002")
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--warmups", type=int, default=1)
    parser.add_argument("--with-http", action="store_true")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    specs = collect_machine_specs()
    base_produtos, base_cestas, base_source = load_base_catalog(args.catalog_url)

    print("=== Especificações da Máquina ===")
    for k, v in specs.items():
        print(f"  {k}: {v}")
    print(f"  base_catalog_source: {base_source} ({len(base_produtos)} peças)")

    algo_rows = run_algorithmic_benchmark(
        base_produtos=base_produtos,
        base_cestas=base_cestas,
        base_source=base_source,
        repeats=args.repeats,
        warmups=args.warmups,
    )

    json_out = RESULTS_DIR / "benchmark_results.json"
    json_out.write_text(
        json.dumps({"machine": specs, "results": algo_rows}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    csv_out = RESULTS_DIR / "benchmark_results.csv"
    with csv_out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(algo_rows[0].keys()))
        writer.writeheader()
        writer.writerows(algo_rows)

    if args.with_http:
        http_results = run_http_e2e_benchmark(
            catalog_url=args.catalog_url,
            rec_url=args.recommendation_url,
            repeats=args.repeats,
            warmups=args.warmups,
        )
        http_out = RESULTS_DIR / "http_e2e_results.json"
        http_out.write_text(
            json.dumps({"machine": specs, **http_results}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    print(f"\nResultados salvos em {RESULTS_DIR}")


if __name__ == "__main__":
    main()
