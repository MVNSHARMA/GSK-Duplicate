TOKEN=$(curl -s -X POST http://127.0.0.1:5005/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@gsk.com","password":"password123"}' | jq -r .token)
echo "Token: $TOKEN"
curl -s -X GET "http://127.0.0.1:5005/api/invoices?page=1&limit=15" -H "Authorization: Bearer $TOKEN" | jq .
