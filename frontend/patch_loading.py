import re

with open('src/pages/admin/TrackerDetail.jsx', 'r') as f:
    content = f.read()

# 1. Add carsLoading state
content = re.sub(
    r"  const \[loading, setLoading\] = useState\(true\);",
    r"  const [loading, setLoading] = useState(true);\n  const [carsLoading, setCarsLoading] = useState(true);",
    content
)

# 2. Modify fetchCars to use carsLoading
fetch_cars_old = """    try {
      setLoading(true);"""
fetch_cars_new = """    try {
      setCarsLoading(true);"""
content = content.replace(fetch_cars_old, fetch_cars_new)

fetch_cars_old2 = """      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tracker cars:', error);
      setLoading(false);
    }"""
fetch_cars_new2 = """      }
      setCarsLoading(false);
    } catch (error) {
      console.error('Error fetching tracker cars:', error);
      setCarsLoading(false);
    }"""
content = content.replace(fetch_cars_old2, fetch_cars_new2)

# 3. Modify fetchTracker to setLoading(false) once done
fetch_tracker_old = """      if (data.success) {
        setTracker(data.data);
        fetchTemplates(data.data.customerId?._id);
      }
    } catch (error) {
      console.error('Error fetching tracker details:', error);
    }
  }, [id]);"""
fetch_tracker_new = """      if (data.success) {
        setTracker(data.data);
        fetchTemplates(data.data.customerId?._id);
      }
    } catch (error) {
      console.error('Error fetching tracker details:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);"""
content = content.replace(fetch_tracker_old, fetch_tracker_new)

# 4. Modify empty state to use carsLoading
content = content.replace("!loading && cars.length === 0", "!carsLoading && cars.length === 0")

with open('src/pages/admin/TrackerDetail.jsx', 'w') as f:
    f.write(content)
print("Patch applied for loading state.")
