import timeit
import json

setup = """
# Simulate what we have in code
available_slots = [{"datetime": f"2023-10-01T10:{i:02d}:00", "display": "something"} for i in range(1000)]
selected_datetime_str = "2023-10-01T10:999:00"  # Not found, worst case
"""

stmt1 = """
any(slot["datetime"] == selected_datetime_str for slot in available_slots)
"""

stmt2 = """
valid_datetimes = {slot["datetime"] for slot in available_slots}
selected_datetime_str in valid_datetimes
"""

print("Worst-case (not found):")
print("any:", timeit.timeit(stmt1, setup=setup, number=10000))
print("set:", timeit.timeit(stmt2, setup=setup, number=10000))

setup2 = """
available_slots = [{"datetime": f"2023-10-01T10:{i:02d}:00", "display": "something"} for i in range(1000)]
selected_datetime_str = "2023-10-01T10:500:00"  # Middle
"""

print("\nMiddle-case:")
print("any:", timeit.timeit(stmt1, setup=setup2, number=10000))
print("set:", timeit.timeit(stmt2, setup=setup2, number=10000))
