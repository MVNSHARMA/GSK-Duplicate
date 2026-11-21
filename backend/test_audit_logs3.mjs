const run = async () => {
    try {
        const loginRes = await fetch("http://localhost:5005/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@gsk.com", password: "password123" })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log("Token:", token ? "Found" : "Missing");

        const auditRes = await fetch("http://localhost:5005/api/admins/audit-logs?page=1&limit=25", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const auditData = await auditRes.json();
        console.log("Audit Status:", auditRes.status);
        console.log("Audit Data:", JSON.stringify(auditData).substring(0, 500));
    } catch (e) {
        console.error(e);
    }
}
run();
