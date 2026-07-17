import timeit
import json

setup = """
# Simulate available slots
available_slots = [{"datetime": f"2023-10-01T10:{i:02d}:00", "display": "something"} for i in range(500)]
selected_datetime_str = "2023-10-01T10:499:00"  # Worst case / Not found
"""

stmt1 = """
any(slot["datetime"] == selected_datetime_str for slot in available_slots)
"""

stmt2 = """
valid_datetimes = {slot["datetime"] for slot in available_slots}
selected_datetime_str in valid_datetimes
"""

print("Benchmarking Generator vs Set Comprehension...")

time_any = timeit.timeit(stmt1, setup=setup, number=10000)
time_set = timeit.timeit(stmt2, setup=setup, number=10000)

print(f"Original (any + generator): {time_any:.4f}s")
print(f"Optimized (set comprehension): {time_set:.4f}s")
print(f"Improvement: {(time_any - time_set) / time_any * 100:.2f}%")
