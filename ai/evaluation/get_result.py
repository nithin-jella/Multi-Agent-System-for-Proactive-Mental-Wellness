import httpx
import json
import csv
import time


API_URL = "http://localhost:8080/api/v1/retrieval/get-answer"
METHODS = [
      'semantic_neighbor',
      'semantic_shortest_path',
      'entity_neighbor',
      'entity_shortest_path',
]


with open("evaluation_dataset.jsonl", "r", encoding="utf-8") as f:
    test_cases = [json.loads(line) for line in f]

results = []

for case in test_cases:
    query = case["query"]
    expected = case["expected_answer"]

    print(f"\n🔍 Evaluating Query: {query}")

    for method in METHODS:
        payload = {
            "query": query,
            "method": method,
            "max_hop": 10, 
            "limit": 50, 
            "top_k": 10
        }

        try:
            start_time = time.time()
            response = httpx.post(API_URL, json=payload, timeout=60.0)
            end_time = time.time()
            response.raise_for_status()

            elapsed_time = end_time - start_time
            answer = response.json()["data"]["answer"]


            results.append({
                "query": query,
                "method": method,
                "expected": expected,
                "actual": answer,
                "latency_seconds": round(elapsed_time, 3)
            })

        except Exception as e:
            print(f"  ❌ Error for method {method}: {e}")
            results.append({
                "query": query,
                "method": method,
                "expected": expected,
                "actual": f"Error: {e}",
                "latency_seconds": -1
            })

# Save results to CSV
csv_filename = "evaluation_results.csv"
with open(csv_filename, mode="w", newline="", encoding="utf-8") as csvfile:
    fieldnames = ["query", "method", "score", "expected", "actual", "latency_seconds"]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

    writer.writeheader()
    for row in results:
        writer.writerow(row)

print(f"\n✅ Results saved to {csv_filename}")
